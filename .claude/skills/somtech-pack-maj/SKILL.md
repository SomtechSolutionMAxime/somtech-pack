---
name: somtech-pack-maj
description: |
  Mettre à jour le projet courant depuis le somtech-pack (via npx).
  TRIGGERS : somtech-pack-maj, mise à jour pack, update pack, sync pack, pull pack, maj somtech, mettre à jour le pack
  Lance `npx @somtech-solutions/pack update`, montre le diff, applique après confirmation.
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Somtech Pack — Mise à jour projet (npx)

Mettre à jour la config Claude Code (skills, agents, hooks, commandes), les features et scripts du projet courant depuis la dernière version publiée du pack — via le CLI **`@somtech-solutions/pack`** (npx). Plus besoin de cloner ni de comparer à la main : le CLI fait la copie idempotente avec diff.

## Phase 0 — Pré-vérifications

```bash
git rev-parse --show-toplevel >/dev/null 2>&1 || { echo "❌ Pas un repo git."; exit 1; }
[ -f .somtech-pack/version.json ] || echo "ℹ️ Pas de marqueur .somtech-pack/version.json — peut-être une première install → utilise /somtech-pack-install."
cat .somtech-pack/version.json 2>/dev/null   # version installée + modules
command -v npx >/dev/null 2>&1 || { echo "❌ npx (Node) requis."; exit 1; }
```

> **Prérequis registre (une fois par poste)** : package privé sur GitHub Packages. Le `~/.npmrc` doit contenir `@somtech-solutions:registry=https://npm.pkg.github.com` + un token `read:packages`. Si l'auth manque, `npx` échouera — le signaler.

## Phase 1 — Aperçu (dry-run, OBLIGATOIRE)

Déterminer les modules installés (depuis `.somtech-pack/version.json`, champ `modules` ; défaut `core,features`) et lancer l'aperçu **sans rien écrire** :

```bash
npx @somtech-solutions/pack@latest update --dry-run
# si le projet a des modules supplémentaires (ex. mockmig) :
# npx @somtech-solutions/pack@latest update --modules core,features,mockmig --dry-run
```

**Afficher le rapport à l'utilisateur** : créés / mis à jour / inchangés / **divergents (non écrasés)** / 🔒 préservés *(s'il y en a — ex. `.claude/settings.json` modifié localement)*. **Attendre sa confirmation** avant d'appliquer.

## Phase 2 — Appliquer

Après confirmation :

```bash
npx @somtech-solutions/pack@latest update
```

- Les fichiers **divergents** (que tu as modifiés localement) ne sont **pas écrasés** ; ils sont listés. Pour chacun, décider avec l'utilisateur :
  - garder la version locale → ne rien faire ;
  - prendre la version du pack → soit `npx @somtech-solutions/pack@latest update --force` (écrase **tous** les divergents), soit, plus chirurgical, `rm <fichier> && npx … update` (le fichier supprimé est recréé depuis le pack).
- `.claude/settings.json` est **préservé** (config projet) — jamais écrasé même avec `--force`.

## Phase 3 — Post-MAJ + commit

```bash
cat .somtech-pack/version.json        # confirme la nouvelle version
git status --short
```

Proposer le commit (sur la branche courante, **jamais** sur main) — **après confirmation** :

```bash
git add .claude/ features/ scripts/ docs/ .somtech-pack/
git commit -m "chore(pack): maj somtech-pack"
```

> Rappel worktree : la MAJ se fait **une fois par projet** (fichiers versionnés) ; les worktrees la récupèrent par git, pas en relançant npx.

## Options

| Demande | Commande |
|---------|----------|
| dry-run seul | `npx @somtech-solutions/pack@latest update --dry-run` |
| modules précis | `… update --modules core,features,mockmig` |
| forcer l'écrasement des divergents | `… update --force` |
| version épinglée | `npx @somtech-solutions/pack@<version> update` (sinon `@latest`) |

## Fallback legacy (si npx indisponible / auth absente)

Ancien mécanisme `curl|bash` / pull (déprécié, conservé en transition) :

```bash
curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target .
# ou, depuis un clone : ./scripts/somtech_pack_pull.sh --target . [--dry-run] [--modules core,features]
```

## Règles critiques

1. **Toujours** le dry-run d'abord + confirmation avant d'appliquer.
2. **Ne jamais** `--force` sans accord explicite (écrase tes modifs locales).
3. **Ne jamais** commiter sans confirmation ; jamais sur `main`.
4. **Ne jamais** supprimer des fichiers locaux hors pack (skills custom) — le CLI ne les touche pas.
5. `.claude/settings.json` est **préservé** : si tu veux la version du pack, c'est un choix manuel explicite.
