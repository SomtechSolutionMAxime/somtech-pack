# shellcheck shell=bash
# ============================================================
# ensure-changelog.sh — v1.0.0
# Helpers déterministes pour intégrer l'entrée CHANGELOG dans le flux /merge
# (D-20260710-0001, T-20260710-0014).
#
# Lib PURE : ne définit que des fonctions, aucun effet de bord au sourcing.
# Testable en isolation (tests/test-ensure-changelog.sh).
#
# Motivation : produire l'entrée CHANGELOG DANS la PR du travail (elle part
# dans le squash-merge sur main), au lieu de la committer en post-hoc via
# /end-session — ce qui créait une branche orpheline à re-merger et bloquait
# le teardown des worktrees claude-swt.
#
# Fonctions publiques :
#   cec_diff_touches_changelog <target>  -> 0 si <target> figure dans la liste
#                                           de fichiers lue sur stdin, 1 sinon
#   cec_prepend_entry <changelog> <entry_file>
#                                        -> insère <entry_file> comme nouvelle
#                                           section, avant la 1re "## [",
#                                           préambule et sections existantes
#                                           préservés
# ============================================================

# cec_diff_touches_changelog <target> — lit une liste de fichiers (un par ligne,
# tel que `gh pr diff <n> --name-only` ou `git diff --name-only`) sur stdin et
# renvoie 0 dès qu'une ligne égale EXACTEMENT <target>. Le match exact évite
# qu'un homonyme en sous-dossier (docs/CHANGELOG.md) compte pour la racine.
cec_diff_touches_changelog() {
  local target="${1:-CHANGELOG.md}" line
  while IFS= read -r line; do
    [ "$line" = "$target" ] && return 0
  done
  return 1
}

# cec_prepend_entry <changelog_path> <entry_file>
# Insère le contenu de <entry_file> (un bloc markdown complet, header "## [...]"
# inclus) JUSTE AVANT la première section versionnée (première ligne commençant
# par "## ["), en préservant le préambule Keep a Changelog. Si aucune section
# "## [" n'existe (fichier neuf/minimal), ajoute le bloc à la fin.
#
# NB : l'idempotence n'est PAS garantie — l'appelant (/merge) ne doit invoquer
# cette fonction QUE si le diff de la PR ne touche pas déjà CHANGELOG.md
# (cec_diff_touches_changelog), pour ne jamais écraser ni dupliquer une entrée
# déjà rédigée par la session.
cec_prepend_entry() {
  local cl="${1:?changelog path}" entry="${2:?entry file}"
  [ -f "$cl" ] || return 1
  [ -f "$entry" ] || return 1

  local at tmp
  at=$(grep -n -m1 '^## \[' "$cl" | cut -d: -f1)
  tmp=$(mktemp) || return 1

  if [ -n "$at" ]; then
    # Préambule (1..at-1), puis l'entrée + ligne vide, puis les sections (at..fin).
    head -n "$((at - 1))" "$cl" > "$tmp"
    cat "$entry" >> "$tmp"
    printf '\n' >> "$tmp"
    tail -n "+$at" "$cl" >> "$tmp"
  else
    # Pas de section versionnée : conserver le fichier tel quel + entrée en fin.
    cat "$cl" > "$tmp"
    printf '\n' >> "$tmp"
    cat "$entry" >> "$tmp"
  fi

  mv "$tmp" "$cl"
}
