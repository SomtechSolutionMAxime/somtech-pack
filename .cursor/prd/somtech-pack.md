# PRD — somtech-pack (Rules/Commands/Skills)

## Contexte & objectifs

`somtech-pack` est un pack de démarrage Somtech pour projets modulaires. Il fournit :
- des **rules Cursor** (`.cursor/rules/`)
- des **commandes Cursor** (`.cursor/commands/`)
- des **skills Cursor** (`.cursor/skills/`)
- de la **documentation générique** (ex: `docs/chatwindow/`)
- des **scripts** d’installation / synchronisation

Objectif : permettre de **standardiser** les pratiques (qualité, gouvernance, MCP, UX) et de **mettre à jour facilement** plusieurs projets.

## Portée

Inclus :
- Installation/mise à jour du pack dans un projet
- Publication de modifications vers le pack via PR (workflow Git)

Exclus :
- Déploiement production automatique
- Stockage de secrets / tokens

## User stories

- US-PACK-001 : En tant que dev, je peux mettre à jour mon projet depuis le pack en une commande.
- US-PACK-002 : En tant que dev, je peux publier des rules/skills depuis un projet vers le pack en ouvrant une PR automatiquement.
- US-PACK-003 : En tant que mainteneur, je peux éviter l’introduction de secrets/URLs sensibles dans le pack via des garde-fous.

## Règles métier / règles de contribution

- Le contenu du pack doit être **générique** : placeholders, pas d’IDs/URLs sensibles.
- Toute modification passe par **branche + PR** (pas de push direct sur `main`).
- Les release notes suivent le template `.specify/templates/releasenote-template.md`.

## Flux (pull / push)

- Pull : projet → clone pack → install vers projet (backup automatique)
- Push : projet → diff-based → clone pack → branche → commit → push → PR → release note

## Mapping (code ↔ produit)

- Installation : `scripts/install_somtech_pack.sh`
- Update local (pull) : `scripts/somtech_pack_pull.sh`
- Publication (push) : `scripts/somtech_pack_push.sh`
- Lib partagée : `scripts/lib/somtech_pack_common.sh`
- Commandes Cursor :
  - `.cursor/commands/somtech.pack.pull.md`
  - `.cursor/commands/somtech.pack.push.md`

## Critères d’acceptation

- CA-PACK-001 : `somtech_pack_pull.sh --dry-run` liste les fichiers et ne modifie rien.
- CA-PACK-002 : `somtech_pack_pull.sh` met à jour le projet et crée des backups.
- CA-PACK-003 : `somtech_pack_push.sh` crée une PR et une release note dans `.cursor/releasenotes/`.
- CA-PACK-004 : `somtech_pack_push.sh` bloque en cas de détection de secrets.

## Changelog

- 2026-01-06 : Ajout des scripts `somtech_pack_pull.sh` / `somtech_pack_push.sh`, template release note, et commandes Cursor associées.
