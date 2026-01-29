# /git-module list

> **Lister les submodules.** Affiche tous les submodules configurés avec leurs infos.

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `--json` | ❌ | Sortie en format JSON |
| `--urls` | ❌ | Afficher les URLs des repos |

## Exemples

```bash
# Liste simple
/git-module list

# Liste avec URLs
/git-module list --urls

# Format JSON
/git-module list --json
```

---

## Comportement

### Étape 1 : Lire la configuration

```
SI .gitmodules n'existe pas:
  → AFFICHER: "ℹ️  Aucun submodule configuré"
  → AFFICHER: ""
  → AFFICHER: "→ Ajouter un submodule: /git-module add <url> <path>"
  → STOP

→ Parser .gitmodules
→ Extraire: path, url, branch pour chaque submodule
```

### Étape 2 : Collecter les infos

```
POUR CHAQUE submodule:
  → path = submodule.path
  → url = submodule.url
  → branch = submodule.branch OU "main"

  SI <path> existe:
    → commit = git -C <path> rev-parse --short HEAD
    → date = git -C <path> log -1 --format=%cr
    → status = "synced"
  SINON:
    → commit = "(non initialisé)"
    → date = "-"
    → status = "uninitialized"

  → submodules.push({path, url, branch, commit, date, status})
```

### Étape 3 : Afficher (mode normal)

```
SI --json:
  → GOTO mode JSON

AFFICHER: "📦 Submodules Git"
AFFICHER: "================="
AFFICHER: ""

# Grouper par dossier parent
grouped = grouper par modules/maquette/<module>/

POUR CHAQUE groupe:
  AFFICHER: "📂 <module>"

  POUR CHAQUE submodule dans groupe:
    SI status = "synced":
      → icon = "✅"
    SI status = "uninitialized":
      → icon = "⚠️"

    AFFICHER: "   <icon> <version>/"
    AFFICHER: "      Commit: <commit> (<date>)"
    AFFICHER: "      Branch: <branch>"

    SI --urls:
      AFFICHER: "      URL: <url>"

AFFICHER: ""
AFFICHER: "Total: <n> submodule(s)"
```

### Étape 4 : Afficher (mode JSON)

```
SI --json:
  json = {
    "count": <n>,
    "submodules": [
      {
        "path": "modules/maquette/devis/v1",
        "url": "git@github.com:somtech/maquette-devis.git",
        "branch": "main",
        "commit": "abc1234",
        "date": "2 days ago",
        "status": "synced"
      },
      ...
    ]
  }

  → AFFICHER: JSON.stringify(json, null, 2)
```

---

## Exemple de sortie

```
📦 Submodules Git
=================

📂 devis
   ✅ v1/
      Commit: abc1234 (2 days ago)
      Branch: main

📂 factures
   ✅ v1/
      Commit: def5678 (1 week ago)
      Branch: main
   ⚠️ v2/
      Commit: (non initialisé)
      Branch: develop

📂 core
   ✅ v1/
      Commit: 789abcd (3 hours ago)
      Branch: main

Total: 4 submodule(s)
```

---

## Voir aussi

- `/git-module status` — État détaillé de sync
- `/git-module sync` — Synchroniser les submodules
- `/git-module add` — Ajouter un submodule
