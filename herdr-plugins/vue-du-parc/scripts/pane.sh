#!/usr/bin/env bash
# Le pane de la vue du parc — il LANCE le TUI, il ne l'implémente pas.
#
# 🔴 `exec`, ET C'EST LA CONDITION DU « AUCUN ORPHELIN ». Sans lui, ce bash reste le
# processus du pane et node devient son enfant : herdr, en fermant le pane, tue le bash
# et laisse le TUI vivant — un processus qui tient une lecture du ServiceDesk et que
# personne ne voit plus. Avec `exec`, node EST le pane : le fermer le tue.
#
# ⚠️ ET LE DIAGNOSTIC SE LIT AVANT L'`exec`, JAMAIS APRÈS. Un pane dont la commande sort
# tout de suite se referme tout de suite : un message d'erreur écrit là ne s'affiche à
# personne. Ce qui peut échouer est donc mesuré ICI, et l'échec RETIENT le pane ouvert
# jusqu'à une touche — sans quoi le raccourci « ne fait rien » sans jamais dire pourquoi.
set -uo pipefail

# La résolution, du plus explicite au plus général. `LIGNE_DIRECTE_BIN` d'abord : c'est
# ce qui permet à celui qui développe la vue de la lancer depuis son dépôt sans avoir à
# réinstaller son poste à chaque essai.
candidats=()
[ -n "${LIGNE_DIRECTE_BIN:-}" ] && candidats+=("$LIGNE_DIRECTE_BIN")
candidats+=("$HOME/.somtech/ligne-directe/bin/ligne-directe.js")

bin=""
for c in "${candidats[@]}"; do
  if [ -f "$c" ]; then bin="$c"; break; fi
done

if [ -n "$bin" ]; then
  exec node "$bin" vue --tui
fi

# Dernier recours : le nom, si le PATH du poste le porte (`pack setup` pose ce raccourci).
if command -v ligne-directe >/dev/null 2>&1; then
  exec ligne-directe vue --tui
fi

# ⚠️ ON NE SORT PAS EN SILENCE. Le pane se refermerait, et le dirigeant lirait « le
# raccourci est cassé » là où la vérité est « le poste n'a pas la ligne directe ».
printf '\n  LA VUE DU PARC — PAS DE LIGNE DIRECTE SUR CE POSTE\n\n'
printf '  Je cherche le TUI de la vue et je ne le trouve nulle part :\n'
for c in "${candidats[@]}"; do printf '    · %s\n' "$c"; done
printf '    · « ligne-directe » sur le PATH\n\n'
printf '  Ceci ne dit PAS que le plugin est fautif — il ouvre bien un pane, et vous le\n'
printf '  lisez. Ce qui manque est l'"'"'outil de poste qu'"'"'il lance.\n\n'
printf '  Le geste : « npx @somtech-solutions/pack setup », qui installe la ligne directe\n'
printf '  dans ~/.somtech aux côtés de ce plugin.\n\n'
printf '  (une touche pour fermer)\n'
read -r -n 1 _ </dev/tty 2>/dev/null || sleep 30
exit 1
