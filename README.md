# somtech-pack

Pack de démarrage Somtech pour projets modulaires.

## Contenu
- `.cursor/rules/` : règles Cursor
- `.cursor/commands/` : commandes Cursor (Somtech + autres si présentes)
- `scripts/install_somtech_pack.sh` : script d’installation (backup + overwrite)

## Installer dans un nouveau projet

Depuis le projet cible (repo vide ou existant) :

```bash
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --dry-run
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target .
```

### Installer uniquement les commandes Somtech

```bash
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --somtech-only
```

## Comportement
- Si un fichier `.cursor/*` existe déjà dans le projet cible :
  - backup automatique en `*.bak-YYYYMMDDHHMMSS`
  - puis copie du fichier pack
- La structure modulaire minimale est créée uniquement si absente :
  - `modules/_template/{mcp,prd,tests}`
  - `modules/_shared/`
