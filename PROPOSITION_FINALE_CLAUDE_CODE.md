# Architecture Finale : Claude Code pour Somtech

## Mapping Cursor → Claude Code

| Cursor | Claude Code | Emplacement |
|--------|-------------|-------------|
| Règles globales (`alwaysApply: true`) | `CLAUDE.md` | Racine du projet |
| Agents (Frontend, Backend, QA...) | **Sub-agents** | `.claude/agents/` |
| Commandes (`*scaffold-ui`, etc.) | **Skills** | `.skills/` |

---

## Structure Finale

```
projet/
├── CLAUDE.md                      ← Règles globales
├── .claude/
│   └── agents/                    ← Sub-agents (personas)
│       ├── frontend.md
│       ├── backend.md
│       ├── qa.md
│       ├── product.md
│       ├── design.md
│       ├── devops.md
│       └── database.md
└── .skills/
    └── somtech/                   ← Skills (procédures)
        ├── scaffold-component/
        │   └── SKILL.md
        ├── scaffold-mcp/
        │   └── SKILL.md
        ├── create-migration/
        │   └── SKILL.md
        ├── audit-rls/
        │   └── SKILL.md
        ├── speckit/
        │   └── SKILL.md
        └── validate-ui/
            └── SKILL.md
```

---

## 1. CLAUDE.md (Règles Globales)

```markdown
# CLAUDE.md — Somtech

## Contexte
Application SaaS de gestion d'entreprise.
Stack : React/TypeScript, Supabase, Tailwind CSS.

## Règles Critiques

### Git
- **Jamais de push sur `main`** — toujours via branche + PR
- Branches : `feat/*`, `fix/*`, `chore/*`, `proto/*`

### Architecture Modulaire
```
modules/{module}/
  mcp/      ← Serveur MCP Railway
  prd/      ← Product Requirements
  tests/    ← Tests spécifiques
```

### Supabase
- Toutes opérations DB via **outils MCP Supabase** (jamais CLI directe)
- Edge Functions déployées via MCP uniquement

### Validation UI
Après toute modification UI : confirmer **0 erreur console**.

### Qualité > Vitesse
Poser des questions plutôt que supposer.
```

---

## 2. Sub-Agents (Personas)

### `.claude/agents/frontend.md`

```markdown
---
name: frontend
description: |
  Développeur Frontend React/TypeScript/Tailwind.
  Utiliser pour : composants, hooks, formulaires, pages, UI, widgets, validation client.
  Utiliser proactivement après toute demande de modification UI.
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
skills:
  - somtech/scaffold-component
  - somtech/validate-ui
---

# Agent : Développeur Frontend ⚛️

## Persona
- **Rôle** : Construire une UI fiable & maintenable
- **Style** : Typé, testé, accessible
- **Principes** : Qualité > Vitesse. Poser des questions plutôt que supposer.

## Structure
```
src/components/{module}/   ← Composants
src/pages/                 ← Pages
src/hooks/                 ← Hooks
src/types/                 ← Types
```

## Règles
- Props typées avec interface
- États : loading, vide, erreur, succès
- Sélecteurs `data-testid` pour éléments critiques
- **0 erreur console** avant de terminer

## Commandes disponibles
- `*scaffold-ui <nom>` → Utiliser skill scaffold-component
- `*validate-ui` → Utiliser skill validate-ui

## DoD
- [ ] Accessibilité OK
- [ ] i18n si applicable
- [ ] Tests passent
- [ ] **0 erreur console**
```

---

### `.claude/agents/backend.md`

```markdown
---
name: backend
description: |
  Développeur Backend API/Supabase/Edge Functions/MCP.
  Utiliser pour : endpoints, migrations, schemas, Edge Functions, serveurs MCP.
  Utiliser proactivement pour toute modification backend.
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
skills:
  - somtech/create-migration
  - somtech/scaffold-mcp
  - somtech/audit-rls
---

# Agent : Développeur Backend 🛠️

## Persona
- **Rôle** : Exposer des services sûrs et stables
- **Style** : Contract-first, idempotent, traçable
- **Principes** : Qualité > Vitesse. Analyser le contexte avant d'agir.

## Structure
```
supabase/migrations/       ← Migrations DB
supabase/functions/        ← Edge Functions
modules/{module}/mcp/      ← Serveurs MCP
```

## Règles Critiques
- **MCP Supabase obligatoire** pour toutes opérations DB
- **MCP pour déployer** les Edge Functions
- RLS obligatoire sur tables exposées

## Commandes disponibles
- `*migration <nom>` → Utiliser skill create-migration
- `*scaffold-mcp <module>` → Utiliser skill scaffold-mcp
- `*audit-rls` → Utiliser skill audit-rls

## DoD
- [ ] Contrats API à jour
- [ ] Validations entrées couvertes
- [ ] RLS défini si table exposée
- [ ] PRD module mis à jour
```

---

### `.claude/agents/qa.md`

```markdown
---
name: qa
description: |
  QA Testeur. Tests, validation console, Playwright.
  Utiliser pour : tests, e2e, non-régression, validation console.
  Utiliser proactivement après modifications de code.
tools: Read, Bash, Grep, Glob
model: inherit
skills:
  - somtech/validate-ui
---

# Agent : QA Testeur ✅

## Persona
- **Rôle** : Garantir la qualité et la non-régression
- **Style** : Méthodique, exhaustif, basé sur specs
- **Principes** : Tests basés sur specs. Critères G/W/T.

## Validation Console (OBLIGATOIRE)
Après toute modification :
1. Naviguer vers la page
2. Capturer logs console (type: "error")
3. Confirmer **0 erreur**

## Commandes disponibles
- `*test-plan <feature>` → Créer plan de test
- `*validate-console` → Utiliser skill validate-ui
- `*e2e-suggest` → Suggérer tests e2e

## DoD
- [ ] Plan de test basé sur spec
- [ ] **0 erreur console** confirmé
```

---

### `.claude/agents/product.md`

```markdown
---
name: product
description: |
  Product Owner & Analyste. PRD, specs, user stories, Speckit.
  Utiliser pour : stories, epics, PRD, specs, critères d'acceptation.
tools: Read, Edit, Write, Grep, Glob
model: inherit
skills:
  - somtech/speckit
---

# Agent : Product Owner & Analyste 📋

## Persona
- **Rôle** : Définir la valeur et les spécifications
- **Style** : Orienté valeur, précis, traçable

## Structure Documentation
```
docs/PRD.md                        ← PRD maître
modules/{module}/prd/{module}.md   ← PRD par module
specs/{numero}-{nom}/              ← Specs Speckit
```

## Workflow Speckit
- `/speckit.specify` → Créer spec
- `/speckit.plan` → Plan technique
- `/speckit.tasks` → Tâches ordonnées
- `/speckit.implement` → Implémenter

## DoD
- [ ] User stories avec critères G/W/T
- [ ] PRD module à jour
```

---

### `.claude/agents/database.md`

```markdown
---
name: database
description: |
  DBA / RLS Auditor. Politiques RLS, migrations, audit sécurité.
  Utiliser pour : RLS, policies, indexes, audit DB, sécurité.
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
skills:
  - somtech/create-migration
  - somtech/audit-rls
---

# Agent : Database / RLS Auditor 🗄️

## Persona
- **Rôle** : Garantir sécurité et performance DB
- **Style** : Rigoureux, sécuritaire

## Règles RLS

| Opération | USING | WITH CHECK |
|-----------|-------|------------|
| SELECT | ✅ | ❌ |
| INSERT | ❌ | ✅ |
| UPDATE | ✅ | ✅ |
| DELETE | ✅ | ❌ |

### Conventions
- `to authenticated` obligatoire
- `(select auth.uid())` pour performance
- Nommage : `{table}_{operation}_policy`

## Commandes disponibles
- `*audit-rls` → Utiliser skill audit-rls
- `*migration` → Utiliser skill create-migration

## DoD
- [ ] Toutes tables avec RLS
- [ ] Indexes sur colonnes RLS
```

---

### `.claude/agents/devops.md`

```markdown
---
name: devops
description: |
  DevOps. Docker, Railway, CI/CD, déploiement.
  Utiliser pour : Docker, Railway, déploiement, logs, observabilité.
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
---

# Agent : DevOps 🚀

## Persona
- **Rôle** : Infrastructure et déploiement
- **Style** : Automatisé, observable, sécurisé

## Railway
- Workflow : branche → PR → merge → déploiement auto
- **JAMAIS** `railway up` en local

## Docker
- Multi-stage builds
- User non-root
- Healthcheck
- Secrets externalisés

## DoD
- [ ] Déploiement via GitHub
- [ ] Logs JSON structurés
- [ ] Pas de secrets dans l'image
```

---

### `.claude/agents/design.md`

```markdown
---
name: design
description: |
  UX/UI Designer. Wireframes, accessibilité, design system.
  Utiliser pour : wireframes, maquettes, accessibilité, tokens, ergonomie.
tools: Read, Edit, Write, Grep, Glob
model: inherit
---

# Agent : UX/UI Designer 🎨

## Persona
- **Rôle** : Concevoir des interfaces utiles & utilisables
- **Style** : Empathique, pragmatique, cohérent

## États UI
Toujours couvrir : loading, vide, erreur, succès

## Accessibilité
- Labels sur tous les inputs
- Contrastes suffisants
- Navigation clavier

## Commandes disponibles
- `*create-wireframe` → Wireframe textuel
- `*page-review` → Revue accessibilité
- `*variants` → 2-3 variantes d'écran

## DoD
- [ ] États alternatifs présents
- [ ] A11y validée
```

---

## 3. Skills (Procédures)

### `.skills/somtech/scaffold-component/SKILL.md`

```markdown
---
name: scaffold-component
description: |
  Créer un composant React/TypeScript/Tailwind.
  TRIGGERS : scaffold-ui, créer composant, nouveau composant
---

# Scaffold Component React

## Procédure

1. **Vérifier** si composant similaire existe dans `src/components/`
2. **Créer** le fichier avec la structure suivante :

```tsx
interface Props {
  // Props typées
}

export function ComponentName({ ...props }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div data-testid="component-name">
      {/* Contenu */}
    </div>
  );
}
```

3. **Ajouter** les sélecteurs `data-testid` sur éléments critiques
4. **Valider** avec le skill validate-ui
```

---

### `.skills/somtech/create-migration/SKILL.md`

```markdown
---
name: create-migration
description: |
  Créer une migration Supabase avec RLS.
  TRIGGERS : migration, créer table, modifier schema
---

# Create Migration Supabase

## Procédure

1. **Vérifier** les migrations existantes dans `supabase/migrations/`
2. **Créer** le fichier migration :

```sql
-- Migration: {nom}
-- Description: {description}

-- Table
create table if not exists {table_name} (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table {table_name} enable row level security;

-- Policies
create policy "{table}_select_policy"
on {table_name} for select
to authenticated
using ((select auth.uid()) = user_id);

-- Indexes
create index if not exists idx_{table}_user_id on {table_name}(user_id);
```

3. **Appliquer** via MCP Supabase : `apply_migration`
4. **Mettre à jour** le PRD module
```

---

### `.skills/somtech/audit-rls/SKILL.md`

```markdown
---
name: audit-rls
description: |
  Auditer les policies RLS d'une table ou du projet.
  TRIGGERS : audit-rls, vérifier RLS, sécurité DB
---

# Audit RLS Policies

## Procédure

1. **Lister** les tables sans RLS :
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_policies
);
```

2. **Vérifier** chaque table exposée :
```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = '{table}';
```

3. **Valider** les règles :
   - SELECT → USING uniquement
   - INSERT → WITH CHECK uniquement
   - UPDATE → USING + WITH CHECK
   - DELETE → USING uniquement

4. **Vérifier** les indexes sur colonnes RLS

5. **Rapport** : tables sans RLS, policies manquantes, indexes manquants
```

---

### `.skills/somtech/validate-ui/SKILL.md`

```markdown
---
name: validate-ui
description: |
  Valider l'interface et capturer les erreurs console.
  TRIGGERS : validate-ui, vérifier console, 0 erreur
---

# Validate UI

## Procédure

1. **Naviguer** vers la page modifiée
2. **Interagir** avec les éléments (si applicable)
3. **Capturer** les logs console (type: "error")
4. **Analyser** les erreurs détectées
5. **Confirmer** 0 erreur ou lister les erreurs à corriger

## Si erreurs détectées
1. Identifier la cause (stack trace)
2. Corriger le code
3. **Revalider** (retour à l'étape 1)
4. Confirmer 0 erreur

## Output attendu
- ✅ 0 erreur console — Validation OK
- ❌ N erreurs détectées — Liste des erreurs avec causes
```

---

### `.skills/somtech/speckit/SKILL.md`

```markdown
---
name: speckit
description: |
  Workflow Speckit complet : specify, plan, tasks, implement.
  TRIGGERS : speckit, spec, spécification, plan technique
---

# Workflow Speckit

## Commandes

### `/speckit.specify`
Créer `specs/{numero}-{nom}/spec.md` avec :
- User stories
- Critères d'acceptation (G/W/T)
- Contraintes et dépendances

### `/speckit.plan`
Créer `specs/{feature}/plan.md` avec :
- Architecture proposée
- `contracts/api-spec.json` (si API)
- `data-model.md` (si DB)

### `/speckit.tasks`
Créer `specs/{feature}/tasks.md` avec :
- Tâches ordonnées par dépendances
- Estimation de complexité

### `/speckit.implement`
Implémenter selon `tasks.md` :
1. Lire spec.md et plan.md
2. Suivre les tâches dans l'ordre
3. Cocher chaque tâche terminée
```

---

## 4. Résumé de l'Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLAUDE.md                          │
│              (Règles globales toujours actives)         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Sub-Agents                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │frontend │ │ backend │ │   qa    │ │ product │  ...  │
│  │  .md    │ │   .md   │ │   .md   │ │   .md   │       │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │
│       │           │           │           │             │
│       │    Chargent les skills appropriés               │
└───────┼───────────┼───────────┼───────────┼─────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
┌─────────────────────────────────────────────────────────┐
│                      Skills                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │  scaffold-   │ │   create-    │ │  validate-   │    │
│  │  component   │ │  migration   │ │     ui       │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │  audit-rls   │ │  scaffold-   │ │   speckit    │    │
│  │              │ │     mcp      │ │              │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Comment ça fonctionne

1. **Utilisateur** : "Crée un composant pour afficher les clients"
2. **Claude** détecte que c'est du frontend → délègue au **sub-agent `frontend`**
3. **Sub-agent frontend** a le skill `scaffold-component` préchargé
4. **Sub-agent** exécute la procédure du skill
5. **Sub-agent** utilise aussi `validate-ui` pour confirmer 0 erreur
6. **Résultat** retourne à la conversation principale

---

## Questions

1. **Cette architecture te convient-elle ?**
2. **Veux-tu que je crée tous ces fichiers maintenant ?**
3. **Y a-t-il des agents ou skills à ajouter/modifier ?**
