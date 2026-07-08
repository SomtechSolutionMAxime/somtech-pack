#!/usr/bin/env python3
"""Tests du client de lecture Graphiti (T-20260708-0007, EF-EPI-005).

Stdlib pure (unittest + unittest.mock). Le HTTP est mocké via `patch.object` sur
`_do_request` — aucun appel réseau réel. L'environnement est scoppé par
`patch.dict` (pas de mutation globale d'os.environ qui fuirait entre tests).

Chaque test cible un G/W/T de la story et chercherait un vrai défaut :
scoping group_id perdu, secret fuité, crash sur réponse invalide, healthcheck
qui ment. Lancer :  python3 graphiti_search_test.py
"""
import json
import unittest
import urllib.error
from unittest import mock

import graphiti_search as gs

SECRET = "sk-test-INFRA-SECRET-should-never-leak"


class _Capture:
    """Faux _do_request : mémorise la Request reçue et rend un corps canné."""

    def __init__(self, body: bytes = b'{"facts": []}'):
        self.body = body
        self.req = None
        self.calls = 0

    def __call__(self, req, timeout):
        self.calls += 1
        self.req = req
        return self.body


def _with_key(**extra):
    env = {gs.API_KEY_ENV: SECRET}
    env.update(extra)
    return mock.patch.dict(gs.os.environ, env, clear=True)


class SearchSuccessTest(unittest.TestCase):
    def test_search_scopes_to_group_id_and_sends_api_key(self):
        cap = _Capture(json.dumps({"facts": [{"fact": "DuckDB adopté sur Polaris"}]}).encode())
        with _with_key(), mock.patch.object(gs, "_do_request", cap):
            client = gs.GraphitiClient(base_url="https://graphiti.test")
            facts = client.search("qui pilote DuckDB ?", "groupe-A", max_facts=5)

        self.assertEqual(facts, [{"fact": "DuckDB adopté sur Polaris"}])
        sent = json.loads(cap.req.data.decode("utf-8"))
        self.assertEqual(sent["group_ids"], ["groupe-A"])  # borné (RA-EPI-002)
        self.assertEqual(sent["max_facts"], 5)
        self.assertEqual(cap.req.get_header("X-api-key"), SECRET)
        self.assertTrue(cap.req.full_url.endswith("/search"))

    def test_missing_facts_key_returns_empty_list(self):
        cap = _Capture(json.dumps({"other": 1}).encode())
        with _with_key(), mock.patch.object(gs, "_do_request", cap):
            self.assertEqual(gs.GraphitiClient().search("q", "g"), [])

    def test_non_dict_json_raises_clean_error_not_attributeerror(self):
        # Réponse JSON valide mais non-objet (liste) — ne doit PAS crasher en AttributeError.
        cap = _Capture(json.dumps(["oops"]).encode())
        with _with_key(), mock.patch.object(gs, "_do_request", cap):
            with self.assertRaises(gs.GraphitiError):
                gs.GraphitiClient().search("q", "g")

    def test_empty_group_id_is_rejected_without_network(self):
        cap = _Capture()
        with _with_key(), mock.patch.object(gs, "_do_request", cap):
            with self.assertRaises(gs.GraphitiConfigError):
                gs.GraphitiClient().search("q", "")
        self.assertEqual(cap.calls, 0)


class SecretHandlingTest(unittest.TestCase):
    def test_no_key_fails_before_any_network_call(self):
        cap = _Capture()
        with mock.patch.dict(gs.os.environ, {}, clear=True), mock.patch.object(gs, "_do_request", cap):
            with self.assertRaises(gs.GraphitiConfigError):
                gs.GraphitiClient().search("q", "g")
        self.assertEqual(cap.calls, 0)

    def test_http_error_does_not_leak_the_key(self):
        def boom(req, timeout):
            raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, None)

        with _with_key(), mock.patch.object(gs, "_do_request", boom):
            with self.assertRaises(gs.GraphitiHTTPError) as ctx:
                gs.GraphitiClient().search("q", "g")
        self.assertEqual(ctx.exception.status, 401)
        self.assertNotIn(SECRET, str(ctx.exception))

    def test_non_json_body_raises_clean_error(self):
        with _with_key(), mock.patch.object(gs, "_do_request", _Capture(b"<html>502</html>")):
            with self.assertRaises(gs.GraphitiError):
                gs.GraphitiClient().search("q", "g")


class HealthcheckTest(unittest.TestCase):
    def test_health_with_key_hits_authenticated_healthcheck(self):
        # Avec clé : /healthcheck + X-API-Key (vrai signal backend, passe la passerelle).
        cap = _Capture(b"ok")
        with _with_key(), mock.patch.object(gs, "_do_request", cap):
            self.assertTrue(gs.GraphitiClient(base_url="https://g.test").healthcheck())
        self.assertTrue(cap.req.full_url.endswith("/healthcheck"))
        self.assertEqual(cap.req.get_header("X-api-key"), SECRET)

    def test_health_without_key_falls_back_to_keyless_caddy_health(self):
        # Sans clé : /caddy-health (seul endpoint keyless via la passerelle Caddy).
        cap = _Capture(b"ok")
        with mock.patch.dict(gs.os.environ, {}, clear=True), mock.patch.object(gs, "_do_request", cap):
            self.assertTrue(gs.GraphitiClient(base_url="https://g.test").healthcheck())
        self.assertTrue(cap.req.full_url.endswith("/caddy-health"))
        self.assertIsNone(cap.req.get_header("X-api-key"))

    def test_health_false_on_401(self):
        def boom(req, timeout):
            raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, None)

        with _with_key(), mock.patch.object(gs, "_do_request", boom):
            self.assertFalse(gs.GraphitiClient().healthcheck())


class EnvFileTest(unittest.TestCase):
    def test_env_file_value_is_dequoted(self):
        import tempfile, os
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False, encoding="utf-8") as fh:
            fh.write(f'{gs.API_KEY_ENV}="{SECRET}"\n')  # valeur entre guillemets
            path = fh.name
        try:
            with mock.patch.dict(gs.os.environ, {gs.ENV_FILE_ENV: path}, clear=True):
                self.assertEqual(gs._resolve_api_key(), SECRET)  # guillemets retirés
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
