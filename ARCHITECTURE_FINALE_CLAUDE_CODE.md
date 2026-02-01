# Architecture Finale Complète : Claude Code pour Somtech

## Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLAUDE.md                               │
│                    (Règles globales - Mémoire)                  │
└─────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Sub-agents    │  │     Skills      │  │     Hooks       │
│   (Personas)    │  │  (Procédures)   │  │  (Automation)   │
│                 │  │                 │  │                 │
│ • frontend.md   │  │ • scaffold-*    │  │ • PreToolUse    │
│ • backend.md    │  │ • create-*      │  │ • PostToolUse   │
│ • qa.md         │  │ • audit-*       │  │ • Stop          │
│ • ...           │  │ • validate-*    │  │                 │
└────────┬────────┘  └────────┬────────┘  └─────────────────┘
         │                    │
         │    skills: [...]   │
         └────────────────────┘
            Préchargement
```

---

## Option 1 : Configuration Projet (Recommandée pour démarrer)

```
projet/
├── CLAUDE.md                          ← Règles globales
├── .claude/
│   ├── settings.json                  ← Hooks globaux
│   ├── agents/                        ← Sub-agents
│   │   ├── frontend.md
│   │   ├── backend.md
│   │   ├── qa.md
│   │   ├── product.md
│   │   ├── design.md
│   │   ├── devops.md
│   │   └── database.md
│   └── skills/                        ← Skills
│       ├── scaffold-component/
│       │   └── SKILL.md
│       ├── scaffold-mcp/
│       │   └── SKILL.md
│       ├── create-migration/
│       │   ├── SKILL.md
│       │   └── scripts/
│       │       └── migration-template.sql
│       ├── audit-rls/
│       │   ├── SKILL.md
│       │   └── scripts/
│       │       └── check-rls.sql
│       ├── speckit/
│       │   └── SKILL.md
│       └── validate-ui/
│           └── SKILL.md
```

---

## Option 2 : Plugin Distribuable

```
somtech-plugin/
├── .claude-plugin/
│   └── plugin.json                    ← Manifest du plugin
├── agents/                            ← Sub-agents
│   ├── frontend.md
│   ├── backend.md
│   └── ...
├── skills/                            ← Skills
│   ├── scaffold-component/
│   │   └── SKILL.md
│   └── ...
├── hooks/
│   └── hooks.json                     ← Hooks du plugin
└── README.md
```

**plugin.json** :
```json
{
  "name": "somtech",
  "description": "Plugin de développement Somtech - React/Supabase/Tailwind",
  "version": "1.0.0",
  "author": {
    "name": "Somtech"
  }
}
```

**Utilisation** : `/somtech:scaffold-component`, `/somtech:audit-rls`

---

## 1. CLAUDE.md (Mémoire Globale)

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
- Opérations DB via **outils MCP Supabase** uniquement
- Edge Functions déployées via MCP

### Validation UI
Après modification UI : confirmer **0 erreur console**.

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
  TRIGGERS : composant, React, hook, formulaire, page, UI, widget, Tailwind
  Utiliser proactivement pour modifications UI.
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
skills:
  - scaffold-component
  - validate-ui
---

# Agent Frontend ⚛️

## Persona
- **Rôle** : UI fiable & maintenable
- **Style** : Typé, testé, accessible

## Structure
- `src/components/{module}/` — Composants
- `src/pages/` — Pages
- `src/hooks/` — Hooks

## Règles
- Props typées, états (loading/vide/erreur/succès)
- `data-testid` sur éléments critiques
- **0 erreur console** avant de terminer

## DoD
- [ ] Accessibilité OK
- [ ] Tests passent
- [ ] 0 erreur console
```

---

### `.claude/agents/backend.md`

```markdown
---
name: backend
description: |
  Développeur Backend API/Supabase/Edge Functions/MCP.
  TRIGGERS : endpoint, API, migration, schema, Edge Function, MCP server
  Utiliser proactivement pour modifications backend.
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
skills:
  - create-migration
  - scaffold-mcp
  - audit-rls
---

# Agent Backend 🛠️

## Persona
- **Rôle** : Services sûrs et stables
- **Style** : Contract-first, idempotent

## Règles Critiques
- **MCP Supabase** pour toutes opérations DB
- **MCP pour déployer** Edge Functions
- RLS obligatoire sur tables exposées

## DoD
- [ ] Contrats API à jour
- [ ] RLS défini
- [ ] PRD module mis à jour
```

---

### `.claude/agents/qa.md`

```markdown
---
name: qa
description: |
  QA Testeur. Tests, validation console, Playwright.
  TRIGGERS : test, e2e, validation, console, QA, non-régression
  Utiliser proactivement après modifications.
tools: Read, Bash, Grep, Glob
model: inherit
skills:
  - validate-ui
---

# Agent QA ✅

## Persona
- **Rôle** : Qualité et non-régression
- **Style** : Méthodique, basé sur specs

## Validation Console (OBLIGATOIRE)
1. Naviguer vers la page
2. Capturer logs console (type: "error")
3. Confirmer **0 erreur**

## DoD
- [ ] 0 erreur console confirmé
- [ ] Tests passent
```

---

### `.claude/agents/product.md`

```markdown
---
name: product
description: |
  Product Owner & Analyste. PRD, specs, user stories, Speckit.
  TRIGGERS : story, epic, PRD, spec, speckit, critères, G/W/T
tools: Read, Edit, Write, Grep, Glob
model: inherit
skills:
  - speckit
---

# Agent Product 📋

## Persona
- **Rôle** : Valeur et spécifications
- **Style** : Orienté valeur, traçable

## Structure
- `docs/PRD.md` — PRD maître
- `modules/{module}/prd/` — PRD modules
- `specs/{numero}-{nom}/` — Specs Speckit

## Workflow Speckit
- `/speckit:specify` → Créer spec
- `/speckit:plan` → Plan technique
- `/speckit:tasks` → Tâches ordonnées
```

---

### `.claude/agents/database.md`

```markdown
---
name: database
description: |
  DBA / RLS Auditor. Politiques RLS, migrations, audit.
  TRIGGERS : RLS, policy, index, audit DB, sécurité, migration
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
skills:
  - create-migration
  - audit-rls
---

# Agent Database 🗄️

## Persona
- **Rôle** : Sécurité et performance DB
- **Style** : Rigoureux

## Règles RLS
| Opération | USING | WITH CHECK |
|-----------|-------|------------|
| SELECT | ✅ | ❌ |
| INSERT | ❌ | ✅ |
| UPDATE | ✅ | ✅ |
| DELETE | ✅ | ❌ |

- `to authenticated` obligatoire
- `(select auth.uid())` pour performance
```

---

## 3. Skills (Procédures)

### `.claude/skills/scaffold-component/SKILL.md`

```markdown
---
name: scaffold-component
description: |
  Créer un composant React/TypeScript/Tailwind.
  TRIGGERS : créer composant, scaffold-ui, nouveau composant
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Glob
---

# Scaffold Component React

## Procédure

1. **Vérifier** si composant similaire existe :
   ```bash
   find src/components -name "*.tsx" | head -20
   ```

2. **Créer** le fichier avec structure :

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

3. **Ajouter** `data-testid` sur éléments critiques

4. **Valider** avec `/validate-ui`
```

---

### `.claude/skills/create-migration/SKILL.md`

```markdown
---
name: create-migration
description: |
  Créer une migration Supabase avec RLS.
  TRIGGERS : migration, créer table, modifier schema, nouvelle table
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Bash
---

# Create Migration Supabase

## Procédure

1. **Vérifier** les migrations existantes :
   ```bash
   ls -la supabase/migrations/
   ```

2. **Créer** le fichier migration :

```sql
-- Migration: {nom}
-- Description: {description}

-- Table
create table if not exists {table_name} (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table {table_name} enable row level security;

-- Policies (selon opérations nécessaires)
create policy "{table}_select_own"
on {table_name} for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "{table}_insert_own"
on {table_name} for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Indexes
create index if not exists idx_{table}_user_id
on {table_name}(user_id);
```

3. **Appliquer** via MCP Supabase

4. **Mettre à jour** le PRD module
```

---

### `.claude/skills/audit-rls/SKILL.md`

```markdown
---
name: audit-rls
description: |
  Auditer les policies RLS d'une table ou du projet.
  TRIGGERS : audit-rls, vérifier RLS, sécurité DB, check policies
disable-model-invocation: false
allowed-tools: Read, Bash, Grep
---

# Audit RLS Policies

## Procédure

1. **Lister** les tables sans RLS :

```sql
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT DISTINCT tablename FROM pg_policies
);
```

2. **Vérifier** les policies existantes :

```sql
SELECT
  tablename,
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

3. **Valider** les règles :
   - SELECT → USING uniquement (pas WITH CHECK)
   - INSERT → WITH CHECK uniquement (pas USING)
   - UPDATE → USING + WITH CHECK
   - DELETE → USING uniquement

4. **Vérifier** les indexes sur colonnes RLS :

```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexdef LIKE '%user_id%';
```

5. **Rapport** :
   - ❌ Tables sans RLS
   - ⚠️ Policies mal configurées
   - ⚠️ Indexes manquants
   - ✅ Tables conformes
```

---

### `.claude/skills/validate-ui/SKILL.md`

```markdown
---
name: validate-ui
description: |
  Valider l'interface et capturer les erreurs console.
  TRIGGERS : validate-ui, vérifier console, 0 erreur, validation UI
disable-model-invocation: false
---

# Validate UI

## Procédure

1. **Naviguer** vers la page modifiée
2. **Interagir** avec les éléments (si applicable)
3. **Capturer** les logs console (type: "error")
4. **Analyser** les erreurs détectées

## Si erreurs détectées

1. Identifier la cause (stack trace)
2. Corriger le code
3. **Revalider** (retour à l'étape 1)
4. Répéter jusqu'à 0 erreur

## Output

- ✅ **0 erreur console** — Validation OK
- ❌ **N erreurs détectées** :
  - Erreur 1 : [description] — [fichier:ligne]
  - Erreur 2 : ...
```

---

### `.claude/skills/speckit/SKILL.md`

```markdown
---
name: speckit
description: |
  Workflow Speckit : specify, plan, tasks, implement.
  TRIGGERS : speckit, spec, spécification, plan technique, créer spec
disable-model-invocation: true
argument-hint: [specify|plan|tasks|implement] [feature-name]
---

# Workflow Speckit

## Commandes

### `/speckit specify <nom>`

Créer `specs/{numero}-{nom}/spec.md` :

```markdown
# Spécification : {nom}

## Contexte
[Description du besoin]

## User Stories

### US-1 : [Titre]
**En tant que** [persona]
**Je veux** [action]
**Afin de** [bénéfice]

#### Critères d'acceptation
- [ ] **Given** [contexte] **When** [action] **Then** [résultat]

## Contraintes
- [Contraintes techniques/métier]

## Dépendances
- [Modules/features liés]
```

### `/speckit plan <feature>`

Créer `specs/{feature}/plan.md` :
- Architecture proposée
- `contracts/api-spec.json` (si API)
- `data-model.md` (si DB)

### `/speckit tasks <feature>`

Créer `specs/{feature}/tasks.md` :
- Tâches ordonnées par dépendances
- Estimation de complexité (S/M/L)

### `/speckit implement <feature>`

1. Lire `spec.md` et `plan.md`
2. Suivre les tâches dans l'ordre de `tasks.md`
3. Cocher chaque tâche terminée
4. Valider avec tests et validation UI
```

---

## 4. Hooks (Automatisation)

### `.claude/settings.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo '⚠️ Fichier modifié - Pensez à valider avec /validate-ui'"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "frontend|backend",
        "hooks": [
          {
            "type": "command",
            "command": "echo '✅ Agent terminé - Vérifiez le DoD'"
          }
        ]
      }
    ]
  }
}
```

---

## 5. Mapping Cursor → Claude Code

| Cursor | Claude Code | Fichier |
|--------|-------------|---------|
| `alwaysApply: true` | `CLAUDE.md` | Racine |
| Agents (personas) | Sub-agents | `.claude/agents/*.md` |
| Commandes `*scaffold-ui` | Skills | `.claude/skills/*/SKILL.md` |
| Commandes `/speckit.*` | Skills avec `argument-hint` | `.claude/skills/speckit/SKILL.md` |
| Hooks | Hooks | `.claude/settings.json` |

---

## 6. Flux de Travail

```
Utilisateur: "Crée un composant pour afficher les clients"
     │
     ▼
Claude analyse → Délègue au sub-agent "frontend"
     │
     ▼
Sub-agent frontend s'active
  ├── Contexte : CLAUDE.md + frontend.md
  ├── Skills préchargés : scaffold-component, validate-ui
     │
     ▼
Exécute skill "scaffold-component"
     │
     ▼
Exécute skill "validate-ui"
     │
     ▼
Hook PostToolUse (si fichier modifié)
     │
     ▼
Résultat retourne à la conversation principale
```

---

## 7. Prochaines Étapes

1. **Créer** la structure `.claude/` avec agents et skills
2. **Créer** le `CLAUDE.md` à la racine
3. **Tester** avec des cas réels
4. **Optionnel** : Convertir en plugin pour distribution

---

## Questions

1. **Veux-tu que je crée tous ces fichiers maintenant ?**
2. **Option 1 (projet) ou Option 2 (plugin) ?**
3. **Y a-t-il des agents ou skills à ajouter/modifier ?**
