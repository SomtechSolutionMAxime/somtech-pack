---
name: somtech-pack-install
description: |
  Installer le somtech-pack dans le projet courant (via npx).
  TRIGGERS : installe le pack, install somtech, somtech-pack install, bootstrap somtech, init somtech, installe somtech-pack
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# Installer le somtech-pack dans le projet courant (npx)

Installe la config Somtech (skills, agents, commandes, hooks, features, scripts) dans le projet courant via le CLI **`@somtech-solutions/pack`** (npx).

> Le pack **ne pousse pas** de `.claude/CLAUDE.md` projet (D-20260513-0009). Le contexte transversal vit dans `~/.claude/CLAUDE.md` (global). Un CLAUDE.md projet local éventuel reste intact.

## Prérequis

- Repo git initialisé (`git init` si besoin).
- **Registre (une fois par poste)** — package privé GitHub Packages. `~/.npmrc` doit contenir :
  ```
  @somtech-solutions:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=<PAT read:packages>
  ```
  Sans ça, `npx` échoue (signaler à l'utilisateur).
- `npx` (Node) disponible.

## Phase 0 — Vérifications

```bash
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "❌ Pas un repo git. 'git init' d'abord."; exit 1; }
if [ -f .somtech-pack/version.json ]; then
  echo "⚠️ Pack déjà installé → utilise /somtech-pack-maj pour mettre à jour."; exit 0
fi
command -v npx >/dev/null 2>&1 || { echo "❌ npx (Node) requis."; exit 1; }
```

## Phase 1 — Aperçu (dry-run, OBLIGATOIRE)

```bash
npx @somtech-solutions/pack@latest init --dry-run
# modules explicites possibles : --modules core,features,mockmig
```

Présenter le rapport (créés / dossiers `.claude/ features/ scripts/ docs/`) et **attendre confirmation**.

## Phase 2 — Installation

Après confirmation :

```bash
npx @somtech-solutions/pack@latest init --yes
# ou avec des modules précis : npx @somtech-solutions/pack@latest init --modules core,features,mockmig --yes
```

## Phase 3 — Post-installation

1. **Mémoire d'état d'app (STD-027)** : lancer `/lier-app` pour créer `.somtech/app.yaml` + le doc Somcraft `/operations/<app-slug>/etat-app.md` (active le hook SessionStart d'état d'app).
2. **Setup poste (recommandé, 1× par machine)** : `npx @somtech-solutions/pack@latest setup` installe les skills globaux + `claude-swt` + le hook de nudge de version.
3. **Commit** (après confirmation) :
   ```bash
   git add .claude/ features/ scripts/ docs/ .somtech-pack/
   git commit -m "chore: bootstrap somtech-pack"
   ```

## Fallback legacy (si npx indisponible / auth absente)

```bash
curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target .
```

## Règles critiques

1. **Toujours** dry-run + résumé avant d'installer.
2. **Ne jamais** commiter sans confirmation.
3. **Ne jamais** toucher à `.claude/CLAUDE.md` projet (D-20260513-0009).
4. `.claude/settings.json` est créé s'il est absent, mais **jamais écrasé** ensuite (config projet préservée).
