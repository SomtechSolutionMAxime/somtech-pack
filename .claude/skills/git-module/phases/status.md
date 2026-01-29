# /git-module status

> **État de synchronisation.** Affiche l'état détaillé de chaque submodule.

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `[path]` | ❌ | Submodule spécifique (défaut: tous) |
| `--fetch` | ❌ | Fetch avant de comparer (plus lent mais précis) |

## Exemples

```bash
# État de tous les submodules
/git-module status

# État d'un submodule spécifique
/git-module status modules/maquette/devis/v1

# Avec fetch pour comparer avec remote
/git-module status --fetch
```

---

## Comportement

### Étape 1 : Préparer

```
SI .gitmodules n'existe pas:
  → AFFICHER: "ℹ️  Aucun submodule configuré"
  → STOP

SI --fetch:
  AFFICHER: "📡 Récupération des infos distantes..."
  → Exécuter: git submodule foreach git fetch origin --quiet
  AFFICHER: ""
```

### Étape 2 : Analyser chaque submodule

```
AFFICHER: "📊 État des Submodules"
AFFICHER: "======================"
AFFICHER: ""

POUR CHAQUE submodule:
  path = submodule.path
  url = submodule.url
  branch = submodule.branch OU "main"

  # Vérifier si initialisé
  SI <path> n'existe pas OU vide:
    → AFFICHER: "⚪ <path>"
    → AFFICHER: "   Status: NON INITIALISÉ"
    → AFFICHER: "   → Exécuter: /git-module sync"
    → CONTINUER

  # Récupérer les infos locales
  → local_commit = git -C <path> rev-parse HEAD
  → local_short = git -C <path> rev-parse --short HEAD
  → local_branch = git -C <path> rev-parse --abbrev-ref HEAD
  → last_commit_msg = git -C <path> log -1 --format=%s
  → last_commit_date = git -C <path> log -1 --format=%cr
  → last_commit_author = git -C <path> log -1 --format=%an

  # Vérifier les modifications locales
  → changes = git -C <path> status --porcelain
  → has_changes = changes.length > 0

  # Comparer avec remote (si fetch fait)
  SI --fetch OU remote info disponible:
    → remote_commit = git -C <path> rev-parse origin/<branch> 2>/dev/null
    SI remote_commit existe:
      → behind = git -C <path> rev-list --count HEAD..origin/<branch>
      → ahead = git -C <path> rev-list --count origin/<branch>..HEAD
    SINON:
      → behind = 0
      → ahead = 0
  SINON:
    → behind = "?"
    → ahead = "?"

  # Déterminer le statut
  SI has_changes:
    → status_icon = "🟡"
    → status_text = "MODIFIÉ"
  SINON SI behind > 0:
    → status_icon = "🔴"
    → status_text = "EN RETARD (<behind> commits)"
  SINON SI ahead > 0:
    → status_icon = "🟠"
    → status_text = "EN AVANCE (<ahead> commits)"
  SINON:
    → status_icon = "🟢"
    → status_text = "À JOUR"

  # Afficher
  AFFICHER: "<status_icon> <path>"
  AFFICHER: "   Status: <status_text>"
  AFFICHER: "   Commit: <local_short> - <last_commit_msg>"
  AFFICHER: "   Date: <last_commit_date> par <last_commit_author>"
  AFFICHER: "   Branch: <local_branch> → origin/<branch>"

  SI has_changes:
    AFFICHER: "   ⚠️  Fichiers modifiés:"
    → Lister les 5 premiers fichiers modifiés
    SI plus de 5:
      AFFICHER: "      ... et <n> autres"

  AFFICHER: ""
```

### Étape 3 : Résumé

```
AFFICHER: "═══════════════════════════════════════"
AFFICHER: ""

# Compter par statut
AFFICHER: "Résumé:"
AFFICHER: "   🟢 À jour: <n>"
AFFICHER: "   🔴 En retard: <n>"
AFFICHER: "   🟠 En avance: <n>"
AFFICHER: "   🟡 Modifiés: <n>"
AFFICHER: "   ⚪ Non initialisés: <n>"

SI submodules en retard OU non initialisés:
  AFFICHER: ""
  AFFICHER: "→ Synchroniser: /git-module sync"

SI submodules modifiés:
  AFFICHER: ""
  AFFICHER: "→ Commit les changements ou stash avant sync"
```

---

## Légende des statuts

| Icône | Statut | Description |
|-------|--------|-------------|
| 🟢 | À JOUR | Synchronisé avec remote |
| 🔴 | EN RETARD | Remote a des commits plus récents |
| 🟠 | EN AVANCE | Local a des commits non pushés |
| 🟡 | MODIFIÉ | Fichiers modifiés localement (non commités) |
| ⚪ | NON INIT | Submodule non initialisé |

---

## Voir aussi

- `/git-module sync` — Synchroniser
- `/git-module list` — Liste simple
