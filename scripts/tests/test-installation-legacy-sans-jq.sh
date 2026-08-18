#!/usr/bin/env bash
# ============================================================
# test-installation-legacy-sans-jq.sh — T-20260818-0042
#
# Le chemin d'installation « legacy » (scripts/somtech_pack_pull.sh, cible du
# one-liner `curl … remote-install.sh | bash`) dépend de `jq` sans le vérifier.
# Sans `jq`, get_module_paths() rend le vide, la boucle de copie ne parcourt
# aucun chemin, et le script sort en SUCCÈS avec le message d'un dépôt déjà à
# jour — 0 fichier arrivé, rien qui le dise.
#
# CE QUE CE TEST TIENT, et pourquoi il en faut trois et non deux :
#
#   A. sans `jq`      → le script REFUSE et NOMME jq.
#   B. dépôt à jour   → le script SUCCÈDE. C'est le cas légitime où zéro
#                       fichier copié est NORMAL ; toute garde formulée
#                       « 0 fichier copié ⇒ erreur » le fait rougir.
#   C. chemins non résolus, `jq` PRÉSENT → le script REFUSE.
#
# C existe parce que A le rend inatteignable autrement : une fois `require_cmd
# jq` posé, un PATH sans jq n'arrive JAMAIS jusqu'à la garde de résultat, qui
# repasserait alors verte faute d'objet (leçon T-20260818-0041). C lui donne un
# objet indépendant de jq : un module absent de pack.json.
#
# Aucun réseau : le « pack distant » est un dépôt git local monté à la volée.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PULL="${SCRIPT_DIR}/../somtech_pack_pull.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
WORK="$(mktemp -d)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"; rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

[ -r "$PULL" ] || { echo "❌ script introuvable: $PULL"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "❌ ce test exige jq pour son TÉMOIN (cas B et C)"; exit 1; }

# ── Un PATH d'où `jq` est absent ────────────────────────────────────────────
# Liste blanche de commandes : tout ce que le script et git touchent, sauf jq.
NOJQ_BIN="${WORK}/nojq-bin"; mkdir -p "$NOJQ_BIN"
for c in git date mkdir rmdir rm cp mv ln dirname basename diff find sed tr wc \
         grep egrep head tail sort uniq cat chmod ls awk uname env bash sh \
         touch mktemp id whoami getent ssh cut expr readlink stat; do
  p="$(command -v "$c" 2>/dev/null)" && ln -sf "$p" "$NOJQ_BIN/$c"
done
# Garde-fou : un shim amputé de git rendrait TOUS les cas rouges pour la
# mauvaise raison — un faux positif est un test qui ne prouve rien.
PATH="$NOJQ_BIN" command -v git >/dev/null 2>&1 \
  || { echo "❌ shim PATH incomplet : git introuvable — test non concluant"; exit 1; }
if PATH="$NOJQ_BIN" command -v jq >/dev/null 2>&1; then
  echo "❌ shim PATH inopérant : jq reste visible — test non concluant"; exit 1
fi

# ── Un « pack distant » minimal, fidèle aux modules par défaut ──────────────
SRC="${WORK}/pack-src"
mkdir -p "$SRC/.claude/skills" "$SRC/scripts" "$SRC/docs" "$SRC/features"
echo "1.99.0" > "$SRC/VERSION"
echo "skill"  > "$SRC/.claude/skills/exemple.md"
echo "script" > "$SRC/scripts/exemple.sh"
echo "doc"    > "$SRC/docs/exemple.md"
echo "feature"> "$SRC/features/exemple.md"
cat > "$SRC/pack.json" <<'PJSON'
{
  "name": "somtech-pack",
  "version": "1.99.0",
  "modules": {
    "core":     { "description": "c", "default": true,  "paths": [".claude/", "scripts/", "docs/"] },
    "features": { "description": "f", "default": true,  "paths": ["features/"] },
    "absent":   { "description": "a", "default": false, "paths": [] },
    "fantome":  { "description": "p", "default": false, "paths": ["jamais-clone/"] }
  }
}
PJSON
( cd "$SRC" && git init -q && git add -A \
    && git -c user.email=t@somtech.ca -c user.name=test commit -qm init ) \
  || { echo "❌ dépôt source non initialisable"; exit 1; }

# ── Lancer une installation et rendre : rc | fichiers arrivés | sortie ──────
CASE_N=0
installer() { # $1=PATH  $2=cible  [$3…]=args supplémentaires
  local p="$1" cible="$2"; shift 2
  rm -rf "$cible"; mkdir -p "$cible"
  CASE_N=$((CASE_N + 1))
  set +e
  OUT="$(PATH="$p" HOME="${WORK}/home" bash "$PULL" \
          --target "$cible" --repo "$SRC" --ref "" --force \
          --workdir "${WORK}/cache-${CASE_N}" "$@" 2>&1)"
  RC=$?
  set -e
  N_FILES="$(find "$cible" -type f -not -path '*/.somtech-pack/*' | wc -l | tr -d ' ')"
}
mkdir -p "${WORK}/home"

echo "== A. Un poste SANS jq : refus nommé, jamais un succès vide =="
installer "$NOJQ_BIN" "${WORK}/cible-sans-jq"
[ "$RC" -ne 0 ] \
  && ok "sort en échec (rc=$RC)" \
  || ko "sort en SUCCÈS (rc=$RC) alors que $N_FILES fichier(s) sont arrivés"
echo "$OUT" | grep -qi 'jq' \
  && ok "nomme jq dans son refus" \
  || ko "ne nomme jamais jq — l'installateur ne peut pas savoir quoi installer"
echo "$OUT" | grep -qi 'aucun changement' \
  && ko "emprunte encore la formule du dépôt déjà à jour" \
  || ok "n'emprunte pas la formule du dépôt déjà à jour"

echo "== B. Un dépôt LÉGITIMEMENT à jour : zéro fichier copié reste un SUCCÈS =="
# Première passe : le dépôt reçoit tout.
installer "$PATH" "${WORK}/cible-a-jour"
[ "$RC" -eq 0 ] && [ "$N_FILES" -eq 4 ] \
  && ok "témoin : 4 fichiers arrivés, rc=0" \
  || ko "témoin cassé : rc=$RC, $N_FILES fichier(s) — le reste du test ne prouve rien"
# Seconde passe, --force, sur le même dépôt : plus rien à copier, et c'est normal.
CASE_N=$((CASE_N + 1))
set +e
OUT="$(HOME="${WORK}/home" bash "$PULL" --target "${WORK}/cible-a-jour" \
        --repo "$SRC" --ref "" --force --workdir "${WORK}/cache-${CASE_N}" 2>&1)"
RC=$?
set -e
[ "$RC" -eq 0 ] \
  && ok "un dépôt déjà à jour sort toujours en succès (rc=0)" \
  || ko "RÉGRESSION : la garde rougit sur un dépôt légitimement à jour (rc=$RC)"
echo "$OUT" | grep -q '4 identique' \
  && ok "il a bien parcouru ses chemins (4 identiques)" \
  || ko "n'a pas parcouru ses chemins — le cas B ne teste pas ce qu'il prétend"

echo "== C. Chemins non résolus, jq PRÉSENT : refus, sans dépendre de jq =="
# Objet indépendant de jq : un module dont pack.json ne déclare aucun chemin.
# C'est ce qui empêche cette garde de repasser verte une fois `require_cmd jq`
# posé — elle garderait sinon une classe qu'aucun cas n'atteint plus.
installer "$PATH" "${WORK}/cible-sans-chemins" --modules absent
[ "$RC" -ne 0 ] \
  && ok "sort en échec quand aucun chemin n'est parcouru (rc=$RC)" \
  || ko "sort en SUCCÈS (rc=$RC) sans avoir parcouru le moindre chemin"
[ "$N_FILES" -eq 0 ] \
  && ok "aucun fichier n'est arrivé, comme attendu" \
  || ko "$N_FILES fichier(s) arrivés — le cas ne mesure pas ce qu'il croit"
echo "$OUT" | grep -qi 'aucun changement' \
  && ko "emprunte encore la formule du dépôt déjà à jour" \
  || ok "n'emprunte pas la formule du dépôt déjà à jour"

echo "== D. Chemins DÉCLARÉS mais absents du clone : refus, et cause distincte =="
# Sans ce cas, la moitié « chemins résolus mais aucun parcouru » ne serait
# gardée par rien : compter les chemins AVANT le test de présence donnerait le
# même verdict sur A, B et C, et personne ne le verrait.
installer "$PATH" "${WORK}/cible-clone-incomplet" --modules fantome
[ "$RC" -ne 0 ] \
  && ok "sort en échec quand les chemins déclarés sont absents (rc=$RC)" \
  || ko "sort en SUCCÈS (rc=$RC) sur un clone qui ne porte aucun chemin déclaré"
echo "$OUT" | grep -qi 'clone' \
  && ok "impute la panne au clone, non à pack.json" \
  || ko "ne distingue pas un clone incomplet d'un pack.json muet"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
