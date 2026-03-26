---
name: silo-logging
description: >
  Format standard de logging et métriques pour tous les agents silo AIMS.
  Ce skill définit comment chaque agent doit structurer ses logs d'activité,
  rapporter ses métriques de performance, et alimenter le tableau de bord
  opérationnel. Utiliser ce skill dès qu'un agent produit un log, génère un
  rapport d'activité, ou rapporte des métriques — y compris au démarrage du
  container, à chaque action significative, et en fin de cycle.
---

# Silo Logging

Chaque agent silo produit des traces d'activité lisibles par les humains ET parsables par les systèmes de monitoring. Un bon log raconte l'histoire de ce qui s'est passé sans obliger quelqu'un à ouvrir le code source.

## Pourquoi c'est important

Sans format standard, chaque agent invente son propre style de log. Le résultat : un opérateur qui doit apprendre 7 formats différents pour diagnostiquer un problème qui traverse 3 agents. Le format unifié permet de corréler les événements entre agents via un `trace_id` commun.

## Format de log standard

Chaque entrée de log suit cette structure JSON Lines (une ligne JSON par événement) :

```json
{
  "ts": "2026-03-06T14:32:01.234Z",
  "level": "info",
  "agent": "clientele",
  "silo": "client-acme",
  "trace_id": "tr_a1b2c3d4",
  "action": "ticket.triaged",
  "detail": "Ticket #142 classé P2-bug, assigné à dev-orchestrator",
  "duration_ms": 234,
  "meta": {}
}
```

### Champs obligatoires

| Champ | Type | Description |
|-------|------|-------------|
| `ts` | ISO 8601 UTC | Horodatage précis au milliseconde |
| `level` | enum | `debug`, `info`, `warn`, `error`, `fatal` |
| `agent` | string | ID de l'agent émetteur (tel que dans architecture.json) |
| `silo` | string | Identifiant du silo client |
| `action` | string | Verbe.objet décrivant l'action (`ticket.triaged`, `pr.merged`, `scan.completed`) |
| `detail` | string | Description humainement lisible de ce qui s'est passé |

### Champs optionnels

| Champ | Type | Description |
|-------|------|-------------|
| `trace_id` | string | Identifiant de corrélation partagé entre agents pour suivre un flux |
| `duration_ms` | number | Durée de l'opération en millisecondes |
| `meta` | object | Données structurées supplémentaires (ticket_id, pr_number, file_count...) |
| `error` | object | `{ "code": "RLS_DENIED", "message": "...", "stack": "..." }` |

## Niveaux de log

Utilise le bon niveau — un `error` qui n'en est pas un crée de la fatigue d'alerte.

| Niveau | Quand l'utiliser | Exemple |
|--------|-----------------|---------|
| `debug` | Détails internes utiles au développement, jamais en prod par défaut | Contenu de la requête SQL générée |
| `info` | Action significative complétée avec succès | PR créée, ticket trié, déploiement terminé |
| `warn` | Situation inhabituelle qui n'empêche pas l'exécution | Retry réussi après timeout, config par défaut utilisée |
| `error` | Échec d'une opération qui nécessite une attention | Migration échouée, API externe indisponible |
| `fatal` | L'agent ne peut plus fonctionner | Connexion DB perdue, secrets manquants |

## Convention de nommage des actions

Le champ `action` suit le pattern `domaine.verbe_passé` :

```
ticket.created     ticket.triaged      ticket.escalated
task.assigned      task.completed      task.blocked
pr.created         pr.reviewed         pr.merged
scan.started       scan.completed      scan.failed
deploy.started     deploy.completed    deploy.rolled_back
migration.applied  migration.validated migration.failed
```

## Métriques de cycle

Chaque agent rapporte ses métriques à la fin de chaque cycle de travail (ou toutes les 15 minutes pour les agents en écoute continue) :

```json
{
  "ts": "2026-03-06T15:00:00.000Z",
  "level": "info",
  "agent": "dev-worker-1",
  "silo": "client-acme",
  "action": "metrics.cycle_report",
  "detail": "Cycle 14h45-15h00 complété",
  "meta": {
    "tasks_completed": 3,
    "tasks_failed": 0,
    "avg_duration_ms": 45200,
    "tokens_used": 128500,
    "errors": 0,
    "status": "idle"
  }
}
```

### Métriques obligatoires par cycle

| Métrique | Type | Description |
|----------|------|-------------|
| `tasks_completed` | number | Nombre de tâches terminées dans le cycle |
| `tasks_failed` | number | Nombre de tâches en échec |
| `avg_duration_ms` | number | Durée moyenne par tâche |
| `tokens_used` | number | Consommation de tokens LLM |
| `errors` | number | Nombre d'erreurs rencontrées |
| `status` | enum | `active`, `idle`, `blocked`, `error` |

## Heartbeat

Chaque agent émet un heartbeat toutes les 60 secondes pour signaler qu'il est vivant :

```json
{
  "ts": "2026-03-06T14:33:00.000Z",
  "level": "debug",
  "agent": "security-auditor",
  "silo": "client-acme",
  "action": "system.heartbeat",
  "meta": { "status": "idle", "uptime_s": 3600, "memory_mb": 256 }
}
```

## Destination des logs

Les logs sont écrits dans Desk (table `silo_logs`) pour permettre la corrélation inter-agents et l'historique. Le format JSON Lines permet aussi une sortie stdout pour les systèmes de collecte Docker.

```sql
-- Structure de la table silo_logs dans Desk
CREATE TABLE silo_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL,
  agent text NOT NULL,
  silo text NOT NULL,
  trace_id text,
  action text NOT NULL,
  detail text,
  duration_ms integer,
  meta jsonb DEFAULT '{}',
  error jsonb
);

CREATE INDEX idx_silo_logs_agent ON silo_logs(agent, ts DESC);
CREATE INDEX idx_silo_logs_trace ON silo_logs(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_silo_logs_level ON silo_logs(level, ts DESC) WHERE level IN ('error', 'fatal');
```

## Anti-patterns

- **Log verbeux sans contexte** : `"Fait"` ne dit rien. Inclure le quoi, le combien, et le résultat.
- **Tout en `info`** : Si un scan de sécurité trouve 3 vulnérabilités critiques, c'est un `warn` ou `error`, pas un `info`.
- **Logs sans trace_id** : Quand une action traverse plusieurs agents (client → triage → orchestrator → worker), le même `trace_id` doit suivre le flux de bout en bout.
- **Métriques manquantes** : Un agent qui ne rapporte pas ses métriques de cycle est invisible pour l'opérateur.
