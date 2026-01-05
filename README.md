# somtech-pack

Pack de démarrage Somtech pour projets modulaires.

## Contenu
- `.cursor/rules/` : règles Cursor
- `.cursor/commands/` : commandes Cursor (Somtech + autres si présentes)
- `.cursor/skills/` : Agent Skills Cursor (réutilisables dans différents projets)
- `docs/chatwindow/` : documentation générique “ChatWindow + widgets” (réutilisable)
- `scripts/install_somtech_pack.sh` : script d’installation (backup + overwrite)

## Installer dans un nouveau projet

Depuis le projet cible (repo vide ou existant) :

```bash
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --dry-run
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target .
```

### Installer sans skills et/ou sans docs

```bash
# Installer uniquement rules + commands (sans skills ni doc)
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --no-skills --no-docs

# Installer sans docs
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --no-docs

# Installer sans skills
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --no-skills
```

### Installer sans skills et/ou sans docs

```bash
# Installer uniquement rules + commands (sans skills ni doc)
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --no-skills --no-docs

# Installer sans docs
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --no-docs

# Installer sans skills
/path/to/somtech-pack/scripts/install_somtech_pack.sh --target . --no-skills
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
