# @somtech-solutions/pack

CLI d'installation du **somtech-pack** — point d'entrée unique pour installer la
configuration Claude Code de Somtech (skills, agents, commandes, hooks), les
blueprints de features, et l'outillage de poste (`claude-swt`).

## Prérequis (une fois par poste)

Le package est **privé** sur **GitHub Packages**. Configure ton `~/.npmrc` :

```
@somtech-solutions:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<PAT avec read:packages>
```

(`npx` lira automatiquement cette config pour résoudre le scope `@somtech-solutions`.)

## Usage

```bash
# Installer le pack dans le projet courant (modules core,features par défaut)
npx @somtech-solutions/pack init
npx @somtech-solutions/pack init --modules core,features,mockmig --yes

# Mettre à jour le projet (présente un diff ; n'écrase pas sans --force)
npx @somtech-solutions/pack update
npx @somtech-solutions/pack update --force

# Configurer le poste : skills globaux (~/.claude/skills) + workflows globaux
# (~/.claude/workflows) + claude-swt (~/.zshrc)
npx @somtech-solutions/pack setup --yes
npx @somtech-solutions/pack setup --dry-run      # aperçu sans écrire
npx @somtech-solutions/pack setup --no-skills    # claude-swt seul
npx @somtech-solutions/pack setup --no-workflows # ne pas mirrorer les workflows
```

### Options

| Option | Effet |
|--------|-------|
| `--modules <csv>` | Modules à installer (`core,features,mockmig,security,plugins`) |
| `--target <dir>` | Projet cible (défaut : répertoire courant) |
| `--force` | `update` : écrase les fichiers divergents |
| `--dry-run` | N'écrit rien, affiche le plan |
| `--yes`, `-y` | Non-interactif (CI) / consentement explicite (`setup` écrit le rc) |
| `--rc` / `--skills-dir` / `--workflows-dir` / `--dest` | `setup` : cibles personnalisées |
| `--no-skills` / `--no-workflows` / `--no-claude-swt` | `setup` : restreindre la portée |

`npx` plutôt que `npm i -g` : l'outil se lance ponctuellement, toujours à la bonne
version (`@latest` ou une version épinglée), sans installation globale à maintenir.

## Modules

Définis dans `pack.json` (bundlé). `core` + `features` sont installés par défaut ;
`security`, `mockmig`, `plugins` sont opt-in via `--modules`.

## Sécurité / idempotence

- Copie **idempotente** : un re-`init` ne touche pas les fichiers identiques ; `update`
  ne remplace un fichier divergent qu'avec `--force`.
- **Containment strict** : aucun fichier n'est écrit hors de la cible ; les symlinks
  du payload sont ignorés.
- `setup` **sauvegarde** le rc (`<rc>.somtech.bak`) avant toute écriture et **refuse**
  d'agir sans consentement (`--yes` ou prompt).

## Publication

Le contenu du pack est **bundlé** dans le tarball au publish (construit depuis le repo,
anti-drift) via un tag `v*` (`.github/workflows/publish.yml`). La version npm suit le tag.
