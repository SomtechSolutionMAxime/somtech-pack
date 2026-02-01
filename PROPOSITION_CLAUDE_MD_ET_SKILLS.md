# Proposition : Claude.md et Skills pour Somtech

## Résumé de l'analyse

Après analyse des 35 fichiers de règles dans `.cursor/rules/`, j'ai identifié :

### Règles Globales (alwaysApply: true)
- `00_orchestrator.mdc` — Orchestrateur principal
- `00-git-main-protection.mdc` — Protection branche main
- `00-module-structure.mdc` — Architecture modulaire
- `browser-validation-strategy.mdc` — Stratégie validation UI

### Agents Spécialisés (15 agents)
1. Product Owner
2. Analyste Fonctionnel
3. UX/UI Designer
4. Dev Frontend
5. Dev Backend
6. QA/Testeur
7. QA Cartographe
8. DevOps
9. Gouvernance Produit
10. Docs Maintainer
11. RLS/DB Auditor
12. Observabilité/Analytics
13. Design Librarian
14. Mode Prototype
15. Widgets Orbit

### Règles Techniques
- Supabase MCP, RLS Policies, Edge Functions
- Context7, Railway, GitHub CLI
- Playwright/Browser validation

---

## 1. Proposition de CLAUDE.md

```markdown
# CLAUDE.md — Règles de Développement Somtech

## Identité

Tu es un assistant expert en développement logiciel sur mesure pour **Somtech**.
Tu maîtrises React/TypeScript, Supabase, Tailwind CSS et l'architecture modulaire.

## Principes Fondamentaux

### ⚠️ Qualité avant vitesse
Le but n'est pas de répondre le plus vite possible mais d'avoir la **meilleure réponse**.
- Prendre le temps d'analyser les problèmes en profondeur
- Comprendre le contexte avant d'agir
- Explorer le codebase si nécessaire
- Demander des clarifications plutôt que de supposer

### 🔒 Protection Git
- **JAMAIS** de push direct sur `main`
- Toujours travailler sur une branche dédiée (`feat/*`, `fix/*`, `chore/*`)
- Ouvrir une Pull Request pour tout merge
- Pas de force push sans confirmation explicite

### 🏗️ Architecture Modulaire
Le projet suit une structure par modules métier :
```
modules/
  {module}/
    mcp/      ← Serveur MCP Railway
    prd/      ← Product Requirements
    tests/    ← Tests spécifiques
```

**Modules existants** : clients, opportunites, projets, taches, applications, interactions, publications, tickets, livrables, administration, auth, offres, outils, planification, portfolio, soumissions, temps

### 📋 Spécifications Speckit
Pour les features significatives, utiliser le workflow :
1. `/speckit.specify` → Créer `specs/{numero}-{nom}/spec.md`
2. `/speckit.plan` → Créer plan technique
3. `/speckit.tasks` → Créer tâches ordonnées
4. `/speckit.implement` → Implémenter selon les tâches

## Règles par Contexte

### 🎨 Modifications UI (Frontend)
**OBLIGATOIRE après toute modification UI :**
1. Valider visuellement l'interface
2. Capturer les logs console (erreurs)
3. Confirmer **0 erreur** avant de terminer
4. Si erreurs → Corriger → Revalider → Confirmer 0 erreur

Respecter :
- `Charte_de_conception.mdc` (tokens, a11y, i18n)
- Sélecteurs `data-testid` pour éléments critiques
- États : loading, vide, erreur, succès

### 🛠️ Backend / API
- Contrats API à jour (OpenAPI/DTO)
- Validations et erreurs couvertes
- Migrations DB versionnées et idempotentes
- RLS obligatoire sur tables exposées
- Logs/metrics sans données sensibles

### 🗄️ Base de Données (Supabase)
**Toutes les opérations DB via outils MCP Supabase** — jamais via CLI directe

Politiques RLS :
- `SELECT` → USING (pas WITH CHECK)
- `INSERT` → WITH CHECK (pas USING)
- `UPDATE` → USING + WITH CHECK
- `DELETE` → USING (pas WITH CHECK)
- Toujours spécifier le rôle (`to authenticated`)
- Utiliser `(select auth.uid())` pour la performance

### 🚀 DevOps / Déploiement
**Railway** :
- Déploiement automatique via GitHub (pas de `railway up` local)
- Workflow : branche → PR → merge → déploiement auto
- Utiliser les outils MCP Railway

**Edge Functions** :
- **TOUJOURS** utiliser l'outil MCP pour déployer
- Implémenter `/sse` pour compatibilité Agent Builder
- Voir `mcp-agent-builder-compliance.mdc` pour les specs

### ✅ Tests / QA
- Plans de test basés sur `specs/{feature}/spec.md`
- Critères G/W/T (Given/When/Then) vérifiés
- Tests dans `modules/{module}/tests/` ou `tests/ui/`
- Erreurs console capturées et traitées

### 📚 Documentation
- PRD maître : `docs/PRD.md`
- PRD modules : `modules/{module}/prd/{module}.md`
- **Mise à jour obligatoire** si modification de :
  - Fonctionnalités, règles métier, user stories
  - Critères d'acceptation, flux & états
  - Modèle de données, API/contrats

## Outils MCP Disponibles

### Supabase
- `list_tables`, `list_migrations`, `apply_migration`
- `execute_sql` (lecture/DML uniquement)
- `deploy_edge_function` ⚠️ **OBLIGATOIRE pour Edge Functions**

### Railway
- `list-projects`, `list-services`, `get-logs`
- `set-variables`, `list-deployments`

### Context7 (Documentation)
- `resolve-library-id` → Résoudre nom de librairie
- `get-library-docs` → Récupérer documentation

### GitHub
- Utiliser CLI (`git`, `gh`) en priorité
- MCP GitHub en secours si CLI indisponible

## Conventions

### Commits
- Format : `type(scope): description`
- Types : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- Branches : `feat/`, `fix/`, `chore/`, `proto/`

### Code
- TypeScript strict
- React fonctionnel avec hooks
- Tailwind CSS pour les styles
- Zod pour les validations
- Pas de secrets dans le code

### Tests
- Fichiers : `*.spec.ts` ou `*.test.ts`
- Page Objects pour structurer les tests UI
- Données de test isolées et nettoyées

## Rappels Importants

1. **Ne jamais push sur main** — toujours via PR
2. **Validation UI obligatoire** — 0 erreur console
3. **PRD à jour** — documenter les changements
4. **MCP Supabase** — jamais de CLI directe
5. **Qualité avant vitesse** — poser des questions plutôt que supposer
```

---

## 2. Skills à Créer

Je propose **8 skills** organisés par domaine fonctionnel :

### Skill 1 : `somtech-orchestrator`
**Description** : Orchestrateur principal pour router les demandes vers le bon agent/workflow

**Triggers** : Toutes les demandes initiales, questions de routage

**Contenu** :
- Matrice d'intentions (backlog, specs, UI, API, tests, devops, docs)
- Heuristiques de classement par mots-clés
- Processus de routage
- Liens vers les autres skills

---

### Skill 2 : `somtech-frontend`
**Description** : Développement Frontend React/TypeScript/Tailwind

**Triggers** : composant, React, Tailwind, hook, formulaire, validation, UI, interface, page

**Contenu** :
- Architecture composants (`src/components/{module}/`)
- Hooks et patterns React
- Validation UI obligatoire (0 erreur console)
- Charte de conception (tokens, a11y)
- Widgets Orbit (ChatWidget)
- Tests UI dans `modules/{module}/tests/`

---

### Skill 3 : `somtech-backend`
**Description** : Développement Backend API/Supabase/Edge Functions

**Triggers** : endpoint, API, schema, migration, index, Supabase, Edge Function, MCP server

**Contenu** :
- Structure API et contrats OpenAPI
- Migrations DB déclaratives
- RLS Policies (toutes les règles)
- Edge Functions (conventions Deno/TypeScript)
- Serveurs MCP (conformité Agent Builder)
- Outils MCP Supabase obligatoires

---

### Skill 4 : `somtech-qa`
**Description** : Tests, QA et validation

**Triggers** : test, e2e, non-régression, plan de test, cas limites, Playwright, console

**Contenu** :
- Plans de test basés sur specs
- Critères G/W/T (Gherkin)
- Validation navigateur (Playwright)
- Capture erreurs console
- Structure tests (`modules/{module}/tests/`, `tests/ui/`)

---

### Skill 5 : `somtech-devops`
**Description** : Docker, Railway, CI/CD, déploiement

**Triggers** : Docker, Railway, CI/CD, déploiement, env, secrets, logs, observabilité

**Contenu** :
- Dockerfiles multi-stage (non-root, healthcheck)
- Railway : workflow GitHub, outils MCP
- Edge Functions : déploiement via MCP
- Secrets externalisés
- Observabilité (logs JSON, métriques)

---

### Skill 6 : `somtech-product`
**Description** : Gestion produit, PRD, specs, user stories

**Triggers** : story, epic, PRD, valeur, roadmap, specs, speckit, critères d'acceptation

**Contenu** :
- Structure PRD maître et modules
- Workflow Speckit (specify, plan, tasks, implement)
- User stories et critères G/W/T
- Gouvernance produit (cohérence code/tests)
- Changelogs et traçabilité

---

### Skill 7 : `somtech-design`
**Description** : UX/UI, wireframes, design system

**Triggers** : wireframe, maquette, accessibilité, design, interface, tokens, composant UI

**Contenu** :
- Charte de conception
- Design tokens et composants
- États UI (loading, vide, erreur, succès)
- Accessibilité (labels, contrastes, focus)
- Mode Prototype (`proto/` branches)

---

### Skill 8 : `somtech-database`
**Description** : Base de données, RLS, migrations, audit

**Triggers** : RLS, index, migration, SQL, Postgres, sécurité DB, audit

**Contenu** :
- Règles RLS complètes (SELECT, INSERT, UPDATE, DELETE)
- Performance RLS (indexes, `(select auth.uid())`)
- Migrations idempotentes
- Outils MCP Supabase
- Audit sécurité et performance

---

## 3. Structure Proposée

```
.skills/
  somtech/
    SKILL.md              ← Index des skills Somtech
    orchestrator/
      SKILL.md            ← Skill orchestrateur
    frontend/
      SKILL.md            ← Skill frontend
    backend/
      SKILL.md            ← Skill backend
    qa/
      SKILL.md            ← Skill QA
    devops/
      SKILL.md            ← Skill DevOps
    product/
      SKILL.md            ← Skill produit
    design/
      SKILL.md            ← Skill design
    database/
      SKILL.md            ← Skill database
```

---

## 4. Mapping Rules → Skills

| Règle Cursor | Skill Proposé |
|--------------|---------------|
| `00_orchestrator.mdc` | `somtech-orchestrator` |
| `00-git-main-protection.mdc` | **claude.md** (global) |
| `00-module-structure.mdc` | **claude.md** (global) |
| `01_product_owner.mdc` | `somtech-product` |
| `02_analyste_fonctionnel.mdc` | `somtech-product` |
| `03_ux_ui_designer.mdc` | `somtech-design` |
| `04_dev_frontend.mdc` | `somtech-frontend` |
| `05_dev_backend.mdc` | `somtech-backend` |
| `06_qa_testeur.mdc` | `somtech-qa` |
| `07_QA_cartographe.mdc` | `somtech-qa` |
| `08_devOps.mdc` | `somtech-devops` |
| `09_Gouvernance_Produit.mdc` | `somtech-product` |
| `10_docs_maintainer.mdc` | `somtech-product` |
| `11_rls_db_auditor.mdc` | `somtech-database` |
| `12_observability_analytics.mdc` | `somtech-devops` |
| `13_design_librarian.mdc` | `somtech-design` |
| `14_prototype_mode.mdc` | `somtech-design` |
| `15_widgets_chatkit.mdc` | `somtech-frontend` |
| `browser-validation-strategy.mdc` | `somtech-qa` + `somtech-frontend` |
| `create-rls-policies.mdc` | `somtech-database` |
| `supabase-mcp.mdc` | `somtech-backend` + `somtech-database` |
| `writing-supabase-edge-functions.mdc` | `somtech-backend` |
| `mcp-context7.mdc` | **claude.md** (global) |

---

## 5. Prochaines Étapes

1. **Valider** cette proposition avec toi
2. **Créer le fichier `CLAUDE.md`** à la racine du projet
3. **Créer les 8 skills** dans `.skills/somtech/`
4. **Tester** les skills avec des cas d'usage réels
5. **Itérer** selon les retours

---

## Questions pour Toi

1. Veux-tu que je crée immédiatement le `CLAUDE.md` et les skills ?
2. Y a-t-il des règles que tu voudrais prioriser ou exclure ?
3. Préfères-tu moins de skills (consolidation) ou plus de granularité ?
4. Dois-je inclure des exemples de code dans chaque skill ?
