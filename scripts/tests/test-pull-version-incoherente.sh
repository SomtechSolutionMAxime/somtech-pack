#!/usr/bin/env bash
# ============================================================
# test-pull-version-incoherente.sh — T-20260922-0136
#
# Le fichier VERSION du pack a cessé de suivre les tags depuis v1.65.0
# (2026-08-17) : 37 tags plus tard, VERSION valait encore 1.64.0.
# scripts/somtech_pack_pull.sh compare la version installée au contenu brut
# de ce fichier (get_pack_version) — jamais au tag git réel. Résultat mesuré :
# un projet dont le marqueur local porte "1.64.0" se voit répondre « déjà à
# jour » et l'installation sort en SUCCÈS sans avoir rien copié, alors que
# des dizaines de versions publiées ne sont jamais arrivées.
#
# CE QUE CE TEST TIENT :
#
#   A. Pack INCOHÉRENT (VERSION ne concorde pas avec son dernier tag), cible
#      dont le marqueur local == VERSION du fichier, SANS --force
#        → le script REFUSE (échec), jamais un succès muet.
#        → son message nomme l'incohérence, pas « déjà à jour ».
#   B. Même pack incohérent, AVEC --force
#        → l'opérateur outrepasse en connaissance de cause : le script
#          installe pour de vrai (du contenu neuf arrive), avec un
#          avertissement explicite sur l'incohérence.
#   C. Pack COHÉRENT (VERSION == dernier tag), cible déjà à cette version
#        → succès no-op légitime, INCHANGÉ — la garde ne doit pas rougir sur
#          le cas sain (c'est le témoin qui garde le témoin de A honnête).
#   D. Pack COHÉRENT, cible EN RETARD, SANS --force
#        → le script installe quand même — condition de fin n°2 du ticket :
#          un projet en retard s'installe SANS --force.
#
# Aucun réseau : le « pack distant » est un dépôt git local monté à la volée,
# avec de VRAIS tags (contrairement à la fixture de
# test-installation-legacy-sans-jq.sh, qui n'en pose pas et pour laquelle ce
# test exige donc qu'elle en porte un désormais — sans quoi le nouveau garde-fou
# la lirait comme incohérente sous --force, ce qui n'est pas ce qu'elle mesure).
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PULL="${SCRIPT_DIR}/../somtech_pack_pull.sh"

export SOMTECH_MCP_ENV_FILE="${SOMTECH_MCP_ENV_FILE:-/nonexistent/somtech-mcp-env-de-test}"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
WORK="$(mktemp -d)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"; rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

[ -r "$PULL" ] || { echo "❌ script introuvable: $PULL"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "❌ ce test exige jq"; exit 1; }

mkpack_commit() { # <dir> <fichier-a-ajouter> <contenu>
  local d="$1" f="$2" c="$3"
  mkdir -p "$(dirname "$d/$f")"
  printf '%s\n' "$c" > "$d/$f"
  ( cd "$d" && git add -A && git -c user.email=t@somtech.ca -c user.name=test commit -qm "add $f" )
}

# ── A/B : un pack INCOHÉRENT — VERSION figé pendant que les tags avancent ───
INCO="${WORK}/remote-a"
mkdir -p "$INCO/.claude/skills" "$INCO/scripts" "$INCO/docs" "$INCO/features"
echo "1.64.0" > "$INCO/VERSION"
echo "v1"     > "$INCO/.claude/skills/exemple.md"
cat > "$INCO/pack.json" <<'PJSON'
{
  "name": "somtech-pack",
  "version": "1.64.0",
  "modules": {
    "core":     { "description": "c", "default": true, "paths": [".claude/", "scripts/", "docs/"] },
    "features": { "description": "f", "default": true, "paths": ["features/"] }
  }
}
PJSON
( cd "$INCO" && git init -q && git add -A \
    && git -c user.email=t@somtech.ca -c user.name=test commit -qm "chore(release): v1.64.0" \
    && git tag v1.64.0 ) \
  || { echo "❌ pack incohérent non initialisable"; exit 1; }
# Un tag qui avance SANS que VERSION suive — exactement le défaut mesuré.
mkpack_commit "$INCO" "docs/exemple.md" "doc nouvelle"
( cd "$INCO" && git tag v1.65.0 )
mkpack_commit "$INCO" "features/exemple.md" "feature toute neuve — jamais arrivée chez personne"
( cd "$INCO" && git tag v1.99.2 )
# VERSION est toujours "1.64.0" ici, alors que le dernier tag est v1.99.2.

marque() { # <cible> <version>
  mkdir -p "$1/.somtech-pack"
  printf '{"pack":{"version":"%s","modules":["core"]}}\n' "$2" > "$1/.somtech-pack/version.json"
}

# Ne WIPE la cible qu'AVANT de poser le marqueur (jamais après — un test
# précédent avait posé le marqueur puis laissé installer() l'effacer par son
# propre rm -rf, ce qui faisait tourner tous les cas en « not-installed » et
# ne mesurait rien de la comparaison de version qu'ils prétendaient éprouver).
installer() { # $1=cible $2=repo [$3…]=args — le marqueur, s'il existe, DOIT déjà être posé
  local cible="$1" repo="$2"; shift 2
  CASE_N=$((CASE_N + 1))
  set +e
  OUT="$(HOME="${WORK}/home" bash "$PULL" \
          --target "$cible" --repo "$repo" --ref "" \
          --workdir "${WORK}/cache-${CASE_N}" "$@" 2>&1)"
  RC=$?
  set -e
  N_FILES="$(find "$cible" -type f -not -path '*/.somtech-pack/*' | wc -l | tr -d ' ')"
}
mkdir -p "${WORK}/home"
CASE_N=0

echo "== A. Pack incohérent, marqueur local == VERSION du fichier, SANS --force =="
CIBLE_A="${WORK}/cible-a"; rm -rf "$CIBLE_A"; mkdir -p "$CIBLE_A"; marque "$CIBLE_A" "1.64.0"
installer "$CIBLE_A" "$INCO"
[ "$RC" -ne 0 ] \
  && ok "sort en échec (rc=$RC) plutôt qu'un succès muet" \
  || ko "sort en SUCCÈS (rc=$RC) : $N_FILES fichier(s) arrivé(s) — c'est exactement le défaut du ticket"
echo "$OUT" | grep -qi 'incoh' \
  && ok "nomme l'incohérence dans son message" \
  || ko "ne nomme jamais l'incohérence — l'opérateur ne peut pas savoir pourquoi"
echo "$OUT" | grep -qi 'déjà à jour' \
  && ko "emprunte encore la formule « déjà à jour » sur une source dont on ne peut rien dire" \
  || ok "n'affirme pas « déjà à jour » sur une source non fiable"
# Discriminant AJOUTÉ après mutation (die → log a laissé rc=1 survivre PAR UN AUTRE CHEMIN —
# le prompt de confirmation qui plante sur stdin fermé en EOF, pas la garde d'incohérence
# elle-même). Sans ce discriminant, ce test était vert que la garde REFUSE ou qu'elle se
# contente de loguer et laisse le script planter plus loin pour une raison sans rapport —
# deux comportements très différents qu'il prétendait pourtant distinguer.
echo "$OUT" | grep -q 'Résumé des changements' \
  && ko "a dépassé la garde d'incohérence jusqu'au résumé des changements — le refus n'est pas venu de la garde elle-même" \
  || ok "refuse AVANT de parcourir le moindre changement — le refus vient bien de la garde"

echo "== B. Même pack incohérent, AVEC --force : outrepasse, installe, avertit =="
CIBLE_B="${WORK}/cible-b"; mkdir -p "$CIBLE_B"; marque "$CIBLE_B" "1.64.0"
installer "$CIBLE_B" "$INCO" --force
[ "$RC" -eq 0 ] \
  && ok "--force outrepasse l'incohérence (rc=0)" \
  || ko "--force devrait outrepasser, pas échouer (rc=$RC)"
[ "$N_FILES" -ge 2 ] \
  && ok "du contenu réellement neuf est arrivé ($N_FILES fichiers) malgré le VERSION figé" \
  || ko "aucun contenu neuf n'est arrivé ($N_FILES) — --force n'a rien forcé"
echo "$OUT" | grep -qi 'incoh' \
  && ok "avertit quand même de l'incohérence, même sous --force" \
  || ko "--force fait taire l'avertissement — l'opérateur croit avoir une version fiable"

echo "== C. Pack COHÉRENT (VERSION == dernier tag), cible déjà à jour : succès no-op inchangé =="
COH="${WORK}/remote-b"
mkdir -p "$COH/.claude/skills"
echo "1.99.2" > "$COH/VERSION"
cat > "$COH/pack.json" <<'PJSON'
{ "name": "somtech-pack", "version": "1.99.2",
  "modules": { "core": { "description": "c", "default": true, "paths": [".claude/"] } } }
PJSON
echo "v1" > "$COH/.claude/skills/exemple.md"
( cd "$COH" && git init -q && git add -A \
    && git -c user.email=t@somtech.ca -c user.name=test commit -qm "chore(release): v1.99.2" \
    && git tag v1.99.2 ) \
  || { echo "❌ pack cohérent non initialisable"; exit 1; }
CIBLE_C="${WORK}/cible-c"; mkdir -p "$CIBLE_C/.claude/skills"; echo "v1" > "$CIBLE_C/.claude/skills/exemple.md"
marque "$CIBLE_C" "1.99.2"
installer "$CIBLE_C" "$COH"
[ "$RC" -eq 0 ] \
  && ok "un pack cohérent et déjà à jour reste un succès (rc=0)" \
  || ko "RÉGRESSION : la garde rougit sur un cas sain (rc=$RC) : $OUT"
echo "$OUT" | grep -qi 'incoh' \
  && ko "signale une incohérence sur une source parfaitement cohérente — faux positif" \
  || ok "ne signale aucune incohérence sur une source saine"

echo "== D. Pack COHÉRENT, cible EN RETARD, SANS --force : s'installe quand même =="
# Sans --force, le script passe par la confirmation interactive (usage : « --force
# Applique sans confirmation ») — ce n'est PAS ce que ce cas éprouve. Ce qu'il éprouve,
# c'est que la comparaison de version ne bloque pas un projet en retard AVANT ce prompt.
# On répond donc "y" sur stdin, comme le ferait un humain, plutôt que de passer --force.
CIBLE_D="${WORK}/cible-d"; mkdir -p "$CIBLE_D"; marque "$CIBLE_D" "1.0.0"
CASE_N=$((CASE_N + 1))
set +e
OUT="$(HOME="${WORK}/home" bash "$PULL" --target "$CIBLE_D" --repo "$COH" --ref "" \
        --workdir "${WORK}/cache-${CASE_N}" <<<"y" 2>&1)"
RC=$?
set -e
N_FILES="$(find "$CIBLE_D" -type f -not -path '*/.somtech-pack/*' | wc -l | tr -d ' ')"
[ "$RC" -eq 0 ] \
  && ok "un projet en retard s'installe sans --force (rc=0)" \
  || ko "un projet en retard NE S'INSTALLE PAS sans --force (rc=$RC) — condition de fin n°2 violée"
[ "$N_FILES" -ge 1 ] \
  && ok "du contenu est réellement arrivé ($N_FILES fichier(s))" \
  || ko "rien n'est arrivé alors que la cible était en retard"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
