---
name: somtech-pack-install
description: |
  Installer le somtech-pack dans le projet courant.
  TRIGGERS : installe le pack, install somtech, somtech-pack install, bootstrap somtech, init somtech, installe somtech-pack
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# Installer le somtech-pack dans le projet courant

Installe le pack de configuration Somtech (skills, agents, commandes, hooks, features, scripts) dans le projet courant via Claude Code.

> Le pack **ne pousse pas** de `.claude/CLAUDE.md` projet depuis 2026-05-13 (cf. D-20260513-0009). Le contexte transversal Somtech vit dans `~/.claude/CLAUDE.md` (global utilisateur). Si le projet a besoin d'un CLAUDE.md projet local pour du contenu vraiment spécifique, il le crée lui-même — l'installateur n'y touche pas.

## Prérequis

- Le projet courant doit être un repo git initialisé
- Accès réseau à GitHub (https://github.com/SomtechSolutionMAxime/somtech-pack.git)

## Phase 0 — Vérification

### 0.1 Vérifier si le pack est déjà installé

```bash
if [ -d ".claude/skills" ] && [ -f ".somtech-pack/version.json" ]; then
  echo "⚠️  Le somtech-pack semble déjà installé (.claude/skills/ + .somtech-pack/version.json présents)."
  echo "→ Utilise /somtech-pack-maj pour mettre à jour."
  exit 0
fi
```

Si le pack est déjà présent, **arrêter** et proposer `/somtech-pack-maj` à la place.

### 0.2 Vérifier que c'est un repo git

```bash
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "❌ Ce n'est pas un repo git. Initialise avec 'git init' d'abord."
  exit 1
fi
```

## Phase 1 — Cloner le pack

```bash
WORKDIR=$(mktemp -d)
echo "📦 Clonage du somtech-pack..."
git clone --depth 1 --branch main https://github.com/SomtechSolutionMAxime/somtech-pack.git "$WORKDIR/somtech-pack"
```

## Phase 2 — Dry-run et prévisualisation

```bash
"$WORKDIR/somtech-pack/scripts/somtech_pack_pull.sh" --target "$(pwd)" --dry-run
```

**OBLIGATOIRE** : Afficher le résumé du dry-run à l'utilisateur et **attendre sa confirmation** avant de continuer.

Présenter :
1. Les dossiers qui seront créés/mis à jour (`.claude/`, `features/`, `scripts/`, `docs/`, `security/`)
2. Les fichiers qui seront copiés
3. Si des fichiers existants seront écrasés (le script fait des backups `.bak`)

## Phase 3 — Installation

Après confirmation explicite de l'utilisateur :

```bash
"$WORKDIR/somtech-pack/scripts/somtech_pack_pull.sh" --target "$(pwd)"
```

## Phase 4 — Nettoyage

```bash
rm -rf "$WORKDIR"
echo "🧹 Dossier temporaire nettoyé."
```

## Phase 5 — Post-installation

### 5.1 Suggestions au projet

Rappeler à l'utilisateur que :

1. **Pour activer la mémoire externe d'état d'app (STD-027)** : lancer `/lier-app` pour créer `.somtech/app.yaml` et le doc Somcraft `/operations/<app-slug>/etat-app.md`. Cela active aussi le hook `SessionStart` qui injecte l'état au boot.

2. **Sources de vérité projet** (optionnel) : si le projet a une ontologie, une constitution ou un doc sécurité, les placer aux chemins conventionnels :
   - `ontologie/02_ontologie.yaml`
   - `memory/constitution.md`
   - `security/ARCHITECTURE_DE_SECURITE.md`

3. **CLAUDE.md projet local** (optionnel) : seulement si le projet a du contenu vraiment spécifique non-déductible (ex: convention de domaine métier exotique). Le pack ne le pousse pas, donc tu peux le créer librement sans crainte de conflit lors des futurs `/somtech-pack-maj`.

### 5.2 Proposer le commit

```bash
git add .claude/ features/ scripts/ docs/ security/
git status
```

Montrer le `git status` et proposer :

```bash
git commit -m "chore: bootstrap somtech-pack"
```

**Attendre la confirmation** avant de commiter.

## Options

L'utilisateur peut demander une installation partielle. Passer les flags appropriés à `somtech_pack_pull.sh` :

| Demande | Flags |
|---------|-------|
| "installe seulement core" | `--modules core` |
| "installe sans les features" | `--modules core` (par défaut features est inclus) |
| "dry-run seulement" | `--dry-run` |
| "installe depuis une branche" | `--ref <branche>` |

## Règles critiques

1. **Toujours** faire un dry-run et montrer le résumé avant d'installer
2. **Ne jamais** commiter sans confirmation explicite
3. **Ne jamais** toucher à `.claude/CLAUDE.md` projet (le pack ne le gère plus depuis D-20260513-0009)
4. **Nettoyer** le dossier temporaire même en cas d'erreur
