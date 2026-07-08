#!/usr/bin/env python3
"""Capacité de LECTURE de la mémoire épisodique Graphiti (D-20260708-0002, EF-EPI-005).

Client que le skill `/rappel` appelle pour interroger EN DIRECT l'instance
Graphiti de Somtech (`graphiti.somtech.solutions`) — recherche par similarité
(`POST /search`) et santé (`GET /healthcheck`), toujours bornée par `group_id`.

Frontière D5 (RA-ROU-001 / RA-EPI-005) : l'agent interroge Graphiti directement,
JAMAIS via le SD-Graph. Ce fichier est ce pont ; il ne parle qu'à Graphiti.

Sécurité du secret (règle d'or n°12 / STD-038) :
  La clé d'accès agent (header `X-API-Key`) est un SECRET D'INFRA. Elle est lue
  au runtime depuis l'environnement (`GRAPHITI_AGENT_API_KEY`) ou un fichier
  local non versionné pointé par `GRAPHITI_ENV_FILE`. Elle n'est JAMAIS écrite
  en dur ici, jamais committée, jamais journalisée, jamais incluse dans un
  message d'erreur. En son absence, le client échoue AVANT tout appel réseau.

Stdlib pure (urllib) → aucune dépendance, tourne avec le python3 système.

CLI :
  GRAPHITI_AGENT_API_KEY=<clé> python3 graphiti_search.py \
      --group-id <gid> --query "de quoi je me rappelle ?" [--max-facts 10]
  python3 graphiti_search.py --health
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "https://graphiti.somtech.solutions"
DEFAULT_MAX_FACTS = 10
DEFAULT_TIMEOUT = 30
API_KEY_ENV = "GRAPHITI_AGENT_API_KEY"
BASE_URL_ENV = "GRAPHITI_BASE_URL"
ENV_FILE_ENV = "GRAPHITI_ENV_FILE"


class GraphitiError(Exception):
    """Erreur générique du client (réseau, réponse illisible)."""


class GraphitiConfigError(GraphitiError):
    """Configuration manquante ou invalide (ex. secret absent) — aucun appel réseau tenté."""


class GraphitiHTTPError(GraphitiError):
    """Le serveur a répondu un statut non-2xx."""

    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(f"HTTP {status}: {message}")


def _load_env_file(path: str) -> None:
    """Charge un fichier KEY=VALUE non versionné dans os.environ (l'env shell a priorité)."""
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())
    except OSError as exc:
        raise GraphitiConfigError(
            f"GRAPHITI_ENV_FILE illisible ({path})"
        ) from exc


def _resolve_api_key() -> str:
    """Récupère la clé d'infra depuis l'environnement (ou GRAPHITI_ENV_FILE). Jamais en dur."""
    env_file = os.environ.get(ENV_FILE_ENV)
    if env_file:
        _load_env_file(env_file)
    key = (os.environ.get(API_KEY_ENV) or "").strip()
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


class GraphitiClient:
    """Client de lecture Graphiti, borné par group_id, auth par X-API-Key.

    La clé est résolue paresseusement (à la première requête) : instancier le
    client ne lit pas encore le secret, ce qui rend le healthcheck public
    utilisable sans clé si besoin — mais /search l'exige.
    """

    def __init__(self, base_url: str | None = None, timeout: int = DEFAULT_TIMEOUT):
        self.base_url = (base_url or os.environ.get(BASE_URL_ENV) or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout

    def _post(self, path: str, payload: dict) -> dict:
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
            # NE JAMAIS inclure la clé ni le corps brut (peut contenir des échos) au-delà du strict nécessaire.
            raise GraphitiHTTPError(exc.code, exc.reason or "erreur serveur") from None
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            raise GraphitiError(f"échec réseau vers Graphiti: {exc.__class__.__name__}") from None
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise GraphitiError("réponse Graphiti illisible (JSON attendu)") from exc

    def search(self, query: str, group_id: str, max_facts: int = DEFAULT_MAX_FACTS) -> list[dict]:
        """Recherche par similarité bornée à UN group_id (RA-EPI-002). Retourne les facts."""
        if not group_id:
            raise GraphitiConfigError("group_id obligatoire : le rappel est toujours borné (RA-EPI-002).")
        if not query:
            raise GraphitiConfigError("query obligatoire.")
        data = self._post(
            "/search",
            {"query": query, "group_ids": [group_id], "max_facts": int(max_facts)},
        )
        facts = data.get("facts", [])
        return facts if isinstance(facts, list) else []

    def healthcheck(self) -> bool:
        """Ping /healthcheck (sans clé). True si 2xx."""
        req = urllib.request.Request(f"{self.base_url}/healthcheck", method="GET")
        try:
            _do_request(req, self.timeout)
            return True
        except (urllib.error.URLError, OSError, TimeoutError):
            return False


def _main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Rappel épisodique Graphiti (lecture, borné par group_id).")
    parser.add_argument("--group-id", help="group_id (projet/sujet) à interroger")
    parser.add_argument("--query", help="requête de rappel en langage naturel")
    parser.add_argument("--max-facts", type=int, default=DEFAULT_MAX_FACTS)
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--health", action="store_true", help="ping /healthcheck puis quitter")
    args = parser.parse_args(argv)

    client = GraphitiClient(base_url=args.base_url)

    if args.health:
        ok = client.healthcheck()
        print(json.dumps({"healthy": ok, "base_url": client.base_url}))
        return 0 if ok else 1

    if not args.group_id or not args.query:
        parser.error("--group-id et --query sont requis (sauf --health).")

    try:
        facts = client.search(args.query, args.group_id, args.max_facts)
    except GraphitiConfigError as exc:
        print(f"[rappel] configuration: {exc}", file=sys.stderr)
        return 2
    except GraphitiError as exc:
        print(f"[rappel] erreur: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"group_id": args.group_id, "count": len(facts), "facts": facts}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
