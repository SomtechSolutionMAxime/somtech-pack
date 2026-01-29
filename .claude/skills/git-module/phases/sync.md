# /git-module sync

> **Synchroniser les submodules.** Met à jour les maquettes depuis leurs repos distants.

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `[path]` | ❌ | Submodule spécifique à sync (défaut: tous) |
| `--all` | ❌ | Forcer la sync de tous les submodules |
| `--remote` | ❌ | Récupérer les derniers commits distants |
| `--recursive` | ❌ | Sync les submodules imbriqués |

## Exemples

```bash
# Sync tous les submodules
/git-module sync

# Sync un submodule spécifique
/git-module sync modules/maquette/devis/v1

# Sync avec les derniers commits distants
/git-module sync --remote

# Sync complet récursif
/git-module sync --all --remote --recursive
```

---

## Comportement

### Étape 1 : Lister les submodules

```
AFFICHER: "🔄 Synchronisation des submodules"
AFFICHER: "=================================="
AFFICHER: ""

→ Lire .gitmodules
→ Parser les submodules

SI aucun submodule:
  → AFFICHER: "ℹ️  Aucun submodule configuré"
  → AFFICHER: "→ Ajouter un submodule: /git-module add <url> <path>"
  → STOP

SI [path] fourni:
  SI path n'est pas un submodule:
    → ERREUR: "<path> n'est pas un submodule"
    → STOP
  → submodules = [path]
SINON:
  → submodules = tous les submodules

AFFICHER: "📦 Submodules à synchroniser: <n>"
POUR CHAQUE submodule:
  → AFFICHER: "   • <path>"
```

### Étape 2 : Fetch des remotes

```
SI --remote:
  AFFICHER: ""
  AFFICHER: "📡 Récupération des mises à jour distantes..."

  → Exécuter: git submodule foreach git fetch origin

  AFFICHER: "✅ Fetch terminé"
```

### Étape 3 : Vérifier l'état avant sync

```
AFFICHER: ""
AFFICHER: "🔍 État actuel:"

POUR CHAQUE submodule:
  → Exécuter: git -C <path> status --porcelain

  SI modifications locales:
    → AFFICHER: "⚠️  <path>: modifications locales non commitées"
    → dirty_submodules.push(path)
  SINON:
    # Comparer avec remote
    → local_commit = git -C <path> rev-parse HEAD
    → remote_commit = git -C <path> rev-parse origin/main (ou branche)

    SI local_commit != remote_commit:
      → behind = nombre de commits de retard
      → AFFICHER: "📥 <path>: <behind> commits de retard"
      → outdated_submodules.push(path)
    SINON:
      → AFFICHER: "✅ <path>: à jour"
```

### Étape 4 : Gérer les modifications locales

```
SI dirty_submodules.length > 0:
  AFFICHER: ""
  AFFICHER: "⚠️  Submodules avec modifications locales:"
  POUR CHAQUE path:
    → AFFICHER: "   • <path>"

  DEMANDER: "Stash les modifications et continuer? [o/N]"

  SI oui:
    POUR CHAQUE path dans dirty_submodules:
      → Exécuter: git -C <path> stash
      → AFFICHER: "   💾 Stash créé pour <path>"
  SINON:
    → AFFICHER: "Sync annulé. Commit ou stash manuellement."
    → STOP
```

### Étape 5 : Synchroniser

```
AFFICHER: ""
AFFICHER: "🔄 Synchronisation en cours..."

sync_mode = "--remote" si --remote sinon ""
recursive_flag = "--recursive" si --recursive sinon ""

→ Exécuter: git submodule update --init <recursive_flag> <sync_mode>

SI erreur:
  → AFFICHER: "❌ Erreur de synchronisation"
  → AFFICHER: "   <error>"
  → STOP
```

### Étape 6 : Vérifier le résultat

```
AFFICHER: ""
AFFICHER: "📊 Résultat:"

synced = 0
failed = 0

POUR CHAQUE submodule:
  → new_commit = git -C <path> rev-parse --short HEAD
  → branch = git -C <path> rev-parse --abbrev-ref HEAD

  SI sync réussie:
    → AFFICHER: "✅ <path>"
    → AFFICHER: "   Commit: <new_commit> (branch: <branch>)"
    → synced++
  SINON:
    → AFFICHER: "❌ <path>: échec"
    → failed++
```

### Étape 7 : Restaurer les stash

```
SI stash créés:
  AFFICHER: ""
  DEMANDER: "Restaurer les modifications stashées? [O/n]"

  SI oui:
    POUR CHAQUE path dans dirty_submodules:
      → Exécuter: git -C <path> stash pop
      → AFFICHER: "   📤 Stash restauré pour <path>"
```

### Étape 8 : Résumé

```
AFFICHER: ""
AFFICHER: "═══════════════════════════════════════"
AFFICHER: "🔄 Synchronisation terminée"
AFFICHER: ""
AFFICHER: "   Succès: <synced>/<total>"
SI failed > 0:
  AFFICHER: "   Échecs: <failed>"
AFFICHER: ""

SI outdated_submodules avaient des mises à jour:
  AFFICHER: "ℹ️  Les submodules ont été mis à jour."
  AFFICHER: "   N'oublie pas de commiter le pointeur:"
  AFFICHER: "   git add <paths> && git commit -m 'chore: update submodules'"
```

---

## Workflow avec mockmig

Après la sync, si une migration est en cours:

```
SI .mockmig/session.json existe:
  → Lire session
  SI session.mockupPath dans submodules synchronisés:
    → AFFICHER: ""
    → AFFICHER: "⚠️  Migration en cours pour ce submodule"
    → AFFICHER: "   La maquette a peut-être changé."
    → AFFICHER: "   → Relancer /mockmig discover pour détecter les changements"
```

---

## Voir aussi

- `/git-module status` — Voir l'état sans sync
- `/git-module list` — Lister les submodules
- `/mockmig discover` — Relancer après sync
