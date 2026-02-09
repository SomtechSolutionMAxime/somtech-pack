# Ontologie du Système Construction Gauthier

## 1. Vue d'ensemble narrative

Le système **Construction Gauthier** est un écosystème modulaire intégré conçu pour digitaliser et orchestrer les opérations de l'entreprise, avec un focus fort sur la **gouvernance technologique**, les **ressources humaines** et la **cartographie des données**.

L'architecture est centrée sur l'idée de **Modules Métier** interconnectés, où chaque module porte sa propre logique mais partage un socle commun d'authentification, d'utilisateurs et de règles de sécurité.

### Concepts Fondamentaux

L'ontologie repose sur trois piliers majeurs :
1.  **Le Capital Humain** (`Ma Place RH`) : Employés, gestionnaires, compétences, et interactions (1:1, feedbacks).
2.  **Le Capital Technologique** (`Gouvernance Tech` & `Outils Tech`) : Modules logiciels, fonctionnalités, outils SaaS, et leur cycle de vie.
3.  **Le Capital de Données** (`Cartographie`) : Sources de vérité, flux de données et modélisation.

---

## 2. Concepts Métier Détaillés

### 2.1 Domaine Ressources Humaines (Capital Humain)

Ce domaine gère la vie de l'employé dans l'entreprise.

*   **Employé (`Employee`)**
    *   *Définition* : Un individu travaillant pour l'entreprise. C'est l'entité centrale du domaine RH.
    *   *Rôle* : Acteur principal des processus RH.
    *   *Lien Système* : Souvent lié à un `UserProfile` (compte d'accès), mais l'entité métier existe même sans accès système.
    *   *Attributs* : Poste, Département, Manager, Date d'embauche.

*   **Rencontre Individuelle (`OneOnOneMeeting`)**
    *   *Définition* : Un moment synchronisé et privilégié entre un gestionnaire et son employé pour discuter de performance, bien-être et développement.
    *   *Cycle de vie* : Planifiée → En cours → Complétée (ou Annulée/Reportée).
    *   *Sous-concepts* :
        *   **Ordre du Jour (`MeetingAgenda`)** : Liste des sujets à aborder.
        *   **Note Privée (`MeetingNote`)** : Réflexions confidentielles d'une partie (invisible à l'autre).
        *   **Action (`MeetingAction`)** : Tâche concrète décidée durant la réunion.

*   **Demande de Congé (`LeaveRequest`)**
    *   *Définition* : Une requête formelle d'absence pour une période donnée.
    *   *Cycle de vie* : Brouillon → Soumise → Approuvée/Rejetée.
    *   *Invariant* : Ne peut pas dépasser le solde disponible (`LeaveBalance`).

*   **Onboarding (`OnboardingProcess`)**
    *   *Définition* : Le processus structuré d'intégration d'un nouvel employé.
    *   *Composition* : Composé de multiples `OnboardingTask` assignées à différentes personnes.

*   **Feedback & Évaluation**
    *   **Feedback** : Retour ponctuel (positif ou constructif) entre pairs ou hiérarchie.
    *   **Évaluation (`Evaluation`)** : Bilan formel périodique de la performance.
    *   **Version d’Évaluation (`EvaluationVersion`)** :
        *   *Définition* : Un **modèle versionné** décrivant le contenu et les règles d’une évaluation (questions, ordre, paramètres).
        *   *Portée* : **Globale (entreprise)** par défaut (source unique pour les nouvelles évaluations).
        *   *Cycle de vie* : `draft` → `active` → `archived`.
        *   *Règle* : Une version `active` est **immuable** (toute évolution passe par une nouvelle version, souvent via duplication).
    *   **Configuration d’Évaluation (`EvaluationConfiguration`)** :
        *   *Définition* : Les paramètres portés par une `EvaluationVersion` (composition, libellés, contraintes de publication, etc.).
        *   *Note* : Concept “contenu” ; il peut être matérialisé par des champs/JSON, mais reste rattaché à une version.
    *   **Banque de Questions (`EvaluationQuestionBank`)** :
        *   *Définition* : Inventaire de questions réutilisables servant à composer des versions d’évaluation.
        *   *Règle* : Les questions existantes (déjà présentes dans des évaluations historiques) peuvent être importées dans la banque.
    *   **Question d’Évaluation (`EvaluationQuestion`)** :
        *   *Définition* : Un item réutilisable (libellé + type + réponses attendues) pouvant être sélectionné dans une version.
        *   *Invariant* : Si une question est utilisée par une version `active`, une modification de question **ne doit pas** modifier rétroactivement la version active.
    *   **Variante de Question (`EvaluationQuestionVariant`)** :
        *   *Définition* : Une révision immuable d’une `EvaluationQuestion` (snapshot/version) utilisée par une `EvaluationVersion`.
        *   *Rôle* : Assurer la comparabilité et éviter la rétroaction (les versions actives pointent vers des variantes, pas vers un brouillon mutable).

### 2.2 Domaine Gouvernance & Technologie (Capital Technologique)

Ce domaine gère le portefeuille applicatif et les outils de l'entreprise.

*   **Module (`Module`)**
    *   *Définition* : Une unité fonctionnelle majeure de l'application propriétaire (ex: "Ma Place RH", "Gouvernance").
    *   *Rôle* : Unité de déploiement, de documentation et de responsabilité produit.
    *   *Cycle de vie* : Portée non définie → Portée définie → Développement → Implantation → En production.

*   **Fonctionnalité (`Function` / `Feature`)**
    *   *Définition* : Découpage granulaire d'un module.
    *   *Hiérarchie* : Module 1:N Fonction 1:N Fonctionnalité.

*   **Outil Technologique (`TechTool`)**
    *   *Définition* : Un logiciel, SaaS ou plateforme utilisé par l'entreprise (interne ou externe).
    *   *Rôle* : Ressource technique nécessitant gestion (coûts, licences, cycle de vie).

### 2.3 Domaine Cartographie (Capital Données)

Ce domaine documente l'architecture de l'information.

*   **Cartographie (`Cartography`)**
    *   *Définition* : Un projet de visualisation des flux de données.
    *   *Composition* : Contient des Nœuds (Systèmes) et des Arêtes (Flux).

*   **Nœud de Donnée (`DataSourceNode`)**
    *   *Définition* : Un système ou une base de données (ex: "Supabase", "Salesforce").
    *   *Attributs* : Contient des `DataField` qui peuvent être marqués comme "Source de Vérité" (Master).

---

## 3. Relations Structurelles Clés

### Relations Organisationnelles
*   `Department` **contient** `Employee` (1:N).
*   `Employee` **rapporte à** `Manager` (Employee) (N:1).
*   `UserProfile` **correspond à** `Employee` (1:1, relation parfois lâche lors de la création).

### Relations Opérationnelles
*   `Module` **est découpé en** `Function` (1:N).
*   `OneOnOneMeeting` **génère** `MeetingAction` (1:N).
*   `Cartography` **visualise** `TechTool` (Relation conceptuelle forte, implémentation via nœuds).
*   `Evaluation` **utilise** `EvaluationVersion` (N:1).
*   `EvaluationVersion` **est composée de** `EvaluationQuestionVariant` (1:N, ordonnée).
*   `EvaluationQuestion` **a** `EvaluationQuestionVariant` (1:N).

---

## 4. Patterns Transversaux (Méta-concepts)

*   **WorkItem (Élément de Travail)**
    *   *Concept abstrait* regroupant : `MeetingAction`, `OnboardingTask`, `Function` (à développer).
    *   *Caractéristiques* : A un statut (À faire/Fait), un responsable, une échéance.

*   **TemporalEvent (Événement Temporel)**
    *   *Concept abstrait* regroupant : `OneOnOneMeeting`, `LeaveRequest`, `Evaluation`.
    *   *Caractéristiques* : A une date de début, une durée ou date de fin.

*   **AccessControl (Contrôle d'Accès)**
    *   Pattern omniprésent via RLS (Row Level Security).
    *   *Règle* : La visibilité est toujours restreinte au contexte (Mon département, Mon équipe, Moi-même).

### Contrôle d’accès — Vocabulaire canonique (2026-01)

Pour éviter les ambiguïtés et respecter la séparation Global/Modules, l’ontologie distingue explicitement :

*   **Module d’accès (`AccessModule`)**
    *   *Définition* : Une unité d’accès applicatif identifiée par une clé stable (ex: `ma-place-rh`) pour laquelle on peut accorder/révoquer un accès.
    *   *Rôle* : Support de la gouvernance d’accès (Niveau 1) et point d’entrée vers l’autorisation fine (Niveau 2).
    *   *Important* : `AccessModule` est **distinct** de `Module` (Capital Technologique / gouvernance / cycle de vie). Un `Module` gouvernance peut correspondre à un `AccessModule`, mais ce n’est pas le même concept.
    *   *Attributs* : `module_id` (clé), `name`, `is_active`, `default_role_key`.

*   **Attribution d’accès (`ModuleAccessGrant`)**
    *   *Définition* : Un événement (ou fait) d’accorder/révoquer un accès à un `AccessModule` pour un `AppUser`.
    *   *Rôle* : Traçabilité et audit : qui a accordé/révoqué, quand, pour quel module.
    *   *Attributs* : `granted_at`, `granted_by`, `revoked_at`, `revoked_by`.

*   **Rôle organisationnel vs rôle applicatif**
    *   **Rôle organisationnel** : reflète la réalité RH (ex: `employee/manager/direction`) et sert à la logique métier (ABAC/RLS).
    *   **Rôle applicatif (RBAC)** : contrôle l’usage de fonctionnalités dans un module (permissions UI/features), ex: rôle `employee` dans `ma-place-rh` pour des permissions “2x4”.

*   **Rôle par défaut d’un module (`DefaultModuleRole`)**
    *   *Règle* : accorder un accès à un `AccessModule` doit attribuer automatiquement un rôle applicatif RBAC minimal correspondant à `default_role_key`.
    *   *But* : éviter les accès “vides”, uniformiser l’expérience et renforcer la défense en profondeur.

---

## 5. Invariants Ontologiques

1.  **Unicité de l'Identité** : Un `UserProfile` (Auth) ne peut correspondre qu'à un seul `Employee` actif.
2.  **Hiérarchie Stricte** : Tout `Employee` (sauf le PDG) a un `Manager`.
3.  **Source de Vérité** : Une donnée métier (ex: "Adresse courriel client") ne devrait avoir qu'une seule source maître déclarée dans la Cartographie.
4.  **Confidentialité des Notes** : Une `MeetingNote` est strictement privée à son auteur ; même un administrateur système ne devrait pas y accéder fonctionnellement (bien que techniquement possible en DB).
5.  **Immutabilité des versions actives** : Une `EvaluationVersion` en statut `active` ne peut pas être modifiée ; tout changement implique une nouvelle version (souvent via duplication).
6.  **Non-rétroaction** : Changer la version “courante” ne modifie jamais rétroactivement les `Evaluation` déjà créées.
7.  **Verrou “en cours”** : Si une `EvaluationVersion` est utilisée par une `Evaluation` en cours de complétion, l’évolution passe par une nouvelle `EvaluationVersion` (pas d’édition directe).
8.  **Unicité de la version courante** : Il n’existe qu’une seule `EvaluationVersion` “courante” (`active`) à un instant T (portée entreprise).
9.  **Gouvernance d’accès** : La configuration des évaluations (création/édition de brouillon/activation/archivage) est réservée aux rôles `Manager` et `Director` (défense en profondeur : guards + RLS).
10. **Registre des modules d’accès** : Tout `AccessModule` actif doit déclarer un `default_role_key`.
11. **Bootstrap d’accès** : Un accès actif à un `AccessModule` implique l’existence d’au moins un rôle applicatif RBAC actif pour ce module (au minimum le rôle par défaut).
12. **Révocation cohérente** : Révoquer l’accès à un `AccessModule` révoque tous les rôles applicatifs RBAC associés à ce module.

---

## 6. Flux Temporels / Causaux

### Flux Rencontre 1:1
```ascii
[Planification] --> (Date arrive) --> [En Cours] --> (Séance tenue) --> [Complétée]
       |                                   |
       +--> [Ordre du jour figé]           +--> [Actions créées]
```

### Flux Développement Module
```ascii
[Idée / Scope Undefined] --> [Scope Defined] --> [Dev Started] --> [Implementation] --> [Fully Implemented]
                                   |
                                   +--> [Fonctions & Features créées]
```
