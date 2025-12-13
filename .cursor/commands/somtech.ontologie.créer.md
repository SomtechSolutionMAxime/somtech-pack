# Prompt Maître — Reconstruction Ontologique Orientée Agents

Ce prompt sert à analyser un système existant (code, schéma de BD, PRD, specs, etc.) et à produire **une ontologie reconstruite**, spécifiquement optimisée pour :

- des **agents autonomes** (LLM, copilotes, orchestrateurs),
- du **raisonnement sémantique** (graphe de connaissances, moteurs de règles),
- des **LLM outillés** (RAG + graph, Neo4j, etc.).

L’objectif est de dégager la **structure conceptuelle réelle du domaine**, telle qu’elle se manifeste dans le système, même si elle n’est pas ou mal documentée.

Tu dois produire **4 documents distincts**, comme si tu écrivais ces fichiers dans le repo :

1. `/ontologie/01_ontologie.md` — Ontologie narrative orientée métier & agents  
2. `/ontologie/02_ontologie.yaml` — Vue structurée “YAML-ready”, agent-friendly  
3. `/ontologie/03_incoherences.md` — Rapport complet d’incohérences  
4. `/ontologie/04_diagnostic.md` — Diagnostic stratégique et “agent readiness”

Dans ce contexte, ta réponse DOIT suivre cet ordre, et le contenu que tu génères correspond logiquement à ces fichiers, dans cet ordre.

---

## Contexte d’analyse

On te fournira :  
- des schémas de BD,  
- des extraits de code,  
- des descriptions fonctionnelles,  
- éventuellement des documents métiers.

Tu dois **toujours te baser sur ce que le système fait réellement**, pas sur ce qu’“il devrait faire” dans un monde idéal.  
Tu peux cependant, dans le diagnostic final, proposer des corrections et refactorings conceptuels.

---

# 1. DOCUMENT : `/ontologie/01_ontologie.md`  
## Ontologie reconstruite — Vue narrative, orientée agents

Ce premier document est une **description narrative, lisible par des humains**, mais structurée de façon très disciplinée pour que :

- un architecte métier comprenne la réalité du domaine,  
- un architecte d’agents puisse en faire un plan d’action,  
- la structure soit facilement transformable en schéma de graphe et en règles.

### 1.1 Concepts

Tâches :

1. Identifie toutes les **entités explicites** (tables, objets, agrégats, modules, etc.).
2. Identifie les **concepts implicites** ou cachés, par exemple :
   - statuts génériques,
   - priorités,
   - montants financiers,
   - dates clés,
   - archivage (soft delete),
   - assignation,
   - pipelines (commercial, support, projet),
   - patterns de “work item”,
   - patterns de “document commercial”, etc.
3. Distingue clairement :
   - les **concepts métier** (Entreprise, Projet, Opportunité, Ticket, etc.),
   - des **détails techniques** (timestamps, IDs techniques, champs d’audit, embeddings vectoriels, chemins de fichiers, etc.).

Pour chaque **concept métier**, documente avec la structure suivante :

- **Nom du concept**
- **Super-concept éventuel** (ex : `WorkItem` pour Tâche / Ticket, `DocumentCommercial` pour Offre / Soumission / Contrat)
- **Définition métier**  
  Une phrase ou court paragraphe clair, orienté domaine, sans jargon technique.
- **Attributs essentiels**  
  Liste des attributs *métier* qui définissent le concept (pas tous les champs techniques, uniquement ceux qui portent du sens métier).
- **Rôle ontologique**  
  Exemples : “unité de valeur commerciale”, “unité d’action”, “ancre temporelle d’un processus”, “point d’ancrage de relations financières”, etc.
- **Cycle de vie métier**  
  Liste des états principaux, transitions typiques, et éventuels états finaux (“terminé”, “signé”, “archivé”, etc.).
- **Utilisation par des agents**  
  Indique, en une courte phrase, comment ce concept peut être utile à des agents (ex : “point d’entrée pour les recommandations commerciales”, “support de raisonnement sur l’effort vs valeur”, etc.).

### 1.2 Relations

Tâches :

- Identifie les **relations structurelles** entre les concepts :
  - composition (A contient B),
  - appartenance (B appartient à A),
  - dépendance,
  - hiérarchie (A est une forme de B),
  - spécialisation (A est un type particulier de B).
- Indique pour chaque relation :
  - **Nom** court et explicite
  - **Source** (from)
  - **Cible** (to)
  - **Type** :
    - `composition`
    - `association`
    - `generation` (A génère B, ex : Opportunité → Projet)
    - `dependency`
    - `specialization`
    - `temporal_cause` (relation causale dans le temps, ex : “Soumission Acceptée → Contrat créé”)
  - **Cardinalité** :
    - 1:1, 1:N, N:1, N:N, 0..1, 0..N, etc.
  - **Description métier** de la relation
  - **Interprétation pour agents** :
    - comment un agent peut utiliser cette relation pour raisonner, planifier, inférer.

### 1.3 Patterns transversaux (méta-concepts)

Tâches :

Identifie et décris de manière générique les patterns suivants (ou autres détectés) :

- Statut / État / Étape
- Priorité
- Montant financier
- Date(s) clé(s)
- Assignation (à un utilisateur / profil / rôle)
- Archivage (soft delete ou statut “archivé”)
- Numéro lisible unique (ID métier)
- Pipelines (commercial, support, projet)
- Récurrence (tâches récurrentes, événements périodiques)
- Patterns de “WorkItem” (Tâche, Ticket, etc.)
- Patterns de “DocumentCommercial” (Offre, Soumission, Contrat, etc.)

Pour chaque **pattern transversal** :

- **Nom du pattern**
- **Description / signification métier**
- **Entités auxquelles il s’applique**
- **Implémentation actuelle** (types de champs, enums, variations entre modules)
- **Utilité pour agents** : comment un agent peut s’appuyer dessus (ex : priorisation, détection d’anomalies, transitions, etc.).

### 1.4 Invariants ontologiques

Tâches :

Distingue les **règles fondamentales du domaine** (lois) des simples conventions produit.

Un **invariant ontologique** est une règle qui :

- est vraie indépendamment de la version du système,
- est vraie quel que soit le frontend ou la stack technique,
- décrit une **contrainte du domaine**, pas du produit.

Exemples :

- “Un objectif doit toujours avoir un propriétaire.”
- “Un élément objectif ne peut référencer qu’un projet OU une tâche, pas les deux.”
- “La probabilité de conversion est comprise entre 0 et 100 %.”
- “Une facture ne peut être liée qu’à un seul contrat source.”

Pour chaque invariant :

- **ID** (ex : `INV-001`)
- **Description** en langage métier
- **Scope** (entité(s) concernée(s))
- **Type** (structurel, temporel, métier)

Formule-les de manière **forte**, comme des lois :  
> Il est impossible dans le domaine que…

### 1.5 Flux temporels / causaux

Tâches :

Décris les flux suivants, sous forme de **diagrammes ASCII** + explications :

- Flux commercial (ex : Entreprise → Opportunité → Offre → Soumission → Contrat → Facture)
- Flux projet (ex : Opportunité gagnée → Projet → Tâches → Suivi temps → Livrables)
- Flux support (ex : Ticket de support de sa création à sa résolution)
- Flux planification (Objectifs, éléments objectifs, liens projets/tâches)

Pour chaque flux :

- montre les **états principaux**,
- les **transitions typiques**,
- les **événements déclencheurs** (signature, changement de statut, création d’entité),
- les **conséquences ontologiques** (ex : création obligatoire d’une entité, changement de relation, fermeture d’un cycle).

---

# 2. DOCUMENT : `/ontologie/02_ontologie.yaml`  
## Vue structurée “YAML-ready” — Agent & graph friendly

Ce document est une **représentation structurée**, pensée pour :

- être facilement transformée en :
  - schéma de graphe (Neo4j, etc.),
  - format OWL / RDF / JSON-LD,
  - base de règles pour agents,
- être lisible par des systèmes automatiques.

### 2.1 Structure YAML attendue

Tu dois produire au minimum les sections suivantes :

```yaml
meta:
  domaine: "NomDuDomaine"
  version: "1.0"
  description: "Ontologie métier reconstruite — version orientée agents"
  date_generation: "YYYY-MM-DD"

hierarchy:
  # Hiérarchie des concepts (superclasses et sous-classes)
  WorkItem:
    subclasses: ["Tache", "Ticket"]
  DocumentCommercial:
    subclasses: ["Offre", "Soumission", "Contrat"]

concepts:
  NomConcept:
    description: "Définition métier claire"
    role: "Rôle ontologique (unité d'action, de valeur, etc.)"
    keys_metier: ["liste", "de", "clés", "logiques", "si", "applicable"]
    attributes:
      - name: "nom_attribut"
        type: "type_logique"   # string, int, decimal, date, enum, ref, etc.
        description: "Description métier"
        domain: "NomDomaineSiApplicable"  # ex: Probability, Money
    lifecycle:
      states: ["Etat1", "Etat2", "EtatFinal..."]
      transitions:
        - from: "Etat1"
          to: "Etat2"
          cause: "Condition ou événement métier"
          type: "normal | final | annulation"

relations:
  - name: "NomRelation"
    from: "ConceptSource"
    to: "ConceptCible"
    type: "composition | association | generation | dependency | specialization | temporal_cause"
    cardinality: "1:1 | 1:N | 0..1 | 0..N | N:N"
    description: "Description métier"
    semantic_hint: "Comment un agent peut utiliser cette relation"

patterns:
  NomPattern:
    description: "Signification métier"
    applies_to: ["ConceptA", "ConceptB", "..."]
    implementation:
      fields: ["nom_champ_1", "nom_champ_2"]
      notes: "Détails sur enums, types, variations"
    agent_usage: "Comment ce pattern supporte le raisonnement d'un agent"

domains:
  Probability:
    type: "int"
    min: 0
    max: 100
  Money:
    type: "decimal"
    constraints:
      min: 0

invariants_ontologiques:
  - id: "INV-001"
    description: "Description de la loi du domaine"
    scope: ["Concept1", "Concept2"]
    type: "structurel | temporel | metier"

regles_produit:
  - id: "R-PROD-001"
    description: "Règle opérationnelle / produit"
    scope: ["Concept", "Module"]
    notes: "Peut changer dans le futur, n'est pas une loi du domaine"

events:
  - name: "NomEvenement"
    description: "Ex: 'SoumissionAcceptée', 'ContratSigné'"
    triggers:
      - entity: "NomConcept"
        when: "condition sur attributs ou statut"
    effects:
      - type: "create | update | link"
        target: "ConceptCible"
        description: "Ce qui doit arriver dans le domaine"

reasoning_hints:
  - "Règle ou insight utile pour l'orchestration d'agents"
  - "Ex: Une Opportunité Gagnée devrait idéalement générer au moins un Projet"
```

Tu peux adapter / enrichir, mais **garde cette structure comme base**.

---

# 3. DOCUMENT : `/ontologie/03_incoherences.md`  
## Rapport d’incohérences

Ce document est un **rapport d’audit conceptuel** du système existant.

### 3.1 Incohérences conceptuelles

- Définitions contradictoires
- Concepts aux responsabilités multiples (god objects)
- Concepts mélangeant purement :
  - logique métier,
  - stockage,
  - traçabilité,
  - aspects techniques (embeddings, fichiers, etc.)

Pour chaque incohérence, indique :

- **ID** (ex: `INC-CONC-001`)
- **Description**
- **Concepts concernés**
- **Impact métier / agent**
- **Suggestion de correction**

### 3.2 Incohérences relationnelles

- Relations circulaires douteuses
- Relations manquantes “évidentes”
- Cardinalités impossibles ou irréalistes
- Relations qui devraient être N:N mais implémentées en 1:N ou inversement

Même format : ID, description, concepts, impact, correction possible.

### 3.3 Incohérences de règles métier

- Règles appliquées différemment selon les modules
- Règles contradictoires entre entités proches
- Exceptions bizarres qui révèlent un modèle mal posé

### 3.4 Incohérences de vocabulaire

- Mêmes concepts nommés différemment (Client vs Entreprise, etc.)
- Concepts différents nommés pareil
- Mélanges “statut / état / étape / phase”
- Différences de vocabulaires entre backend, frontend, BD et docs

### 3.5 Incohérences temporelles

- Dates ou statuts qui ne collent pas avec la réalité métier
  - date de fin < date de début
  - entité “terminée” mais encore modifiable
  - entités “archivées” encore actives dans certains flux

### 3.6 Divergences domaine vs système

- Cas où le système force des choses qui ne font pas sens métier
- Cas où le système ne force PAS des invariants pourtant évidents dans le domaine

---

# 4. DOCUMENT : `/ontologie/04_diagnostic.md`  
## Diagnostic stratégique & Agent Readiness

Ce document répond à :  
> “Dans quel état est notre modèle conceptuel, et est-il exploitable proprement par des agents et un graphe de connaissances ?”

### 4.1 Qualité conceptuelle globale

- Qualifie le modèle (ex : “solide mais hétérogène”, “bricolé”, “propre mais incomplet”…)
- Donne quelques **forces** (séparations claires, bons patterns, etc.)
- Donne quelques **faiblesses** (incohérences, concepts surchargés, vocabulaire, etc.)

### 4.2 Agent Readiness Score

Propose un score (0–100) qui reflète :

- clarté des concepts,
- cohérence des cycles de vie,
- qualité des relations,
- stabilité des invariants,
- harmonisation du vocabulaire,
- facilité à brancher des agents dessus (RAG + graph + règles).

Justifie en quelques points.

### 4.3 Corrections conceptuelles proposées

- **Factorisations** :
  - ex : introduire un concept abstrait `WorkItem` pour Tâche/Ticket,
  - introduire `DocumentCommercial` pour Offre/Soumission/Contrat.
- **Clarifications** :
  - séparer planification / exécution,
  - séparer données métier vs données techniques,
  - clarifier les rôles de certaines entités.
- **Harmonisation** :
  - vocabulaire (client/entreprise, statut/état/étape),
  - enums (priorités, statuts, etc.),
  - patterns (archivage, numérotation, pipelines…).

### 4.4 Points critiques à corriger en priorité

Classe au moins en 3 niveaux :

- **Priorité 1 — Bloquant agents / graph** :
  - incohérences qui cassent le raisonnement (agents ne peuvent pas raisonner proprement).
- **Priorité 2 — Fortement recommandé** :
  - ce qui dégrade la qualité des décisions mais ne bloque pas totalement.
- **Priorité 3 — Confort / long terme** :
  - améliorations structurelles, refactors propres, patterns plus beaux.

Explique en quoi ces corrections :

- rendent le domaine plus **stable**,
- rendent les agents plus **précis et cohérents**,
- facilitent la création d’un **graphe de connaissances robuste**.

---

# Format de sortie attendu (rappel synthétique)

À partir de la description du système fourni :

1. **Document 1 — `/ontologie/01_ontologie.md`**  
   - Ontologie narrative agentique :  
     - concepts,  
     - relations,  
     - patterns transversaux,  
     - invariants ontologiques,  
     - flux temporels/causaux.

2. **Document 2 — `/ontologie/02_ontologie.yaml`**  
   - Vue structurée :  
     - `meta`,  
     - `hierarchy`,  
     - `concepts`,  
     - `relations`,  
     - `patterns`,  
     - `domains`,  
     - `invariants_ontologiques`,  
     - `regles_produit`,  
     - `events`,  
     - `reasoning_hints`.

3. **Document 3 — `/ontologie/03_incoherences.md`**  
   - Rapport complet des incohérences.

4. **Document 4 — `/ontologie/04_diagnostic.md`**  
   - Diagnostic stratégique + Agent Readiness.

---

Utilise ce prompt comme **contrat** : tu dois respecter cette structure, cette séparation des niveaux (domaine vs produit), et toujours garder en tête que la sortie doit être **exploitable par des agents intelligents, pas seulement lisible par des humains**.
