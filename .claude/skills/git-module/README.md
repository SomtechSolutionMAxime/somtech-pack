# Skill Git-Module

Gestion des maquettes via git submodules.

## Usage

```bash
/git-module <command> [options]
```

## Commandes

| Commande | Description |
|----------|-------------|
| `add <url> [path]` | Ajouter un nouveau submodule |
| `sync [--all]` | Synchroniser les submodules |
| `list [--urls]` | Lister les submodules |
| `status [--fetch]` | État de synchronisation |
| `remove <path>` | Retirer un submodule |

## Fichiers

```
.claude/skills/git-module/
├── SKILL.md           # Point d'entrée du skill
├── README.md          # Ce fichier
└── phases/
    ├── add.md         # Instructions pour add
    ├── sync.md        # Instructions pour sync
    ├── list.md        # Instructions pour list
    ├── status.md      # Instructions pour status
    └── remove.md      # Instructions pour remove
```

## Workflow avec Mockmig

```bash
# 1. Ajouter la maquette (submodule)
/git-module add git@github.com:somtech/maquette-devis.git modules/maquette/devis/v1

# 2. Vérifier que c'est synced
/git-module status

# 3. Lancer la migration
/mockmig init --module devis --mockupPath modules/maquette/devis/v1
```

## Convention de chemins

```
modules/maquette/<module>/<version>/
```

Exemples:
- `modules/maquette/devis/v1/`
- `modules/maquette/core/v1/`
- `modules/maquette/factures/v2/`

## Statuts

| Icône | Statut | Description |
|-------|--------|-------------|
| 🟢 | À JOUR | Synchronisé avec remote |
| 🔴 | EN RETARD | Remote a des commits plus récents |
| 🟠 | EN AVANCE | Local a des commits non pushés |
| 🟡 | MODIFIÉ | Fichiers modifiés localement |
| ⚪ | NON INIT | Submodule non initialisé |
