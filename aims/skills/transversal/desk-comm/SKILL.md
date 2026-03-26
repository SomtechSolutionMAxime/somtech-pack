---
name: desk-comm
description: >
  Protocole de communication inter-agents via Desk (base de données PostgreSQL
  partagée). Ce skill définit comment les agents silo s'envoient des messages,
  des tâches et des notifications à travers la BD commune. Utiliser ce skill
  chaque fois qu'un agent doit communiquer avec un autre agent, publier une
  tâche, répondre à une demande, ou consulter l'état d'un flux en cours.
---

# Desk Communication Protocol

Desk est la base de données PostgreSQL partagée qui sert de bus de communication entre tous les agents d'un silo. Plutôt qu'un système de messaging complexe (RabbitMQ, Redis), on utilise des tables PostgreSQL avec LISTEN/NOTIFY pour la communication temps réel et des tables de tâches pour les flux asynchrones.

## Pourquoi Desk plutôt qu'une message queue

Les agents silo sont des instances Claude qui fonctionnent en cycles (pas en streaming continu). Un système basé sur une BD offre trois avantages concrets : la persistance native (pas de message perdu si un agent redémarre), la requêtabilité (on peut interroger l'historique des échanges en SQL), et la simplicité (pas de broker externe à maintenir).

## Architecture de communication

Desk expose deux mécanismes complémentaires :

### 1. Table `desk_tasks` — Communication asynchrone

Les agents publient des tâches que d'autres agents consomment. C'est le mécanisme principal pour les flux de travail.

```sql
CREATE TABLE desk_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Routing
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  silo text NOT NULL,
  trace_id text,

  -- Contenu
  task_type text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  payload jsonb NOT NULL DEFAULT '{}',

  -- Lifecycle
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error text
);

CREATE INDEX idx_desk_tasks_pending ON desk_tasks(to_agent, status, priority)
  WHERE status = 'pending';
CREATE INDEX idx_desk_tasks_trace ON desk_tasks(trace_id)
  WHERE trace_id IS NOT NULL;
```

### 2. LISTEN/NOTIFY — Signaux temps réel

Quand une tâche urgente est créée, un trigger PostgreSQL envoie un signal NOTIFY pour réveiller l'agent destinataire sans qu'il ait à poller.

```sql
-- Trigger sur insertion de tâche
CREATE OR REPLACE FUNCTION notify_new_task()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'desk_' || NEW.to_agent,
    json_build_object(
      'task_id', NEW.id,
      'task_type', NEW.task_type,
      'priority', NEW.priority,
      'from', NEW.from_agent
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_desk_task_notify
  AFTER INSERT ON desk_tasks
  FOR EACH ROW EXECUTE FUNCTION notify_new_task();
```

## Types de tâches standard

Chaque `task_type` suit le format `domaine.action` et a un payload attendu :

| task_type | De → Vers | Payload attendu |
|-----------|-----------|-----------------|
| `ticket.new` | clientele → dev-orchestrator | `{ ticket_id, title, description, priority, client }` |
| `ticket.clarification` | dev-orchestrator → clientele | `{ ticket_id, questions: [...] }` |
| `task.assign` | dev-orchestrator → dev-worker-* | `{ task_id, branch, specs, acceptance_criteria }` |
| `task.completed` | dev-worker-* → dev-orchestrator | `{ task_id, pr_number, summary }` |
| `pr.review_request` | dev-worker-1 → dev-worker-2 | `{ pr_number, branch, files_changed }` |
| `pr.review_result` | dev-worker-2 → dev-worker-1 | `{ pr_number, approved, comments: [...] }` |
| `pr.security_check` | dev-orchestrator → security-validator | `{ pr_number, branch, diff_summary }` |
| `pr.security_result` | security-validator → dev-orchestrator | `{ pr_number, passed, findings: [...] }` |
| `scan.schedule` | system → security-auditor | `{ scan_type, scope, schedule }` |
| `scan.report` | security-auditor → dev-orchestrator | `{ scan_id, findings, severity_counts }` |
| `deploy.request` | dev-orchestrator → devops-silo | `{ environment, branch, migration_files }` |
| `deploy.result` | devops-silo → dev-orchestrator | `{ environment, success, url, rollback_id }` |

## Cycle de vie d'une tâche

```
pending → in_progress → completed
                     → failed
                     → cancelled
```

### Règles de transition

- Seul l'agent `to_agent` peut passer une tâche de `pending` à `in_progress`
- L'agent qui traite la tâche met à jour `result` (ou `error`) avant de la marquer `completed` (ou `failed`)
- `cancelled` peut être déclenché par l'agent émetteur ou par le dev-orchestrator
- Chaque transition met à jour `updated_at`

## Priorités

| Priorité | Délai attendu | Cas d'usage |
|----------|---------------|-------------|
| `critical` | < 5 minutes | Incident prod, faille sécurité active |
| `high` | < 30 minutes | Bug bloquant client, PR urgente |
| `normal` | < 2 heures | Développement courant, reviews |
| `low` | Prochain cycle | Refactoring, documentation, améliorations |

## Pattern de consommation

Quand un agent démarre son cycle de travail, il consulte Desk dans cet ordre :

```sql
-- 1. Tâches critiques d'abord
SELECT * FROM desk_tasks
WHERE to_agent = 'dev-worker-1'
  AND silo = 'client-acme'
  AND status = 'pending'
ORDER BY
  CASE priority
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'normal' THEN 2
    WHEN 'low' THEN 3
  END,
  created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;  -- Évite les conflits si 2 workers lisent en même temps
```

Le `FOR UPDATE SKIP LOCKED` est essentiel : il empêche deux agents de prendre la même tâche simultanément.

## Propagation du trace_id

Quand une action traverse plusieurs agents, le `trace_id` doit suivre le flux complet. Le premier agent (souvent clientele) génère le trace_id, et chaque tâche subséquente le propage :

```
Client envoie un message Slack
  → clientele crée ticket (trace_id: tr_x1y2z3)
    → dev-orchestrator crée tâches (même trace_id)
      → dev-worker-1 code (même trace_id)
      → security-validator review (même trace_id)
    → devops-silo déploie (même trace_id)
  → clientele confirme au client (même trace_id)
```

## Anti-patterns

- **Polling agressif** : Ne pas interroger Desk toutes les secondes. Utiliser LISTEN/NOTIFY pour les urgences, et poller toutes les 30-60 secondes pour le reste.
- **Tâches sans payload** : Une tâche `task.assign` sans `specs` ni `acceptance_criteria` force le worker à deviner. Inclure tout le contexte nécessaire.
- **Ignorer le trace_id** : Sans trace_id, impossible de reconstituer le parcours d'un ticket client à travers les agents.
- **Résultat sans structure** : Le champ `result` doit être un JSON structuré, pas une string libre. L'agent consommateur doit pouvoir parser le résultat programmatiquement.
