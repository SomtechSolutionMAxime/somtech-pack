#!/usr/bin/env bash
# L'action « ouvrir » — ce que prefix+virgule invoque.
#
# herdr n'a pas de champ déclaratif « ouvre ce pane » : une action est toujours une
# commande, et la commande rappelle le CLI d'herdr. C'est le patron des plugins du
# poste (dagr, herdrtools), pas une invention d'ici.
#
# 🔴 UN SECOND APPUI FOCALISE, IL N'OUVRE PAS UN SECOND PANE. Sans cette garde, taper le
# raccourci deux fois empile deux vues — et chacune redemande au ServiceDesk une lecture
# du parc de ~80 s. Ce n'est pas un détail de confort : c'est le geste le plus probable
# du dirigeant (« il ne s'est rien passé, je retape »).
#
# ⚠️ ET LA GARDE EST FAIL-OPEN, DÉLIBÉRÉMENT. Au moindre doute sur le pane mémorisé, on
# en ouvre un neuf : ne pas ouvrir la vue quand on la demande est un échec bien pire que
# l'ouvrir deux fois.
set -uo pipefail

herdr_bin="${HERDR_BIN_PATH:-herdr}"
plugin_id="${HERDR_PLUGIN_ID:-somtech.vue-du-parc}"

# La disposition, depuis l'argv de l'action : une action par disposition, chacune
# pouvant porter sa propre touche. `zoomed` par défaut — l'écran est un arbre ET une
# colonne de détail, et à mi-largeur les deux se disputent la place.
placement="${1:-zoomed}"

# Le pane mémorisé vit avec la configuration du plugin, pas dans le dépôt : c'est un état
# de POSTE. `config-dir` peut ne rien rendre (plugin lié sans config) — on retombe alors
# sur un chemin sous ~/.somtech plutôt que de renoncer à la garde.
config_dir="$("$herdr_bin" plugin config-dir "$plugin_id" 2>/dev/null | tr -d '\r')"
[ -n "$config_dir" ] || config_dir="$HOME/.somtech/herdr-plugins/vue-du-parc"
mkdir -p "$config_dir" 2>/dev/null || true
memo="$config_dir/pane-ouvert"

if [ -f "$memo" ]; then
  ancien="$(cat "$memo" 2>/dev/null | tr -d '\r\n')"
  # ⚠️ `pane get` REND 1 SUR UN PANE INCONNU — mesuré, pas supposé (un rc toujours nul
  # aurait fait focaliser un pane mort et l'action n'aurait plus jamais rien ouvert).
  if [ -n "$ancien" ] && "$herdr_bin" pane get "$ancien" >/dev/null 2>&1; then
    if "$herdr_bin" plugin pane focus "$ancien" >/dev/null 2>&1; then
      exit 0
    fi
  fi
  rm -f "$memo" 2>/dev/null || true
fi

args=(plugin pane open --plugin "$plugin_id" --entrypoint vue-du-parc --focus)
case "$placement" in
  split|right) args+=(--placement split --direction right) ;;
  down)        args+=(--placement split --direction down) ;;
  tab)         args+=(--placement tab) ;;
  *)           args+=(--placement zoomed) ;;
esac

out="$("$herdr_bin" "${args[@]}")" || exit 1
printf '%s' "$out"

# Le `pane_id` de la réponse, sans jq (le poste n'en a pas toujours) : le premier gagne.
pane_id="$(printf '%s' "$out" | sed -nE 's/.*"pane_id":"([^"]+)".*/\1/p' | head -1)"
[ -n "$pane_id" ] && printf '%s\n' "$pane_id" >"$memo" 2>/dev/null || true
exit 0
