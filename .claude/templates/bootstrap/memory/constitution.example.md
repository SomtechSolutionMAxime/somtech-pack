<!--
  Sync Impact Report - Constitution v1.5.0
  
  Version change: 1.4.0 → 1.5.0 (MINOR)
  
  Modified sections:
  - Section "Gouvernance" : Mise à jour version et historique
  
  Added sections:
  - Section "Ontologie" : Ajout de l'ontologie comme pilier fondamental
  
  Templates requiring updates:
  - ✅ spec-template.md : Aucune modification nécessaire (générique)
  - ✅ plan-template.md : Aucune modification nécessaire (référence déjà constitution via "Constitution Check")
  - ✅ tasks-template.md : Aucune modification nécessaire (générique)
  - ✅ commands/*.md : Aucune modification nécessaire (génériques)
  
  Follow-up TODOs:
  - Aucun placeholder différé
-->

# Constitution du Projet — Construction Gauthier

## Vision de l'Application

**Essence** : Application propriétaire modulaire qui va contenir progressivement tous les modules métier de l'entreprise Construction Gauthier.

**Croissance progressive** :
- Les modules arrivent un par un, selon les priorités métier
- Chaque module est indépendant (code, PRD, tests, MCP)
- L'application grandit organiquement pour couvrir tous les processus métier
- Chaque nouveau module suit la structure standardisée définie dans `00-module-structure.mdc`

**Vision à long terme** :
- Une panoplie de modules couvrant tous les processus métier de l'entreprise
- Chaque module contient ses propres composants, tests et documentation
- L'application reste cohérente grâce à l'architecture modulaire et aux standards de cette Constitution

**Modules actuels** :
- Gouvernance Technologique (implémenté)
- Ressources Humaines (en développement)
- [Liste complète des modules existants et planifiés dans `Browse/Guides/PRD.md`]

*Pour la liste complète des modules existants et planifiés, voir : `Browse/Guides/PRD.md`*

## Principes Fondamentaux

### Architecture Modulaire
Le projet est organisé en **modules métier indépendants**, chacun contenant son code MCP, sa documentation PRD et ses tests dans une structure unifiée.

**Structure standardisée** :
```
modules/
  {nom-module}/
    mcp/              ← Serveur MCP Railway (si applicable)
      src/
      Dockerfile
      railway.toml
      deploy.sh
      README.md
    prd/              ← Product Requirements Documents
      {module}.md     ← PRD principal du module
    tests/            ← Tests spécifiques au module
      unit/
      e2e/
```

**Principes** :
- Chaque module a son PRD dédié
- Les tests sont organisés par module
- Les serveurs MCP sont déployés indépendamment
- La structure modulaire doit être respectée pour toute nouvelle feature

**Modules existants** :
- La liste complète des modules métier et leur statut est documentée dans `Browse/Guides/modules-architecture.md`
- La règle `.cursor/rules/00-module-structure.mdc` définit la structure générique des modules

*Pour les détails d'implémentation, voir : `Browse/Guides/modules-architecture.md`*

### Développement Piloté par les Spécifications (Spec-Driven)

**Intention** : Le développement suit un processus structuré allant de la spécification à l'implémentation, en séparant le "quoi" du "comment".

**Principes** :
- Les spécifications décrivent le "quoi" et le "pourquoi" sans se préoccuper de la pile technologique
- Le plan définit la pile technologique et l'architecture
- Les tâches sont générées à partir du plan
- Les spécifications doivent respecter la structure modulaire
- Les PRD existants restent la source de vérité
- Les nouvelles specs doivent être alignées avec les modules existants

*Pour les procédures détaillées, voir : `Browse/Guides/spec-kit-usage.md`*

### Qualité du Code

**Standards** :
- Code TypeScript/React avec TypeScript strict
- Utilisation de Tailwind CSS pour le styling
- Validation des données côté client et serveur
- Gestion d'erreurs robuste avec messages clairs
- Code modulaire et réutilisable

**Tests** :
- Tests unitaires pour la logique métier
- Tests e2e pour les parcours critiques
- Tests organisés par module et pour parcours cross-modules
- Validation interactive obligatoire après toute modification UI

### Design System et Charte de Conception

**Principe** : Le projet suit une charte de conception définissant les tokens, composants et standards UI.

**Intentions** :
- La `Charte_de_conception.mdc` (si présente) prime sur les standards UI et doit être respectée par tous les agents
- Les composants doivent respecter le design system documenté
- Les tokens et composants sont documentés et statutés (ready/deprecated)
- Le Design Librarian maintient la cohérence design ↔ PRD modules
- Les formats, i18n et conventions de la Charte sont appliqués dans tous les modules

*Pour les détails, voir : `Charte_de_conception.mdc` (si présente) et `.cursor/rules/13_design_librarian.mdc`*

### Validation UI

**Principe** : Toute modification d'interface doit être validée visuellement avant validation, avec pour objectif **0 erreur console**.

**Intentions** :
- Validation visuelle obligatoire après modification UI
- Objectif : 0 erreur console
- Tests automatisés optionnels sauf pour parcours critiques métier
- Les tests sont organisés par module et pour parcours cross-modules

*Pour les procédures détaillées, voir : `.cursor/rules/browser-validation-strategy.mdc`*

### Gestion Git et Branches

**Principe absolu** : Ne jamais pousser directement sur `main`.

**Intentions** :
- Tous les changements passent par une branche dédiée
- Une Pull Request est requise pour tout changement vers `main`
- La CI et la revue doivent valider avant merge
- Les branches suivent une convention de nommage claire

**Workflow** :
- Utiliser le CLI (`git`, `gh`) en priorité pour créer branches, ouvrir/mettre à jour PR et Issues
- Les outils MCP GitHub sont autorisés en secours uniquement si le CLI est indisponible
- Documenter toutes les actions distantes (branche créée, PR ouverte, commentaires) dans le suivi de tâche
- Éviter les opérations destructives sans confirmation explicite (push forcé, suppression de branche distante, merge sans revue)

*Pour les procédures détaillées, voir : `.cursor/rules/00-git-main-protection.mdc`, `.cursor/rules/no-production-push.mdc`*

### Documentation

**PRD par module** :
- Chaque module a son PRD dans `modules/{module}/prd/{module}.md`
- Les PRD contiennent les sections requises pour documenter le module
- Les changements de schéma, RLS et API sont documentés dans le PRD du module concerné

**PRD par composant (nouveau standard)** :
- Chaque module peut (et doit, lorsque les composants sont migrés/implémentés) avoir des PRD par composant dans `modules/{module}/prd/components/{component}.md`
- Le PRD composant est la **source de vérité** détaillée d’un composant (UI/DB/règles métier/AC), et complète le PRD module
- Les changements localisés à un composant doivent mettre à jour **le PRD module + le PRD composant**

**Cohérence** :
- Après toute modification impactant la documentation, la cohérence doit être validée
- Le mapping Code↔Produit↔Tests doit être maintenu à jour

*Pour les sections requises et templates, voir : `Browse/Guides/PRD.md` et `Browse/Templates/`*

### Agents et Orchestration

**Intention** : Le projet utilise un système d'agents spécialisés pour différentes responsabilités, orchestrés automatiquement selon l'intention de chaque demande.

**Agents disponibles** :
- **Product Owner** : Backlog, épics, stories, priorisation
- **Analyste Fonctionnel** : Spécifications, critères d'acceptation G/W/T
- **UX/UI Designer** : Wireframes, interfaces, accessibilité
- **Dev Frontend** : Composants React, validations client, hooks API
- **Dev Backend** : API, migrations DB, logique métier
- **QA Testeur** : Plans de test, cas G/W/T, e2e, non-régression
- **DevOps** : Docker, déploiements, CI/CD, observabilité
- **Gouvernance Produit** : Validation PRD, cohérence code/tests
- **Docs Maintainer** : Validation PRD, mapping PRD↔code↔tests
- **RLS/DB Auditor** : Audit RLS, index, modèle de données
- **Observabilité/Analytics** : Événements, métriques, traces
- **Design Librarian** : Tokens, composants, statut, liens PRD
- **PRD Cartographe** : Cartographie PRD ↔ code ↔ tests

**Routage** : L'orchestrateur analyse chaque demande et route vers l'agent approprié selon l'intention détectée.

*Pour la matrice de routage et les commandes, voir : `.cursor/rules/00_orchestrator.mdc`*

### Base de Données Supabase

**Migrations** :
- Les modifications de schéma doivent être versionnées et traçables
- Les changements de schéma sont documentés dans le PRD du module concerné
- Le schéma est géré de façon déclarative

**RLS (Row Level Security)** :
- Toutes les tables doivent avoir des politiques RLS appropriées
- Les politiques RLS sont documentées dans le PRD du module (section data_model)
- Les politiques doivent être explicites et testables

**Outils MCP disponibles** :
- **MCP Supabase** : Gestion schéma, migrations, RLS, diagnostic (logs, advisors)
- **MCP Context7** : Documentation des librairies (React, Next.js, Supabase, etc.)
- **MCP pure.md** : Web fetching et recherche (pages externes, veille, extraction structurée)
- **MCP Railway** : Déploiement des modules MCP sur Railway
- **MCP Playwright** : Validation UI interactive (navigateur intégré)

**Règles d'utilisation** :
- Les modifications DDL passent par des migrations versionnées (MCP Supabase)
- Les requêtes DML et d'inspection sont exécutées ponctuellement (pas via migrations)
- MCP Context7 pour documentation librairies (résolution ID puis récupération docs)
- MCP pure.md pour contenu web bloqué/JS lourd ou veille/actu
- MCP Railway pour déploiement automatisé des modules MCP

*Pour les procédures détaillées, voir : `.cursor/rules/supabase-mcp.mdc`, `.cursor/rules/declarative-database-schema.mdc`, `.cursor/rules/mcp-context7.mdc`*

### Ontologie

**⚠️ PRINCIPE ABSOLU** : Les documents `ontologie/01_ontologie.md` (Narrative) et `ontologie/02_ontologie.yaml` (Technique) constituent la **source de vérité sémantique et structurelle** du système.

**Règle stricte** :
- **AUCUNE** nouvelle entité métier ou relation ne doit être implémentée sans être d'abord définie dans l'ontologie.
- **AUCUN** nommage de table, de colonne ou de composant ne doit contredire les termes définis dans l'ontologie.
- L'ontologie définit le langage commun (Ubiquitous Language) entre le métier et la technique.

**Portée de cette règle** :
- Modélisation de données (tables, colonnes, relations)
- Nommage des variables et classes dans le code
- Terminologie dans les interfaces utilisateur
- Structure des modules et leurs interactions

**Documents de référence** :
- **Ontologie Narrative** : `ontologie/01_ontologie.md` (Vision, Concepts, Flux)
- **Ontologie Technique** : `ontologie/02_ontologie.yaml` (Hiérarchie, Attributs, Invariants)

**Conformité obligatoire** :
- Avant tout développement d'une nouvelle feature, vérifier si les concepts existent dans l'ontologie.
- Si un concept manque, proposer un amendement à l'ontologie avant de coder.
- Les "Invariants Ontologiques" définis dans `02_ontologie.yaml` doivent être respectés par le code et les tests.

*Pour les détails, voir : `ontologie/01_ontologie.md` et `ontologie/02_ontologie.yaml`*

### Gestion des Utilisateurs

**⚠️ PRINCIPE ABSOLU** : Le document `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md` est la **référence de vérité** pour tout ce qui concerne la structure et la gestion des utilisateurs (tables, relations, sources de vérité, artefacts historiques) dans le système.

**Règle stricte** :
- **AUCUNE** modification, implémentation ou décision concernant la gestion des utilisateurs ne doit être faite sans se référer d'abord à `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md`
- **AUCUNE** action ne doit être entreprise si elle n'est pas explicitement spécifiée ou compatible avec ce document
- Toute nouvelle fonctionnalité, migration, API ou interface liée aux utilisateurs doit être conforme à l'architecture définie dans ce document

**Portée de cette règle** :
- Création, modification, suppression d'utilisateurs
- Gestion des accès aux modules (`module_access`)
- Gestion des rôles et permissions (`module_roles`, `user_module_roles`)
- Profils métiers (employés, consultants, etc.)
- Tables de données : `app_users`, `employees`, `public.users`, `employee_profiles`, `module_access`, etc.
- Fonctions RPC : `create_user_with_profile`, `grant_module_access`, `revoke_module_access`, `check_user_exists`, etc.
- Interfaces utilisateur : ConfigurationPage, création d'employé depuis Ma Place RH, etc.
- Flux de création et gestion des utilisateurs
- Séparation des concepts (employé vs accès module)
- Sécurité et permissions (RLS, gardes frontend)

**Conformité obligatoire** :
- Avant toute modification liée aux utilisateurs, lire et comprendre `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md`
- Vérifier que la modification proposée est conforme à l'architecture définie
- Si une modification semble nécessaire mais n'est pas dans le document, mettre à jour d'abord le document d'architecture (avec validation) avant d'implémenter
- Tous les agents (Dev Backend, Dev Frontend, QA, etc.) doivent respecter cette architecture

**Document de référence** :
- **Référence de vérité** : `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md`
- Ce document contient :
  - Principes architecturaux (source de vérité unique, séparation des responsabilités, séparation des concepts)
  - Modèle de données complet (toutes les tables et leurs relations)
  - Flux de création et gestion (scénarios détaillés)
  - API et fonctions RPC (signatures et logique)
  - Interface utilisateur (spécifications des pages et composants)
  - Sécurité et permissions (RLS, gardes frontend)
  - Plan de migration et évolution

**Exceptions** :
- Aucune exception n'est autorisée sans validation explicite et mise à jour préalable du document d'architecture

*Pour tous les détails, voir : `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md`*

### Déploiement et Infrastructure

**Serveurs MCP** :
- Chaque module MCP est déployé indépendamment
- Un service Railway par module MCP
- Les déploiements sont automatisés et traçables

**CI/CD** :
- Validation automatique des PR avant merge
- Tests automatisés obligatoires avant merge
- Déploiement en production nécessite validation explicite

*Pour les procédures de déploiement, voir : `Browse/Guides/railway-mcp-modulaire.md`*

### Sécurité

**⚠️ PRINCIPE ABSOLU** : Le document `security/ARCHITECTURE_DE_SECURITÉ.md` est la **source de vérité unique et absolue** pour tout ce qui concerne l'architecture de sécurité du système.

**Règle stricte** :
- **AUCUNE** modification, implémentation ou décision concernant la sécurité ne doit être faite sans se référer d'abord à `security/ARCHITECTURE_DE_SECURITÉ.md`
- **AUCUNE** action ne doit être entreprise si elle n'est pas explicitement spécifiée ou compatible avec ce document
- Toute nouvelle fonctionnalité, migration, API ou interface liée à la sécurité doit être conforme à l'architecture définie dans ce document

**Portée de cette règle** :
- Architecture d'authentification (Supabase Auth, Azure AD)
- Architecture d'autorisation à deux niveaux (accès modules, rôles/permissions)
- Politiques Row Level Security (RLS) sur toutes les tables
- Gardes frontend et protection des routes (`ProtectedRoute`, `ModuleAccessGuard`, `PermissionGuard`)
- Patterns de sécurité (propriétaire, équipe/manager, admin, permissions génératives ABAC)
- Audit et traçabilité (`auth_events`, journalisation)
- Modèle hybride RBAC + ABAC (rôles stockés + permissions calculées)

**Conformité obligatoire** :
- Avant toute modification liée à la sécurité, lire et comprendre `security/ARCHITECTURE_DE_SECURITÉ.md`
- Vérifier que la modification proposée est conforme à l'architecture définie
- Si une modification semble nécessaire mais n'est pas dans le document, mettre à jour d'abord le document d'architecture (avec validation) avant d'implémenter
- Tous les agents (Dev Backend, Dev Frontend, QA, DevOps, etc.) doivent respecter cette architecture

**Document de référence** :
- **Source de vérité** : `security/ARCHITECTURE_DE_SECURITÉ.md`
- Ce document contient :
  - Principes de sécurité fondamentaux (défense en profondeur, moindre privilège, RBAC + ABAC)
  - Architecture de sécurité en couches (authentification, autorisation niveau 1 et 2, RLS, frontend)
  - Politiques RLS par table (`user_profiles`, `module_access`, `employee_profiles`, etc.)
  - Gardes frontend et protection des routes
  - Patterns de sécurité réutilisables
  - Bonnes pratiques de sécurité
  - Documentation de sécurité (référence au plan de documentation)

**Principes généraux** :
- Ne jamais exécuter d'action destructive sans confirmation
- Ne jamais exposer de secrets dans le code
- Utiliser les variables d'environnement pour la configuration
- Valider toutes les entrées utilisateur
- Appliquer RLS pour la sécurité des données

**Classification des données** :
- Les données sont classifiées selon leur niveau de sensibilité (public, interne, sensible, restreint)
- Les données restreintes nécessitent RLS obligatoire et audit des accès
- Les données sensibles nécessitent chiffrement au repos et en transit

**Conformité légale** :
- Respect de la Loi 25 (Québec)
- Respect du RGPD si applicable (UE)
- Politiques de rétention : Projets (7 ans), Journaux d'accès (1 an)

**Exceptions** :
- Aucune exception n'est autorisée sans validation explicite et mise à jour préalable du document d'architecture

*Pour tous les détails, voir : `security/ARCHITECTURE_DE_SECURITÉ.md`*

### Performance

**Objectifs** :
- Temps de chargement initial < 3s
- Interactions UI < 100ms
- Latence p95 < 300ms pour les opérations courantes
- Optimisation des requêtes DB (index appropriés)
- Lazy loading des modules non critiques

**Observabilité** :
- Événements minimaux trackés : `page_view`, `action_click`, `error`
- Budget d'erreurs visibles : < 1% sessions
- Métriques de performance suivies et alertées

*Pour les métriques détaillées, voir : `.cursor/rules/12_observability_analytics.mdc`*

## Gouvernance

Cette constitution définit les principes fondamentaux du projet Construction Gauthier. Elle prime sur toutes les autres pratiques et doit être respectée par tous les développements.

**Procédure d'amendement** :
- Les amendements nécessitent une documentation explicite des changements
- Les changements majeurs (MAJOR) nécessitent une approbation formelle
- Les modifications doivent être propagées aux templates dépendants (spec, plan, tasks)
- Un plan de migration doit être défini pour les changements incompatibles
- Les amendements sont documentés dans cette section avec date et raison

**Politique de versioning** :
- **MAJOR** : Suppression ou redéfinition de principes incompatibles avec les versions précédentes
- **MINOR** : Ajout de nouveaux principes ou sections sans incompatibilité
- **PATCH** : Clarifications, corrections de typo, améliorations non-sémantiques

**Version** : 1.5.0 | **Ratifiée** : 2025-01-30 | **Dernière modification** : 2025-12-02

**Historique des amendements** :
- **v1.5.0** (2025-12-02) : Intégration de l'Ontologie comme pilier fondamental et source de vérité sémantique.
- **v1.4.0** (2025-02-04) : Mise à jour section "Sécurité" avec référence absolue à `security/ARCHITECTURE_DE_SECURITÉ.md` comme source de vérité unique. Aucune modification liée à la sécurité ne peut être faite sans se conformer à ce document. Ajout dans la section Références.
- **v1.3.0** (2025-02-02) : Ajout section "Gestion des Utilisateurs" avec référence absolue à `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md` comme référence de vérité. Aucune modification liée aux utilisateurs ne peut être faite sans se conformer à ce document.
- **v1.2.0** (2025-01-30) : Ajout section "Vision de l'Application" pour documenter l'essence et la croissance progressive de l'application modulaire
- **v1.1.0** (2025-01-30) : Ajout section Design System, complétion Outils MCP, enrichissement structure modulaire, références complètes aux règles spécialisées
- **v1.0.0** (2025-01-30) : Version initiale avec principes fondamentaux et gouvernance

## Conformité

Tous les développements doivent respecter cette constitution. En cas de doute, consulter les guides dans `Browse/Guides/` ou les règles dans `.cursor/rules/`.

## Références

### Guides
- Architecture modulaire : `Browse/Guides/modules-architecture.md`
- PRD maître : `Browse/Guides/PRD.md`
- Déploiement MCP : `Browse/Guides/railway-mcp-modulaire.md`
- Spec-kit usage : `Browse/Guides/spec-kit-usage.md`

### Documents de référence absolue
- **Ontologie** : `ontologie/01_ontologie.md` et `ontologie/02_ontologie.yaml` ⚠️ **SOURCE DE VÉRITÉ SÉMANTIQUE**
- **Gestion des utilisateurs** : `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md` ⚠️ **RÉFÉRENCE DE VÉRITÉ**
- **Architecture de sécurité** : `security/ARCHITECTURE_DE_SECURITÉ.md` ⚠️ **SOURCE DE VÉRITÉ UNIQUE**

### Règles spécialisées

**Orchestration et structure** :
- Orchestrateur : `.cursor/rules/00_orchestrator.mdc`
- Structure modulaire : `.cursor/rules/00-module-structure.mdc`
- Protection branche main : `.cursor/rules/00-git-main-protection.mdc` / `.cursor/rules/no-production-push.mdc`

**Validation UI et tests** :
- Stratégie navigateur/tests : `.cursor/rules/browser-validation-strategy.mdc`
- Validation UI obligatoire : `.cursor/rules/ui-changes-require-playwright-tests.mdc`
- Navigateur interactif : `.cursor/rules/ui-browser-interactive.mdc`
- Validation & exploration UI : `.cursor/rules/ui-interface-playwright.mdc`
- Tests automatisés : `.cursor/rules/ui-testing-automated.mdc`
- Politique validation UI : `.cursor/rules/ui-validation-policy.mdc`
- Index navigateur/tests : `.cursor/rules/INDEX_NAVIGATEUR_TESTS.md`

**Base de données** :
- MCP Supabase : `.cursor/rules/supabase-mcp.mdc`
- Schéma déclaratif : `.cursor/rules/declarative-database-schema.mdc`
- RLS : `.cursor/rules/create-rls-policies.mdc`
- SQL Postgres : `.cursor/rules/supabaseprojetct.mdc`
- Edge Functions : `.cursor/rules/writing-supabase-edge-functions.mdc`

**Outils MCP** :
- MCP Context7 : `.cursor/rules/mcp-context7.mdc`

**Design System** :
- Design Librarian : `.cursor/rules/13_design_librarian.mdc`
