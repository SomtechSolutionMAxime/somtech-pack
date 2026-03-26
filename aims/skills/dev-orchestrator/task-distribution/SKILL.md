---
name: task-distribution
description: >
  Découper un ticket en tâches atomiques, assigner aux dev-workers selon leur
  spécialisation et charge actuelle, gérer les dépendances entre tâches.
  Ce skill est utilisé par dev-orchestrator pour transformer un ticket client
  (en provenance du clientele ou du backlog) en un ensemble de tâches parallélisables
  assignées aux dev-worker-1 et dev-worker-2. Utiliser ce skill chaque fois
  qu'un ticket arrive prêt à être développé, ou qu'il faut rééquilibrer les
  tâches en cas de blocage.
---

# Task Distribution

Le dev-orchestrator est responsable de fragmenter un ticket en tâches qui peuvent être travaillées en parallèle ou en séquence. Une mauvaise décomposition crée des goulots, des attentes inutiles, ou pire : des workers qui se marches dessus. Une bonne décomposition maximise le parallélisme et laisse chaque worker avancer de façon prévisible.

## Philosophie

Une tâche atomique satisfait trois critères :

1. **Autonome** : Peut être terminée indépendamment des autres (ou avec des dépendances explicites)
2. **Mensurable** : On sait quand elle est complète (acceptation criteria clairement définis)
3. **Dimensionnée pour un worker** : Peut être complétée en 1-4 heures, pas plus

Une tâche trop petite (30 minutes) crée trop de context-switching. Une tâche trop grosse (8+ heures) bloque le parallélisme.

## Processus de décomposition

### 1. Analyser le ticket entrant

Recevoir le ticket de clientele ou consulter le backlog, extraire :

```
TICKET: [ID client + titre]
DESCRIPTION: [Qu'est-ce qu'il faut faire]
ACCEPTANCE_CRITERIA: [Comment on sait que c'est bon]
DÉPENDANCES EXTERNES: [Attend-on une réponse client, une data, une API tierce ?]
SPIKE ESTIMÉ: [Combien de temps pour explorer l'inconnu ?]
```

### 2. Identifier les domaines

Chaque tâche tombe dans un domaine technique :

| Domaine | Description | Worker assigné par défaut |
|---------|-------------|--------------------------|
| **Frontend** | Composant React, form, navigation, UI/UX | worker-1 (expert frontend) |
| **Backend** | API endpoint, business logic, SQL, validation | worker-2 (expert backend) |
| **Database** | Migration SQL, RLS, index, schema | worker-2 (accès SQL direct) |
| **Testing** | Tests e2e, tests unitaires, fixtures | Au spec du ticket |
| **Documentation** | README, spec technique, changelog | Peut être fait par n'importe quel worker |

### 3. Décomposer en tâches

Pour chaque domaine identifié, créer une tâche avec un titre clair et un scope délimité.

**Template de décomposition** :

```json
{
  "ticket_id": "TK-145",
  "title": "Ajouter système de promotions (codes promo)",
  "tasks": [
    {
      "task_id": "TSK-145-1",
      "sequence": 1,
      "domain": "backend",
      "title": "Créer table promos et API",
      "description": "Table PostgreSQL promos avec colonnes: code, discount_percent, valid_from/to, max_uses. Endpoint POST /api/promos/validate pour vérifier qu'un code est valide.",
      "acceptance_criteria": [
        "Table créée avec RLS",
        "Endpoint retourne 200 si code valide, 400 si expiré/utilisé",
        "Tests e2e pour les 2 cas"
      ],
      "depends_on": [],
      "estimated_hours": 2,
      "assigned_to": "dev-worker-2"
    },
    {
      "task_id": "TSK-145-2",
      "sequence": 2,
      "domain": "frontend",
      "title": "Formulaire de code promo en checkout",
      "description": "Ajouter un champ texte + bouton 'Appliquer' dans le formulaire de checkout. Intégrer l'API /validate pour vérifier le code en temps réel. Afficher le discount calculé.",
      "acceptance_criteria": [
        "Champ visible et focusable",
        "Validation en temps réel sans rechargement",
        "Affiche le discount ou message d'erreur clair",
        "Tests e2e du flux complet"
      ],
      "depends_on": ["TSK-145-1"],
      "estimated_hours": 2,
      "assigned_to": "dev-worker-1"
    },
    {
      "task_id": "TSK-145-3",
      "sequence": 3,
      "domain": "documentation",
      "title": "Documenter le système de promos",
      "description": "README expliquant comment créer une promo, limites, edge cases. Ajouter un exemple de payload API.",
      "acceptance_criteria": [
        "README sections: API, Edge cases, Limitations",
        "Exemple de curl pour créer une promo",
        "Exemple de réponse API"
      ],
      "depends_on": ["TSK-145-1"],
      "estimated_hours": 1,
      "assigned_to": "dev-worker-2"
    }
  ]
}
```

## Règles d'assignation

### Charge et spécialisation

Chaque worker a une charge maximale et des spécialités. Avant d'assigner une tâche :

```
1. Consulter la charge ACTUELLE des deux workers (voir sprint-coordination)
2. Vérifier la spécialité du domaine
3. Appliquer les règles d'équilibre
```

### Matrice de spécialisation

| Domaine | Worker-1 (Frontend expert) | Worker-2 (Backend expert) | Préférence |
|---------|---------------------------|--------------------------|-----------|
| **Frontend** | ⭐⭐⭐ | ⭐ | Assign à worker-1 |
| **Backend** | ⭐ | ⭐⭐⭐ | Assign à worker-2 |
| **Database** | ⭐ | ⭐⭐⭐ | Assign à worker-2 (accès SQL) |
| **Testing** | ⭐⭐ | ⭐⭐ | Flexible, considérer la charge |
| **Documentation** | ⭐ | ⭐ | Flexible, lead worker si dispo |

### Règles de rééquilibrage

Si un worker est surchargé et que la tâche pourrait être faite par l'autre :

- **Rule 1** : Si worker-1 a 8+ heures de tâches et c'est une tâche de documentation → assigner à worker-2
- **Rule 2** : Si worker-2 a 8+ heures et c'est du testing → assigner à worker-1
- **Rule 3** : Si les deux ont > 8 heures → escalader au dev-orchestrator pour priorisation
- **Rule 4** : Une tâche bloquante sur la dépendance critique n'attend jamais — la lui assigner même si surchargé

### Charge maximale par worker

Un worker ne doit JAMAIS recevoir plus de 12 heures de tâches simultanées (estimation = fiction, la vraie durée peut être 1.5x). Maximum 3-4 tâches par cycle.

## Format de tâche dans Desk

Quand dev-orchestrator crée une tâche pour un worker, elle est insérée dans `desk_tasks` via `task.assign` :

```json
{
  "task_type": "task.assign",
  "from_agent": "dev-orchestrator",
  "to_agent": "dev-worker-1",
  "priority": "high",
  "silo": "client-acme",
  "trace_id": "tr_145_abc",
  "payload": {
    "task_id": "TSK-145-2",
    "ticket_id": "TK-145",
    "branch": "feat/promotions-v1",
    "title": "Formulaire de code promo en checkout",
    "description": "Ajouter un champ texte + bouton 'Appliquer' dans le formulaire de checkout...",
    "acceptance_criteria": [
      "Champ visible et focusable",
      "Validation en temps réel sans rechargement",
      "Affiche le discount ou message d'erreur clair",
      "Tests e2e du flux complet"
    ],
    "depends_on": ["TSK-145-1"],
    "depends_on_status": {
      "TSK-145-1": "pending"
    },
    "estimated_hours": 2,
    "context": {
      "api_endpoint": "/api/promos/validate",
      "response_sample": "{\"valid\": true, \"discount_percent\": 10}",
      "ui_location": "components/checkout/PromoField.tsx",
      "related_pr": null,
      "blockers_known": []
    }
  }
}
```

### Champs obligatoires du payload

| Champ | Type | Pourquoi |
|-------|------|---------|
| `task_id` | uuid | ID unique pour Desk et logs |
| `ticket_id` | string | Traçabilité au ticket original |
| `branch` | string | Le worker sait sur quelle branche travailler |
| `acceptance_criteria` | array | Pas d'ambiguïté sur "complète" |
| `depends_on` | array | Liste les tâches bloquantes |
| `context` | object | API endpoints, fichiers à modifier, exemples de réponse |

## Gestion des dépendances

### Dépendances "hard" vs "soft"

**Hard** : La tâche A doit attendre que la tâche B soit terminée ET mergée. Exemple : frontend attend que le backend expose un endpoint.

**Soft** : La tâche A peut commencer avant B mais elle progresse plus vite si B est prête. Exemple : tests peuvent être écrits avant que la feature soit complète.

### Stratégies pour débloquer les dépendances

**Stratégie 1 : API stub**

Si le frontend attend un endpoint, le worker-1 crée un mock endpoint (`/api/promos/validate` retourne toujours `{valid: true}`) pour pouvoir tester le formulaire. Le worker-2 remplace le stub par la vraie logique plus tard.

Payload pour notifier du stub :

```json
{
  "task_type": "task.update",
  "from_agent": "dev-worker-1",
  "to_agent": "dev-orchestrator",
  "payload": {
    "task_id": "TSK-145-2",
    "status": "in_progress",
    "blocker": "waiting_for_api",
    "workaround": "Created mock endpoint at /api/promos/validate (stub)",
    "can_proceed": true
  }
}
```

**Stratégie 2 : Paralléliser les indépendances**

Si deux tâches n'ont pas de dépendance, les assigner immédiatement.

**Stratégie 3 : Extraire un spike**

Si le chemin de dépendance est incertain (ex: "on ne sait pas encore comment l'API va répondre"), créer une tâche de spike court (30 min) pour clarifier la contrat avant de coder.

### Graphe de dépendances

Après décomposition, afficher le graphe pour vérifier la criticalité :

```
TSK-145-1 (backend, ~2h) ← CRITIQUE
    ↓
TSK-145-2 (frontend, ~2h) ← dépend de TSK-145-1
    ↓
TSK-145-3 (docs, ~1h) ← peut en parallèle de 145-2

CHEMIN CRITIQUE: TSK-145-1 → 145-2 (4h total)
CHEMIN PARALLÈLE: Rien (tous les chemins dépendent du backend)
```

Idéal = chemins parallèles. Pire = tous les chemins en série.

## Métriques de décomposition

Rapporter ces métriques (voir silo-logging) après chaque décomposition :

```json
{
  "action": "task.decomposed",
  "meta": {
    "ticket_id": "TK-145",
    "task_count": 3,
    "avg_hours": 1.67,
    "critical_path_hours": 4,
    "dependencies": 2,
    "workers_assigned": 2,
    "parallel_potential": 0.67
  }
}
```

Interpréter `parallel_potential` : 0 = tout en série (mauvais), 1 = complètement parallèle (idéal). Ici 0.67 = 67% des tâches peuvent se faire en parallèle.

## Anti-patterns

- **Tâches trop petites** : "Créer une variable TypeScript" n'est pas une tâche, c'est un étape. Une tâche doit être complets en elle-même et livrable (PR mergeable).
- **Zéro dépendances** : Si toutes les tâches sont indépendantes, c'est qu'on n'a pas analysé le ticket. Le backend et frontend ont toujours une dépendance (contrat API).
- **Dépendances circulaires** : "A dépend de B, B dépend de A" est un deadlock. Revoir la décomposition.
- **Assigner sans considérer la charge** : Assigner une tâche de 4h à un worker qui a déjà 10h en attente = le worker va être bloqué et frustré. Consulter la charge réelle dans sprint-coordination.
- **Acceptation criteria flou** : "Le formulaire doit marcher" ≠ "Le formulaire accepte les codes valides, refuse les expirés, montre l'erreur au client, et passe les tests e2e". Soyez spécifiques.
- **Pas de contexte dans le payload** : Le worker doit pouvoir commencer immédiatement. Si le payload ne dit pas "modifiez le fichier X" ou "appelez l'endpoint Y", c'est incomplet.
