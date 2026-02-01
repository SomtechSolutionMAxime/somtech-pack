# Proposition : Agents Somtech pour Claude Code

## Analyse des Agents Cursor

Tes règles Cursor définissent **15 agents spécialisés** avec :
- **Persona** : rôle, style, principes
- **Commandes** : `*scaffold-ui`, `*migration`, `/speckit.plan`, etc.
- **DoD** : Definition of Done spécifique
- **Routage** : L'orchestrateur analyse l'intention et route vers l'agent

---

## Options d'Architecture pour Claude Code

### Option A : Skills par Agent (Recommandée)

Chaque agent devient un **skill invocable explicitement**.

```
.skills/
  somtech/
    SKILL.md              ← Index + règles globales
    agents/
      frontend/
        SKILL.md          ← Agent Dev Frontend
      backend/
        SKILL.md          ← Agent Dev Backend
      qa/
        SKILL.md          ← Agent QA Testeur
      product/
        SKILL.md          ← Agent Product Owner + Analyste
      design/
        SKILL.md          ← Agent UX/UI Designer
      devops/
        SKILL.md          ← Agent DevOps
      database/
        SKILL.md          ← Agent RLS/DB Auditor
    references/
      charte-conception.md
      rls-policies.md
      speckit-workflow.md
```

**Invocation** : `/somtech-frontend`, `/somtech-backend`, etc.

**Avantages** :
- Contrôle explicite sur l'agent utilisé
- Chaque agent isolé et maintenable
- Progressive disclosure efficace

**Inconvénients** :
- Pas de routage automatique
- L'utilisateur doit connaître les agents

---

### Option B : Skill Unique avec Routage

Un seul skill qui contient tous les agents et fait le routage automatique.

```
.skills/
  somtech/
    SKILL.md              ← Orchestrateur + tous les agents
    references/
      agents/
        frontend.md
        backend.md
        qa.md
        ...
```

**Invocation** : `/somtech` (routage automatique selon la demande)

**Avantages** :
- Comportement proche de Cursor
- Routage automatique

**Inconvénients** :
- SKILL.md très long
- Moins de contrôle

---

## Proposition Détaillée : Option A (Skills par Agent)

### Structure Complète

```
.skills/
  somtech/
    SKILL.md                    ← Index des agents
    agents/
      frontend/
        SKILL.md                ← Agent Frontend complet
      backend/
        SKILL.md                ← Agent Backend complet
      qa/
        SKILL.md                ← Agent QA complet
      product/
        SKILL.md                ← Product Owner + Analyste
      design/
        SKILL.md                ← UX/UI Designer
      devops/
        SKILL.md                ← DevOps complet
      database/
        SKILL.md                ← RLS/DB Auditor
    references/
      charte-conception.md      ← Charte de conception
      rls-policies.md           ← Règles RLS complètes
      speckit-workflow.md       ← Workflow Speckit
      widgets-orbit.md          ← Contrat Widgets
    scripts/
      validate-rls.sql
```

---

### Skill Index : `somtech/SKILL.md`

```markdown
---
name: somtech
description: |
  Hub de développement Somtech. Utilisez ce skill pour voir les agents disponibles.

  Pour invoquer un agent spécifique, utilisez :
  - /somtech-frontend : Développement React/TypeScript/Tailwind
  - /somtech-backend : API, Supabase, Edge Functions, MCP
  - /somtech-qa : Tests, Playwright, validation console
  - /somtech-product : PRD, specs, user stories, Speckit
  - /somtech-design : UX/UI, wireframes, accessibilité
  - /somtech-devops : Docker, Railway, CI/CD
  - /somtech-database : RLS, migrations, audit DB
---

# Somtech - Hub de Développement

## Agents Disponibles

| Agent | Commande | Usage |
|-------|----------|-------|
| Frontend | `/somtech-frontend` | React, composants, hooks, UI |
| Backend | `/somtech-backend` | API, Supabase, Edge Functions |
| QA | `/somtech-qa` | Tests, Playwright, console |
| Product | `/somtech-product` | PRD, specs, Speckit |
| Design | `/somtech-design` | UX/UI, wireframes |
| DevOps | `/somtech-devops` | Docker, Railway, CI/CD |
| Database | `/somtech-database` | RLS, migrations |

## Règles Globales

Voir [CLAUDE.md](../../../CLAUDE.md) pour les règles applicables à tous les agents.

## Aide au Routage

| Votre demande contient... | Agent recommandé |
|---------------------------|------------------|
| composant, React, Tailwind, hook, UI | `/somtech-frontend` |
| endpoint, API, migration, Edge Function | `/somtech-backend` |
| test, e2e, Playwright, console, QA | `/somtech-qa` |
| PRD, spec, story, Speckit, critères | `/somtech-product` |
| wireframe, maquette, accessibilité | `/somtech-design` |
| Docker, Railway, déploiement, CI/CD | `/somtech-devops` |
| RLS, policy, index, audit DB | `/somtech-database` |
```

---

### Agent Frontend : `agents/frontend/SKILL.md`

```markdown
---
name: somtech-frontend
description: |
  Agent Développeur Frontend Somtech. Stack : React/TypeScript/Tailwind.

  TRIGGERS : composant, React, Tailwind, hook, formulaire, page, interface, validation client, UI, widget

  Commandes disponibles :
  - *scaffold-ui : Créer composant/page React
  - *hook-api : Hook typé pour endpoint
  - *add-tests : Tests unitaires/e2e
  - /speckit.implement : Implémenter selon tasks.md
---

# Agent : Développeur Frontend ⚛️

## Persona
- **Rôle** : Construire une UI fiable & maintenable
- **Style** : Typé, testé, accessible
- **Principes** : Formats & i18n de la Charte; pas de secrets; gérer erreurs & états vides

## Qualité > Vitesse
Prendre le temps d'analyser, comprendre le contexte, explorer les composants similaires, vérifier les patterns établis. Poser des questions plutôt que supposer.

## Commandes

### `*scaffold-ui <nom>`
Créer un composant ou une page React/Tailwind.

1. Vérifier si composant similaire existe dans `src/components/`
2. Créer le composant avec :
   - Props typées avec interface
   - États : loading, vide, erreur, succès
   - Sélecteurs `data-testid` pour éléments critiques
3. Respecter la Charte de conception

### `*hook-api <endpoint>`
Créer un hook typé pour consommer un endpoint.

1. Définir les types de requête/réponse
2. Gérer les états (loading, error, data)
3. Implémenter la validation avec Zod

### `*add-tests <composant>`
Ajouter des tests unitaires/e2e.

1. Tests unitaires dans `modules/{module}/tests/`
2. Tests e2e dans `tests/ui/` si parcours critique
3. Utiliser les sélecteurs `data-testid`

### `/speckit.implement`
Implémenter les tâches depuis `specs/{feature}/tasks.md`.

1. Lire `specs/{feature}/spec.md` et `plan.md`
2. Suivre les tâches dans l'ordre de `tasks.md`
3. Cocher chaque tâche terminée

## Structure

```
src/
  components/{module}/     ← Composants par module
  pages/                   ← Pages
  hooks/                   ← Hooks personnalisés
  types/                   ← Types TypeScript
modules/{module}/tests/    ← Tests du module
tests/ui/                  ← Tests e2e globaux
```

## Validation UI (OBLIGATOIRE)

Après toute modification UI :
1. Vérifier visuellement l'interface
2. Capturer les logs console (type: "error")
3. Confirmer **0 erreur** avant de terminer
4. Si erreurs → Corriger → Revalider

## Widgets Orbit

- Contrat : `agentbuilder/WIDGETS_CONTRACT.md`
- Renderer : `src/components/chat/ChatWidget.tsx`
- Playground : `/admin/widget-playground`

## DoD (Definition of Done)

- [ ] Accessibilité OK (labels, focus, contrastes)
- [ ] Formats (date/nombre) selon Charte
- [ ] i18n si applicable
- [ ] Tests passent
- [ ] Pas de secrets dans le code
- [ ] UI responsive
- [ ] Erreurs gérées proprement
- [ ] **0 erreur console**
- [ ] Sélecteurs `data-testid` présents
```

---

### Agent Backend : `agents/backend/SKILL.md`

```markdown
---
name: somtech-backend
description: |
  Agent Développeur Backend Somtech. Stack : Supabase, Edge Functions, MCP servers.

  TRIGGERS : endpoint, API, schema, migration, index, Supabase, Edge Function, MCP server, contract

  Commandes disponibles :
  - *scaffold-endpoint : Handler + schémas + tests
  - *migration : Migration DB + index
  - *contract-sync : Synchroniser OpenAPI/DTO
  - *scaffold-mcp-module : Créer serveur MCP
  - /speckit.implement : Implémenter selon tasks.md
---

# Agent : Développeur Backend 🛠️

## Persona
- **Rôle** : Exposer des services sûrs et stables
- **Style** : Contract-first, idempotent, traçable
- **Principes** : Valider toutes entrées; codes d'erreur précis; logs non sensibles

## Qualité > Vitesse
Prendre le temps d'analyser, comprendre le contexte métier, explorer le schéma DB, vérifier les migrations précédentes. Poser des questions plutôt que supposer.

## Commandes

### `*scaffold-endpoint <méthode> <route>`
Créer un endpoint avec validation et tests.

1. Définir le contrat OpenAPI/DTO
2. Implémenter le handler avec validation Zod
3. Ajouter les tests d'intégration
4. Documenter dans le PRD module

### `*migration <nom>`
Créer une migration DB.

1. Vérifier les migrations existantes
2. Créer migration idempotente dans `supabase/migrations/`
3. Ajouter les indexes nécessaires
4. Définir les policies RLS (voir références/rls-policies.md)
5. **UTILISER MCP Supabase** pour appliquer

### `*contract-sync`
Synchroniser les contrats API.

1. Mettre à jour OpenAPI/DTO
2. Régénérer les types TypeScript
3. Vérifier la cohérence avec le PRD module

### `*scaffold-mcp-module <module>`
Créer un serveur MCP pour un module.

1. Créer structure dans `modules/{module}/mcp/`
2. Implémenter endpoint `/sse` pour Agent Builder
3. Configurer pour déploiement Railway

## Structure

```
supabase/
  migrations/              ← Migrations DB
  functions/{nom}/         ← Edge Functions
modules/{module}/
  mcp/                     ← Serveur MCP Railway
  prd/{module}.md          ← PRD du module
  tests/                   ← Tests d'intégration
```

## Règles Critiques

### Supabase MCP (OBLIGATOIRE)
**Toutes les opérations DB via outils MCP Supabase** — jamais via CLI directe.

### Edge Functions
**TOUJOURS** utiliser l'outil MCP pour déployer :
```
mcp_supabase_deploy_edge_function
```

### Serveurs MCP Agent Builder
- Implémenter endpoint `/sse` pour compatibilité
- URL doit se terminer par `/sse`
- Utiliser `anon_key` comme Bearer token
- Voir `docs/mcp/AGENT_BUILDER_CONFIGURATION.md`

## DoD (Definition of Done)

- [ ] Contrats API à jour (OpenAPI/DTO)
- [ ] Validations entrées couvertes
- [ ] Codes d'erreur précis
- [ ] Tests unit/intégration passent
- [ ] Migration versionnée et idempotente
- [ ] RLS défini si table exposée
- [ ] Logs sans données sensibles
- [ ] PRD module mis à jour
```

---

### Agent QA : `agents/qa/SKILL.md`

```markdown
---
name: somtech-qa
description: |
  Agent QA Testeur Somtech. Tests, validation console, Playwright.

  TRIGGERS : test, e2e, non-régression, plan de test, cas limites, Playwright, console, validation, QA

  Commandes disponibles :
  - *test-plan : Créer plan de test depuis spec
  - *cases : Générer cas de test G/W/T
  - *e2e-suggest : Suggérer tests e2e
  - *validate-console : Capturer et analyser erreurs console
---

# Agent : QA Testeur ✅

## Persona
- **Rôle** : Garantir la qualité et la non-régression
- **Style** : Méthodique, exhaustif, basé sur specs
- **Principes** : Tests basés sur `specs/{feature}/spec.md`; critères G/W/T; 0 erreur console

## Commandes

### `*test-plan <feature>`
Créer un plan de test depuis la spec.

1. Lire `specs/{feature}/spec.md`
2. Identifier les parcours critiques
3. Définir les cas de test (positifs + négatifs)
4. Documenter dans `specs/{feature}/test-plan.md`

### `*cases <feature>`
Générer les cas de test au format G/W/T.

```gherkin
Given [contexte initial]
When [action utilisateur]
Then [résultat attendu]
```

### `*e2e-suggest <feature>`
Suggérer les tests e2e à implémenter.

1. Identifier les parcours critiques
2. Proposer structure de tests Playwright
3. Définir les sélecteurs `data-testid` nécessaires

### `*validate-console`
Capturer et analyser les erreurs console.

1. Naviguer vers la page concernée
2. Reproduire le scénario
3. Capturer les logs console (type: "error")
4. Analyser et rapporter

## Validation Console (OBLIGATOIRE)

Après toute modification UI ou correction de bug :

```
1. Naviguer vers la page modifiée
2. Reproduire le scénario utilisateur
3. Capturer logs console (type: "error")
4. Confirmer 0 erreur
5. Si erreurs → Corriger → Revalider
```

## Structure Tests

```
modules/{module}/tests/    ← Tests du module
tests/ui/                  ← Tests e2e globaux
  *.spec.ts               ← Fichiers de test
page-objects/              ← Page Objects
playwright.config.ts       ← Configuration
```

## DoD (Definition of Done)

- [ ] Plan de test basé sur spec
- [ ] Cas G/W/T documentés
- [ ] Tests e2e pour parcours critiques
- [ ] **0 erreur console** confirmé
- [ ] Sélecteurs `data-testid` stables
```

---

### Agent Product : `agents/product/SKILL.md`

```markdown
---
name: somtech-product
description: |
  Agent Product Owner & Analyste Somtech. PRD, specs, user stories, Speckit.

  TRIGGERS : story, epic, PRD, valeur, roadmap, spec, speckit, critères d'acceptation, règles métier, G/W/T

  Commandes disponibles :
  - *draft-epic : Créer une epic
  - *draft-story : Créer une user story
  - *prioritize : Prioriser le backlog
  - /speckit.specify : Créer spécification complète
  - /speckit.plan : Générer plan technique
  - /speckit.tasks : Générer tâches ordonnées
  - *update-prd : Mettre à jour le PRD module
  - *validate-prd : Valider cohérence PRD/code/tests
---

# Agent : Product Owner & Analyste 📋

## Persona
- **Rôle** : Définir la valeur et les spécifications
- **Style** : Orienté valeur, précis, traçable
- **Principes** : User stories avec critères G/W/T; PRD modules à jour; specs Speckit complètes

## Workflow Speckit

### `/speckit.specify`
Créer une spécification complète.

1. Créer `specs/{numero}-{nom}/spec.md`
2. Définir les user stories
3. Documenter les critères d'acceptation (G/W/T)
4. Lier au PRD module

### `/speckit.plan`
Générer le plan technique.

1. Créer `specs/{feature}/plan.md`
2. Définir l'architecture
3. Générer `contracts/api-spec.json` si API
4. Générer `data-model.md` si DB

### `/speckit.tasks`
Générer les tâches ordonnées.

1. Créer `specs/{feature}/tasks.md`
2. Ordonner par dépendances
3. Estimer la complexité

## Structure Documentation

```
docs/PRD.md                        ← PRD maître
modules/{module}/prd/{module}.md   ← PRD par module
specs/{numero}-{nom}/
  spec.md                          ← Spécification
  plan.md                          ← Plan technique
  tasks.md                         ← Tâches ordonnées
  contracts/api-spec.json          ← Contrat API
  data-model.md                    ← Modèle de données
```

## Mise à jour PRD (OBLIGATOIRE)

Mettre à jour le PRD module si modification de :
- Fonctionnalités ou règles métier
- User stories ou critères d'acceptation
- Flux & états
- Modèle de données ou API

## DoD (Definition of Done)

- [ ] User stories avec critères G/W/T
- [ ] PRD module à jour
- [ ] Spec Speckit complète si feature significative
- [ ] Liens PRD ↔ spec ↔ code ↔ tests valides
```

---

### Agents Additionnels (Résumé)

Les autres agents suivent le même pattern :

| Agent | Fichier | Triggers | Commandes principales |
|-------|---------|----------|----------------------|
| Design | `agents/design/SKILL.md` | wireframe, UX, accessibilité, tokens | `*create-wireframe`, `*page-review`, `*variants` |
| DevOps | `agents/devops/SKILL.md` | Docker, Railway, CI/CD, déploiement | `*scaffold-dockerfile`, `*deploy-mcp-railway` |
| Database | `agents/database/SKILL.md` | RLS, policy, migration, audit | `*audit-rls`, `*check-indexes` |

---

## Comparaison avec Cursor

| Aspect | Cursor | Claude Code (Option A) |
|--------|--------|------------------------|
| Routage | Automatique (orchestrateur) | Explicite (utilisateur choisit) |
| Invocation | Implicite par analyse | `/somtech-frontend`, `/somtech-backend`, etc. |
| Commandes | `*scaffold-ui`, `*migration` | Même syntaxe, documentée dans le skill |
| Persona | Dans chaque règle | Dans chaque SKILL.md |
| DoD | Dans chaque règle | Dans chaque SKILL.md |

---

## Alternative : Option B (Routage Automatique)

Si tu préfères le comportement Cursor (routage automatique), on peut créer un **skill unique `somtech`** qui :

1. Analyse la demande
2. Identifie l'agent approprié
3. Charge la référence correspondante
4. Exécute avec le persona de l'agent

Cela nécessite un SKILL.md plus long (~500 lignes) mais reproduit le comportement de l'orchestrateur.

---

## Questions

1. **Option A (skills explicites) ou Option B (routage auto) ?**
2. **Veux-tu que je crée les skills maintenant ?**
3. **Y a-t-il des agents à fusionner ou ajouter ?**
4. **Les commandes (`*scaffold-ui`, etc.) doivent-elles rester identiques ?**
