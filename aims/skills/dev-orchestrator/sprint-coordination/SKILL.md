---
name: sprint-coordination
description: >
  Suivre l'avancement en temps réel, détecter les blocages, rééquilibrer la
  charge entre les deux dev-workers. Ce skill définit le cycle de coordination
  que dev-orchestrator exécute régulièrement (polling Desk, consultation du
  statut des tâches, détection d'anomalies, ajustements). Utiliser ce skill
  toutes les 30 minutes pour rester conscient de l'état du sprint en cours.
---

# Sprint Coordination

Dev-orchestrator n'est pas un gestionnaire passif qui assigne des tâches et disparaît. C'est un agent en veille permanente qui détecte les blocages et réaction avant qu'un worker ne soit paralysé 2 heures. Ce skill définit les rituels de coordination et les seuils d'action.

## Philosophie

Le sprint n'est pas un plan immuable — c'est une hypothèse qu'on teste chaque 30 minutes. Quand la réalité dévie du plan, réagir fast.

## Cycle de coordination

Dev-orchestrator exécute ce cycle toutes les 30 minutes (ou après chaque tâche complétée, selon ce qui arrive en premier) :

### 1. Polling Desk (5 min)

Consulter Desk pour récupérer l'état actuel :

```sql
-- Tâches assignées au sprint actuel
SELECT id, task_id, status, assigned_to, created_at, updated_at
FROM desk_tasks
WHERE silo = 'client-acme'
  AND task_type = 'task.assign'
  AND created_at > now() - interval '7 days'
ORDER BY priority DESC, created_at ASC;

-- PRs en attente de review
SELECT pr_number, branch, files_changed, created_at
FROM desk_tasks
WHERE task_type = 'pr.created'
  AND status = 'pending'
ORDER BY created_at ASC;

-- Escalades ou erreurs
SELECT id, task_id, error, from_agent
FROM desk_tasks
WHERE task_type LIKE 'escalation.%'
  AND status = 'pending'
ORDER BY priority DESC;
```

### 2. Calculer la charge actuelle (10 min)

Pour chaque worker, compter les heures de travail restante :

```sql
-- Charge par worker
SELECT
  assigned_to,
  COUNT(*) as task_count,
  SUM(payload->>'estimated_hours')::float as estimated_hours,
  ARRAY_AGG(task_id) as task_ids,
  ARRAY_AGG(status) as statuses
FROM desk_tasks
WHERE task_type = 'task.assign'
  AND status IN ('pending', 'in_progress')
GROUP BY assigned_to;
```

Interpréter les résultats :

| Worker | Tâches | Heures | Charge | Statut |
|--------|--------|--------|--------|--------|
| worker-1 | 2 | 5.5 | Normale | Active |
| worker-2 | 4 | 12.0 | SURCHARGÉ | À risque |

Charge par niveau :

- **0-6h** : Vert — peut accepter nouvelles tâches
- **6-10h** : Jaune — peut accepter si tâche critique
- **10-12h** : Orange — pas de nouvelles tâches sauf escalade
- **12h+** : ROUGE — BLOCAGE, intervention requise

### 3. Vérifier les dépendances (5 min)

Pour chaque tâche `in_progress`, vérifier que ses dépendances sont respectées :

```sql
-- Tâches avec dépendances bloquées
SELECT
  t.task_id,
  t.status,
  t.assigned_to,
  (t.payload->>'depends_on')::text[] as depends_on,
  -- Fetch status of dependencies
  (SELECT array_agg(status) FROM desk_tasks WHERE task_id = ANY((t.payload->>'depends_on')::text[])) as dep_statuses
FROM desk_tasks t
WHERE t.status = 'in_progress'
  AND t.payload->>'depends_on' IS NOT NULL;
```

Flag les tâches où une dépendance n'est PAS encore `completed`.

### 4. Détecter les blocages (10 min)

Appliquer cette matrice de détection :

#### Pattern 1 : Tâche stagnante

```
Critère : tâche in_progress depuis > 4 heures sans progression
Action : Demander une mises à jour au worker
```

Log de détection :

```json
{
  "action": "sprint.stagnant_task_detected",
  "priority": "high",
  "meta": {
    "task_id": "TSK-145-2",
    "assigned_to": "dev-worker-1",
    "status": "in_progress",
    "duration_hours": 4.5,
    "estimated_hours": 2.0,
    "last_update": "14:00"
  }
}
```

Demander au worker via Desk :

```json
{
  "task_type": "task.status_check",
  "from_agent": "dev-orchestrator",
  "to_agent": "dev-worker-1",
  "priority": "normal",
  "payload": {
    "task_id": "TSK-145-2",
    "message": "Tâche en cours depuis 4.5h, estimation était 2h. Besoin d'une mise à jour : où vous en êtes, y a-t-il un blocage ?",
    "expect_response_in_minutes": 15
  }
}
```

#### Pattern 2 : Worker idle avec tâches en attente

```
Critère : worker n'a pas mise à jour de tâche depuis 2h ET il y a des tâches pending
Action : Le checker — problème de connectivité ? Besoin d'aide ?
```

#### Pattern 3 : Dépendance non-satisfaite depuis > 2h

```
Critère : Tâche B attend la tâche A, mais A est stagnante
Action : Escalader A OU relâcher B pour la faire en parallèle
```

#### Pattern 4 : Erreurs répétées sur le même type de tâche

```
Critère : 3+ erreurs sur des tâches de même type (ex: 3 migrations SQL qui échouent)
Action : C'est un pattern systématique, pas un incident isolé. Chercher la cause racine.
```

Log :

```json
{
  "action": "sprint.pattern_detected",
  "priority": "high",
  "meta": {
    "pattern": "repeated_migration_failures",
    "error_count": 3,
    "task_ids": ["TSK-140", "TSK-142", "TSK-145"],
    "possible_cause": "RLS configuration or column constraint",
    "recommendation": "Create spike task to audit RLS policies"
  }
}
```

### 5. Décision : rééquilibrer ou escalader (10 min)

Basé sur les détections du step 4, appliquer une action :

#### Scénario 1 : Worker surchargé, tâche bloquée par dépendance

**Situation** : Worker-2 a 12h de tâches, worker-1 a 4h. TSK-145-2 (dépend de TSK-145-1) est stagnante chez worker-2.

**Action** :

```
1. Vérifier si TSK-145-1 est la blocker
2. Si oui → Extraire TSK-145-1 et le faire démarrer immédiatement (reassign si nécessaire)
3. Créer une tâche temporaire pour débloquer : "Frontend peut faire du mock de l'API"
```

#### Scénario 2 : Dépendance non-satisfaite depuis > 2h

**Situation** : Frontend attend un endpoint. Le backend a coté la tâche comme "pending" mais elle n'a pas commencée.

**Action** :

```
1. Checker directement avec le worker — pourquoi pas commencée ?
2. Si blocage technique : escalader
3. Si c'est juste pas arrivé : remonter la priorité
```

#### Scénario 3 : Même erreur sur 3 tâches

**Situation** : Trois migrations SQL échouent avec le même message "column already exists".

**Action** :

```
1. Ne pas retenter les 3 tâches — c'est futile
2. Créer une tâche spike : "Audit RLS policies and existing schema"
3. Bloquer les 3 tâches tant que le spike n'est pas résolu
```

### 6. Rapporter au sprint (fin du cycle)

Émettre un rapport structuré (voir silo-logging) :

```json
{
  "ts": "2026-03-06T15:00:00.000Z",
  "action": "sprint.coordination_report",
  "detail": "Coordination cycle 14h30-15h00",
  "meta": {
    "cycle_number": 14,
    "tasks_total": 9,
    "tasks_pending": 2,
    "tasks_in_progress": 5,
    "tasks_completed": 2,
    "worker_1_load_hours": 4.5,
    "worker_2_load_hours": 10.0,
    "blockers_detected": 1,
    "actions_taken": [
      "Requested status check on TSK-145-2",
      "Elevated TSK-146 priority due to dependency"
    ],
    "health_status": "yellow",
    "estimated_completion": "2026-03-07T10:00:00Z"
  }
}
```

## Rééquilibrage de charge

Quand les heures ne sont pas équitablement distribuées, réagir selon ce protocole :

### Écart toléré

| Écart | Action |
|------|--------|
| 0-2h | Rien (fluctuation normale) |
| 2-4h | Observer, peut être normal si un task prend moins longtemps |
| 4-6h | Rééquilibrer si possible |
| 6h+ | Intervention obligatoire |

### Comment rééquilibrer

**Option 1 : Réassigner une tâche pending**

Si worker-2 a 12h et worker-1 a 4h, et qu'il y a une tâche de 3h en pending :

```json
{
  "task_type": "task.reassign",
  "from_agent": "dev-orchestrator",
  "to_agent": "dev-worker-1",
  "payload": {
    "task_id": "TSK-147",
    "from_agent_previous": "dev-worker-2",
    "reason": "Load balancing: worker-2 has 12h, worker-1 has 4h",
    "new_branch": "feat/invoicing-v2",
    "specs": {...}
  }
}
```

**Option 2 : Accélérer une tâche bloquée chez le surchargé**

Si worker-2 est surchargé et a une tâche stagnante dépendant d'une autre tâche en attente :

```
1. Priorité immédiate : faire commencer la dépendance
2. Débloquer le worker surchargé (ex: frontend peut mock l'API)
```

**Option 3 : Créer une tâche d'aide**

Si worker-2 se noie sur une tâche massive, proposer :

```
"TSK-150 : Code review et test de TSK-148 (assigné à worker-1)"
```

Ça décharge le surchargé, garde le second worker occupé.

### Charge prédictive

Quand on assigne une tâche, ajouter une marge d'erreur (les estimations sont souvent 1.5x trop optimistes) :

```
Estimation dite = 2h
Ajuster mentalement = 2h × 1.5 = 3h
```

Ne pas assigner à un worker s'il a déjà 12h - estimation.

## Détection des erreurs répétées

Quand un worker échoue 3 fois sur le même type de tâche dans la même session :

```json
{
  "action": "sprint.error_pattern",
  "priority": "high",
  "meta": {
    "error_type": "RLS_DENIED",
    "affected_tasks": ["TSK-142", "TSK-144", "TSK-146"],
    "worker": "dev-worker-2",
    "error_message": "new row violates row-level security policy",
    "first_occurrence": "14:05",
    "last_occurrence": "14:58",
    "recommendation": "Spike: Audit RLS policies for this feature set"
  }
}
```

Ne pas dire au worker de retenter. Créer une tâche spike.

## Métriques de coordination

À chaque rapport de cycle, capturer :

```json
{
  "meta": {
    "coordination_cycle": 14,
    "cycle_duration_minutes": 30,
    "tasks_completed_this_cycle": 2,
    "avg_task_completion_time_hours": 1.5,
    "blockers_detected": 1,
    "blockers_resolved": 1,
    "worker_1_utilization_percent": 75,
    "worker_2_utilization_percent": 83,
    "critical_path_progress_percent": 45,
    "estimated_sprint_completion_hours": 12
  }
}
```

Interpréter :

- **utilization > 90%** : Trop chargé, risque de qualité
- **utilization < 50%** : Worker idle, rééquilibrer ou escalader
- **critical_path_progress < 30% after 50% of time** : Va trop lentement, probable retard

## Anti-patterns

- **Ignorer les status checks** : Un worker idle depuis 2h sans réponse n'est pas "OK". Checker activement.
- **Retenter sans analyser** : "Retry the migration" 3 fois de suite est une boucle infinie. Analyser la cause d'abord.
- **Rééquilibrer en permanence** : Reassigner une tâche à chaque cycle crée du chaos. Attendre 2-3 cycles avant de réagir aux petits écarts.
- **Assigner au surchargé parce que "c'est son domaine"** : Spécialiste qui se noie = meilleure solution : débloquer le specialist.
- **Masquer les blocages** : "Le worker dit que c'est presque fini" ne compte pas. Status visible dans Desk, ou c'est un blocage caché.
- **Sprint sans coordination** : Assigner des tâches le lundi et checker vendredi = catastrophe garantie. Coordination active, toutes les 30 min.
