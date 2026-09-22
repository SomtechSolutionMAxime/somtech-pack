#!/usr/bin/env python3
"""Tests du geste d'ÉCRITURE de la mémoire épisodique (STD-045, T-20260922-0165).

Stdlib pure (unittest + unittest.mock), sur le modèle de graphiti_search_test.py.
Le HTTP est mocké via `patch.object` sur `_do_request` (aucun appel réseau réel,
aucune instance Graphiti exercée — STD-045 §2.7 : rien n'est mis en service ici),
et le délai d'extraction via `_do_sleep` (aucune vraie attente ~50s en test).

Chaque test cible une contrainte MUST/MUST NOT du standard : refus avant réseau,
forme exacte du corps posté, acceptation de tout 2xx, non-réessai sur 4xx et sur
recherche vide, vocabulaire « soumis » jamais « encodé ». Lancer :
  python3 graphiti_encode_test.py
"""
import json
import unittest
import urllib.error
from unittest import mock

import graphiti_encode as ge

SECRET = "sk-test-INFRA-SECRET-should-never-leak"
GROUP = "groupe-A"
REF = "sess-2026-09-22-abc"
AUTHOR = "Michel (agent)"
MESSAGES_ACK = b"{}"


def _facts(payload):
    return json.dumps({"facts": payload}).encode()


def _with_key(**extra):
    env = {ge.API_KEY_ENV: SECRET}
    env.update(extra)
    return mock.patch.dict(ge.os.environ, env, clear=True)


def _no_sleep():
    return mock.patch.object(ge, "_do_sleep", lambda seconds: None)


class _Capture:
    """Faux _do_request : rend les réponses cannées dans l'ordre des appels."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0
        self.requests = []

    def __call__(self, req, timeout):
        self.requests.append(req)
        idx = min(self.calls, len(self.responses) - 1)
        self.calls += 1
        resp = self.responses[idx]
        if isinstance(resp, Exception):
            raise resp
        return resp


class GroupIdRequiredTest(unittest.TestCase):
    def test_missing_group_id_fails_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id="", session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
                )
        self.assertEqual(cap.calls, 0)

    def test_missing_group_id_none_fails_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=None, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
                )
        self.assertEqual(cap.calls, 0)


class SessionRefRequiredTest(unittest.TestCase):
    def test_missing_session_ref_fails_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref="", author_label=AUTHOR, statements=["un énoncé"]
                )
        self.assertEqual(cap.calls, 0)

    def test_session_ref_with_space_is_rejected(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref="a b", author_label=AUTHOR, statements=["un énoncé"]
                )
        self.assertEqual(cap.calls, 0)

    def test_session_ref_too_long_is_rejected(self):
        cap = _Capture([MESSAGES_ACK])
        ref = "a" * 129
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref=ref, author_label=AUTHOR, statements=["un énoncé"]
                )
        self.assertEqual(cap.calls, 0)

    def test_session_ref_128_chars_is_accepted(self):
        ref = "a" * 128
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            result = ge.GraphitiEncodeClient().encode(
                group_id=GROUP, session_ref=ref, author_label=AUTHOR, statements=["un énoncé"]
            )
        self.assertTrue(result["submitted"])


class AuthorLabelRequiredTest(unittest.TestCase):
    def test_blank_author_label_is_rejected_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref=REF, author_label="   ", statements=["un énoncé"]
                )
        self.assertEqual(cap.calls, 0)


class StatementContentTest(unittest.TestCase):
    def test_blank_statement_is_rejected_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["   "]
                )
        self.assertEqual(cap.calls, 0)

    def test_one_blank_among_valid_statements_is_rejected_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP,
                    session_ref=REF,
                    author_label=AUTHOR,
                    statements=["un énoncé valide", "   "],
                )
        self.assertEqual(cap.calls, 0)


class TimestampFormatTest(unittest.TestCase):
    def test_malformed_explicit_timestamp_is_rejected_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP,
                    session_ref=REF,
                    author_label=AUTHOR,
                    statements=["un énoncé"],
                    timestamp="pas une date",
                )
        self.assertEqual(cap.calls, 0)

    def test_valid_explicit_timestamp_is_accepted(self):
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            result = ge.GraphitiEncodeClient().encode(
                group_id=GROUP,
                session_ref=REF,
                author_label=AUTHOR,
                statements=["un énoncé"],
                timestamp="2026-09-22T12:00:00Z",
            )
        self.assertTrue(result["submitted"])


class SecretHandlingTest(unittest.TestCase):
    def test_no_key_fails_before_any_network_call(self):
        cap = _Capture([MESSAGES_ACK])
        with mock.patch.dict(ge.os.environ, {}, clear=True), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
                )
        self.assertEqual(cap.calls, 0)

    def test_http_error_does_not_leak_the_key(self):
        def boom(req, timeout):
            raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, None)

        with _with_key(), mock.patch.object(ge, "_do_request", boom), _no_sleep():
            with self.assertRaises(ge.GraphitiHTTPError) as ctx:
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
                )
        self.assertNotIn(SECRET, str(ctx.exception))

    def test_env_file_value_is_dequoted(self):
        import tempfile, os

        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False, encoding="utf-8") as fh:
            fh.write(f'{ge.API_KEY_ENV}="{SECRET}"\n')
            path = fh.name
        try:
            with mock.patch.dict(ge.os.environ, {ge.ENV_FILE_ENV: path}, clear=True):
                self.assertEqual(ge._resolve_api_key(), SECRET)
        finally:
            os.unlink(path)


class StatementBoundsTest(unittest.TestCase):
    def test_zero_statements_is_rejected(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=[]
                )
        self.assertEqual(cap.calls, 0)

    def test_eleven_statements_is_rejected(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(ge.GraphitiConfigError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP,
                    session_ref=REF,
                    author_label=AUTHOR,
                    statements=[f"énoncé {i}" for i in range(11)],
                )
        self.assertEqual(cap.calls, 0)

    def test_ten_statements_is_accepted(self):
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            result = ge.GraphitiEncodeClient().encode(
                group_id=GROUP,
                session_ref=REF,
                author_label=AUTHOR,
                statements=[f"énoncé {i}" for i in range(10)],
            )
        self.assertEqual(result["message_count"], 10)


class MessageBodyTest(unittest.TestCase):
    def test_body_has_exact_shape_and_fields(self):
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            ge.GraphitiEncodeClient(base_url="https://graphiti.test").encode(
                group_id=GROUP,
                session_ref=REF,
                author_label=AUTHOR,
                statements=["Le seuil est fixé à 0,5."],
                timestamp="2026-09-22T12:00:00Z",
            )
        sent = json.loads(cap.requests[0].data.decode("utf-8"))
        self.assertEqual(set(sent.keys()), {"group_id", "messages"})
        self.assertEqual(sent["group_id"], GROUP)
        self.assertEqual(len(sent["messages"]), 1)
        msg = sent["messages"][0]
        self.assertEqual(
            set(msg.keys()),
            {"name", "role", "role_type", "content", "timestamp", "source_description"},
        )
        self.assertEqual(msg["name"], AUTHOR)
        self.assertEqual(msg["role"], AUTHOR)
        self.assertEqual(msg["role_type"], "user")
        self.assertEqual(msg["content"], "Le seuil est fixé à 0,5.")
        self.assertEqual(msg["timestamp"], "2026-09-22T12:00:00Z")
        self.assertEqual(msg["source_description"], f"session {REF}")
        self.assertTrue(cap.requests[0].full_url.endswith("/messages"))
        self.assertEqual(cap.requests[0].get_header("X-api-key"), SECRET)

    def test_source_description_matches_meeting_convention(self):
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            ge.GraphitiEncodeClient().encode(
                group_id=GROUP,
                session_ref="2026-09-22T12:00:00Z-architecture",
                author_label=AUTHOR,
                statements=["Un énoncé autoportant."],
            )
        sent = json.loads(cap.requests[0].data.decode("utf-8"))
        self.assertEqual(
            sent["messages"][0]["source_description"],
            "session 2026-09-22T12:00:00Z-architecture",
        )

    def test_default_timestamp_is_iso8601_when_not_provided(self):
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            ge.GraphitiEncodeClient().encode(
                group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
            )
        sent = json.loads(cap.requests[0].data.decode("utf-8"))
        ts = sent["messages"][0]["timestamp"]
        # Ne re-teste pas un format précis au-delà de ce que le standard exige : parseable ISO 8601.
        import datetime

        datetime.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")


class AcceptAny2xxTest(unittest.TestCase):
    def test_2xx_is_accepted_without_requiring_202(self):
        # _do_request (comportement urllib) ne lève QUE sur un statut non-2xx : un
        # 200 et un 202 empruntent donc le même chemin de succès ici.
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            result = ge.GraphitiEncodeClient().encode(
                group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
            )
        self.assertTrue(result["submitted"])


class NoRetryTest(unittest.TestCase):
    def test_4xx_on_messages_raises_without_retry(self):
        calls = {"n": 0}

        def boom(req, timeout):
            calls["n"] += 1
            raise urllib.error.HTTPError(req.full_url, 400, "Bad Request", {}, None)

        with _with_key(), mock.patch.object(ge, "_do_request", boom), _no_sleep():
            with self.assertRaises(ge.GraphitiHTTPError):
                ge.GraphitiEncodeClient().encode(
                    group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
                )
        self.assertEqual(calls["n"], 1)

    def test_empty_search_does_not_retry_messages_post(self):
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            result = ge.GraphitiEncodeClient().encode(
                group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
            )
        message_calls = [r for r in cap.requests if r.full_url.endswith("/messages")]
        search_calls = [r for r in cap.requests if r.full_url.endswith("/search")]
        self.assertEqual(len(message_calls), 1)
        self.assertEqual(len(search_calls), 1)
        self.assertFalse(result["confirmed"])
        self.assertEqual(result["facts"], [])

    def test_confirmation_search_failure_does_not_crash_or_retry_messages(self):
        def flaky(req, timeout):
            if req.full_url.endswith("/messages"):
                return MESSAGES_ACK
            raise urllib.error.HTTPError(req.full_url, 500, "Internal Error", {}, None)

        with _with_key(), mock.patch.object(ge, "_do_request", flaky), _no_sleep():
            result = ge.GraphitiEncodeClient().encode(
                group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
            )
        self.assertTrue(result["submitted"])
        self.assertFalse(result["confirmed"])


class ReportingVocabularyTest(unittest.TestCase):
    def test_result_reports_submitted_and_confirmed_never_encoded(self):
        cap = _Capture([MESSAGES_ACK, _facts([{"fact": "Le seuil EPI est fixé à 0,5."}])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            result = ge.GraphitiEncodeClient().encode(
                group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
            )
        self.assertTrue(result["submitted"])
        self.assertTrue(result["confirmed"])
        self.assertNotIn("encoded", result)
        self.assertNotIn("encodé", json.dumps(result, ensure_ascii=False))


class ExtractionDelayTest(unittest.TestCase):
    def test_sleeps_between_post_and_search_with_configured_delay(self):
        sleep_calls = []
        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), mock.patch.object(
            ge, "_do_sleep", lambda s: sleep_calls.append(s)
        ):
            ge.GraphitiEncodeClient(extraction_delay=50).encode(
                group_id=GROUP, session_ref=REF, author_label=AUTHOR, statements=["un énoncé"]
            )
        self.assertEqual(sleep_calls, [50])

    def test_default_extraction_delay_matches_std045_order_of_magnitude(self):
        self.assertEqual(ge.EXTRACTION_DELAY_SECONDS, 50)


# Pas de test automatique pour l'absence d'appel à la promotion de mémoire :
# STD-045 §5 le dit explicitement — c'est une contrainte d'ABSENCE, vérifiée par
# RELECTURE, et un grep naïf sur le nom de l'outil échouerait sur ce module même
# (qui cite ce nom en prose pour documenter l'interdit). Voir revue de ce lot.


class CliTest(unittest.TestCase):
    def test_cli_reports_soumis_not_encode_on_success(self):
        import contextlib
        import io

        cap = _Capture([MESSAGES_ACK, _facts([])])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            buf_out, buf_err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(buf_out), contextlib.redirect_stderr(buf_err):
                rc = ge._main(
                    [
                        "--group-id", GROUP,
                        "--session-ref", REF,
                        "--author-label", AUTHOR,
                        "--statement", "un énoncé",
                    ]
                )
        self.assertEqual(rc, 0)
        self.assertIn("soumis", buf_err.getvalue())
        self.assertNotIn("encodé", buf_err.getvalue())

    def test_cli_missing_group_id_exits_before_network_with_named_error(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            import contextlib
            import io

            buf_err = io.StringIO()
            with contextlib.redirect_stderr(buf_err):
                rc = ge._main(
                    ["--session-ref", REF, "--author-label", AUTHOR, "--statement", "x"]
                )
        self.assertEqual(rc, 2)
        self.assertIn("group", buf_err.getvalue().lower())
        self.assertEqual(cap.calls, 0)

    def test_cli_missing_author_label_fails_via_argparse_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(SystemExit):
                ge._main(["--group-id", GROUP, "--session-ref", REF, "--statement", "x"])
        self.assertEqual(cap.calls, 0)

    def test_cli_missing_statement_fails_via_argparse_before_network(self):
        cap = _Capture([MESSAGES_ACK])
        with _with_key(), mock.patch.object(ge, "_do_request", cap), _no_sleep():
            with self.assertRaises(SystemExit):
                ge._main(["--group-id", GROUP, "--session-ref", REF, "--author-label", AUTHOR])
        self.assertEqual(cap.calls, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
