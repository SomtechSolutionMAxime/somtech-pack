# Skill Mockmig

Workflow de migration de maquettes Git vers production Supabase.

## Usage

```bash
/mockmig <phase> [options]
```

## Phases

| Phase | Description | Artefacts générés |
|-------|-------------|-------------------|
| `init` | Preflight MCPs + Bootstrap | Sources de vérité, session.json |
| `discover` | Inventaire règles métier | 00_context, 01_business_rules, 02_validation_packet |
| `analyze` | Audit DB + Gap analysis | 03_existing_audit, 04_gap_analysis |
| `plan` | Tâches backend/UI | 05_backend_tasks, 06_ui_tasks, 07_runbook |
| `execute` | Implémentation | Migrations SQL, composants, hooks |
| `status` | Vue d'ensemble | - |

## Fichiers

```
.claude/skills/mockmig/
├── SKILL.md           # Point d'entrée du skill
├── README.md          # Ce fichier
└── phases/
    ├── init.md        # Instructions phase init
    ├── discover.md    # Instructions phase discover
    ├── analyze.md     # Instructions phase analyze
    ├── plan.md        # Instructions phase plan
    ├── execute.md     # Instructions phase execute
    └── status.md      # Instructions phase status
```

## Prérequis

- Claude Code installé
- MCPs connectés (Supabase requis, GitHub/Netlify optionnels)
- Repo avec maquette à migrer

## Workflow typique

```bash
# 1. Initialiser la migration
/mockmig init --module devis --mockupPath modules/maquette/devis/v1

# 2. Découvrir les règles métier
/mockmig discover

# 3. Analyser les gaps avec la DB existante
/mockmig analyze

# 4. Planifier les tâches
/mockmig plan

# 5. Exécuter (après sign-off)
/mockmig execute --confirm

# À tout moment: voir le statut
/mockmig status
```

## Documentation

Voir `.claude/MOCKMIG_ANALYSIS.md` pour le détail complet du workflow.
