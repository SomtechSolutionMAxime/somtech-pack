#!/usr/bin/env python3
"""Capacité d'ÉCRITURE de la mémoire épisodique Graphiti (STD-045, EF-EPI-004).

Moteur POSSÉDÉ par le geste de fonction `/episodique` (STD-039 I2 : la fonction
possède son moteur, lecture et écriture au même endroit nommé), colocalisé avec
le moteur de LECTURE `graphiti_search.py`.

Encode des ÉNONCÉS saillants d'une session de travail (jamais un dialogue, jamais
le transcript — STD-045 §2.3) via `POST /messages` sur l'instance Graphiti de
Somtech, toujours bornée par `--group-id` (aucune valeur par défaut, aucun repli
sur `somtech-internal` — §2.2).

🔴 Ce que ce moteur NE fait JAMAIS (STD-045 §2.6, I7) :
  Il n'appelle et n'enchaîne SOUS AUCUNE CONDITION sur l'outil MCP `memory_promotion`.
  L'encodage reste non-opposable → non-opposable ; aucune autorité n'est franchie ici.
  Un épisode encodé par ce script NE DEVIENT JAMAIS opposable (décision de projet
  `fdba0e96`, 2026-07-28) — ni par ce script, ni par un mécanisme à venir.

🔴 Le `202` (ou tout autre 2xx) d'un `POST /messages` ne prouve rien (STD-045 §2.4) :
  Graphiti enfile l'extraction en asynchrone et répond AVANT d'avoir traité quoi que
  ce soit. Ce moteur rapporte donc « soumis », jamais « encodé » — et vérifie ensuite
  par une recherche sur le même group_id. Un résultat de recherche vide est NON
  CONCLUANT, jamais négatif (§2.4.1) : ce moteur NE RÉESSAIE JAMAIS `POST /messages`
  au seul motif qu'une recherche de confirmation est revenue vide (risque de doublons
  sans moyen de retrait, dette D5).

Conditions de mise en service (Loi 25, STD-045 §2.7) : NON REMPLIES au 2026-09-22.
Ce moteur est LIVRÉ ET TESTÉ (HTTP mocké) mais N'EST PAS mis en service et n'est
exercé contre AUCUNE instance réelle par cette livraison (dette D4 : aucune clé
Graphiti disponible depuis un poste de développement).

Sécurité du secret (règle d'or n°12 / STD-038), identique au moteur de lecture :
  La clé d'accès agent (header `X-API-Key`) est un SECRET D'INFRA, lue au runtime
  depuis l'environnement (`GRAPHITI_AGENT_API_KEY`) ou un fichier local non versionné
  pointé par `GRAPHITI_ENV_FILE`. Jamais en dur, jamais journalisée. En son absence,
  le client échoue AVANT tout appel réseau.

Stdlib pure (urllib) → aucune dépendance, tourne avec le python3 système.

CLI :
  GRAPHITI_AGENT_API_KEY=<clé> python3 graphiti_encode.py \
      --group-id <gid> --session-ref <ref> --author-label "Michel (agent)" \
      --statement "Un énoncé autoportant en français." [--statement "Un second."]
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "https://graphiti.somtech.solutions"
DEFAULT_TIMEOUT = 30
# Ordre de grandeur mesuré au POC ED4 (STD-045 §2.4) — à ne pas confondre avec le
# 1,13 s d'enfilement mesuré en ED5, qui n'est pas le délai d'extraction.
EXTRACTION_DELAY_SECONDS = 50
MIN_STATEMENTS = 1
MAX_STATEMENTS = 10
SESSION_REF_MAX_LEN = 128
API_KEY_ENV = "GRAPHITI_AGENT_API_KEY"
BASE_URL_ENV = "GRAPHITI_BASE_URL"
ENV_FILE_ENV = "GRAPHITI_ENV_FILE"


class GraphitiError(Exception):
    """Erreur générique du client (réseau, réponse illisible)."""


class GraphitiConfigError(GraphitiError):
    """Configuration ou entrée invalide (group_id, session_ref, secret, bornes) —
    levée AVANT tout appel réseau."""


class GraphitiHTTPError(GraphitiError):
    """Le serveur a répondu un statut non-2xx."""

    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(f"HTTP {status}: {message}")


def _dequote(val: str) -> str:
    """Retire une paire de guillemets englobants (les .env quotés sont courants)."""
    val = val.strip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ("\"", "'"):
        return val[1:-1]
    return val


def _load_env_file(path: str) -> None:
    """Charge un fichier KEY=VALUE non versionné dans os.environ (l'env shell a priorité)."""
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), _dequote(val))
    except OSError as exc:
        raise GraphitiConfigError(f"GRAPHITI_ENV_FILE illisible ({path})") from exc


def _maybe_api_key() -> str | None:
    """Clé d'infra si disponible (env ou GRAPHITI_ENV_FILE), sinon None. Ne lève pas."""
    env_file = os.environ.get(ENV_FILE_ENV)
    if env_file:
        try:
            _load_env_file(env_file)
        except GraphitiConfigError:
            pass
    return (os.environ.get(API_KEY_ENV) or "").strip() or None


def _resolve_api_key() -> str:
    """Récupère la clé d'infra ; lève GraphitiConfigError si absente. Jamais en dur."""
    key = _maybe_api_key()
    if not key:
        raise GraphitiConfigError(
            f"Secret d'infra absent : définir {API_KEY_ENV} (ou {ENV_FILE_ENV}). "
            "La clé Graphiti n'est jamais stockée dans le pack (STD-038)."
        )
    return key


def _do_request(req: urllib.request.Request, timeout: int) -> bytes:
    """Exécute la requête HTTP. Isolé pour être monkeypatché dans les tests."""
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _do_sleep(seconds: float) -> None:
    """Isolé pour être monkeypatché dans les tests (aucune vraie attente en test)."""
    time.sleep(seconds)


def _now_iso8601() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _build_messages(author_label: str, statements: list[str], timestamp: str, session_ref: str) -> list[dict]:
    """Forme exacte imposée par STD-045 §2.3 — celle déjà en production pour les rencontres,
    on n'en invente pas une seconde."""
    source_description = f"session {session_ref}"
    return [
        {
            "name": author_label,
            "role": author_label,
            "role_type": "user",
            "content": statement,
            "timestamp": timestamp,
            "source_description": source_description,
        }
        for statement in statements
    ]


class GraphitiEncodeClient:
    """Client d'écriture Graphiti, borné par group_id, auth par X-API-Key.

    Ne prépare et n'appelle jamais `memory_promotion` (STD-045 §2.6, I7) : le
    chemin d'écriture s'arrête au `POST /messages` et à sa vérification par
    recherche — rien de plus.
    """

    def __init__(
        self,
        base_url: str | None = None,
        timeout: int = DEFAULT_TIMEOUT,
        extraction_delay: float = EXTRACTION_DELAY_SECONDS,
    ):
        self.base_url = (base_url or os.environ.get(BASE_URL_ENV) or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.extraction_delay = extraction_delay

    def _post(self, path: str, payload: dict, parse_json: bool = True) -> dict | None:
        api_key = _resolve_api_key()  # lève GraphitiConfigError AVANT tout réseau si absent
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-API-Key": api_key,
            },
        )
        try:
            raw = _do_request(req, self.timeout)
        except urllib.error.HTTPError as exc:
            # NE JAMAIS inclure la clé ni le corps brut au-delà du strict nécessaire.
            raise GraphitiHTTPError(exc.code, exc.reason or "erreur serveur") from None
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            raise GraphitiError(f"échec réseau vers Graphiti: {exc.__class__.__name__}") from None
        if not parse_json:
            return None
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise GraphitiError("réponse Graphiti illisible (JSON attendu)") from exc

    def _validate(
        self,
        group_id: str | None,
        session_ref: str | None,
        author_label: str | None,
        statements: list[str] | None,
        timestamp: str | None,
    ) -> None:
        if not group_id:
            raise GraphitiConfigError(
                "--group-id obligatoire : aucune valeur par défaut, aucun repli sur "
                "'somtech-internal' (STD-045 §2.2)."
            )
        if not session_ref:
            raise GraphitiConfigError(
                "--session-ref obligatoire : identifiant permettant de retrouver la "
                "session (STD-045 §2.3.1)."
            )
        if any(ch.isspace() for ch in session_ref):
            raise GraphitiConfigError("--session-ref ne doit contenir aucune espace (STD-045 §2.3.1).")
        if len(session_ref) > SESSION_REF_MAX_LEN:
            raise GraphitiConfigError(
                f"--session-ref dépasse {SESSION_REF_MAX_LEN} caractères (STD-045 §2.3.1)."
            )
        if not author_label or not author_label.strip():
            raise GraphitiConfigError("--author-label obligatoire, non vide (champs name/role, STD-045 §2.3).")
        count = len(statements) if statements else 0
        if count < MIN_STATEMENTS or count > MAX_STATEMENTS:
            raise GraphitiConfigError(
                f"un encodage porte {MIN_STATEMENTS} à {MAX_STATEMENTS} énoncés "
                f"(STD-045 §2.3, anti-firehose RA-EPI-004) — reçu {count}."
            )
        if statements and any(not statement or not statement.strip() for statement in statements):
            raise GraphitiConfigError(
                "chaque --statement doit être un énoncé non vide (STD-045 §2.3 — un énoncé est autoportant)."
            )
        if timestamp is not None:
            try:
                datetime.datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%SZ")
            except ValueError as exc:
                raise GraphitiConfigError(
                    f"--timestamp doit être ISO 8601 (ex. 2026-09-22T12:00:00Z) — reçu {timestamp!r}."
                ) from exc

    def encode(
        self,
        group_id: str | None,
        session_ref: str | None,
        author_label: str | None,
        statements: list[str] | None,
        timestamp: str | None = None,
    ) -> dict:
        """Encode 1 à 10 énoncés saillants pour une session. Rapporte « soumis »,
        jamais « encodé » (STD-045 §2.4) : le POST /messages accepte tout 2xx (la
        réponse ne prouve rien), puis une recherche de confirmation est tentée sur
        le même group_id — un résultat vide est non concluant et NE DÉCLENCHE
        JAMAIS de réessai du POST (§2.4.1)."""
        self._validate(group_id, session_ref, author_label, statements, timestamp)

        ts = timestamp or _now_iso8601()
        messages = _build_messages(author_label, statements, ts, session_ref)

        # POST /messages — tout 2xx est accepté : _do_request ne lève que sur non-2xx.
        self._post("/messages", {"group_id": group_id, "messages": messages}, parse_json=False)

        _do_sleep(self.extraction_delay)

        facts: list = []
        try:
            search_data = self._post(
                "/search",
                {"query": statements[0], "group_ids": [group_id], "max_facts": MAX_STATEMENTS},
            )
            if isinstance(search_data, dict):
                found = search_data.get("facts", [])
                facts = found if isinstance(found, list) else []
        except GraphitiError:
            # La confirmation a échoué (réseau, HTTP) : le POST a déjà réussi, on ne
            # réessaie PAS et on rapporte simplement une confirmation non obtenue.
            facts = []

        return {
            "group_id": group_id,
            "session_ref": session_ref,
            "message_count": len(statements),
            "submitted": True,
            "confirmed": bool(facts),
            "facts": facts,
        }


def _main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Encodage épisodique Graphiti (écriture, borné par group_id, STD-045)."
    )
    parser.add_argument("--group-id", default=None)
    parser.add_argument("--session-ref", default=None)
    parser.add_argument("--author-label", required=True)
    parser.add_argument(
        "--statement",
        action="append",
        required=True,
        metavar="ÉNONCÉ",
        help="Énoncé autoportant (1 à 10) ; répéter l'option pour en fournir plusieurs.",
    )
    parser.add_argument("--timestamp", default=None, help="ISO 8601 ; défaut : horodatage courant UTC")
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--extraction-delay", type=float, default=None)
    args = parser.parse_args(argv)

    client = GraphitiEncodeClient(
        base_url=args.base_url,
        extraction_delay=args.extraction_delay if args.extraction_delay is not None else EXTRACTION_DELAY_SECONDS,
    )

    try:
        result = client.encode(
            group_id=args.group_id,
            session_ref=args.session_ref,
            author_label=args.author_label,
            statements=args.statement,
            timestamp=args.timestamp,
        )
    except GraphitiConfigError as exc:
        print(f"[episodique] configuration: {exc}", file=sys.stderr)
        return 2
    except GraphitiError as exc:
        print(f"[episodique] erreur: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result["confirmed"]:
        print("[episodique] soumis, confirmé par recherche", file=sys.stderr)
    else:
        print(
            "[episodique] soumis, non confirmé — recherche vide ou en attente d'extraction, "
            "aucun réessai (STD-045 §2.4.1)",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
