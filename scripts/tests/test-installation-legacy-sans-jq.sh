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

# Le cas F invoque `remote-install.sh --with-claude-swt`, donc le chemin qui
# mène au lanceur du poste. On borne le lieu unique des jetons sur un chemin
# inexistant : aucun secret réel ne peut atteindre une sortie de test, même si
# ce chemin allait plus loin qu'attendu. Règle vérifiée mécaniquement par
# test-mcp-env.sh, pour tous les tests.
export SOMTECH_MCP_ENV_FILE="${SOMTECH_MCP_ENV_FILE:-/nonexistent/somtech-mcp-env-de-test}"

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

echo "== E. Une LISTE MIXTE : un module valide + un inconnu ne passe pas en succès =="
# La garde sur le total ne voyait pas ce cas : `core` résout, donc des chemins
# sont parcourus, des fichiers arrivent, et le module inconnu était ignoré en
# silence. Une demande servie à moitié qui se dit réussie est le même défaut
# que celui de ce ticket, simplement plus discret.
installer "$PATH" "${WORK}/cible-liste-mixte" --modules core,typo-inexistant
[ "$RC" -ne 0 ] \
  && ok "sort en échec sur un module inconnu dans une liste valide (rc=$RC)" \
  || ko "sort en SUCCÈS (rc=$RC) : $N_FILES fichier(s) arrivés, le module inconnu passé sous silence"
echo "$OUT" | grep -q 'typo-inexistant' \
  && ok "nomme le module fautif" \
  || ko "ne nomme pas le module fautif — l'appelant ne peut pas corriger sa frappe"

echo "== F. La garde amont de remote-install.sh ne refuse QUE ce qu'elle doit =="
# `remote-install.sh` refuse désormais AVANT de cloner quand jq manque — mais
# seulement pour une installation projet. Une garde qui refuserait aussi
# `--with-claude-swt` (qui n'a jamais eu besoin de jq) coûterait plus qu'elle
# ne rapporte : on mesure les DEUX chiffres, ce qu'elle attrape et ce qu'elle
# refuse à tort.
RI="${SCRIPT_DIR}/../remote-install.sh"
set +e
OUT="$(PATH="$NOJQ_BIN" bash "$RI" --target "${WORK}/cible-remote" --repo "$SRC" --ref "" 2>&1)"; RC=$?
set -e
{ [ "$RC" -ne 0 ] && echo "$OUT" | grep -qi 'jq'; } \
  && ok "sans jq, une install projet est refusée et jq est nommé" \
  || ko "ne refuse pas / ne nomme pas jq (rc=$RC)"
echo "$OUT" | grep -qi 'Téléchargement du pack' \
  && ko "clone le dépôt AVANT de refuser — le refus arrive trop tard" \
  || ok "refuse AVANT de télécharger le pack"
# Sans --target : l'appel doit DÉPASSER la garde jq. On le lance donc pour de
# vrai (pas `--help`, qui sortirait avant d'atteindre la garde et rendrait un
# vert qui n'a rien touché). Le dépôt source de ce test ne porte pas
# install-claude-swt.sh : l'appel échoue donc PLUS LOIN, sur ce fichier
# manquant — et c'est précisément la preuve qu'il a franchi la garde jq au lieu
# d'être refusé par elle. Rien n'est installé sur le poste.
set +e
SRC_REF="$(cd "$SRC" && git rev-parse --abbrev-ref HEAD)"
OUT="$(PATH="$NOJQ_BIN" bash "$RI" --with-claude-swt --repo "$SRC" --ref "$SRC_REF" 2>&1)"
set -e
echo "$OUT" | grep -qi 'jq est requis' \
  && ko "refuse à tort un usage qui n'a jamais eu besoin de jq" \
  || ok "ne refuse pas un usage sans installation de modules"
echo "$OUT" | grep -qi 'install-claude-swt.sh introuvable' \
  && ok "il est bien allé au-delà de la garde jq (échec plus loin, comme attendu)" \
  || ko "n'a pas atteint l'étape suivante — l'assertion précédente ne prouve rien"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
