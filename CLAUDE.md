# somtech-pack

Dépôt central de Somtech qui sert deux objectifs : le **marketplace de plugins Cowork** de Somtech et le **pack de configuration réutilisable** pour les sessions Claude Code et Cursor dans les projets clients.

## Ce que contient ce repo

### 1. Marketplace de Plugins (`plugins/`)

Répertoire des plugins Claude Cowork développés par Somtech. Chaque plugin est un dossier autonome avec sa propre structure `.claude-plugin/`.

| Plugin | Description |
|--------|-------------|
| **somtech-silo-manager** | Génération et déploiement de silos applicatifs (architecture multi-tenant) |
| **somtech-proposals** | Complétion de cahiers des charges et offres de services à partir de gabarits Word, avec vérification de cohérence des clauses juridiques contre le contrat cadre client |

### 2. Configuration Claude Code (`.claude/`)

Configuration réutilisable installée dans chaque projet client via les scripts de synchronisation.

| Composant | Rôle |
|-----------|------|
| `.claude/CLAUDE.md` | Template de contexte projet (sources de vérité, stack, règles critiques, workflows Supabase, gestion des ports) |
| `.claude/agents/` | Sub-agents spécialisés (frontend, backend, qa, product, database, devops, design) |
| `.claude/skills/` | Skills Claude Code : mockmig, git-module, scaffold-component, create-migration, audit-rls, validate-ui, speckit |
| `.claude/commands/` | Commandes slash Claude Code (mockmig) |
| `.claude/templates/` | Templates de bootstrap pour les sources de vérité (ontologie, constitution, architecture sécurité) |
| `.claude/schemas/` | Schémas JSON (sessions mockmig) |
| `.claude/settings.json` | Configuration des permissions et outils Claude Code |

### 3. Configuration Cursor (`.cursor/`)

| Composant | Rôle |
|-----------|------|
| `.cursor/commands/` | Commandes Cursor (mockmig, speckit, somtech-pack sync, deploy, etc.) |
| `.cursor/skills/` | Skills Cursor réutilisables (git-commit-pr, build-chatwindow, configure-mcp-server) |
| `.cursor/rules/` | Règles et contexte projet pour Cursor |
| `.cursor/prd/` | PRD du pack lui-même |
| `.cursor/releasenotes/` | Notes de version du pack (historique des changements) |

### 4. Documentation et Outils

| Dossier | Rôle |
|---------|------|
| `docs/` | Documentation générique réutilisable (ex: ChatWindow + widgets) |
| `features/` | Documentation technique de features implémentées (blueprints réutilisables entre projets) |
| `scripts/` | Scripts d'installation, synchronisation pull/push, utilitaires |
| `security/` | Documentation sur l'architecture de sécurité |
| `.mockmig/` | Scripts et templates du workflow mockmig |
| `.specify/` | Templates pour spécifications (release notes, etc.) |

## Synchronisation avec les projets clients

### Installer dans un nouveau projet

```bash
./scripts/install_somtech_pack.sh --target /path/to/project --dry-run
./scripts/install_somtech_pack.sh --target /path/to/project
```

### Pull — mettre à jour un projet depuis le pack

```bash
./scripts/somtech_pack_pull.sh --target .
```

### Push — publier des changements depuis un projet vers le pack

```bash
./scripts/somtech_pack_push.sh --message "chore(pack): sync rules/skills"
```

## Conventions

### Commits

Format conventionnel : `type(scope): description`

Types : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

### Plugins

Chaque plugin dans `plugins/` doit respecter la structure standard Claude Cowork :

```
plugins/nom-du-plugin/
├── .claude-plugin/plugin.json    # Manifeste (obligatoire)
├── commands/                     # Commandes slash
├── skills/                       # Skills avec SKILL.md
├── templates/                    # Gabarits et fichiers de référence
└── README.md                     # Documentation du plugin
```

### Fichiers à ignorer

`.DS_Store` est ignoré via `.gitignore`
