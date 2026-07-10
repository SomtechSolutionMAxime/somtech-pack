#!/usr/bin/env bash
# Garde-fou anti-regression pour /merge.
#
# Invariant teste : dans SKILL.md, le deploiement des migrations en prod doit
# apparaitre AVANT le merge de la PR. Raison : le merge sur `main` declenche le
# redeploiement du frontend (Netlify). Si on migrait apres le merge, le nouveau
# frontend tournerait contre l'ancienne BD → erreurs en prod.
#
# Ce test aurait ete ROUGE avant le fix (migrations a l'etape 5, merge a l'etape 3)
# et est VERT apres (migrations etape 3, merge etape 5).
#
# Lancer : bash .claude/skills/merge/tests/test-migration-before-merge.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_MD="$SCRIPT_DIR/../SKILL.md"

fail() { echo "❌ FAIL: $1" >&2; exit 1; }

[ -f "$SKILL_MD" ] || fail "SKILL.md introuvable a $SKILL_MD"

# Numero de ligne du titre de section « Deploiement des migrations en prod »
mig_line=$(grep -n '^## .*[Dd]eploiement des migrations en prod' "$SKILL_MD" | head -1 | cut -d: -f1)
# Numero de ligne du titre de section « Merge de la PR »
merge_line=$(grep -n '^## .*Merge de la PR' "$SKILL_MD" | head -1 | cut -d: -f1)

[ -n "$mig_line" ]   || fail "Section « Deploiement des migrations en prod » introuvable"
[ -n "$merge_line" ] || fail "Section « Merge de la PR » introuvable"

if [ "$mig_line" -ge "$merge_line" ]; then
  fail "Les migrations (ligne $mig_line) doivent etre AVANT le merge (ligne $merge_line). Le merge declenche le frontend — migrer apres casse la prod."
fi

# Garde-fou complementaire : la gate de coherence staging/prod doit aussi preceder le merge.
gate_line=$(grep -n '^## .*Gate de coherence migrations' "$SKILL_MD" | head -1 | cut -d: -f1)
[ -n "$gate_line" ] || fail "Section « Gate de coherence migrations » introuvable"
if [ "$gate_line" -ge "$merge_line" ]; then
  fail "La gate de coherence (ligne $gate_line) doit etre AVANT le merge (ligne $merge_line)."
fi

# Garde-fou complementaire : les Edge Functions (backend dont le frontend depend) doivent aussi preceder le merge.
ef_line=$(grep -n '^## .*[Dd]eploiement des Edge Functions en prod' "$SKILL_MD" | head -1 | cut -d: -f1)
[ -n "$ef_line" ] || fail "Section « Deploiement des Edge Functions en prod » introuvable"
if [ "$ef_line" -ge "$merge_line" ]; then
  fail "Les Edge Functions (ligne $ef_line) doivent etre AVANT le merge (ligne $merge_line) — le frontend peut en dependre."
fi

# Garde-fou complementaire (D-20260710-0001) : l'entree CHANGELOG doit etre produite
# AVANT le merge, pour partir dans le squash-merge sur main (sinon commit post-merge
# = branche orpheline a re-merger, teardown worktree bloque).
cl_line=$(grep -n '^## .*[Aa]ssurer l.entree CHANGELOG' "$SKILL_MD" | head -1 | cut -d: -f1)
[ -n "$cl_line" ] || fail "Section « Assurer l'entree CHANGELOG » introuvable"
if [ "$cl_line" -ge "$merge_line" ]; then
  fail "L'entree CHANGELOG (ligne $cl_line) doit etre AVANT le merge (ligne $merge_line) — sinon elle ne part pas dans le squash et cree une branche orpheline."
fi

echo "✅ PASS: migrations (L$mig_line) + gate (L$gate_line) + Edge Functions (L$ef_line) + CHANGELOG (L$cl_line) precedent bien le merge (L$merge_line)."
