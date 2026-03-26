---
name: requirement-intake
description: >
  Capturer les besoins client et les transformer en spécifications structurées
  pour le dev-orchestrator. Ce skill guide l'agent clientele dans l'extraction
  des exigences à partir de messages informels, la détection des non-dits,
  et la production de specs actionnables. Utiliser ce skill quand un client
  demande une nouvelle fonctionnalité, un changement, ou une amélioration
  qui nécessite du développement.
---

# Requirement Intake

Les clients expriment leurs besoins dans leur langage, pas dans celui des développeurs. L'agent clientele traduit ces besoins en spécifications que le dev-orchestrator peut transformer en tâches. La qualité de cette traduction détermine si l'équipe va construire ce que le client veut vraiment ou perdre du temps sur des malentendus.

## Quand ce skill s'active

- Le client décrit une fonctionnalité qu'il voudrait avoir
- Le client demande un changement dans le comportement existant
- Le ticket trié (ticket-triage) est de catégorie `feature` ou `changement`
- Le dev-orchestrator retourne un ticket avec des questions non résolues

## Processus d'intake

### Étape 1 — Extraire l'intention

À partir du message brut du client, identifier :

```
BESOIN EXPRIMÉ: [Ce que le client dit vouloir — ses mots exacts]
BESOIN RÉEL: [Ce qu'il essaie d'accomplir — le problème sous-jacent]
CONTEXTE: [Pourquoi maintenant ? Qu'est-ce qui a déclenché la demande ?]
UTILISATEURS: [Qui va utiliser cette fonctionnalité ?]
```

**Exemple :**

```
Message client: "On aimerait pouvoir exporter nos données en Excel"

BESOIN EXPRIMÉ: Export Excel des données
BESOIN RÉEL: Le client doit faire des rapports mensuels pour sa direction
  et les données sont actuellement coincées dans l'app
CONTEXTE: Fin du trimestre, rapport au CA la semaine prochaine
UTILISATEURS: La directrice financière et le comptable
```

La distinction entre besoin exprimé et besoin réel est importante : parfois l'export Excel n'est pas la meilleure solution — un rapport intégré ou un dashboard pourrait mieux répondre au vrai besoin.

### Étape 2 — Poser les bonnes questions

Ne pas deviner ce qu'on ne sait pas. Voici les questions à poser selon le type de besoin :

#### Pour une nouvelle fonctionnalité

| Question | Pourquoi c'est important |
|----------|-------------------------|
| "Pourriez-vous me décrire un scénario typique d'utilisation ?" | Comprendre le flux utilisateur réel |
| "Qui va utiliser cette fonctionnalité au quotidien ?" | Identifier les personas et leurs niveaux techniques |
| "Que se passe-t-il aujourd'hui sans cette fonctionnalité ?" | Comprendre le workaround actuel et la douleur |
| "Y a-t-il des contraintes de délai ?" | Prioriser correctement |
| "Avez-vous un exemple de ce à quoi ça devrait ressembler ?" | Aligner les attentes visuelles |

#### Pour un changement

| Question | Pourquoi c'est important |
|----------|-------------------------|
| "Qu'est-ce qui ne fonctionne pas bien dans le comportement actuel ?" | Comprendre le problème avant la solution |
| "Comment aimeriez-vous que ça fonctionne à la place ?" | Capter la vision du client |
| "Ce changement affecte-t-il d'autres personnes dans votre équipe ?" | Évaluer l'impact |
| "Y a-t-il des données existantes qui seraient affectées ?" | Anticiper les migrations |

### Étape 3 — Structurer la spec

Une fois les informations collectées, produire une spec structurée pour le dev-orchestrator :

```json
{
  "task_type": "ticket.new",
  "from_agent": "clientele",
  "to_agent": "dev-orchestrator",
  "priority": "normal",
  "payload": {
    "ticket_id": "TK-150",
    "title": "Export des données de facturation en Excel",
    "category": "feature",
    "priority": "P3",
    "client": "acme",
    "spec": {
      "user_story": "En tant que directrice financière d'Acme, je veux exporter les données de facturation en Excel pour produire mes rapports trimestriels au CA.",
      "acceptance_criteria": [
        "L'utilisateur peut sélectionner une période (mois, trimestre, année)",
        "L'export contient : date, numéro de facture, client, montant HT, taxes, montant TTC",
        "Le fichier Excel est formaté avec en-têtes et totaux",
        "L'export se déclenche depuis la page Facturation, bouton 'Exporter'"
      ],
      "constraints": [
        "Maximum 10 000 lignes par export (pagination si plus)",
        "Le fichier ne doit pas contenir de données PII d'autres clients (RLS)"
      ],
      "out_of_scope": [
        "Rapports graphiques intégrés (phase future possible)",
        "Export PDF (déjà existant via TK-89)"
      ],
      "context": {
        "trigger": "Rapport trimestriel au CA, deadline dans 2 semaines",
        "current_workaround": "Copier-coller manuel depuis l'interface",
        "users": ["Directrice financière", "Comptable"],
        "related_tickets": ["TK-89 (export PDF)"]
      }
    }
  }
}
```

### Format user story

Toujours utiliser le format standard :

```
En tant que [persona],
je veux [action/fonctionnalité],
pour [bénéfice/objectif].
```

### Format critères d'acceptation

Chaque critère doit être vérifiable objectivement. Utiliser le format Given/When/Then pour les cas complexes :

```
GIVEN l'utilisateur est sur la page Facturation
  AND il a sélectionné la période "Q1 2026"
WHEN il clique sur "Exporter en Excel"
THEN un fichier .xlsx est téléchargé
  AND le fichier contient toutes les factures de janvier à mars 2026
  AND chaque ligne contient : date, numéro, client, montant HT, taxes, TTC
  AND la dernière ligne contient les totaux
```

## Détection des non-dits

Les clients omettent souvent des informations qu'ils considèrent évidentes. Voici les non-dits fréquents à vérifier :

| Ce que le client dit | Ce qu'il ne dit pas (mais qu'il faut clarifier) |
|---------------------|--------------------------------------------------|
| "Export Excel" | Quelles colonnes ? Quel formatage ? Quelle période ? |
| "Ajouter un filtre" | Par quel critère ? Combinable avec d'autres filtres ? |
| "Envoyer une notification" | Par quel canal ? À qui ? Quand exactement ? |
| "Modifier le formulaire" | Ajouter/retirer quels champs ? Validation requise ? |
| "Améliorer la performance" | Quelle page/action est lente ? C'est lent depuis quand ? Quel est le seuil acceptable ? |

## Vérification avec le client

Avant de transmettre la spec au dev-orchestrator, la résumer au client pour validation :

```
Bonjour [Prénom],

Merci pour les précisions. Voici ce que j'ai compris de votre besoin :

📋 **Fonctionnalité** : Export Excel des données de facturation
👤 **Utilisateurs** : Directrice financière et comptable
✅ **Ce qui sera inclus** :
  - Sélection de période (mois, trimestre, année)
  - Export avec colonnes : date, N° facture, client, montant HT, taxes, TTC
  - Bouton d'export sur la page Facturation

❌ **Ce qui n'est pas inclus pour le moment** :
  - Rapports graphiques intégrés
  - Export dans d'autres formats que Excel

Est-ce que ça correspond bien à votre besoin ? Si oui, je transmets à l'équipe technique.
```

Attendre la confirmation du client AVANT de créer la tâche dans Desk. Ça évite le cycle "développer → montrer → ce n'est pas ce que je voulais → recommencer".

## Registre des règles d'affaires

Si le besoin du client révèle une règle d'affaires implicite (ex: "les factures doivent toujours être en TTC au Québec"), la documenter dans le payload pour que l'agent product l'ajoute au registre des règles d'affaires :

```json
{
  "business_rules_detected": [
    {
      "rule": "Les exports de facturation doivent respecter le RLS — un client ne voit que ses propres données",
      "source": "Implicite (sécurité)",
      "priority": "mandatory"
    },
    {
      "rule": "Les montants affichés incluent toujours les taxes applicables (TPS + TVQ au Québec)",
      "source": "Client Acme, message du 6 mars 2026",
      "priority": "mandatory"
    }
  ]
}
```

## Anti-patterns

- **Specs techniques prématurées** : L'agent clientele ne décide pas de l'implémentation technique. "Utiliser la librairie xlsx-js" n'est pas son rôle — c'est celui du dev-orchestrator et des workers.
- **Accepter sans questionner** : "On veut un bouton" → quel bouton, où, pour faire quoi ? Creuser avant de transmettre.
- **Spec trop vague** : "Améliorer la page" n'est pas une spec. Identifier les améliorations concrètes.
- **Oublier le hors-scope** : Définir ce qui n'est PAS inclus est aussi important que ce qui l'est. Ça prévient le scope creep.
- **Transmettre sans validation client** : La spec doit être confirmée par le client avant d'arriver chez le dev-orchestrator. Un aller-retour de 5 minutes en amont évite un aller-retour de 5 jours en aval.
