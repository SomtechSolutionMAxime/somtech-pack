---
name: ticket-triage
description: >
  Catégoriser et prioriser les demandes entrantes des clients pour l'agent
  clientele du silo AIMS. Ce skill transforme un message client brut (Slack,
  email, formulaire) en un ticket structuré avec priorité, catégorie et
  routage vers le bon agent. Utiliser ce skill à chaque nouveau message
  client, chaque demande de support, ou chaque signalement de bug.
---

# Ticket Triage

L'agent clientele est le premier point de contact entre le client et le silo. Chaque message entrant doit être transformé en un ticket structuré avant d'être transmis au reste de l'équipe. Un bon triage accélère la résolution ; un mauvais triage gaspille le temps de tout le monde.

## Processus de triage

### 1. Réception et extraction

À la réception d'un message client (Slack, email, ou desk_tasks entrant), extraire les informations clés :

```
SOURCE: [Slack / Email / Formulaire / Desk]
CLIENT: [Nom du client / Identifiant]
MESSAGE BRUT: [Le texte exact du client]
PIÈCES JOINTES: [Screenshots, fichiers, logs fournis]
CONTEXTE: [Historique récent avec ce client si disponible]
```

### 2. Classification

Chaque ticket reçoit une **catégorie** et une **priorité**.

#### Catégories

| Catégorie | Indicateurs dans le message | Route vers |
|-----------|----------------------------|------------|
| `bug` | "erreur", "ne fonctionne pas", "crash", "écran blanc", screenshot d'erreur | dev-orchestrator |
| `feature` | "serait bien si", "on aimerait", "est-ce possible de", "nouvelle fonctionnalité" | dev-orchestrator (backlog) |
| `question` | "comment faire pour", "est-ce que", "où se trouve", "je ne comprends pas" | clientele (réponse directe si possible) |
| `urgent` | "en production", "les clients voient", "impossible de travailler", "ça bloque tout" | dev-orchestrator (priorité haute) |
| `changement` | "modifier", "changer", "mettre à jour", "corriger le texte" | dev-orchestrator |
| `accès` | "je n'ai plus accès", "mot de passe", "permission refusée", "nouvel utilisateur" | dev-orchestrator → security |

#### Priorités

| Priorité | Critères | Temps de réponse | Temps de résolution |
|----------|----------|------------------|---------------------|
| **P1 — Critique** | Production down, perte de données, faille sécurité, impact financier direct | < 15 min | < 4h |
| **P2 — Haute** | Fonctionnalité majeure cassée, workaround difficile, plusieurs utilisateurs affectés | < 1h | < 24h |
| **P3 — Normale** | Bug mineur avec workaround, amélioration demandée, question technique | < 4h | < 1 semaine |
| **P4 — Basse** | Cosmétique, suggestion, documentation, nice-to-have | < 24h | Backlog |

### Règles de priorisation

Appliquer ces règles dans l'ordre — la première qui matche détermine la priorité :

1. **Le mot "urgent" ou "production" + un problème** → P1 jusqu'à preuve du contraire
2. **Impact financier mentionné** (facturation, paiements, contrats) → P1
3. **Plusieurs utilisateurs affectés** → minimum P2
4. **Fonctionnalité cassée, pas de workaround** → P2
5. **Bug avec workaround connu** → P3
6. **Demande d'amélioration ou question** → P3 ou P4 selon l'urgence perçue

### Signaux d'escalade immédiate

Certains messages doivent bypasser le triage normal et être escaladés immédiatement :

- Mention de **données personnelles** exposées ou fuitées → P1 + security-auditor
- Mention de **perte de données** → P1 + dev-orchestrator
- Client **mécontent et menaçant** de résilier → P1 + escalade humaine
- Mention d'une **faille de sécurité** → P1 + security-auditor

### 3. Création du ticket structuré

Transformer le message en un ticket pour Desk :

```json
{
  "task_type": "ticket.new",
  "from_agent": "clientele",
  "to_agent": "dev-orchestrator",
  "priority": "high",
  "payload": {
    "ticket_id": "TK-143",
    "title": "Factures PDF affichent 0.00$ depuis le 5 mars",
    "description": "Le client Acme signale que toutes les factures générées depuis le 5 mars montrent un total de 0.00$. Les lignes de facture sont correctes mais le total ne se calcule pas. Screenshot en pièce jointe.",
    "category": "bug",
    "priority": "P2",
    "client": "acme",
    "source": "slack",
    "original_message": "Salut, depuis lundi nos factures affichent 0$ comme total. Les détails sont bons mais pas le total. Ça nous bloque pour la facturation de fin de mois.",
    "attachments": ["screenshot_facture.png"],
    "context": "Client Acme, 2 tickets similaires dans les 30 derniers jours (TK-128 résolu, TK-135 résolu)"
  }
}
```

### 4. Confirmation au client

Après le triage, envoyer une confirmation au client via le canal d'origine. Le message confirme la prise en charge et donne une estimation.

Template de confirmation :

```
Bonjour [Nom],

Merci pour votre signalement. J'ai créé le ticket [TK-XXX] pour suivre ce problème.

📋 Catégorie : [Bug / Demande / Question]
⚡ Priorité : [P1-Critique / P2-Haute / P3-Normale / P4-Basse]
⏱️ Temps de réponse estimé : [délai selon la priorité]

[Si P1/P2] Notre équipe prend le relais immédiatement. Je vous tiendrai au courant de l'avancement.
[Si P3/P4] Nous avons bien noté votre demande. Elle sera traitée dans les prochains jours.

N'hésitez pas si vous avez des informations supplémentaires à ajouter.
```

## Gestion des cas ambigus

Parfois un message ne rentre pas clairement dans une catégorie. Voici les heuristiques :

| Situation | Décision |
|-----------|----------|
| Le client dit "urgent" mais le problème semble mineur | Investiguer avant de déclasser — demander l'impact concret |
| Le message est vague ("ça marche pas") | Demander des précisions au client AVANT de créer le ticket |
| Plusieurs problèmes dans un seul message | Créer un ticket par problème, chacun avec sa priorité |
| Le client pose une question qui cache un bug | Classifier comme `bug` si l'investigation révèle un dysfonctionnement |
| Demande hors scope du contrat | Classifier comme `feature` P4, noter "hors scope" dans le contexte |

## Métriques de triage

L'agent clientele rapporte ces métriques spécifiques dans ses cycles :

| Métrique | Description |
|----------|-------------|
| `tickets_triaged` | Nombre de tickets triés dans le cycle |
| `avg_triage_time_ms` | Temps moyen de triage par ticket |
| `p1_count` | Nombre de P1 créés (indicateur de santé) |
| `clarification_requested` | Nombre de fois où il a fallu demander plus d'info au client |
| `auto_resolved` | Tickets résolus directement par clientele (questions simples) |

## Audit trail

Chaque triage génère un événement d'audit (voir skill audit-trail) :

```json
{
  "event_type": "decision.automated",
  "resource_type": "ticket",
  "resource_id": "TK-143",
  "reason": "Classé P2-bug: fonctionnalité de facturation cassée, pas d'impact financier direct immédiat mais bloque la facturation de fin de mois",
  "decision_basis": "Mots-clés: 'factures', '0$', 'bloque'. Impact: facturation de fin de mois. Pas de mention de perte de données (sinon P1). Workaround possible: calcul manuel.",
  "meta": { "confidence": 0.91, "pii_involved": false }
}
```

## Anti-patterns

- **Sur-prioriser pour faire plaisir au client** : Tout mettre en P1 rend la priorisation inutile. Un P1 injustifié retarde les vrais P1.
- **Créer un ticket sans contexte** : Le titre "Bug" avec une description vide force le dev-orchestrator à retourner poser des questions.
- **Ignorer l'historique** : Si le client a déjà signalé le même problème 3 fois, c'est un signal que la résolution précédente n'était pas complète.
- **Répondre au client sans avoir trié** : D'abord trier et créer le ticket, ensuite confirmer au client. Ça évite de promettre un délai qu'on ne peut pas tenir.
