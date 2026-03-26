---
name: audit-trail
description: >
  Traçabilité complète des actions prises par chaque agent silo AIMS.
  Ce skill définit comment enregistrer, stocker et interroger l'historique
  des décisions et actions de chaque agent. Indispensable pour la conformité
  (Loi 25), le debugging post-incident, et la transparence client. Utiliser
  ce skill dès qu'un agent prend une décision significative, modifie des
  données, ou interagit avec un système externe.
---

# Audit Trail

L'audit trail va plus loin que le logging — il enregistre non seulement ce qui s'est passé, mais **pourquoi** et **sur la base de quoi** chaque décision a été prise. C'est la mémoire officielle du silo.

## Différence avec le logging

| Aspect | Logging (silo-logging) | Audit Trail |
|--------|----------------------|-------------|
| Objectif | Monitoring opérationnel | Conformité et traçabilité |
| Contenu | Actions et métriques | Décisions, justifications, données affectées |
| Rétention | 30 jours (configurable) | Durée du contrat client + 2 ans minimum |
| Mutabilité | Peut être purgé | Immuable (append-only) |
| Audience | Opérateurs, devops | Auditeurs, légal, client |

## Structure d'un événement d'audit

```sql
CREATE TABLE audit_trail (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ts timestamptz DEFAULT now() NOT NULL,
  silo text NOT NULL,
  agent text NOT NULL,
  trace_id text,

  -- Quoi
  event_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,

  -- Pourquoi
  reason text NOT NULL,
  decision_basis text,

  -- Données
  before_state jsonb,
  after_state jsonb,
  diff jsonb,

  -- Contexte
  triggered_by text,
  task_id uuid REFERENCES desk_tasks(id),
  meta jsonb DEFAULT '{}'
);

-- Immuabilité : pas de UPDATE ni DELETE autorisé
REVOKE UPDATE, DELETE ON audit_trail FROM silo_agent_role;

CREATE INDEX idx_audit_silo_ts ON audit_trail(silo, ts DESC);
CREATE INDEX idx_audit_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX idx_audit_agent ON audit_trail(agent, ts DESC);
```

## Types d'événements auditables

Tout ne mérite pas un événement d'audit. Voici les catégories qui en nécessitent un :

### Toujours auditer

| Catégorie | event_type | Exemples |
|-----------|-----------|----------|
| **Données modifiées** | `data.created`, `data.updated`, `data.deleted` | Création d'un ticket, modification d'une facture |
| **Accès sensible** | `access.granted`, `access.denied`, `access.revoked` | Tentative d'accès à des données PII |
| **Décision automatisée** | `decision.automated` | Triage automatique d'un ticket, assignation d'un worker |
| **Communication externe** | `comm.sent`, `comm.received` | Message Slack envoyé au client |
| **Déploiement** | `deploy.started`, `deploy.completed`, `deploy.rolled_back` | Mise en production |
| **Sécurité** | `security.scan`, `security.finding`, `security.remediation` | Résultat d'audit, correction appliquée |
| **Escalade** | `escalation.created`, `escalation.resolved` | Problème escaladé, résolution |

### Ne pas auditer

- Heartbeats et métriques de cycle (c'est du logging)
- Lectures sans modification (sauf données PII — Loi 25)
- Opérations internes de debug

## Enregistrement d'une décision automatisée

Quand un agent prend une décision sans intervention humaine (ex : triage automatique, assignation), il enregistre le raisonnement :

```json
{
  "event_type": "decision.automated",
  "agent": "clientele",
  "resource_type": "ticket",
  "resource_id": "TK-142",
  "reason": "Ticket classé P2-bug par analyse du contenu",
  "decision_basis": "Mots-clés détectés: 'erreur', 'crash', 'ne fonctionne plus'. Historique client: 2 tickets similaires résolus en P2. Aucune mention d'impact financier (sinon P1).",
  "after_state": {
    "priority": "P2",
    "category": "bug",
    "assigned_to": "dev-orchestrator"
  },
  "meta": {
    "confidence": 0.87,
    "alternative_considered": "P1-bug (rejeté: pas d'impact financier mentionné)"
  }
}
```

Le champ `decision_basis` est important pour la conformité Loi 25 : il permet d'expliquer à un client **pourquoi** une décision automatisée a été prise sur ses données.

## Conformité Loi 25

La Loi 25 du Québec impose des obligations spécifiques quand des renseignements personnels sont traités par des systèmes automatisés :

### Obligations d'audit

| Obligation | Comment l'audit trail y répond |
|------------|-------------------------------|
| Droit d'accès (art. 27) | Requête SQL par `resource_id` pour extraire tout ce qui concerne un individu |
| Droit de rectification (art. 28) | `before_state` / `after_state` montrent chaque modification |
| Décision automatisée (art. 12.1) | `decision_basis` documente le raisonnement |
| Registre des incidents (art. 3.5) | `event_type = 'security.*'` pour tous les incidents de sécurité |
| Évaluation de facteurs (art. 3.3) | `access.*` sur les données PII trace qui y a accédé |

### Tags PII

Quand un événement implique des renseignements personnels, ajouter un flag dans `meta` :

```json
{
  "meta": {
    "pii_involved": true,
    "pii_types": ["email", "phone"],
    "legal_basis": "execution_contrat"
  }
}
```

## Requêtes utiles

### Reconstituer le parcours d'un ticket

```sql
SELECT ts, agent, event_type, reason, after_state
FROM audit_trail
WHERE trace_id = 'tr_x1y2z3'
ORDER BY ts ASC;
```

### Auditer les accès PII des 30 derniers jours

```sql
SELECT ts, agent, event_type, resource_type, resource_id
FROM audit_trail
WHERE silo = 'client-acme'
  AND meta->>'pii_involved' = 'true'
  AND ts > now() - interval '30 days'
ORDER BY ts DESC;
```

### Décisions automatisées sur un client spécifique

```sql
SELECT ts, agent, reason, decision_basis, after_state
FROM audit_trail
WHERE event_type = 'decision.automated'
  AND resource_id = 'client-123'
ORDER BY ts DESC;
```

## Rétention et archivage

| Type d'événement | Rétention active | Archivage cold |
|-----------------|-----------------|----------------|
| Décisions automatisées | Durée du contrat | + 2 ans |
| Accès PII | Durée du contrat | + 5 ans (Loi 25) |
| Incidents sécurité | Durée du contrat | + 5 ans |
| Données modifiées | 1 an | + 1 an |
| Communications externes | 1 an | + 2 ans |

## Anti-patterns

- **Audit après coup** : Enregistrer l'événement AVANT d'exécuter l'action, pas après. Si l'action plante, on a quand même la trace de la tentative.
- **Diff manquant** : Un `data.updated` sans `before_state` / `after_state` est inutile pour la rectification.
- **Raison vague** : `"Décision automatique"` ne satisfait pas la Loi 25. Documenter le raisonnement spécifique.
- **Ignorer les lectures PII** : La Loi 25 exige de tracer qui accède aux renseignements personnels, pas seulement qui les modifie.
