# /git-module remove

> **Retirer un submodule.** Supprime un submodule du projet.

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `<path>` | ✅ | Chemin du submodule à retirer |
| `--force` | ❌ | Supprimer même avec modifications locales |
| `--keep-files` | ❌ | Garder les fichiers (dé-submoduliser) |

## Exemples

```bash
# Retirer un submodule
/git-module remove modules/maquette/devis/v1

# Forcer la suppression
/git-module remove modules/maquette/old/v1 --force

# Garder les fichiers (convertir en dossier normal)
/git-module remove modules/maquette/devis/v1 --keep-files
```

---

## Comportement

### Étape 1 : Validation

```
SI <path> manquant:
  → ERREUR: "Chemin du submodule requis"
  → AFFICHER: "Usage: /git-module remove <path>"
  → STOP

SI <path> n'est pas un submodule:
  → ERREUR: "<path> n'est pas un submodule"
  → AFFICHER: "Submodules disponibles:"
  → Lister les submodules
  → STOP
```

### Étape 2 : Vérifier les modifications

```
SI <path> existe:
  → changes = git -C <path> status --porcelain

  SI changes.length > 0 ET --force absent:
    → AFFICHER: "⚠️  Le submodule a des modifications non commitées:"
    → Lister les fichiers modifiés
    → AFFICHER: ""
    → AFFICHER: "Options:"
    → AFFICHER: "   1. Commit les changements d'abord"
    → AFFICHER: "   2. Utiliser --force pour supprimer quand même"
    → AFFICHER: "   3. Utiliser --keep-files pour convertir en dossier"
    → STOP
```

### Étape 3 : Vérifier les migrations en cours

```
SI .mockmig/session.json existe:
  → Lire session
  SI session.mockupPath = <path>:
    → AFFICHER: "⚠️  Une migration est en cours pour ce submodule!"
    → AFFICHER: "   Module: <session.module>"
    → AFFICHER: "   Phase: <session.phase>"
    → AFFICHER: ""
    → DEMANDER: "Supprimer quand même? [o/N]"
    SI non:
      → STOP
    → Supprimer .mockmig/session.json
    → AFFICHER: "   Session de migration supprimée"
```

### Étape 4 : Confirmation

```
AFFICHER: "🗑️  Suppression du submodule"
AFFICHER: "   Path: <path>"
AFFICHER: "   URL: <url>"
AFFICHER: ""

SI --keep-files:
  → AFFICHER: "   Mode: Convertir en dossier (garder les fichiers)"
SINON:
  → AFFICHER: "   Mode: Suppression complète"

DEMANDER: "Confirmer la suppression? [o/N]"

SI non:
  → AFFICHER: "Suppression annulée"
  → STOP
```

### Étape 5 : Dé-initialiser le submodule

```
AFFICHER: ""
AFFICHER: "📦 Dé-initialisation..."

# Retirer du fichier .gitmodules
→ Exécuter: git submodule deinit -f <path>
→ AFFICHER: "   ✅ Submodule dé-initialisé"

# Retirer de .git/config
→ Exécuter: git config --remove-section submodule.<path> 2>/dev/null
→ AFFICHER: "   ✅ Config retirée"
```

### Étape 6 : Supprimer les fichiers

```
SI --keep-files:
  # Convertir en dossier normal
  AFFICHER: ""
  AFFICHER: "📂 Conversion en dossier..."

  → Exécuter: git rm --cached <path>
  → Supprimer <path>/.git (le fichier, pas le dossier)
  → AFFICHER: "   ✅ Fichiers conservés comme dossier normal"

SINON:
  # Suppression complète
  AFFICHER: ""
  AFFICHER: "🗑️  Suppression des fichiers..."

  → Exécuter: git rm -rf <path>
  → Exécuter: rm -rf .git/modules/<path>
  → AFFICHER: "   ✅ Fichiers supprimés"
```

### Étape 7 : Nettoyer .gitmodules

```
# Retirer l'entrée de .gitmodules
→ Éditer .gitmodules pour retirer la section [submodule "<path>"]

SI .gitmodules est vide après:
  → Supprimer .gitmodules
  → AFFICHER: "   ✅ .gitmodules supprimé (plus de submodules)"
SINON:
  → AFFICHER: "   ✅ .gitmodules mis à jour"
```

### Étape 8 : Commiter

```
AFFICHER: ""
DEMANDER: "Commiter la suppression? [O/n]"

SI oui:
  SI --keep-files:
    → Exécuter: git add .gitmodules
    → Exécuter: git commit -m "refactor(modules): convert <module> from submodule to directory"
  SINON:
    → Exécuter: git add .gitmodules
    → Exécuter: git commit -m "chore(modules): remove submodule <module>"

  → AFFICHER: "✅ Commit créé"
SINON:
  → AFFICHER: "ℹ️  N'oublie pas de commiter les changements"
```

### Étape 9 : Résultat

```
AFFICHER: ""
AFFICHER: "═══════════════════════════════════════"
AFFICHER: "✅ Submodule retiré avec succès"
AFFICHER: ""

SI --keep-files:
  AFFICHER: "Les fichiers ont été conservés dans: <path>"
  AFFICHER: "Ce dossier fait maintenant partie du repo principal."
```

---

## Notes

- La suppression d'un submodule est une opération complexe dans Git
- `--keep-files` est utile si tu veux "internaliser" une maquette
- Après `--keep-files`, les fichiers peuvent être commités normalement

---

## Voir aussi

- `/git-module list` — Voir les submodules existants
- `/git-module add` — Ajouter un submodule
