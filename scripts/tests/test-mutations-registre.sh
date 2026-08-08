#!/usr/bin/env bash
# ============================================================
# test-mutations-registre.sh — v1.0.0
# Prouve que les tests du lot E-20260807-0009 MORDENT.
#
# POURQUOI CE FICHIER EXISTE
# Un test qui n'a jamais été rouge n'a jamais rien testé. Sur les chantiers
# précédents, le motif « le double est plus indulgent que le vrai service » a
# laissé passer une fonction inerte en production derrière 97 tests verts et
# deux revues. Une suite entièrement verte du premier coup est donc un signal
# d'alarme, pas un succès.
#
# COMMENT
# On introduit dans une COPIE du code un défaut précis — celui qu'on redoute
# vraiment — et on exige que la suite correspondante devienne ROUGE. Si elle
# reste verte, c'est le TEST qui est défectueux, pas le code, et on le dit.
# Le code du dépôt n'est jamais modifié.
#
# Usage : bash scripts/tests/test-mutations-registre.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB_SRC="${ROOT}/scripts/shell/mcp-env.sh"
HOOK_SRC="${ROOT}/.claude/hooks/session-start-registre.sh"
MIG_SRC="${ROOT}/scripts/migrate-mcp-secrets.py"
SWT_SRC="${ROOT}/scripts/shell/claude-swt.sh"

WORK="$(mktemp -d)"; PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# mutate <fichier-source> <copie> <python-remplacement>
# Le remplacement est un extrait Python qui transforme la variable `s`.
mutate() {
  local src="$1" dst="$2" code="$3"
  python3 - "$src" "$dst" "$code" <<'PY'
import sys
src, dst, code = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(src, encoding="utf-8").read()
before = s
ns = {"s": s}
exec(code, ns)
s = ns["s"]
if s == before:
    print("MUTATION-INOPERANTE", file=sys.stderr)
    sys.exit(2)
open(dst, "w", encoding="utf-8").write(s)
PY
}

# expect_red <nom> <commande de suite…> — la suite DOIT échouer.
expect_red() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    ko "MUTANT SURVIVANT — $label : la suite reste VERTE, le test ne protège rien"
  else
    ok "$label → suite rouge"
  fi
}

echo "== Mutations de la lib des jetons =="

M="${WORK}/m1.sh"
mutate "$LIB_SRC" "$M" 's = s.replace("  set -a\n  # shellcheck", "  # shellcheck")' \
  && expect_red "les jetons ne sont plus exportés (set -a retiré)" \
       env MCP_ENV_SRC="$M" bash "${SCRIPT_DIR}/test-mcp-env.sh" \
  || ko "mutation 1 inopérante (le code a changé de forme ?)"

M="${WORK}/m2.sh"
mutate "$LIB_SRC" "$M" 's = s.replace("  . \"$f\"\n  set +a", "  . \"$f\"")' \
  && expect_red "auto-export laissé actif (set +a retiré) — fuite d'environnement" \
       env MCP_ENV_SRC="$M" bash "${SCRIPT_DIR}/test-mcp-env.sh" \
  || ko "mutation 2 inopérante"

M="${WORK}/m3.sh"
mutate "$LIB_SRC" "$M" 's = s.replace("| sort -u\n}", "| sort -u | head -1\n}")' \
  && expect_red "un seul serveur rapporté — celui dont le jeton est dans l'URL passe inaperçu" \
       env MCP_ENV_SRC="$M" bash "${SCRIPT_DIR}/test-mcp-env.sh" \
  || ko "mutation 3 inopérante"

M="${WORK}/m4.sh"
mutate "$LIB_SRC" "$M" 's = s.replace("    [ -n \"$val\" ] || printf", "    [ -n \"${val+x}\" ] || printf")' \
  && expect_red "une variable VIDE passe pour renseignée" \
       env MCP_ENV_SRC="$M" bash "${SCRIPT_DIR}/test-mcp-env.sh" \
  || ko "mutation 4 inopérante"

M="${WORK}/m5.sh"
mutate "$LIB_SRC" "$M" 's = s.replace("  esac\n", "  esac\n  grep SOMTECH_DESK \"$f\" >&2\n")' \
  && expect_red "l'avertissement imprime la VALEUR du jeton" \
       env MCP_ENV_SRC="$M" bash "${SCRIPT_DIR}/test-mcp-env.sh" \
  || ko "mutation 5 inopérante"

echo "== Mutations du hook de naissance =="

M="${WORK}/m6.sh"
mutate "$HOOK_SRC" "$M" 's = s.replace("  SOMTECH_MCP_ENV_NOLOAD=1 . \"$_LIB\"", "  . \"$_LIB\"")'  \
  && expect_red "le hook se rassure avec le lieu unique au lieu de lire la session" \
       env REGISTRE_HOOK_SRC="$M" bash "${SCRIPT_DIR}/test-session-start-registre.sh" \
  || ko "mutation 6 inopérante"

M="${WORK}/m7.sh"
mutate "$HOOK_SRC" "$M" 's = s.replace("MSG\nexit 0", "MSG\nexit 1")' \
  && expect_red "le hook sort en 1 — il empêcherait la session de s'ouvrir" \
       env REGISTRE_HOOK_SRC="$M" bash "${SCRIPT_DIR}/test-session-start-registre.sh" \
  || ko "mutation 7 inopérante"

M="${WORK}/m8.sh"
mutate "$HOOK_SRC" "$M" 's = s.replace("[ -n \"$MISSING\" ] || exit 0", "true")' \
  && expect_red "le hook alerte même quand tout va bien — on cesserait de le lire" \
       env REGISTRE_HOOK_SRC="$M" bash "${SCRIPT_DIR}/test-session-start-registre.sh" \
  || ko "mutation 8 inopérante"

M="${WORK}/m18.sh"
mutate "$HOOK_SRC" "$M" 's = s.replace("  [ -n \"$_s\" ] || continue", "  :")' \
  && expect_red "une variable hors mcpServers déclenche une fausse alarme" \
       env REGISTRE_HOOK_SRC="$M" bash "${SCRIPT_DIR}/test-session-start-registre.sh" \
  || ko "mutation 18 inopérante"

M="${WORK}/m19.sh"
mutate "$HOOK_SRC" "$M" 's = s.replace("RETENUES=\"${RETENUES}${_v}", "RETENUES=\"${RETENUES}")' \
  && expect_red "le filtre fait taire une VRAIE alerte" \
       env REGISTRE_HOOK_SRC="$M" bash "${SCRIPT_DIR}/test-session-start-registre.sh" \
  || ko "mutation 19 inopérante"

echo "== Mutations de la migration des jetons =="

M="${WORK}/m9.py"
mutate "$MIG_SRC" "$M" 's = s.replace("os.fchmod(fd, 0o600)", "os.fchmod(fd, 0o644)").replace("os.chmod(path, 0o600)", "pass")' \
  && expect_red "le lieu unique est écrit en 0644 — jeton lisible par un autre compte" \
       env MIGRATE_SRC="$M" bash "${SCRIPT_DIR}/test-migrate-mcp-secrets.sh" \
  || ko "mutation 9 inopérante"

M="${WORK}/m10.py"
mutate "$MIG_SRC" "$M" 's = s.replace("    shutil.copy2(args.config, backup)\n", "")' \
  && expect_red "aucune sauvegarde avant de réécrire un fichier partagé et vivant" \
       env MIGRATE_SRC="$M" bash "${SCRIPT_DIR}/test-migrate-mcp-secrets.sh" \
  || ko "mutation 10 inopérante"

M="${WORK}/m11.py"
mutate "$MIG_SRC" "$M" 's = s.replace("and not VAR_REF.match(auth)", "")' \
  && expect_red "une valeur déjà sous forme \${VAR} est re-migrée (perte d'idempotence)" \
       env MIGRATE_SRC="$M" bash "${SCRIPT_DIR}/test-migrate-mcp-secrets.sh" \
  || ko "mutation 11 inopérante"

M="${WORK}/m12.py"
mutate "$MIG_SRC" "$M" '
s = s.replace("""        print(f"  · serveur « {name} » → {location} remplacé par ${{{var}}}")""",
              """        print(f"  · serveur « {name} » → {location} = {_raw} remplacé par ${{{var}}}")""")' \
  && expect_red "l'inspection imprime la VALEUR du jeton" \
       env MIGRATE_SRC="$M" bash "${SCRIPT_DIR}/test-migrate-mcp-secrets.sh" \
  || ko "mutation 12 inopérante"

M="${WORK}/m13.py"
mutate "$MIG_SRC" "$M" '
s = s.replace("""    n_projects = len(conf_after.get("projects") or {})""",
              """    conf_after.pop("projects", None)
    json.dump(conf_after, open(args.config, "w"), ensure_ascii=False, indent=2)
    n_projects = 0""")' \
  && expect_red "la réécriture perd les projets du fichier partagé" \
       env MIGRATE_SRC="$M" bash "${SCRIPT_DIR}/test-migrate-mcp-secrets.sh" \
  || ko "mutation 13 inopérante"

M="${WORK}/m14.py"
mutate "$MIG_SRC" "$M" 's = s.replace("                conflicts.append((k, src))\n                continue", "                pass")' \
  && expect_red "l'import écrase une valeur en place au lieu de signaler le conflit" \
       env MIGRATE_SRC="$M" bash "${SCRIPT_DIR}/test-migrate-mcp-secrets.sh" \
  || ko "mutation 14 inopérante"

M="${WORK}/m15.py"
mutate "$MIG_SRC" "$M" 's = s.replace("                conflicts.append((k, src))\n                continue", "                conflicts.append((k, src))\n                return 1")' \
  && expect_red "un conflit bloque l'import des autres variables (dommage collatéral)" \
       env MIGRATE_SRC="$M" bash "${SCRIPT_DIR}/test-migrate-mcp-secrets.sh" \
  || ko "mutation 15 inopérante"

echo "== Mutations des portes de naissance =="

# Le chaînage rc → claude-swt.sh → mcp-env.sh est ce qui ouvre les quatre portes.
# Le couper est le retour exact à l'état d'avant le lot.
M="${WORK}/m16.sh"
mutate "$SWT_SRC" "$M" 's = s.replace("[ -r \"$_swt_dir/mcp-env.sh\" ] && . \"$_swt_dir/mcp-env.sh\"", ":")' \
  && expect_red "le lanceur ne charge plus la lib des jetons — retour au défaut" \
       env SWT_SRC_OVERRIDE="$M" bash "${SCRIPT_DIR}/test-portes-naissance.sh" \
  || ko "mutation 16 inopérante"

# L'effet de bord au chargement EST la raison d'être de la lib. Le retirer laisse
# les fonctions définies et l'environnement vide : tout paraît en place, rien ne marche.
M="${WORK}/m17.sh"
mutate "$LIB_SRC" "$M" 's = s.replace("[ -n \"${SOMTECH_MCP_ENV_NOLOAD:-}\" ] || mcp_env_load", ":")' \
  && expect_red "la lib ne charge plus rien au source — les fonctions existent, l'environnement est vide" \
       env MCP_ENV_SRC_OVERRIDE="$M" bash "${SCRIPT_DIR}/test-portes-naissance.sh" \
  || ko "mutation 17 inopérante"

echo
echo "Résultat : ${PASS} mutations tuées, ${FAIL} problèmes"
[ "$FAIL" -eq 0 ]
