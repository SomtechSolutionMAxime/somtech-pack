# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Non-versionné] - 2025-02-01

### Ajouté

- **Skills Claude Code** (.claude/skills/)
  - `mockmig/` - Workflow de migration avec 6 phases (init, discover, analyze, plan, execute, status)
  - `git-module/` - Gestion des sous-modules git avec 5 phases (status, add, list, sync, remove)
- **Templates bootstrap** (.claude/templates/bootstrap/)
  - Templates ontologie, memory, security, session
- **Schémas** (.claude/schemas/)
  - `mockmig/session.schema.json`
- **Configuration**
  - `.gitignore` pour ignorer les fichiers `.DS_Store`
  - `.claude/CLAUDE.md` instructions projet

### Modifié

- `mockmig/phases/discover.md` - Mise à jour du workflow de découverte
- `mockmig/phases/execute.md` - Mise à jour du workflow d'exécution

### Technique

- Synchronisation avec origin/main (38 fichiers récupérés)
- Nettoyage des `.DS_Store` accidentellement committés
