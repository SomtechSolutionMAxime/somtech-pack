# Skills Cursor — somtech-pack

Ce dossier contient des **Agent Skills** (format `SKILL.md`) utilisables par Cursor pour étendre un agent avec des workflows réutilisables.

## Skills inclus

### `build-chatwindow`

- Objectif : construire une UI de chat (ChatWindow) + widgets `ChatWidget` (contrat SSE), plus une méthode de validation via Playground.
- Doc associée (pack) : `docs/chatwindow/README.md`

### `configure-mcp-server`

- Objectif : aider à configurer un serveur MCP dans Cursor via `~/.cursor/mcp.json`.
- Templates : `references/SERVEURS_MCP.md` (à compléter par projet)
- Exemple (optionnel) : `references/SERVEURS_ORBIT.md` (liste de serveurs type — URLs à adapter)

### `git-commit-pr`

- Objectif : guider la création de commits bien formatés, push vers origin et création de Pull Requests documentées.
- Format : Conventional Commits avec templates de PR complets
- Références : `PR_TEMPLATE.md`, `COMMIT_EXAMPLES.md`, `GIT_WORKFLOW.md`

## Structure (rappel)

```
.cursor/skills/
  skill-name/
    SKILL.md
    README.md
    references/
    scripts/
    assets/
```

## Versioning

Tous les skills suivent [Semantic Versioning 2.0.0](https://semver.org/) et maintiennent un CHANGELOG.

Voir [VERSIONING.md](./VERSIONING.md) pour la politique complète de versioning.

### Versions actuelles
- **build-chatwindow** : v1.1.0 ([CHANGELOG](./build-chatwindow/CHANGELOG.md))
- **configure-mcp-server** : v1.2.0 ([CHANGELOG](./configure-mcp-server/CHANGELOG.md))
- **git-commit-pr** : v1.0.0 ([CHANGELOG](./git-commit-pr/CHANGELOG.md))

## Notes

- Chaque skill doit être **générique** : pas d'IDs, URLs ou secrets réels dans le pack.
- Utilisez des placeholders (`votre-project-id`, `YOUR_TOKEN`) et documentez où les remplacer.
- Chaque skill maintient son propre **CHANGELOG.md** et suit **Semantic Versioning**.
