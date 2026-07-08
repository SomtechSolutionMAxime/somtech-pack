#!/usr/bin/env python3
"""Tests du client de lecture Graphiti (T-20260708-0007, EF-EPI-005).

Stdlib pure (unittest). Le HTTP est mocké : on remplace `_do_request` — aucun
appel réseau réel. Chaque test cible un G/W/T de la story et chercherait un vrai
défaut (scoping group_id manquant, secret fuité, crash sur réponse invalide).

Lancer :  python3 graphiti_search_test.py
"""
import json
import unittest
import urllib.error

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


class SearchSuccessTest(unittest.TestCase):
    def setUp(self):
        self.env = {gs.API_KEY_ENV: SECRET}

    def _patch(self, cap):
        self._orig_do = gs._do_request
        self._orig_env = gs.os.environ
        gs._do_request = cap
        gs.os.environ = dict(self.env)

    def tearDown(self):
        gs._do_request = self._orig_do
        gs.os.environ = self._orig_env

    def test_search_scopes_to_group_id_and_sends_api_key(self):
        cap = _Capture(json.dumps({"facts": [{"fact": "DuckDB adopté sur Polaris"}]}).encode())
        self._patch(cap)
        client = gs.GraphitiClient(base_url="https://graphiti.test")
        facts = client.search("qui pilote DuckDB ?", "groupe-A", max_facts=5)

        # G/W/T 1 : facts parsés
        self.assertEqual(facts, [{"fact": "DuckDB adopté sur Polaris"}])
        # borné à group_id (RA-EPI-002) — le défaut le plus grave serait un scoping absent/faux
        sent = json.loads(cap.req.data.decode("utf-8"))
        self.assertEqual(sent["group_ids"], ["groupe-A"])
        self.assertEqual(sent["max_facts"], 5)
        # header X-API-Key présent et exact
        self.assertEqual(cap.req.get_header("X-api-key"), SECRET)
        # cible /search
        self.assertTrue(cap.req.full_url.endswith("/search"))

    def test_missing_facts_key_returns_empty_list(self):
        cap = _Capture(json.dumps({"other": 1}).encode())
        self._patch(cap)
        client = gs.GraphitiClient()
        self.assertEqual(client.search("q", "g"), [])

    def test_empty_group_id_is_rejected_without_network(self):
        cap = _Capture()
        self._patch(cap)
        client = gs.GraphitiClient()
        with self.assertRaises(gs.GraphitiConfigError):
            client.search("q", "")
        self.assertEqual(cap.calls, 0)  # borné : aucun appel si group_id vide


class SecretHandlingTest(unittest.TestCase):
    def tearDown(self):
        gs._do_request = self._orig_do
        gs.os.environ = self._orig_env

    def _patch(self, env, cap):
        self._orig_do = gs._do_request
        self._orig_env = gs.os.environ
        gs._do_request = cap
        gs.os.environ = dict(env)

    def test_no_key_fails_before_any_network_call(self):
        cap = _Capture()
        self._patch({}, cap)  # aucune clé
        client = gs.GraphitiClient()
        with self.assertRaises(gs.GraphitiConfigError):
            client.search("q", "g")
        self.assertEqual(cap.calls, 0)  # G/W/T 2 : zéro réseau sans secret

    def test_http_error_does_not_leak_the_key(self):
        def boom(req, timeout):
            raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, None)

        self._patch({gs.API_KEY_ENV: SECRET}, boom)
        client = gs.GraphitiClient()
        with self.assertRaises(gs.GraphitiHTTPError) as ctx:
            client.search("q", "g")
        self.assertEqual(ctx.exception.status, 401)
        self.assertNotIn(SECRET, str(ctx.exception))  # G/W/T 3 : la clé ne fuite pas

    def test_non_json_body_raises_clean_error(self):
        self._patch({gs.API_KEY_ENV: SECRET}, _Capture(b"<html>502 Bad Gateway</html>"))
        client = gs.GraphitiClient()
        with self.assertRaises(gs.GraphitiError):
            client.search("q", "g")


if __name__ == "__main__":
    unittest.main(verbosity=2)
