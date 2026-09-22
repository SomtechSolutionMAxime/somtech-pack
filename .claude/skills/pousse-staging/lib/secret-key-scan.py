#!/usr/bin/env python3
# ============================================================
# secret-key-scan.py — v1.0.0
# Moteur de detection d'une cle Supabase a droits eleves dans un fichier
# (STD-038 SS3.2, regle d'or n12).
#
# Deux motifs, DEUX cles reelles — jamais un grep sur le mot "service_role"
# (legitime en prose d'audit et en SQL `GRANT ... TO service_role`) :
#
#   1. sb_secret_<20+ caracteres>   nouveau modele, grep direct sur la forme
#   2. eyJ....·....·....            JWT legacy DONT le payload decode porte
#                                    "role":"service_role" — le mot n'apparait
#                                    JAMAIS en clair dans le token (base64),
#                                    donc on decode plutot que grepper le texte
#                                    encode (STD-038 SS3.2, explicite).
#
# Ne whitelist PAS supabase/migrations|functions (suggere par STD-038 SS3.2
# pour un gate naif sur le mot) : notre detection ne matche deja QUE des cles
# reelles, jamais le mot nu — whitelister ces dossiers masquerait une VRAIE
# cle collee par erreur dans une migration, que STD-038 SS2.4 interdit
# explicitement (« commitee en source control, meme repo prive »).
#
# Le message de refus NOMME le fichier et la ligne, JAMAIS la valeur de la
# cle (STD-038 SS2.4 : « cle a droits eleves dans un log » est interdit).
#
# Usage : python3 secret-key-scan.py <fichier...>
# Sortie : une ligne par violation sur stdout ("fichier:ligne: motif — extrait
#          tronque"), rc 0 si rien trouve, rc 1 si au moins une violation.
# ============================================================
import base64
import json
import re
import sys

SB_SECRET_RE = re.compile(r"sb_secret_[A-Za-z0-9_-]{20,}")
JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")


def _decode_segment(seg: str):
    """Decode un segment JWT base64url en JSON. None si pas decodable/pas un objet."""
    padded = seg + "=" * (-len(seg) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        return json.loads(raw)
    except Exception:
        return None


def is_service_role_jwt(token: str) -> bool:
    """True si le payload decode du JWT porte exactement role=service_role."""
    parts = token.split(".")
    if len(parts) != 3:
        return False
    payload = _decode_segment(parts[1])
    return isinstance(payload, dict) and payload.get("role") == "service_role"


def _mask(value: str) -> str:
    """Tronque a 14 caracteres + ellipse — jamais la valeur complete en sortie."""
    return value[:14] + "…" if len(value) > 14 else value


def scan_text(text: str):
    """Retourne [(lineno, motif, extrait_masque), ...] pour une chaine de texte."""
    hits = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        for m in SB_SECRET_RE.finditer(line):
            hits.append((lineno, "sb_secret_", _mask(m.group(0))))
        for m in JWT_RE.finditer(line):
            if is_service_role_jwt(m.group(0)):
                hits.append((lineno, "service_role-jwt", _mask(m.group(0))))
    return hits


def scan_file(path: str):
    """Lit un fichier et le scanne. Liste vide si illisible (pas une erreur)."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    except (IsADirectoryError, FileNotFoundError, PermissionError):
        return []
    return scan_text(text)


def main(argv):
    if len(argv) < 2:
        print("usage: secret-key-scan.py <fichier...>", file=sys.stderr)
        return 2
    any_hit = False
    for path in argv[1:]:
        for lineno, motif, extrait in scan_file(path):
            any_hit = True
            print(f"{path}:{lineno}: cle a droits elevees detectee ({motif}) — {extrait}")
    return 1 if any_hit else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
