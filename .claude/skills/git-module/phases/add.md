# /git-module add

> **Ajouter un nouveau submodule.** Clone une maquette depuis un repo Git.

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `<url>` | ✅ | URL du repo Git (SSH ou HTTPS) |
| `[path]` | ❌ | Chemin local (défaut: déduit du nom du repo) |
| `--branch <branch>` | ❌ | Branche à suivre (défaut: main) |
| `--version <v>` | ❌ | Version à créer (ex: v1, v2) |

## Exemples

```bash
# Ajouter avec chemin explicite
/git-module add git@github.com:somtech/maquette-devis.git modules/maquette/devis/v1

# Ajouter avec branche spécifique
/git-module add git@github.com:somtech/maquette-core.git --branch develop

# Ajouter en déduisant le chemin
/git-module add git@github.com:somtech/maquette-factures.git
# → modules/maquette/factures/v1
```

---

## Comportement

### Étape 1 : Validation des arguments

```
SI <url> manquant:
  → ERREUR: "URL du repo requise"
  → AFFICHER: "Usage: /git-module add <url> [path]"
  → STOP

SI <url> ne matche pas (git@|https://):
  → ERREUR: "URL invalide: <url>"
  → STOP
```

### Étape 2 : Déduire le chemin si absent

```
SI [path] absent:
  # Extraire le nom du repo
  # git@github.com:somtech/maquette-devis.git → maquette-devis
  repo_name = extraire_nom(url)

  # Nettoyer le préfixe "maquette-" si présent
  module_name = repo_name.replace("maquette-", "")

  # Construire le chemin
  version = --version OU "v1"
  path = "modules/maquette/<module_name>/<version>"

  AFFICHER: "📂 Chemin déduit: <path>"
```

### Étape 3 : Vérifier si le chemin existe déjà

```
SI <path> existe:
  → AFFICHER: "⚠️  Le chemin existe déjà: <path>"

  SI .gitmodules contient <path>:
    → AFFICHER: "   C'est déjà un submodule."
    → AFFICHER: "   → Pour mettre à jour: /git-module sync"
    → STOP
  SINON:
    → AFFICHER: "   Ce n'est pas un submodule."
    → DEMANDER: "Supprimer et remplacer? [o/N]"
    SI non:
      → STOP
    SINON:
      → rm -rf <path>
```

### Étape 4 : Ajouter le submodule

```
AFFICHER: "📦 Ajout du submodule..."
AFFICHER: ""

branch = --branch OU "main"

→ Exécuter: git submodule add -b <branch> <url> <path>

SI succès:
  → AFFICHER: "✅ Submodule ajouté: <path>"
SINON:
  → AFFICHER: "❌ Échec de l'ajout"
  → AFFICHER: "   Erreur: <git_error>"
  → STOP
```

### Étape 5 : Initialiser et cloner

```
AFFICHER: "📥 Initialisation..."

→ Exécuter: git submodule update --init --recursive <path>

SI succès:
  → AFFICHER: "✅ Submodule initialisé"
SINON:
  → AFFICHER: "⚠️  Initialisation partielle"
  → AFFICHER: "   → Vérifier les credentials Git"
```

### Étape 6 : Vérifier la structure

```
AFFICHER: ""
AFFICHER: "🔍 Vérification de la structure..."

SI <path>/src/components existe:
  → Lister composants
  → AFFICHER: "✅ Structure valide (<n> composants)"
  POUR CHAQUE composant:
    → AFFICHER: "   • <composant>"
SINON SI <path>/package.json existe:
  → AFFICHER: "⚠️  Structure non standard (pas de src/components/)"
SINON:
  → AFFICHER: "⚠️  Maquette vide ou structure inconnue"
```

### Étape 7 : Commiter l'ajout

```
AFFICHER: ""
DEMANDER: "Commiter l'ajout du submodule? [O/n]"

SI oui:
  → Exécuter: git add .gitmodules <path>
  → Exécuter: git commit -m "feat(modules): add submodule <module_name>"
  → AFFICHER: "✅ Commit créé"
SINON:
  → AFFICHER: "ℹ️  N'oublie pas de commiter .gitmodules et <path>"
```

### Étape 8 : Prochaine étape

```
AFFICHER: ""
AFFICHER: "═══════════════════════════════════════"
AFFICHER: "✅ Submodule ajouté avec succès"
AFFICHER: ""
AFFICHER: "→ Prochaine étape:"
AFFICHER: "  /mockmig init --module <module_name> --mockupPath <path>"
```

---

## Erreurs possibles

| Code | Message | Solution |
|------|---------|----------|
| `ERR_URL` | URL invalide | Vérifier le format SSH/HTTPS |
| `ERR_AUTH` | Authentication failed | Vérifier les clés SSH / tokens |
| `ERR_EXISTS` | Path already exists | Utiliser un autre chemin ou supprimer |
| `ERR_CLONE` | Clone failed | Vérifier l'URL et les permissions |

---

## Voir aussi

- `/git-module sync` — Synchroniser après modification
- `/git-module list` — Voir tous les submodules
- `/mockmig init` — Migrer la maquette
