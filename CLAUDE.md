# somtech-pack

Dépôt central de Somtech qui sert deux objectifs : le **marketplace de plugins Cowork** de Somtech et le **pack de configuration réutilisable** pour les sessions Claude Code et Cursor dans les projets clients.

## Ce que contient ce repo

### 1. Marketplace de Plugins (`plugins/`)

Répertoire des plugins Claude Cowork développés par Somtech. Chaque plugin est un dossier autonome avec sa propre structure `.claude-plugin/`.

| Plugin | Description |
|--------|-------------|
| **somtech-silo-manager** | Génération et déploiement de silos applicatifs (architecture multi-tenant) |
| **somtech-proposals** | Complétion de cahiers des charges et offres de services à partir de gabarits Word, avec vérification de cohérence des clauses juridiques contre le contrat cadre client |
| **audit-loi25** | Audit de conformité Loi 25 / P-39.1 (Québec) pour projets Supabase/React/TypeScript — détection PII, vérification RLS, chiffrement, masquage frontend, gouvernance et incidents |
| **somtech-estimator** | Estimation de projets forfaitaires — comparaison traditionnelle vs IA-assistée avec analyse de risque |

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

## Installation et synchronisation

### Modules disponibles

Le pack est modulaire. Chaque module est défini dans `pack.json` :

| Module | Par défaut | Contenu |
|--------|:----------:|---------|
| **core** | ✓ | `.claude/`, `.cursor/`, `scripts/`, `docs/`, `security/` |
| **features** | ✓ | `features/` — Blueprints de features réutilisables |
| **mockmig** | ○ | `.mockmig/`, `.specify/` — Workflow migration maquette → production |
| **plugins** | ○ | `plugins/` — Plugins Cowork (audit-loi25, somtech-proposals, somtech-silo-manager) |

### Méthode 1 — Installation one-liner (recommandée)

```bash
curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target .
curl -fsSL .../remote-install.sh | bash -s -- --target . --modules core,features,mockmig
```

### Méthode 2 — Installation locale (pack cloné)

```bash
./scripts/install_somtech_pack.sh --target /path/to/project --dry-run
./scripts/install_somtech_pack.sh --target /path/to/project
./scripts/install_somtech_pack.sh --target /path/to/project --modules core,features,plugins
./scripts/install_somtech_pack.sh --list-modules
```

### Méthode 3 — Mise à jour (pull avec diff)

```bash
./scripts/somtech_pack_pull.sh --target .
./scripts/somtech_pack_pull.sh --target . --force
./scripts/somtech_pack_pull.sh --target . --modules core,features
```

### Push — publier des changements depuis un projet vers le pack

```bash
./scripts/somtech_pack_push.sh --message "chore(pack): sync rules/skills"
```

### Versioning

Chaque installation crée `.somtech-pack/version.json` dans le projet cible, permettant de détecter la version installée et les mises à jour disponibles. La version du pack est dans `VERSION` à la racine.

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

### Distribution des plugins (fichiers .zip versionnés)

Chaque plugin contient un fichier `.zip` **versionné** prêt à installer dans Claude Cowork, placé **dans son propre dossier** :

```
plugins/
├── audit-loi25/
│   ├── audit-loi25-v0.3.0.zip    # Archive versionnée pour installation Cowork
│   ├── .claude-plugin/plugin.json
│   ├── commands/
│   ├── skills/
│   └── ...
├── somtech-proposals/
│   ├── somtech-proposals-v0.2.0.zip
│   └── ...
└── somtech-silo-manager/
    ├── somtech-silo-manager-v1.0.0.zip
    └── ...
```

**Convention de nommage :** `<nom-du-plugin>-v<version>.zip` (la version vient de `plugin.json`)

**Règles :**
- Le `.zip` est créé **depuis l'intérieur** du dossier plugin pour que la racine du zip contienne directement `.claude-plugin/`, `commands/`, `skills/`, etc.
- Le nom du zip inclut la version (`-v0.3.0`) pour savoir quelle version est installée sur chaque poste/session Cowork
- Exclure les `.DS_Store` et les anciens `.zip` du contenu de l'archive
- **Regénérer le .zip à chaque modification** du plugin (nouvelle commande, bump de version, etc.) — supprimer l'ancien zip avant
- Commande type : `cd plugins/nom-du-plugin && rm -f *.zip && zip -r "nom-du-plugin-v$(python3 -c "import json;print(json.load(open('.claude-plugin/plugin.json'))['version'])").zip" . -x "*.DS_Store" -x "*.zip"`

### Fichiers à ignorer

`.DS_Store` est ignoré via `.gitignore`
