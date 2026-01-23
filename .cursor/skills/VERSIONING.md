# Politique de Versioning — Skills

Ce document décrit la politique de versioning pour tous les skills du pack **somtech-pack**.

## Semantic Versioning

Tous les skills suivent le [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) (SemVer).

### Format

```
MAJOR.MINOR.PATCH
```

### Incrémentation des versions

| Type | Quand l'incrémenter | Exemple |
|------|---------------------|---------|
| **MAJOR** | Changements incompatibles de l'API/contrat | Modification du contrat ChatWidget, changement de structure mcp.json |
| **MINOR** | Nouvelles fonctionnalités rétrocompatibles | Ajout d'un nouveau type de widget, support d'un nouveau type MCP |
| **PATCH** | Corrections de bugs rétrocompatibles | Corrections de documentation, fixes de bugs mineurs |

### Règles spécifiques par skill

#### build-chatwindow

| Changement | Version |
|------------|---------|
| Ajout d'un nouveau type de widget | MINOR |
| Modification du contrat `ChatWidget` | MAJOR |
| Changement des types TypeScript | MAJOR |
| Ajout d'exemples dans `WIDGET_EXAMPLES.md` | PATCH |
| Correction de documentation | PATCH |
| Modification du flux SSE | MAJOR |
| Ajout de validation supplémentaire | MINOR |

#### configure-mcp-server

| Changement | Version |
|------------|---------|
| Ajout d'un nouveau type de configuration MCP | MINOR |
| Modification de la structure `mcp.json` | MAJOR |
| Ajout d'un serveur dans `SERVEURS_ORBIT.md` | PATCH |
| Amélioration du script de validation | MINOR |
| Correction de documentation | PATCH |
| Support d'une nouvelle plateforme (ex: Cloudflare) | MINOR |

## CHANGELOG

Chaque skill **DOIT** maintenir un fichier `CHANGELOG.md` à sa racine.

### Format du CHANGELOG

Le CHANGELOG suit le format [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

#### Structure

```markdown
# Changelog

## [Unreleased]
### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security

## [X.Y.Z] - YYYY-MM-DD
### Added
- Nouvelle fonctionnalité 1
- Nouvelle fonctionnalité 2

### Changed
- Changement 1

### Fixed
- Correction 1
```

#### Sections

- **Added** : Nouvelles fonctionnalités
- **Changed** : Modifications de fonctionnalités existantes
- **Deprecated** : Fonctionnalités obsolètes (seront supprimées dans une version future)
- **Removed** : Fonctionnalités supprimées
- **Fixed** : Corrections de bugs
- **Security** : Corrections de sécurité

## Workflow de versioning

### 1. Développement

Toutes les modifications en cours sont documentées dans la section `[Unreleased]` du CHANGELOG.

```markdown
## [Unreleased]
### Added
- Support pour le type de widget `calendar`
```

### 2. Release

Lors d'une release :

1. **Déterminer le nouveau numéro de version** selon SemVer
2. **Créer une nouvelle section** dans CHANGELOG.md avec la version et la date
3. **Déplacer le contenu** de `[Unreleased]` vers la nouvelle section
4. **Mettre à jour** le numéro de version dans :
   - `SKILL.md` (metadata.version)
   - `README.md` (section Version)
5. **Commit** avec message : `chore(skill-name): release vX.Y.Z`
6. **Tag Git** (optionnel) : `git tag skill-name-vX.Y.Z`

### 3. Exemple de workflow

```bash
# 1. Modifications et documentation dans CHANGELOG
vim build-chatwindow/CHANGELOG.md

# 2. Mettre à jour la version dans les métadonnées
vim build-chatwindow/SKILL.md
# metadata:
#   version: "1.2.0"

# 3. Mettre à jour README
vim build-chatwindow/README.md
# Version: 1.2.0

# 4. Commit
git add .
git commit -m "chore(build-chatwindow): release v1.2.0"

# 5. Tag (optionnel)
git tag build-chatwindow-v1.2.0
```

## Compatibilité entre skills

Les skills peuvent dépendre les uns des autres. Dans ce cas :

### Dépendances de version

Documenter les dépendances dans la section **Requirements** du README :

```markdown
## Requirements

### Skills
- `configure-mcp-server` : ^1.2.0
```

### Format de version

Utiliser les formats npm pour spécifier les versions compatibles :

- `1.2.3` : Version exacte
- `^1.2.3` : Compatible MINOR et PATCH (>= 1.2.3, < 2.0.0)
- `~1.2.3` : Compatible PATCH uniquement (>= 1.2.3, < 1.3.0)
- `>=1.2.3` : Version minimale

## Rétrocompatibilité

### Changements MAJOR (Breaking Changes)

Lors d'un changement MAJOR, documenter :

1. **Que ce soit** dans CHANGELOG sous `### Removed` ou `### Changed`
2. **Le migration path** dans un nouveau fichier `MIGRATION.md` (si complexe)
3. **Les alternatives** pour les fonctionnalités supprimées

#### Exemple CHANGELOG pour MAJOR

```markdown
## [2.0.0] - 2025-02-15

### BREAKING CHANGES
- Suppression du type de widget `input` (non fonctionnel)
- Modification du contrat ChatWidget : `data` devient obligatoire

### Migration Guide
Voir [MIGRATION.md](./MIGRATION.md) pour le guide de migration de v1.x vers v2.0.

### Removed
- Type de widget `input` supprimé (utilisez `form` avec un seul champ)

### Changed
- `ChatWidget.data` est maintenant obligatoire (était optionnel)
```

## Versioning du pack global

Le pack **somtech-pack** lui-même peut avoir sa propre version qui suit SemVer.

### Version du pack

Définie dans le README principal du pack :

```markdown
# somtech-pack

Version: 2.1.0

## Skills inclus
- build-chatwindow: v1.2.0
- configure-mcp-server: v1.3.0
```

### Règles de versioning du pack

- **MAJOR** : Suppression ou changement MAJOR d'un skill existant
- **MINOR** : Ajout d'un nouveau skill ou MINOR d'un skill
- **PATCH** : Corrections de documentation globale, PATCH de skills

## Bonnes pratiques

### ✅ À FAIRE

1. **Toujours** mettre à jour CHANGELOG.md lors de modifications
2. **Utiliser** des messages de commit clairs : `feat(skill): ...`, `fix(skill): ...`
3. **Documenter** les breaking changes de manière explicite
4. **Tester** avant chaque release
5. **Garder** [Unreleased] à jour pendant le développement

### ❌ À ÉVITER

1. **Ne pas** incrémenter la version sans mettre à jour CHANGELOG
2. **Ne pas** faire de breaking changes dans MINOR ou PATCH
3. **Ne pas** oublier de mettre à jour metadata.version dans SKILL.md
4. **Ne pas** mélanger plusieurs types de changements dans un commit
5. **Ne pas** supprimer l'historique du CHANGELOG

## Références

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Questions fréquentes

### Quand créer une version MAJOR ?

Créez une version MAJOR quand vous apportez des changements qui **cassent** la compatibilité avec les versions précédentes. Par exemple :
- Modification du contrat d'interface (ChatWidget, mcp.json)
- Suppression de fonctionnalités existantes
- Changement de comportement par défaut

### Peut-on revenir en arrière sur une version publiée ?

Non. Une fois publiée, une version est **immuable**. Si vous trouvez un problème :
1. Créez une nouvelle version PATCH pour corriger le bug
2. Documentez le problème dans CHANGELOG de la nouvelle version

### Comment gérer plusieurs branches de développement ?

Pour les versions LTS ou multiples branches :
- `main` : Version stable actuelle (ex: v1.2.0)
- `v2.x` : Développement de la prochaine version majeure (ex: v2.0.0-beta.1)
- Maintenir un CHANGELOG par branche

---

**Note** : Cette politique de versioning s'applique à tous les skills du pack **somtech-pack**. Chaque skill est versionné de manière indépendante.
