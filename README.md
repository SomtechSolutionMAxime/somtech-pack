# somtech-pack

> v1.2.0

Pack de configuration et marketplace de plugins Somtech pour **Claude Code**. Fournit skills, agents, commandes, hooks, plugins Cowork et blueprints de features réutilisables dans tous les projets clients.

## Installation rapide

**Méthode canonique — CLI npm (`@somtech-solutions/pack`)** :

```bash
# Dans un projet : installe les modules du pack (interactif)
npx @somtech-solutions/pack init

# Modules explicites / mode CI
npx @somtech-solutions/pack init --modules core,features,mockmig --yes

# Mettre à jour un projet (présente un diff, n'écrase pas sans --force)
npx @somtech-solutions/pack update

# Configurer le poste : skills globaux (~/.claude/skills) + claude-swt (~/.zshrc)
npx @somtech-solutions/pack setup --yes
```

> **Prérequis registre (une fois par poste)** — le package est privé sur **GitHub Packages**.
> Ajoute à ton `~/.npmrc` :
> ```
> @somtech-solutions:registry=https://npm.pkg.github.com
> //npm.pkg.github.com/:_authToken=<ton_PAT_avec_read:packages>
> ```
> Pourquoi `npx` plutôt que `npm i -g` : on lance l'outil ponctuellement, toujours
> à la bonne version (`@latest` ou une version épinglée), sans install globale à maintenir.

> ⚠️ `npx @somtech-solutions/pack` n'est disponible **qu'après la première publication**
> du package (voir `cli/README.md`). En attendant, utilise la méthode transitoire ci-dessous.

<details>
<summary>Méthode transitoire (legacy) — <code>curl | bash</code></summary>

```bash
# Installation one-liner (depuis n'importe quel projet)
curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target .

# Setup poste (claude-swt) en attendant le CLI
curl -fsSL .../scripts/remote-install.sh | bash -s -- --with-claude-swt

# Installation locale (si le pack est cloné)
./scripts/somtech_pack_pull.sh --target /path/to/project
```

Cette méthode reste fonctionnelle mais sera dépréciée une fois le CLI publié.
</details>

## Contenu du pack

### 1. Plugins Cowork (`plugins/`)

| Plugin | Version | Description |
|--------|---------|-------------|
| **audit-loi25** | v0.4.0 | Audit de conformité Loi 25 / P-39.1 (Québec) avec génération de rapports PDF |
| **somtech-proposals** | v0.2.0 | Complétion de contrats cadres, cahiers des charges et offres de services |
| **somtech-silo-manager** | v1.0.0 | Génération et déploiement de silos applicatifs (architecture multi-tenant) |
| **somtech-somcraft-deployer** | v1.0.0 | Déploiement de SomCraft sur les clients (migrations + Fly.io) |
| **somtech-rag** | v1.0.0 | Déploiement du Somtech RAG Service par client |
| **somtech-estimator** | v0.1.0 | Estimation de coûts/temps de projets |
| **mcp-expose** | v0.1.0 | Exposition de capacités locales en MCP |

Chaque plugin inclut un `.zip` versionné prêt à installer dans Claude Cowork. La marketplace est exposée via `.claude-plugin/marketplace.json` à la racine du repo.

### 2. Configuration Claude Code (`.claude/`)

| Composant | Contenu |
|-----------|---------|
| **Skills** (22) | audit-rls, create-migration, deploy-aims, deploy-metering, end-session, feature-doc-generator, git-module, lier-app, mcp-builder, merge, mockmig, plan-servicedesk, pousse-staging, prototype, scaffold-aims, scaffold-component, somtech-pack-global, somtech-pack-maj, speckit, sync-app-state, validate-ui, webapp-testing |
| **Agents** (7) | backend, database, design, devops, frontend, product, qa |
| **Commandes** | `/pousse` |
| **Hooks** | `SessionStart` → mémoire externe d'état d'app (STD-027) |
| **Templates** | Bootstrap pour ontologie, constitution, architecture sécurité, USER_CLAUDE_MD.md |
| **User-skills** | `somtech-pack-install` (skill global utilisateur pour bootstrap d'un projet) |

### 3. Features (blueprints réutilisables) (`features/`)

| Feature | Description |
|---------|-------------|
| **metering-billing** | Système de métriques et facturation (tables, Edge Functions, cron) |
| **audio-transcription-analysis** | Transcription et analyse audio |

### 4. Documentation (`docs/`)

| Doc | Description |
|-----|-------------|
| **chatwindow** | ChatWindow + widgets (composant réutilisable) |
| **migrations** | Guide des migrations Supabase |
| **superpowers** | Specs et plans d'implémentation (workflow brainstorming → writing-plans → executing-plans) |

### 5. Sécurité (`security/`)

| Document | Description |
|----------|-------------|
| `ARCHITECTURE_DE_SECURITÉ.md` | RLS, guards, patterns de sécurité |
| `PROTECTION_DONNEES_LOI25.md` | Conformité Loi 25 / P-39.1 (Québec) |
| `references/` | Documents officiels (P-39.1, Guide EFVP CAI) |

### 6. Scripts (`scripts/`)

| Script | Description |
|--------|-------------|
| `remote-install.sh` | Installation / mise à jour one-liner via curl (délègue à `somtech_pack_pull.sh`) |
| `somtech_pack_pull.sh` | Mise à jour d'un projet depuis le pack (détection de version, diff, modules sélectionnables) |
| `somtech_pack_push.sh` | Publier des changements depuis un projet vers le pack (scope par défaut : `.claude,docs,scripts,README.md`) |
| `somtech_pack_add.sh` | Ajouter un composant au pack |
| `install_user_skills.sh` | Installer le user-skill `somtech-pack-install` dans `~/.claude/` |
| `update_speckit_assets.sh` | Mettre à jour les assets Speckit |

## Système modulaire (`pack.json`)

Le pack est organisé en modules activables :

| Module | Par défaut | Contenu |
|--------|------------|---------|
| **core** | oui | `.claude/`, `scripts/`, `docs/` |
| **features** | oui | `features/` (blueprints réutilisables) |
| **security** | non | `security/` (doc sécurité Somtech — Loi 25, CAI). **Opt-in** : ne pas écraser l'architecture sécurité projet-spécifique. |
| **mockmig** | non | `.mockmig/`, `.specify/` (workflow migration maquette) |
| **plugins** | non | `plugins/` (marketplace Cowork) |

## Synchronisation avec les projets clients

### Pull — mettre à jour un projet depuis le pack

```bash
./scripts/somtech_pack_pull.sh --target .
```

Skill équivalent disponible dans Claude Code : `/somtech-pack-maj`.

### Push — publier des changements depuis un projet vers le pack

```bash
./scripts/somtech_pack_push.sh --message "chore(pack): sync skills/agents"
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
