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

## Notes

- Chaque skill doit être **générique** : pas d’IDs, URLs ou secrets réels dans le pack.
- Utilisez des placeholders (`votre-project-id`, `YOUR_TOKEN`) et documentez où les remplacer.
