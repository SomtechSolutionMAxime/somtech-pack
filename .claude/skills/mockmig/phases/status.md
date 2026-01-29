# /mockmig status

> **Vue d'ensemble de la migration en cours.** Affiche l'état de la session, les artefacts et les MCPs.

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `--verbose` | Non | Afficher les détails complets |
| `--json` | Non | Sortie en format JSON |

## Exemples

```bash
# Statut standard
/mockmig status

# Statut détaillé
/mockmig status --verbose

# Sortie JSON (pour scripting)
/mockmig status --json
```

---

## Comportement

### Étape 1 : Vérifier la session

```
SI .mockmig/session.json n'existe pas:
  → AFFICHER: "❌ Aucune session active"
  → AFFICHER: ""
  → AFFICHER: "Pour démarrer une migration:"
  → AFFICHER: "  /mockmig init --module <nom> --mockupPath <chemin>"
  → STOP

→ Charger session.json
```

### Étape 2 : Afficher l'en-tête

```
AFFICHER: "═══════════════════════════════════════"
AFFICHER: "📊 MOCKMIG STATUS"
AFFICHER: "═══════════════════════════════════════"
AFFICHER: ""
```

### Étape 3 : Informations générales

```
AFFICHER: "📦 Module: <module>"
AFFICHER: "📁 Maquette: <mockupPath>"
AFFICHER: "📂 Migration: <migrationDir>"
AFFICHER: ""
```

### Étape 4 : Phase actuelle

```
phases = ["INIT", "DISCOVER", "ANALYZE", "PLAN", "EXECUTE", "DONE"]
current_index = phases.indexOf(session.phase)

AFFICHER: "🔄 Progression:"
AFFICHER: ""

POUR i, phase DANS phases:
  SI i < current_index:
    → AFFICHER: "   ✅ <phase>"
  SI i = current_index:
    → AFFICHER: "   🔵 <phase> ← actuel"
  SI i > current_index:
    → AFFICHER: "   ⚪ <phase>"

AFFICHER: ""
```

### Étape 5 : Gates

```
AFFICHER: "🚧 Gates:"
AFFICHER: ""

# Gate A - Validate
SI gates.validate.passed:
  → AFFICHER: "   ✅ Gate A (Validate): Passée le <date>"
SINON:
  → AFFICHER: "   ⚪ Gate A (Validate): En attente"

# Gate B - Sign-off
SI gates.signoff.passed:
  → AFFICHER: "   ✅ Gate B (Sign-off): Passée le <date> par <by>"
SINON:
  → AFFICHER: "   ⚪ Gate B (Sign-off): En attente"

# Gate C - Confirm
SI gates.confirm.passed:
  → AFFICHER: "   ✅ Gate C (Confirm): Passée le <date>"
SINON:
  → AFFICHER: "   ⚪ Gate C (Confirm): En attente"

AFFICHER: ""
```

### Étape 6 : Artefacts

```
AFFICHER: "📄 Artefacts:"
AFFICHER: ""

artifacts_order = [
  "00_context",
  "01_business_rules",
  "02_validation_packet",
  "03_existing_audit",
  "04_gap_analysis",
  "05_backend_tasks",
  "06_ui_tasks",
  "07_runbook"
]

POUR CHAQUE artifact DANS artifacts_order:
  status = session.artifacts[artifact]?.status ?? "pending"

  SI status = "done":
    → AFFICHER: "   ✅ <artifact>.md"
  SI status = "in_progress":
    → AFFICHER: "   🔵 <artifact>.md (en cours)"
  SI status = "pending":
    → AFFICHER: "   ⚪ <artifact>.md"
  SI status = "skipped":
    → AFFICHER: "   ⏭️  <artifact>.md (ignoré)"

AFFICHER: ""
```

### Étape 7 : MCPs (si --verbose)

```
SI --verbose:
  AFFICHER: "🔌 MCPs:"
  AFFICHER: ""

  # Supabase
  SI mcps.supabase.connected:
    → AFFICHER: "   ✅ Supabase"
    → AFFICHER: "      Project: <projectId>"
    → AFFICHER: "      Role: <role>"
  SINON:
    → AFFICHER: "   ❌ Supabase (non connecté)"

  # GitHub
  SI mcps.github.connected:
    → AFFICHER: "   ✅ GitHub"
    → AFFICHER: "      Repo: <repo>"
    → AFFICHER: "      Branch: <branch>"
  SINON:
    → AFFICHER: "   ❌ GitHub (non connecté)"

  # Netlify
  SI mcps.netlify.connected:
    → AFFICHER: "   ✅ Netlify"
    → AFFICHER: "      Site: <siteId>"
  SINON:
    → AFFICHER: "   ❌ Netlify (non connecté)"

  AFFICHER: ""
```

### Étape 8 : Historique des commandes (si --verbose)

```
SI --verbose:
  AFFICHER: "📜 Historique:"
  AFFICHER: ""
  AFFICHER: "   Créé: <createdAt>"
  AFFICHER: "   Modifié: <updatedAt>"
  AFFICHER: "   Dernière commande: <lastCommand>"

  SI lastError:
    AFFICHER: ""
    AFFICHER: "   ⚠️  Dernière erreur: <lastError>"

  AFFICHER: ""
```

### Étape 9 : Exécution (si phase >= EXECUTE)

```
SI session.execution existe:
  AFFICHER: "🚀 Exécution:"
  AFFICHER: ""
  AFFICHER: "   Démarrée: <execution.started>"
  AFFICHER: "   Terminée: <execution.completed>"
  AFFICHER: ""
  AFFICHER: "   Tâches: <execution.success>/<total> succès"

  SI execution.failed > 0:
    AFFICHER: "   ⚠️  Échecs: <execution.failed>"

    SI --verbose:
      AFFICHER: ""
      AFFICHER: "   Tâches en échec:"
      POUR CHAQUE task DANS execution.tasks:
        SI task.status = "failed":
          → AFFICHER: "      • [<task.id>] <task.error>"

  AFFICHER: ""
```

### Étape 10 : Prochaine action

```
AFFICHER: "═══════════════════════════════════════"
AFFICHER: ""

SI phase = "INIT":
  → AFFICHER: "→ Prochaine étape: /mockmig discover"

SI phase = "DISCOVER":
  SI gates.validate.passed:
    → AFFICHER: "→ Prochaine étape: /mockmig analyze"
  SINON:
    → AFFICHER: "→ Prochaine étape: Corriger les erreurs de validation"
    → AFFICHER: "  puis passer Gate A"

SI phase = "ANALYZE":
  → AFFICHER: "→ Prochaine étape: /mockmig plan"

SI phase = "PLAN":
  SI gates.signoff.passed:
    → AFFICHER: "→ Prochaine étape: /mockmig execute --confirm"
  SINON:
    → AFFICHER: "→ Prochaine étape: Obtenir le sign-off (Gate B)"
    → AFFICHER: "  puis: /mockmig execute --confirm"

SI phase = "EXECUTE":
  SI execution.failed > 0:
    → AFFICHER: "→ Prochaine étape: Corriger les erreurs puis:"
    → AFFICHER: "  /mockmig execute --confirm --task <id>"
  SINON:
    → AFFICHER: "✅ Migration terminée!"
    → AFFICHER: ""
    → AFFICHER: "Actions recommandées:"
    → AFFICHER: "   1. Vérifier: npm run test"
    → AFFICHER: "   2. Créer PR: gh pr create"
    → AFFICHER: "   3. Déployer preview: (auto)"

SI phase = "DONE":
  → AFFICHER: "✅ Migration complète et déployée!"
```

### Mode JSON

```
SI --json:
  → Afficher session.json formaté
  → STOP (pas d'affichage textuel)
```

---

## Exemples de sortie

### Sortie standard

```
═══════════════════════════════════════
📊 MOCKMIG STATUS
═══════════════════════════════════════

📦 Module: devis
📁 Maquette: modules/maquette/devis/v1
📂 Migration: migration/devis

🔄 Progression:

   ✅ INIT
   ✅ DISCOVER
   🔵 ANALYZE ← actuel
   ⚪ PLAN
   ⚪ EXECUTE
   ⚪ DONE

🚧 Gates:

   ✅ Gate A (Validate): Passée le 2026-01-28
   ⚪ Gate B (Sign-off): En attente
   ⚪ Gate C (Confirm): En attente

📄 Artefacts:

   ✅ 00_context.md
   ✅ 01_business_rules.md
   ✅ 02_validation_packet.md
   🔵 03_existing_audit.md (en cours)
   ⚪ 04_gap_analysis.md
   ⚪ 05_backend_tasks.md
   ⚪ 06_ui_tasks.md
   ⚪ 07_runbook.md

═══════════════════════════════════════

→ Prochaine étape: Terminer /mockmig analyze
```

### Sortie verbose

```
═══════════════════════════════════════
📊 MOCKMIG STATUS
═══════════════════════════════════════

📦 Module: devis
📁 Maquette: modules/maquette/devis/v1
📂 Migration: migration/devis

🔄 Progression:
   ...

🚧 Gates:
   ...

📄 Artefacts:
   ...

🔌 MCPs:

   ✅ Supabase
      Project: abc123
      Role: service_role

   ✅ GitHub
      Repo: somtech/app-construction
      Branch: feat/devis-migration

   ❌ Netlify (non connecté)

📜 Historique:

   Créé: 2026-01-28T10:30:00Z
   Modifié: 2026-01-28T14:45:00Z
   Dernière commande: /mockmig analyze

═══════════════════════════════════════

→ Prochaine étape: /mockmig plan
```

---

## Voir aussi

- `/mockmig init` — Démarrer une migration
- `/mockmig discover` — Phase 1
- `/mockmig analyze` — Phase 2
- `/mockmig plan` — Phase 3
- `/mockmig execute` — Phase 4
