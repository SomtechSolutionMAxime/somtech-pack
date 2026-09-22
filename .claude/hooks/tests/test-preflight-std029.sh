#!/usr/bin/env bash
# ============================================================
# test-preflight-std029.sh — v1.0.0
# Teste le hook SessionStart de préflight STD-029 (T-20260922-0093, garde 3/5 lot 4).
#
# Chaque scénario construit un dépôt git jetable dans /tmp, y positionne l'état
# attendu (branche, âge du dernier commit, présence/absence de CLAUDE.md et
# ontologie/, migrations neuves ou non), lance le hook dedans, et vérifie le
# verdict rendu PAR CHECK.
#
# Le scénario H coupe la sonde elle-même (PATH sans `git` fonctionnel) et vérifie
# que le verdict devient `[non mesuré]`, DISTINCT d'un `OK` — c'est la contrainte
# qui fait ce lot (cf. brief garde 3/5 : « la garde doit rougir quand la SONDE est
# cassée, pas seulement quand le CHECK échoue »).
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="${SCRIPT_DIR}/../session-start-preflight-std029.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# Construit un dépôt git jetable. Retourne son chemin.
mkrepo() {
  local d
  d="$(mktemp -d)"
  git -C "$d" init -q -b main
  git -C "$d" config user.email "test@somtech.ca"
  git -C "$d" config user.name "test"
  echo "$d"
}

# Commit avec une date arbitraire (relative, en jours dans le passé).
commit_days_ago() {
  local repo="$1" days="$2" file="$3"
  local ts
  ts="$(date -v-"${days}"d +%s 2>/dev/null || date -d "-${days} days" +%s)"
  echo "x" >> "$repo/$file"
  git -C "$repo" add "$file"
  GIT_AUTHOR_DATE="@$ts" GIT_COMMITTER_DATE="@$ts" git -C "$repo" commit -q -m "commit $file"
}

run_hook() {  # run_hook <repo>
  ( cd "$1" && bash "$HOOK" )
}

echo "== A. Branche main → ECHEC nommé sur le check branche =="
R="$(mkrepo)"; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -qi "ECHEC.*branche\|ECHEC.*main" && echo "$out" | grep -q "main" \
  && ok "branche main → ECHEC nommé" || ko "attendu ECHEC nommé sur main : $out"
rm -rf "$R"

echo "== B. Branche staging → ECHEC nommé =="
R="$(mkrepo)"; git -C "$R" checkout -q -b staging; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -qi "ECHEC" && echo "$out" | grep -q "staging" \
  && ok "branche staging → ECHEC nommé" || ko "attendu ECHEC nommé sur staging : $out"
rm -rf "$R"

echo "== C. Branche feat/... → check branche PASSE (OK) =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/D-99999999-0001-exemple; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -q "OK.*feat/D-99999999-0001-exemple" \
  && ok "branche feat/* → OK" || ko "attendu OK sur feat/* : $out"
rm -rf "$R"

echo "== D. Branche wt/<ts> → check branche PASSE (OK) =="
R="$(mkrepo)"; git -C "$R" checkout -q -b wt/20260922-102228; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -q "OK.*wt/20260922-102228" \
  && ok "branche wt/<ts> → OK" || ko "attendu OK sur wt/* : $out"
rm -rf "$R"

echo "== E. Dernier commit > 3 jours → échec de fraîcheur =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; commit_days_ago "$R" 5 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -qi "ECHEC.*fra" \
  && ok "commit vieux de 5j → échec de fraîcheur" || ko "attendu échec fraîcheur : $out"
rm -rf "$R"

echo "== F. Commit du jour → check fraîcheur PASSE =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -qi "OK.*dernier commit" \
  && ok "commit du jour → fraîcheur OK" || ko "attendu fraîcheur OK : $out"
rm -rf "$R"

echo "== G. CLAUDE.md présent à la racine → check verifie qu'il a ete charge (OK) =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; echo "# CLAUDE" > "$R/CLAUDE.md"; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -qi "OK.*CLAUDE.md\|CLAUDE.md.*OK" \
  && ok "CLAUDE.md présent → OK" || ko "attendu OK sur CLAUDE.md présent : $out"
rm -rf "$R"

echo "== G2. CLAUDE.md absent → [non applicable], JAMAIS un échec =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -q "\[non applicable\].*CLAUDE.md\|CLAUDE.md.*\[non applicable\]" && ! echo "$out" | grep -qi "ECHEC.*CLAUDE" \
  && ok "CLAUDE.md absent → [non applicable], pas d'échec" || ko "attendu [non applicable] sans échec : $out"
rm -rf "$R"

echo "== H1. Ontologie présente (/ontologie/) → check s'applique =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; mkdir -p "$R/ontologie"; touch "$R/ontologie/02_ontologie.yaml"
commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -qi "ontologie" | true
echo "$out" | grep -v "\[non applicable\]" | grep -qi "ontologie" \
  && ok "ontologie présente → check s'applique (pas [non applicable])" || ko "attendu check ontologie applicable : $out"
rm -rf "$R"

echo "== H2. Ontologie absente → [non applicable] =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -q "\[non applicable\].*ontologie\|ontologie.*\[non applicable\]" \
  && ok "ontologie absente → [non applicable]" || ko "attendu [non applicable] sur ontologie absente : $out"
rm -rf "$R"

echo "== I1. Pas de migration planifiée (pas de supabase/migrations) → check ne s'exécute pas, et le dit =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; commit_days_ago "$R" 0 f1.txt
out="$(run_hook "$R")"
echo "$out" | grep -qi "ne s'exécute pas" \
  && ok "pas de migration → check ne s'exécute pas (et le dit)" || ko "attendu 'ne s'exécute pas' : $out"
rm -rf "$R"

echo "== I2. Migration détectée sur la branche (nouveau fichier vs origin/main) → BLOQUANT =="
R="$(mkrepo)"; mkdir -p "$R/supabase/migrations"; commit_days_ago "$R" 0 f1.txt
git -C "$R" checkout -q -b feat/x
mkdir -p "$R/supabase/migrations"
echo "alter table x add column y int;" > "$R/supabase/migrations/20260922000000_ajout.sql"
git -C "$R" add supabase/migrations
git -C "$R" commit -q -m "feat: migration"
out="$(run_hook "$R")"
echo "$out" | grep -qi "BLOQUANT" \
  && ok "migration détectée → BLOQUANT" || ko "attendu BLOQUANT sur migration détectée : $out"
rm -rf "$R"

echo "== I3. Dépôt sans aucun commit → check fraîcheur [non applicable] (pas [non mesuré]) =="
R="$(mkrepo)"
out="$(run_hook "$R")"
echo "$out" | grep -q "\[non applicable\].*aucun commit\|aucun commit.*\[non applicable\]" \
  && ok "dépôt vide → [non applicable] sur la fraîcheur" || ko "attendu [non applicable] sur dépôt vide : $out"
rm -rf "$R"

echo "== J. SONDE CASSÉE (git indisponible) → [non mesuré], DISTINCT d'un OK — c'est la contrainte du lot =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; commit_days_ago "$R" 0 f1.txt
FAKEBIN="$(mktemp -d)"
cat > "$FAKEBIN/git" <<'EOF'
#!/usr/bin/env bash
exit 127
EOF
chmod +x "$FAKEBIN/git"
out="$( cd "$R" && PATH="$FAKEBIN:$PATH" bash "$HOOK" )"
echo "$out" | grep -qi "\[non mesuré\]" \
  && ok "git cassé → [non mesuré] apparaît" || ko "attendu [non mesuré] quand git est cassé : $out"
# contre-preuve : DISTINCT d'un OK — aucune ligne ne doit annoncer OK sur les checks git-dépendants
! echo "$out" | grep -qE "OK.*(branche|fraîcheur|dernier commit)" \
  && ok "aucun faux OK sur les checks git-dépendants quand la sonde est coupée" \
  || ko "un check git-dépendant a rendu OK alors que la sonde est cassée : $out"
rm -rf "$FAKEBIN" "$R"

echo "== K. Non-bloquant : le hook sort toujours en 0, même avec des ECHEC =="
R="$(mkrepo)"; commit_days_ago "$R" 5 f1.txt  # reste sur main + vieux commit → 2 échecs
( cd "$R" && bash "$HOOK" >/dev/null 2>&1 )
rc=$?
[ "$rc" -eq 0 ] && ok "exit 0 malgré des ECHEC (hors-scope : ne bloque pas)" || ko "le hook a bloqué (exit $rc), hors-scope"
rm -rf "$R"

echo "== L. Non-bloquant même sonde cassée : exit 0 =="
R="$(mkrepo)"; git -C "$R" checkout -q -b feat/x; commit_days_ago "$R" 0 f1.txt
FAKEBIN="$(mktemp -d)"; printf '#!/usr/bin/env bash\nexit 127\n' > "$FAKEBIN/git"; chmod +x "$FAKEBIN/git"
( cd "$R" && PATH="$FAKEBIN:$PATH" bash "$HOOK" >/dev/null 2>&1 )
rc=$?
[ "$rc" -eq 0 ] && ok "exit 0 même sonde cassée" || ko "le hook a bloqué (exit $rc) sonde cassée"
rm -rf "$FAKEBIN" "$R"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
