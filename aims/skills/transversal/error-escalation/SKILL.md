---
name: error-escalation
description: >
  Patterns de gestion d'erreurs, retry, fallback et escalade pour les agents
  silo AIMS. Ce skill définit comment un agent doit réagir face à un échec :
  retenter, basculer vers un plan B, ou escalader vers un autre agent. Utiliser
  ce skill quand une opération échoue, quand un agent reçoit une erreur d'un
  service externe, ou quand un problème dépasse la capacité de l'agent courant.
---

# Error Escalation

Un agent silo qui rencontre une erreur ne doit jamais la laisser passer silencieusement ni abandonner sans rien dire. Ce skill définit trois niveaux de réaction (retry, fallback, escalade) et les règles pour choisir le bon.

## Philosophie

L'objectif n'est pas de tout attraper et tout retenter — c'est de traiter chaque erreur au bon niveau. Une erreur réseau temporaire se résout par un retry. Un token expiré nécessite un fallback (rafraîchir le token). Un conflit de migration nécessite une escalade humaine. Confondre ces niveaux crée soit des boucles infinies, soit des abandons prématurés.

## Arbre de décision

Quand une opération échoue, suivre ce flow :

```
L'erreur est-elle transitoire ?
  (timeout, 429, 503, connexion refusée)
  │
  ├─ OUI → RETRY (avec backoff)
  │         Réussi ? → Continuer normalement
  │         3 échecs ? → L'erreur est-elle contournable ?
  │                      │
  │                      ├─ OUI → FALLBACK
  │                      └─ NON → ESCALADE
  │
  └─ NON → L'erreur est-elle contournable ?
           │
           ├─ OUI → FALLBACK
           │         Réussi ? → Continuer + log warn
           │         Échoué ? → ESCALADE
           │
           └─ NON → ESCALADE immédiate
```

## Niveau 1 : Retry

Pour les erreurs transitoires uniquement. Ne jamais retenter une erreur logique (validation, permission, conflit).

### Erreurs retryables

| Code/Pattern | Source typique | Max retries |
|-------------|----------------|-------------|
| HTTP 429 (rate limit) | API externe, Supabase | 3, avec respect du header Retry-After |
| HTTP 503 (service unavailable) | Service temporairement down | 3 |
| Timeout réseau | Latence réseau, service lent | 2 |
| Connection refused | Container pas encore prêt | 3 |
| Lock timeout PostgreSQL | Conflit de lock sur desk_tasks | 2 |

### Erreurs NON retryables

| Code/Pattern | Pourquoi ne pas retenter |
|-------------|------------------------|
| HTTP 400 (bad request) | Le payload est invalide, retenter ne changera rien |
| HTTP 401/403 (auth) | Credentials invalides — fallback vers refresh ou escalade |
| HTTP 404 (not found) | La ressource n'existe pas |
| Erreur de validation | Les données ne respectent pas le schéma |
| Conflit de migration | État de la BD incompatible — nécessite intervention |

### Stratégie de backoff

```
Tentative 1 : immédiate
Tentative 2 : attendre 2 secondes
Tentative 3 : attendre 8 secondes (exponentiel × 4)
```

Ajouter un jitter aléatoire de ±25% pour éviter que tous les agents retentent exactement au même moment (effet de troupeau).

### Template de log retry

```json
{
  "level": "warn",
  "action": "retry.attempted",
  "detail": "Tentative 2/3 — Supabase API timeout après 5000ms",
  "meta": {
    "operation": "desk_tasks.insert",
    "attempt": 2,
    "max_attempts": 3,
    "wait_ms": 2000,
    "error_type": "timeout"
  }
}
```

## Niveau 2 : Fallback

Quand l'opération principale échoue mais qu'une alternative existe.

### Fallbacks courants

| Opération échouée | Fallback | Conditions |
|-------------------|----------|------------|
| API Supabase REST timeout | Connexion directe PostgreSQL | Si l'agent a accès direct |
| Slack API indisponible | Écrire dans desk_tasks pour envoi différé | clientele uniquement |
| Worker 1 surchargé/bloqué | Réassigner au worker 2 | dev-orchestrator décide |
| Scan de dépendances échoué | Utiliser le dernier rapport en cache | Si < 24h |
| Génération de test IA échoue | Créer un test placeholder avec TODO | Marquer comme incomplet |

### Règles de fallback

- Toujours logger le fallback en `warn` avec le contexte de l'erreur originale
- Le fallback doit être fonctionnellement équivalent OU explicitement dégradé (et documenté comme tel)
- Ne pas enchaîner plus de 2 niveaux de fallback — après le 2e échec, c'est une escalade

## Niveau 3 : Escalade

Quand l'agent ne peut pas résoudre le problème seul. L'escalade crée une tâche dans Desk vers l'agent approprié.

### Matrice d'escalade

| Agent en erreur | Escalade vers | task_type |
|----------------|---------------|-----------|
| clientele | dev-orchestrator | `escalation.client_issue` |
| dev-worker-* | dev-orchestrator | `escalation.task_blocked` |
| dev-orchestrator | opérateur humain (via Desk flag) | `escalation.human_required` |
| security-validator | security-auditor | `escalation.security_finding` |
| security-auditor | dev-orchestrator + opérateur | `escalation.critical_vulnerability` |
| devops-silo | dev-orchestrator + opérateur | `escalation.infra_failure` |

### Format d'escalade

Chaque tâche d'escalade contient un payload structuré qui donne au destinataire tout le contexte sans avoir à chercher :

```json
{
  "task_type": "escalation.task_blocked",
  "priority": "high",
  "from_agent": "dev-worker-1",
  "to_agent": "dev-orchestrator",
  "payload": {
    "original_task_id": "uuid-de-la-tache",
    "error_summary": "Migration 20260306_add_invoices.sql échoue — conflit avec colonne existante",
    "error_detail": "column 'amount' of relation 'invoices' already exists",
    "attempts": [
      { "strategy": "retry", "count": 1, "result": "same_error" },
      { "strategy": "fallback", "action": "rename_column", "result": "schema_conflict" }
    ],
    "impact": "Bloque la PR #47 et les tâches dépendantes #48, #49",
    "suggested_resolution": "Vérifier si la migration précédente a déjà ajouté cette colonne. Créer une migration corrective.",
    "context": {
      "branch": "feat/invoicing",
      "pr_number": 47,
      "trace_id": "tr_invoice_flow"
    }
  }
}
```

### Escalade humaine

Certaines situations ne peuvent être résolues que par un humain. L'agent marque la tâche avec un flag spécial :

```json
{
  "task_type": "escalation.human_required",
  "priority": "critical",
  "payload": {
    "reason": "Décision d'affaires requise — le client demande une fonctionnalité hors scope du contrat",
    "options": [
      "Accepter et ajuster le budget",
      "Refuser poliment avec alternatives",
      "Proposer un avenant au contrat"
    ],
    "deadline": "2026-03-07T17:00:00Z"
  }
}
```

## Circuit breaker

Si un agent accumule 5 erreurs consécutives sur le même type d'opération en moins de 10 minutes, il active un circuit breaker :

1. **Open** : L'agent arrête de tenter cette opération
2. **Log** un `error` avec le contexte complet
3. **Escalade** immédiate vers le dev-orchestrator
4. **Half-open** après 5 minutes : tente une seule opération
5. Si succès → **Closed** (retour à la normale). Si échec → reste **Open** encore 5 minutes

## Anti-patterns

- **Retry infini** : Maximum 3 tentatives, toujours. Une boucle infinie de retry peut saturer un service déjà en difficulté.
- **Escalade sans contexte** : Un message "ça marche pas" ne sert à rien. Inclure l'erreur, les tentatives faites, et l'impact.
- **Swallow silencieux** : Attraper une erreur et continuer comme si de rien n'était. Même si c'est non-critique, logger en `warn`.
- **Escalade pour des erreurs retryables** : Un timeout réseau de 2 secondes ne justifie pas de réveiller l'orchestrateur.
