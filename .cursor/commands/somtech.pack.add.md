Ajoute des fichiers au **Somtech Pack** (via une PR diff-based) afin qu’ils soient récupérables par les autres projets au prochain `.pull`.

## Pourquoi cette commande existe

Le push vers `somtech-pack` est **diff-based** : il synchronise uniquement les changements **commités** entre `origin/main...HEAD`.
Donc pour publier de nouveaux fichiers (ex: nouvelles commandes `.cursor/commands/*.md`), il faut d’abord **commit** dans le projet courant.

## Usage

### Ajouter une ou plusieurs commandes (globs ok)

- `/somtech.pack.add .cursor/commands/mockmig*.md`

### Ajouter des fichiers variés

- `/somtech.pack.add .cursor/commands/foo.md scripts/bar.sh docs/baz.md`

## Ce que ça fait

1) `git add <fichiers...>` (dans le projet courant)\n
2) `git commit` (message auto)\n
3) Lance le script du pack `somtech_pack_push.sh` pour ouvrir une PR dans `SomtechSolutionMAxime/somtech-pack`.\n

## Pré-requis

- `gh` installé + authentifié (`gh auth login`)
- Le repo `somtech-pack` cloné localement (idéalement à côté du projet, ex: `../somtech-pack`)\n
  - Ou définir `SOMTECH_PACK_DIR=/chemin/vers/somtech-pack`

## Exécution

Cette commande s’appuie sur :

- `./scripts/somtech_pack_add.sh`

