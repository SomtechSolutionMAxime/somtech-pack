# somtech-pack

> v1.0.0

Pack de configuration et marketplace de plugins Somtech pour **Claude Code** et **Cursor**. Fournit skills, agents, commandes, plugins Cowork et blueprints de features réutilisables dans tous les projets clients.

## Installation rapide

```bash
# Installation one-liner (depuis n'importe quel projet)
curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target .

# Installation locale (si le pack est cloné)
./scripts/install_somtech_pack.sh --target /path/to/project
```

## Contenu du pack

### 1. Plugins Cowork (`plugins/`)

| Plugin | Version | Description |
|--------|---------|-------------|
| **audit-loi25** | v0.4.0 | Audit de conformité Loi 25 / P-39.1 (Québec) avec génération de rapports PDF |
| **somtech-proposals** | v0.2.0 | Complétion de contrats cadres, cahiers des charges et offres de services |
| **somtech-silo-manager** | v1.0.0 | Génération et déploiement de silos applicatifs (architecture multi-tenant) |

Chaque plugin inclut un `.zip` versionné prêt à installer dans Claude Cowork.

### 2. Configuration Claude Code (`.claude/`)

| Composant | Contenu |
|-----------|---------|
| **Skills** (15) | audit-rls, create-migration, deploy-metering, end-session, feature-doc-generator, git-module, mcp-builder, mockmig, playwright-tests, prototype, scaffold-component, somtech-pack-maj, speckit, validate-ui, webapp-testing |
| **Agents** (7) | backend, database, design, devops, frontend, product, qa |
| **Commandes** | mockmig, pousse |
| **Templates** | Bootstrap pour ontologie, constitution, architecture sécurité |

### 3. Configuration Cursor (`.cursor/`)

| Composant | Contenu |
|-----------|---------|
| **Commandes** | mockmig, speckit, somtech-pack (sync/deploy/diagnostic), polish, refactoring |
| **Skills** | git-commit-pr, build-chatwindow, configure-mcp-server |
| **Rules** | Règles et contexte projet |

### 4. Features (blueprints réutilisables) (`features/`)

| Feature | Description |
|---------|-------------|
| **metering-billing** | Système de métriques et facturation (tables, Edge Functions, cron) |
| **audio-transcription-analysis** | Transcription et analyse audio |

### 5. Documentation (`docs/`)

| Doc | Description |
|-----|-------------|
| **chatwindow** | ChatWindow + widgets (composant réutilisable) |
| **migrations** | Guide des migrations Supabase |

### 6. Sécurité (`security/`)

| Document | Description |
|----------|-------------|
| `ARCHITECTURE_DE_SECURITÉ.md` | RLS, guards, patterns de sécurité |
| `PROTECTION_DONNEES_LOI25.md` | Conformité Loi 25 / P-39.1 (Québec) |
| `references/` | Documents officiels (P-39.1, Guide EFVP CAI) |

### 7. Scripts (`scripts/`)

| Script | Description |
|--------|-------------|
| `install_somtech_pack.sh` | Installation du pack dans un projet |
| `remote-install.sh` | Installation one-liner via curl |
| `somtech_pack_pull.sh` | Mise à jour d'un projet depuis le pack (diff + versioning) |
| `somtech_pack_push.sh` | Publier des changements depuis un projet vers le pack |
| `somtech_pack_add.sh` | Ajouter un composant au pack |

## Système modulaire (`pack.json`)

Le pack est organisé en modules activables :

| Module | Par défaut | Contenu |
|--------|------------|---------|
| **core** | oui | `.claude/`, `.cursor/`, `scripts/`, `docs/`, `security/` |
| **features** | oui | `features/` (blueprints réutilisables) |
| **mockmig** | non | `.mockmig/`, `.specify/` (workflow migration maquette) |
| **plugins** | non | `plugins/` (marketplace Cowork) |

## Synchronisation avec les projets clients

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

### Structure des plugins

```
plugins/nom-du-plugin/
├── .claude-plugin/plugin.json    # Manifeste (obligatoire)
├── commands/                     # Commandes slash
├── skills/                       # Skills avec SKILL.md
├── templates/                    # Gabarits et fichiers de référence
├── nom-du-plugin-vX.Y.Z.zip     # Archive versionnée pour Cowork
└── README.md
```
