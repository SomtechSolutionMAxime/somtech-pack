# /mockmig execute

> **Phase 4 du workflow mockmig.** Implémentation des tâches backend et UI.

## Prérequis

- Phase PLAN complétée
- Gate B (Sign-off) passée
- Flag `--confirm` requis pour exécuter

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `--confirm` | ✅ | Confirmation explicite pour exécuter |
| `--task <id>` | Non | Exécuter une tâche spécifique (ex: BE-001) |
| `--phase <A\|B\|C\|D>` | Non | Exécuter une phase complète |
| `--dry-run` | Non | Prévisualiser sans exécuter |

## Exemples

```bash
# Exécuter toutes les tâches
/mockmig execute --confirm

# Dry-run (prévisualisation)
/mockmig execute --dry-run

# Exécuter une tâche spécifique
/mockmig execute --confirm --task BE-001

# Exécuter une phase
/mockmig execute --confirm --phase A
```

---

## Comportement

### Étape 1 : Validation pré-exécution

```
SI .mockmig/session.json n'existe pas:
  → ERREUR: "Aucune session active. Exécuter /mockmig init d'abord."
  → STOP

→ Charger session.json

SI phase != "PLAN":
  → AFFICHER: "Phase actuelle: <phase>"
  → AFFICHER: "→ Compléter les phases précédentes d'abord"
  → STOP

SI --confirm n'est pas fourni:
  → AFFICHER: "⚠️  Flag --confirm requis pour exécuter"
  → AFFICHER: ""
  → AFFICHER: "Résumé de l'exécution:"
  → AFFICHER: "   • Backend: <n> tâches"
  → AFFICHER: "   • UI: <n> tâches"
  → AFFICHER: "   • Effort estimé: <x>h"
  → AFFICHER: ""
  → AFFICHER: "Pour prévisualiser: /mockmig execute --dry-run"
  → AFFICHER: "Pour exécuter: /mockmig execute --confirm"
  → STOP
```

### Étape 2 : Vérification Gate B

```
SI gates.signoff.passed != true:
  → AFFICHER: "⚠️  Gate B (Sign-off) non passée"
  → AFFICHER: ""
  → AFFICHER: "Avant d'exécuter, un Tech Lead/PO doit valider:"
  → AFFICHER: "   migration/<module>/SIGNOFF_CHECKLIST.md"
  → AFFICHER: ""
  → DEMANDER: "Le sign-off a-t-il été obtenu? (oui/non)"

  SI réponse = "oui":
    → Mettre à jour session.json:
      - gates.signoff.passed: true
      - gates.signoff.date: <now>
      - gates.signoff.by: "manual"
  SINON:
    → AFFICHER: "→ Obtenir le sign-off avant d'exécuter"
    → STOP
```

### Étape 3 : Charger le plan

```
AFFICHER: "🚀 Phase EXECUTE"
AFFICHER: "================"
AFFICHER: ""
AFFICHER: "📖 Chargement du plan..."

→ Lire migration/<module>/05_backend_tasks.md
→ Lire migration/<module>/06_ui_tasks.md
→ Lire migration/<module>/07_runbook.md

→ Parser les tâches et dépendances
→ Construire le graphe d'exécution

SI --task:
  → Filtrer pour ne garder que la tâche spécifiée + ses dépendances

SI --phase:
  → Filtrer pour ne garder que les tâches de la phase

AFFICHER: "   Tâches à exécuter: <n>"
```

### Étape 4 : Mode Dry-Run

```
SI --dry-run:
  AFFICHER: ""
  AFFICHER: "🔍 Mode Dry-Run (prévisualisation)"
  AFFICHER: ""

  POUR CHAQUE tâche dans l'ordre:
    AFFICHER: "   [<id>] <description>"
    SI tâche.type = "migration":
      AFFICHER: "      → Créer migration: supabase/migrations/<timestamp>_<name>.sql"
    SI tâche.type = "rls":
      AFFICHER: "      → Ajouter policy dans migration"
    SI tâche.type = "component":
      AFFICHER: "      → Créer: app/src/modules/<module>/components/<name>.tsx"
    ...

  AFFICHER: ""
  AFFICHER: "→ Pour exécuter réellement: /mockmig execute --confirm"
  → STOP
```

### Étape 5 : Exécution Backend (via Supabase MCP)

```
AFFICHER: ""
AFFICHER: "🔧 Exécution Backend..."

executed = []
failed = []

POUR CHAQUE tâche backend dans l'ordre des dépendances:
  AFFICHER: "   [<id>] <description>..."

  SI tâche a des dépendances non exécutées:
    → AFFICHER: "      ⏸️  En attente de: <deps>"
    → Continuer à la prochaine

  ESSAYER:
    SI tâche.type = "migration":
      → Générer fichier SQL depuis ontologie
      → Supabase MCP: créer migration
      → Supabase MCP: appliquer migration

    SI tâche.type = "rls":
      → Générer policy SQL depuis pattern
      → Supabase MCP: ajouter à migration existante ou créer nouvelle
      → Supabase MCP: appliquer

    SI tâche.type = "function":
      → Générer fonction SQL depuis business rules
      → Supabase MCP: créer fonction

    SI tâche.type = "index":
      → Générer CREATE INDEX
      → Supabase MCP: appliquer

    → AFFICHER: "      ✅ Succès"
    → executed.push(tâche)

  EN CAS D'ERREUR:
    → AFFICHER: "      ❌ Échec: <error>"
    → failed.push({tâche, error})
    → DEMANDER: "Continuer malgré l'erreur? (oui/non)"
    SI non:
      → GOTO étape_bilan

AFFICHER: ""
AFFICHER: "   Backend: <executed.length>/<total> tâches complétées"
```

### Étape 6 : Génération Types TypeScript

```
SI executed contient des migrations:
  AFFICHER: ""
  AFFICHER: "📝 Régénération des types..."

  → Bash: supabase gen types typescript --local > app/src/types/supabase.ts

  AFFICHER: "   ✅ Types régénérés: app/src/types/supabase.ts"
```

### Étape 7 : Exécution UI

```
AFFICHER: ""
AFFICHER: "🎨 Exécution UI..."

POUR CHAQUE tâche UI dans l'ordre des dépendances:
  AFFICHER: "   [<id>] <description>..."

  SI tâche a des dépendances backend non exécutées:
    → AFFICHER: "      ⚠️  Dépendance backend manquante"
    → Continuer

  ESSAYER:
    SI tâche.type = "component":
      → Lire composant source depuis maquette
      → Adapter le code:
        - Remplacer mock data par hooks Supabase
        - Ajouter types générés
        - Ajouter guards si nécessaire
        - Ajouter loading/error states
      → Écrire dans app/src/modules/<module>/components/

    SI tâche.type = "page":
      → Générer page Next.js
      → Intégrer composants migrés
      → Configurer route

    SI tâche.type = "guard":
      → Générer guard selon pattern
      → Écrire dans app/src/components/guards/

    → AFFICHER: "      ✅ Créé: <path>"
    → executed.push(tâche)

  EN CAS D'ERREUR:
    → AFFICHER: "      ❌ Échec: <error>"
    → failed.push({tâche, error})

AFFICHER: ""
AFFICHER: "   UI: <executed.length>/<total> tâches complétées"
```

### Étape 8 : Hooks et utilitaires

```
SI des composants ont été créés:
  AFFICHER: ""
  AFFICHER: "🔗 Génération hooks..."

  → Créer app/src/modules/<module>/hooks/use<Module>.ts
    - Hooks CRUD basés sur les tables créées
    - Utilisation de @supabase/ssr

  → Créer app/src/modules/<module>/types/index.ts
    - Re-export des types Supabase pertinents

  → Créer app/src/modules/<module>/index.ts
    - Barrel export du module

  AFFICHER: "   ✅ Module structure créée"
```

### Étape 9 : Bilan d'exécution

```
:étape_bilan

AFFICHER: ""
AFFICHER: "═══════════════════════════════════════"
AFFICHER: "📊 Bilan d'exécution"
AFFICHER: ""

total = backend_tasks.length + ui_tasks.length
success = executed.length
failures = failed.length

AFFICHER: "   Succès: <success>/<total>"
AFFICHER: "   Échecs: <failures>/<total>"

SI failures > 0:
  AFFICHER: ""
  AFFICHER: "❌ Tâches en échec:"
  POUR CHAQUE f dans failed:
    AFFICHER: "   • [<f.tâche.id>] <f.error>"

  → Créer migration/<module>/EXECUTION_ERRORS.md avec détails

  AFFICHER: ""
  AFFICHER: "→ Corriger les erreurs puis relancer:"
  AFFICHER: "  /mockmig execute --confirm --task <failed_id>"

  → Mettre à jour session.json:
    - lastError: "Exécution partielle: <failures> échecs"

SI success = total:
  AFFICHER: ""
  AFFICHER: "✅ Migration complète!"

  → Mettre à jour session.json:
    - phase: "EXECUTE"
    - gates.confirm.passed: true
    - gates.confirm.date: <now>
```

### Étape 10 : Actions post-exécution

```
SI success = total:
  AFFICHER: ""
  AFFICHER: "📋 Actions recommandées:"
  AFFICHER: ""
  AFFICHER: "1. Vérifier les migrations:"
  AFFICHER: "   supabase db diff"
  AFFICHER: ""
  AFFICHER: "2. Tester localement:"
  AFFICHER: "   npm run dev"
  AFFICHER: ""
  AFFICHER: "3. Créer une PR:"
  AFFICHER: "   gh pr create --title 'feat(<module>): migration from mockup'"
  AFFICHER: ""
  AFFICHER: "4. Déployer sur preview:"
  AFFICHER: "   (automatique via Netlify)"
```

### Étape 11 : Mettre à jour session

```
→ Mettre à jour .mockmig/session.json:
  - phase: "EXECUTE" (ou rester sur PLAN si échecs)
  - updatedAt: <now>
  - lastCommand: "/mockmig execute --confirm"
  - execution: {
      started: <timestamp>,
      completed: <timestamp>,
      success: <n>,
      failed: <n>,
      tasks: [
        {id: "BE-001", status: "done", duration: <ms>},
        {id: "BE-002", status: "failed", error: "..."},
        ...
      ]
    }

SI tous succès ET phase = EXECUTE:
  AFFICHER: ""
  AFFICHER: "═══════════════════════════════════════"
  AFFICHER: "🎉 Migration terminée!"
  AFFICHER: ""
  AFFICHER: "→ Voir le statut final: /mockmig status"
```

---

## Fichiers créés

Lors de l'exécution, les fichiers suivants peuvent être créés:

### Backend
| Type | Emplacement |
|------|-------------|
| Migrations SQL | `supabase/migrations/<timestamp>_<name>.sql` |
| Types générés | `app/src/types/supabase.ts` |

### Frontend
| Type | Emplacement |
|------|-------------|
| Composants | `app/src/modules/<module>/components/*.tsx` |
| Pages | `app/src/modules/<module>/pages/*.tsx` |
| Hooks | `app/src/modules/<module>/hooks/*.ts` |
| Types | `app/src/modules/<module>/types/index.ts` |
| Guards | `app/src/components/guards/*.tsx` |

---

## Gestion des erreurs

### Erreur de migration SQL
```
❌ Échec: relation "users" already exists
```
→ Vérifier si la table existe déjà, ajuster la migration

### Erreur RLS
```
❌ Échec: policy "owner_select" already exists
```
→ Utiliser CREATE OR REPLACE ou DROP IF EXISTS

### Erreur TypeScript
```
❌ Échec: Type 'X' is not assignable to type 'Y'
```
→ Régénérer les types, vérifier les imports

---

## Voir aussi

- `/mockmig plan` — Étape précédente
- `/mockmig status` — Voir l'état de la session
- `supabase db diff` — Voir les changements DB
