#!/usr/bin/env bash
# ============================================================
# test-claude-swt-pack-sync.sh — E4 (T-20260715-0007 marqueur, T-20260715-0008 sync)
# Vrais worktrees git locaux. Aucun réseau.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWT="${SCRIPT_DIR}/../shell/claude-swt.sh"
PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }
[ -r "$SWT" ] || { echo "❌ introuvable: $SWT"; exit 1; }
# shellcheck source=/dev/null
source "$SWT"

SESSDIR="$(mktemp -d)"; export SWT_SESSIONS_DIR="$SESSDIR"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"; rm -rf "$SESSDIR"' EXIT

echo "== 4.1 — marqueur de session : lock/active/unlock + orphelin =="
d="$(mktemp -d)"
_swt_session_active "$d" && ko "inactif au départ attendu" || ok "aucun marqueur → inactif"
_swt_session_lock "$d"
_swt_session_active "$d" && ok "après lock → actif" || ko "devrait être actif après lock"
_swt_session_unlock "$d"
_swt_session_active "$d" && ko "après unlock devrait être inactif" || ok "après unlock → inactif"
# marqueur orphelin (PID mort) → inactif
printf '999999' > "$(_swt_session_marker "$d")"
_swt_session_active "$d" && ko "PID mort devrait être inactif" || ok "marqueur orphelin (PID mort) → inactif"
rm -rf "$d"

echo "== 4.2 — claude-swt-pack-sync : rebase les propres, skip sales/actifs =="
root="$(mktemp -d)"; origin="$root/origin.git"; main="$root/main"
git init -q --bare "$origin"
git init -q "$main"
( cd "$main"; git config user.email t@t; git config user.name t; git config commit.gpgsign false
  echo v1 > f.txt; git add -A; git commit -q -m c1; git branch -M main
  git remote add origin "$origin"; git push -q -u origin main )
C1="$(git -C "$main" rev-parse HEAD)"
# worktrees créés depuis C1 (donc en retard une fois main avancé)
git -C "$main" worktree add -q "$root/wtclean"  -b feat1 "$C1"
git -C "$main" worktree add -q "$root/wtdirty"  -b feat2 "$C1"
git -C "$main" worktree add -q "$root/wtactive" -b feat3 "$C1"
# avancer origin/main d'un commit (simule le merge de la PR de pack)
( cd "$main"; echo v2 >> f.txt; git commit -qam c2; git push -q origin main )
C2="$(git -C "$main" rev-parse HEAD)"
# salir wtdirty ; activer wtactive
echo dirty > "$root/wtdirty/uncommitted.txt"
_swt_session_lock "$root/wtactive"

out="$( cd "$main" && claude-swt-pack-sync 2>&1 )"

echo "$out" | grep -E "synchronisés.*wtclean" >/dev/null && ok "wtclean listé comme synchronisé" || ko "wtclean pas synchronisé\n$out"
echo "$out" | grep -E "modifs non commitées.*wtdirty" >/dev/null && ok "wtdirty listé comme sale" || ko "wtdirty pas skippé sale\n$out"
echo "$out" | grep -E "session active.*wtactive" >/dev/null && ok "wtactive listé comme actif" || ko "wtactive pas skippé actif\n$out"

# wtclean doit maintenant contenir C2 (rebasé sur origin/main)
git -C "$root/wtclean" merge-base --is-ancestor "$C2" HEAD 2>/dev/null && ok "wtclean rebasé sur origin/main (contient C2)" || ko "wtclean PAS rebasé"
# wtdirty intact : toujours sur C1, changement non commité préservé
[ "$(git -C "$root/wtdirty" rev-parse HEAD)" = "$C1" ] && ok "wtdirty non touché (toujours C1)" || ko "wtdirty a bougé"
[ -f "$root/wtdirty/uncommitted.txt" ] && ok "changement non commité de wtdirty préservé" || ko "DANGER: travail non commité clobberé"
# wtactive intact : toujours sur C1
[ "$(git -C "$root/wtactive" rev-parse HEAD)" = "$C1" ] && ok "wtactive non touché (session vivante protégée)" || ko "wtactive rebasé malgré session active"
# rappel de redémarrage présent
echo "$out" | grep -q "relance les sessions vivantes" && ok "rappel de redémarrage affiché" || ko "rappel manquant"

rm -rf "$root"

echo "== 4.3 — câblage du launcher (structurel) =="
grep -q 'pf_nudge_launch "$main"' "$SWT" && ok "nudge câblé" || ko "pf_nudge_launch non câblé"
grep -q 'CLAUDE_SWT_NO_AUTOPACK' "$SWT" && grep -q 'pf_auto_pr "$main"' "$SWT" && ok "auto-PR câblé avec opt-out" || ko "auto-PR/opt-out non câblé"
grep -q 'disown' "$SWT" && ok "auto-PR détaché (disown)" || ko "détachement manquant"
grep -q '_swt_session_lock "$wt"' "$SWT" && grep -q '_swt_session_unlock "$wt"' "$SWT" && ok "marqueur de session posé + retiré" || ko "lock/unlock de session non câblés"
# Ordre : l'auto-PR doit être câblé APRÈS le `git worktree add "$wt"` du launcher (anti-course).
add_ln=$(grep -n 'worktree add "$wt"' "$SWT" | head -1 | cut -d: -f1)
apr_ln=$(grep -n 'pf_auto_pr "$main"' "$SWT" | tail -1 | cut -d: -f1)
{ [ -n "$add_ln" ] && [ -n "$apr_ln" ] && [ "$apr_ln" -gt "$add_ln" ]; } \
  && ok "auto-PR séquencé après la création du worktree (anti-course)" || ko "ordre auto-PR/worktree add incorrect ($apr_ln vs $add_ln)"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
