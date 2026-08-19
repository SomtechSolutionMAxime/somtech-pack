#!/bin/bash
# Combien d'agents VIVANTS ce poste porte-t-il que le registre ne connaît pas ?
#
# ═══════════════════════════════════════════════════════════════════════════════
# POURQUOI CET OUTIL EXISTE
#
# `herdr agent get` rend `agent_not_found` pour DEUX situations qu'il ne
# distingue pas : le pane a été fermé, ou le pane est bien vivant mais aucun
# agent ne lui est rattaché. La veille les confondait et déclarait « le pane
# n'existe plus — il n'y a plus rien à garder » sur un pane vivant hébergeant un
# agent vivant (T-20260819-0064).
#
# ⚠️ ET LES CHIFFRES QUI L'ONT PROUVÉ N'ÉTAIENT PAS REJOUABLES — relevé par une
# revue de fond : la mesure vivait dans un message, pas dans le dépôt. Un compte
# qu'on ne peut pas refaire n'est pas une mesure, c'est une affirmation.
#
# ═══════════════════════════════════════════════════════════════════════════════
# LA MÉTHODE
#
# Pour chaque pane du poste, trois questions posées SÉPARÉMENT :
#   1. `herdr pane get`   — le pane existe-t-il ?
#   2. `herdr agent get`  — un agent y est-il RATTACHÉ au registre ?
#   3. `herdr pane read`  — un agent est-il VISIBLE à l'écran ?
#
# Le croisement des trois donne les quatre populations. Celle qui compte est
# « pane vivant + non rattaché + agent à l'écran » : des agents que personne ne
# garde, et que la veille déclarait morts.
#
# ⚠️ CE QUE CETTE MESURE NE DIT PAS :
#   • elle porte sur un INSTANT d'un poste vivant — les panes naissent et
#     meurent, le compte change. Elle horodate donc son relevé ;
#   • la détection « agent à l'écran » repose sur les libellés de l'interface
#     (`esc to interrupt`, `manual mode on`, …). Une interface qui changerait
#     ses libellés échapperait à ce compte, dans le sens du SOUS-comptage ;
#   • l'inventaire se fait par `foreground_cwd`, JAMAIS par nom d'agent : depuis
#     les noms de rivière, les noms d'agents et les noms de lieux ne
#     correspondent plus.
#
# Usage :  bash scripts/mesure-panes-non-gardes.sh
set -u
command -v herdr >/dev/null 2>&1 || { echo "herdr absent — cette mesure ne peut pas être prise" >&2; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
herdr pane list 2>/dev/null | python3 -c "
import sys, json
try: d = json.load(sys.stdin)
except Exception: raise SystemExit(1)
print('\n'.join(p['pane_id'] for p in d.get('result', {}).get('panes', [])))" > "$TMP/panes" || {
  echo "herdr n'a pas rendu la liste des panes — rien à mesurer" >&2; exit 1; }

cat > "$TMP/sonde" <<'SONDE'
#!/bin/bash
P="$1"
PANE=$(herdr pane get "$P" >/dev/null 2>&1 && echo VIVANT || echo MORT)
AG=$(herdr agent get "$P" 2>&1 | grep -q '"code":"agent_not_found"' && echo NON-RATTACHE || echo RATTACHE)
EC=$(herdr pane read "$P" --lines 6 2>/dev/null | grep -cE 'esc to interrupt|auto mode on|manual mode on|for shortcuts')
CWD=$(herdr pane get "$P" 2>/dev/null | python3 -c "
import json,sys
try: print(json.load(sys.stdin)['result']['pane'].get('foreground_cwd',''))
except Exception: print('')" 2>/dev/null)
echo "$P|$PANE|$AG|$EC|$CWD"
SONDE
chmod +x "$TMP/sonde"
xargs -P 12 -n 1 "$TMP/sonde" < "$TMP/panes" > "$TMP/sondage" 2>/dev/null

echo "relevé le $(date -u +%Y-%m-%dT%H:%M:%SZ) — un poste vivant : ce compte vaut pour cet instant"
awk -F'|' '
{ tot++
  if ($2=="MORT") mort++
  else if ($3=="RATTACHE") rat++
  else if ($4>0) { nonGardes++; print "   NON GARDÉ : " $1 "  " $5 }
  else shell++ }
END {
  printf "\n  panes relevés                                        : %d\n", tot
  printf "  agents rattachés au registre (aucun signal)           : %d\n", rat+0
  printf "  panes morts                                          : %d\n", mort+0
  printf "  AGENTS VIVANTS NON RATTACHÉS — personne ne les garde  : %d\n", nonGardes+0
  printf "  panes sans agent (shell nu)                          : %d\n", shell+0
}' "$TMP/sondage"
