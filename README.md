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
| **Skills** (24) | audit-rls, create-migration, deploy-aims, deploy-metering, end-session, feature-doc-generator, git-module, lier-app, mcp-builder, merge, mockmig, plan-servicedesk, pousse-staging, prototype, scaffold-aims, scaffold-component, setup-archi-ci, somtech-pack-global, somtech-pack-maj, speckit, superplan, sync-app-state, validate-ui, webapp-testing |
| **Agents** (7) | backend, database, design, devops, frontend, product, qa |
| **Commandes** | `/pousse` |
| **Hooks** | `SessionStart` → mémoire externe d'état d'app (STD-027) ; `SessionStart` → registre injoignable (E-20260807-0009) |
| **Templates** | Bootstrap pour ontologie, constitution, architecture sécurité, USER_CLAUDE_MD.md |
| **User-skills** | `somtech-pack-install` (skill global utilisateur pour bootstrap d'un projet) |

### Les jetons MCP du poste — un lieu unique

Claude Code résout les `${VAR}` d'un `.mcp.json` depuis l'environnement du **processus**
qui lance la session, jamais depuis un fichier. Un serveur dont la variable manque est
refusé au premier échange et **disparaît de la session** : l'agent n'a plus de registre,
et il ne s'en aperçoit qu'au premier appel — souvent après avoir déjà travaillé.

Le pack tient donc les jetons du poste à **un seul endroit**, `~/.somtech/mcp-env` (droits
`600`, hors de tout dépôt), chargé par `scripts/shell/mcp-env.sh`. Cette lib est sourcée
par `claude-swt.sh`, lui-même sourcé par le rc du shell : **tout** shell du poste porte
les jetons, donc toute session `claude` qui en naît les hérite — y compris celles qui ne
passent pas par le lanceur (agent ouvert par un orchestrateur, `claude` lancé directement
dans un plan de travail existant, reprise de session).

| Commande | Rôle |
|---|---|
| `python3 scripts/migrate-mcp-secrets.py` | inspecte : quels jetons sont encore en clair dans `~/.claude.json` |
| `… --apply` | les déplace vers le lieu unique et les remplace par `${VAR}` |
| `… --from-env <.env> --apply` | importe aussi les jetons d'un serveur déclaré au seul niveau projet |
| `claude mcp list` | le verdict vivant : quels serveurs répondent réellement |

La réécriture de `~/.claude.json` est prudente **parce que ce fichier est partagé et
vivant** (une centaine de projets, plus les réglages de toutes les sessions ouvertes) :
relecture avant écriture, écriture atomique, sauvegarde, et vérification après coup que
rien d'autre n'a bougé — restauration sinon. Un conflit de valeurs est **signalé, jamais
tranché à ta place**.

Le hook `session-start-registre.sh` ferme la boucle : si malgré tout un agent naît sans
registre, il l'apprend **à sa naissance**, avec le nom des serveurs muets et le geste qui
répare.

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
