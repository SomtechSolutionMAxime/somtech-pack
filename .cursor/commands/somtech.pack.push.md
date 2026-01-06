Publie des changements du projet courant vers `somtech-pack` en ouvrant une PR (diff-based) + en générant une release note.

## Pré-requis

- `gh` installé et authentifié : `gh auth login`

## Usage (recommandé)

1. Faire tes changements (rules/skills/docs/scripts du pack)
2. Committer tes changements dans ton projet
3. Publier vers le pack :

- `./scripts/somtech_pack_push.sh --message "chore(pack): sync rules/skills"`

## Options utiles

- Base ref pour calculer le diff (par défaut `origin/main`) :
  - `./scripts/somtech_pack_push.sh --message "..." --base-ref main`

- Changer le scope sync (par défaut `.cursor,docs,scripts,README.md`) :
  - `./scripts/somtech_pack_push.sh --message "..." --scope .cursor,docs`

## Notes

- Le script crée : branche → commit → push → PR → release note dans `.cursor/releasenotes/`.
- Les checks bloquent si du contenu sensible est détecté (tokens, Authorization bearer, etc.).
