# somtech-pack

Pack de configuration et skills réutilisables pour Claude Code et Cursor.

## Structure du Projet

```
.claude/           # Skills et templates Claude Code
.cursor/           # Commands et skills Cursor
.mockmig/          # Scripts et templates mockmig
docs/              # Documentation
scripts/           # Scripts utilitaires
security/          # Documentation sécurité
```

## Skills Disponibles

### Claude Code (.claude/skills/)

- **mockmig/** - Workflow de migration avec phases (init, discover, analyze, plan, execute, status)
- **git-module/** - Gestion des sous-modules git (status, add, list, sync, remove)

### Cursor (.cursor/skills/)

- **git-commit-pr/** - Workflow git avec commits conventionnels et PRs
- **build-chatwindow/** - Construction de chat windows
- **configure-mcp-server/** - Configuration serveurs MCP

## Conventions

### Commits

Format conventionnel: `type(scope): description`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

### Fichiers à ignorer

`.DS_Store` est ignoré via `.gitignore`
