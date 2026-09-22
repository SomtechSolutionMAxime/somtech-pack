#!/usr/bin/env bash
# ============================================================
# test-version-tag-coherence.sh — T-20260922-0136
#
# La garde CENTRALE de ce ticket : elle mesure le DÉPÔT RÉEL (jamais une
# fixture), et rougit dès que VERSION cesse de suivre le dernier tag Git.
#
# version-consistency.test.js (cli/test/) vérifiait déjà que VERSION,
# pack.json et cli/package.json sont IDENTIQUES ENTRE EUX — mais les trois
# ont dérivé ENSEMBLE, immobiles à 1.64.0, pendant que 37 tags avançaient
# (v1.65.0 → v1.101.5, 2026-08-17 → 2026-09-22). Ce test-là restait vert : il
# ne compare jamais rien à l'extérieur du trio qu'il garde. C'est exactement
# le motif « une garde qui ne rougit jamais » — une règle que rien n'éprouve.
#
# Ce test-ci ferme ce trou : il compare VERSION au dernier tag Git atteignable
# depuis le HEAD checkté, la source unique documentée dans le CLAUDE.md racine
# de ce dépôt. Exécuté sur CHAQUE push (tests.yml, shell-tests), il aurait
# rougi dès le tag v1.65.0 — pas 37 tags plus tard.
#
# ⚠️ CECI N'EST PAS le motif que test-merge-mesure-distante.sh interdit (§S,
# « aucun fichier ne PRESCRIT la lecture locale ») : /merge lit le dernier tag
# LOCAL pour calculer un NUMÉRO À POSER — un dépôt qui n'a pas fetché depuis
# une heure y rend un numéro déjà pris, en silence (T-20260820-0097). Ici, on
# ne calcule rien à poser : on AUDITE si le HEAD déjà checkté (fetch-depth: 0,
# fetch minutes plus tôt dans ce même job) est cohérent AVEC SA PROPRE
# ancêtre-tag. La question posée n'est pas « quel est le dernier tag connu du
# serveur ? » mais « ce commit-ci raconte-t-il une histoire cohérente ? » —
# une question à laquelle seule la vue locale de CE commit peut répondre.
#
# Nécessite un historique complet AVEC tags (fetch-depth: 0 en CI — voir
# .github/workflows/tests.yml, job shell-tests). Sans tag atteignable, ce
# n'est PAS un skip silencieux : c'est un échec qui nomme la cause probable,
# parce qu'un « je n'ai pas pu vérifier » qui se tait est indiscernable d'un
# « c'est bon ».
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

command -v git >/dev/null 2>&1 || { echo "❌ git introuvable"; exit 1; }
[ -f "${REPO_ROOT}/VERSION" ] || { echo "❌ ${REPO_ROOT}/VERSION introuvable"; exit 1; }

file_version="$(tr -d '[:space:]' < "${REPO_ROOT}/VERSION")"
tag_raw="$(git -C "$REPO_ROOT" describe --tags --abbrev=0 2>&1)"
tag_rc=$?

echo "VERSION (fichier)      : ${file_version}"

if [ "$tag_rc" -ne 0 ]; then
  echo "❌ Aucun tag Git atteignable depuis HEAD (git describe a échoué) :"
  echo "   ${tag_raw}"
  echo "   Cause probable : checkout superficiel sans tags (fetch-depth doit être 0"
  echo "   et fetch-tags actif), ou dépôt réellement sans le moindre tag."
  echo "   Un « je ne peux pas vérifier » ne se lit PAS comme « c'est bon »."
  exit 1
fi

tag_version="${tag_raw#v}"
echo "Dernier tag Git atteint : ${tag_raw} (${tag_version})"

if [ "$file_version" = "$tag_version" ]; then
  echo "✅ VERSION concorde avec le dernier tag Git (${tag_version})"
  exit 0
fi

echo "❌ INCOHÉRENCE : VERSION (${file_version}) ≠ dernier tag Git (${tag_version})"
echo "   VERSION, pack.json et cli/package.json doivent être bumpés ET COMMITÉS"
echo "   sur la même version que le tag — voir .claude/skills/merge/SKILL.md,"
echo "   Étape 8 (bump + commit AVANT git tag)."
exit 1
