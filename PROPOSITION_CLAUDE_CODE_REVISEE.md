# Proposition Révisée : CLAUDE.md et Skills pour Claude Code

## Principes Appliqués (tirés du skill-creator)

1. **Concision** : Claude est déjà intelligent — inclure uniquement ce qu'il ne sait pas
2. **Progressive Disclosure** : SKILL.md léger, références séparées par domaine
3. **Description = Trigger** : Le frontmatter `description` déclenche le skill
4. **Scripts pour tâches répétitives** : Code exécutable plutôt que réécrit à chaque fois
5. **Pas de docs auxiliaires** : Pas de README, CHANGELOG, etc.

---

## 1. CLAUDE.md (à la racine du projet)

Le fichier `CLAUDE.md` contient les règles **globales** applicables à toutes les tâches.

```markdown
# CLAUDE.md — Somtech

## Contexte

Application SaaS de gestion d'entreprise. Stack : React/TypeScript, Supabase, Tailwind CSS.

## Règles Critiques

### Git
- **Jamais de push sur `main`** — toujours via branche + PR
- Branches : `feat/*`, `fix/*`, `chore/*`, `proto/*`
- Commits : `type(scope): description`

### Architecture Modulaire
```
modules/{module}/
  mcp/      ← Serveur MCP Railway
  prd/      ← Product Requirements
  tests/    ← Tests spécifiques
```

### Validation UI Obligatoire
Après toute modification UI :
1. Vérifier visuellement
2. Capturer logs console (erreurs)
3. Confirmer **0 erreur** avant de terminer

### Supabase
- Toutes opérations DB via **outils MCP Supabase** (jamais CLI directe)
- Edge Functions déployées via MCP uniquement

### Qualité > Vitesse
Poser des questions plutôt que supposer. Analyser avant d'agir.
```

---

## 2. Architecture des Skills Révisée

**Approche : 1 skill principal + références par domaine** (Pattern 2 du guide)

Cela évite la fragmentation et utilise la progressive disclosure efficacement.

```
.skills/
  somtech/
    SKILL.md                    ← Skill principal (~200 lignes)
    references/
      frontend.md               ← React, composants, widgets
      backend.md                ← API, Edge Functions, MCP servers
      database.md               ← RLS, migrations, audit
      qa.md                     ← Tests, Playwright, validation
      devops.md                 ← Docker, Railway, CI/CD
      product.md                ← PRD, Speckit, specs
      design.md                 ← UX/UI, tokens, accessibilité
    scripts/
      validate-rls.sql          ← Script validation RLS
      check-console-errors.sh   ← Script capture erreurs console
    assets/
      component-template.tsx    ← Template composant React
      edge-function-template.ts ← Template Edge Function
```

---

## 3. Contenu du Skill Principal

### `somtech/SKILL.md`

```markdown
---
name: somtech
description: |
  Développement logiciel sur mesure pour Somtech. Stack : React/TypeScript, Supabase, Tailwind CSS.

  MANDATORY TRIGGERS :
  - Modifications UI : React, composant, Tailwind, hook, formulaire, page, interface
  - Backend : API, endpoint, Edge Function, MCP server, schema, migration
  - Database : RLS, policy, index, SQL, Supabase, audit
  - Tests : test, e2e, Playwright, validation, console, QA
  - DevOps : Docker, Railway, déploiement, CI/CD, logs
  - Produit : PRD, spec, story, epic, Speckit, critères d'acceptation
  - Design : wireframe, UX, accessibilité, tokens, design system
---

# Somtech Development

## Workflow Standard

1. **Analyser** la demande et identifier le domaine
2. **Charger** la référence appropriée (voir ci-dessous)
3. **Exécuter** selon les règles du domaine
4. **Valider** selon les critères de qualité

## Références par Domaine

| Demande | Référence à charger |
|---------|---------------------|
| Composants React, UI, Tailwind | [references/frontend.md](references/frontend.md) |
| API, Edge Functions, MCP | [references/backend.md](references/backend.md) |
| RLS, migrations, SQL | [references/database.md](references/database.md) |
| Tests, Playwright, console | [references/qa.md](references/qa.md) |
| Docker, Railway, déploiement | [references/devops.md](references/devops.md) |
| PRD, specs, stories | [references/product.md](references/product.md) |
| UX, wireframes, tokens | [references/design.md](references/design.md) |

## Scripts Disponibles

- `scripts/validate-rls.sql` — Valider les policies RLS d'une table
- `scripts/check-console-errors.sh` — Capturer les erreurs console

## Règles Transversales

### Validation UI (OBLIGATOIRE)
Après toute modification UI, confirmer **0 erreur console** avant de terminer.

### RLS (OBLIGATOIRE)
Toute table exposée doit avoir des policies RLS. Voir [references/database.md](references/database.md).

### Documentation (OBLIGATOIRE)
Mettre à jour le PRD module si modification de fonctionnalité. Voir [references/product.md](references/product.md).
```

---

## 4. Contenu des Références

### `references/frontend.md` (~150 lignes)

```markdown
# Frontend — React/TypeScript/Tailwind

## Structure
- Composants : `src/components/{module}/`
- Pages : `src/pages/`
- Hooks : `src/hooks/`
- Types : `src/types/`

## Conventions

### Composants
- Fonctionnels avec hooks
- Props typées avec interface
- Sélecteurs `data-testid` pour éléments critiques
- États : loading, vide, erreur, succès

### Exemple minimal
```tsx
interface Props {
  title: string;
  onSubmit: (data: FormData) => void;
}

export function MyComponent({ title, onSubmit }: Props) {
  const [loading, setLoading] = useState(false);
  // ...
}
```

## Widgets Orbit
Contrat : `agentbuilder/WIDGETS_CONTRACT.md`
Types : `src/types/chat.ts`
Renderer : `src/components/chat/ChatWidget.tsx`

## Validation
1. Vérifier visuellement l'interface
2. Capturer les logs console (type: "error")
3. Confirmer 0 erreur avant de terminer
```

### `references/backend.md` (~150 lignes)

```markdown
# Backend — API/Supabase/Edge Functions

## Edge Functions

### Conventions
- Dossier : `supabase/functions/{nom}/`
- Point d'entrée : `index.ts`
- Runtime : Deno/TypeScript

### Déploiement
**TOUJOURS** utiliser l'outil MCP Supabase :
```
mcp_supabase_deploy_edge_function
```

### Template
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  // Implémenter /sse pour compatibilité Agent Builder
  if (req.url.endsWith("/sse")) {
    return handleSSE(req);
  }
  // ...
});
```

## MCP Servers
- Conformité Agent Builder : `mcp-agent-builder-compliance.mdc`
- Déploiement Railway : via GitHub (pas `railway up` local)

## Outils MCP
- `list_tables`, `list_migrations`, `apply_migration`
- `execute_sql` (lecture/DML uniquement)
- `deploy_edge_function` ← OBLIGATOIRE
```

### `references/database.md` (~200 lignes)

```markdown
# Database — RLS/Migrations/Audit

## Outils MCP (OBLIGATOIRES)
Toutes opérations via MCP Supabase, jamais CLI directe.

## RLS Policies

### Règles par opération
| Opération | USING | WITH CHECK |
|-----------|-------|------------|
| SELECT | ✅ | ❌ |
| INSERT | ❌ | ✅ |
| UPDATE | ✅ | ✅ |
| DELETE | ✅ | ❌ |

### Conventions
- Toujours spécifier `to authenticated`
- Utiliser `(select auth.uid())` pour performance (pas `auth.uid()` direct)
- Nommage : `{table}_{operation}_policy`

### Exemple
```sql
create policy "users_select_own"
on users for select
to authenticated
using ((select auth.uid()) = id);

create policy "users_insert_own"
on users for insert
to authenticated
with check ((select auth.uid()) = id);
```

## Migrations
- Déclaratives et idempotentes
- Via MCP : `apply_migration`
- Fichiers : `supabase/migrations/`

## Audit
Vérifier périodiquement :
- Tables sans RLS
- Policies manquantes
- Performance (indexes sur colonnes RLS)
```

### `references/qa.md` (~100 lignes)

```markdown
# QA — Tests/Playwright/Validation

## Validation Console (OBLIGATOIRE)

Après toute modification UI :
1. Naviguer vers la page modifiée
2. Capturer logs console (type: "error")
3. Confirmer **0 erreur**
4. Si erreurs → Corriger → Revalider

## Tests Playwright

### Structure
- Tests : `tests/ui/**/*.spec.ts`
- Page Objects : `page-objects/**/*.ts`
- Config : `playwright.config.ts`

### Commandes
```bash
npx playwright test           # Tous les tests
npx playwright test --ui      # Mode interactif
```

## Plans de Test
Basés sur `specs/{feature}/spec.md`
Format G/W/T (Given/When/Then)
```

### `references/devops.md` (~100 lignes)

```markdown
# DevOps — Docker/Railway/CI-CD

## Railway

### Workflow
1. Créer branche
2. Ouvrir PR
3. Merge → Déploiement automatique

**JAMAIS** `railway up` en local.

### Outils MCP
- `list-projects`, `list-services`
- `get-logs`, `set-variables`
- `list-deployments`

## Docker

### Bonnes pratiques
- Multi-stage builds
- User non-root
- Healthcheck
- Secrets externalisés (pas dans l'image)

## Observabilité
- Logs JSON structurés
- Pas de données sensibles dans les logs
```

### `references/product.md` (~100 lignes)

```markdown
# Produit — PRD/Specs/Stories

## Structure Documentation
- PRD maître : `docs/PRD.md`
- PRD modules : `modules/{module}/prd/{module}.md`
- Specs features : `specs/{numero}-{nom}/spec.md`

## Workflow Speckit
1. `/speckit.specify` → Créer spec
2. `/speckit.plan` → Plan technique
3. `/speckit.tasks` → Tâches ordonnées
4. `/speckit.implement` → Implémenter

## Mise à jour PRD (OBLIGATOIRE)
Mettre à jour si modification de :
- Fonctionnalités, règles métier
- User stories, critères d'acceptation
- Flux & états, modèle de données
```

### `references/design.md` (~80 lignes)

```markdown
# Design — UX/UI/Tokens

## Charte de Conception
Fichier : `Charte_de_conception.mdc`
Tokens : `DocExample/design_charter.yaml`

## États UI
Toujours couvrir :
- Loading (skeleton, spinner)
- Vide (message explicatif)
- Erreur (message + action)
- Succès (confirmation)

## Accessibilité
- Labels sur tous les inputs
- Contrastes suffisants
- Navigation clavier
- Messages d'erreur clairs

## Mode Prototype
Branches `proto/*` pour expérimentations
Pas de merge sur main sans validation
```

---

## 5. Scripts

### `scripts/validate-rls.sql`

```sql
-- Valider les policies RLS d'une table
-- Usage: Remplacer {TABLE_NAME} par le nom de la table

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE tablename = '{TABLE_NAME}';

-- Vérifier si RLS est activé
SELECT
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = '{TABLE_NAME}';
```

### `scripts/check-console-errors.sh`

```bash
#!/bin/bash
# Capture les erreurs console via Playwright MCP
# Ce script est un aide-mémoire des commandes à utiliser

echo "Pour capturer les erreurs console, utiliser les outils MCP Playwright :"
echo ""
echo "1. Naviguer : mcp_playwright_playwright_navigate"
echo "2. Capturer : mcp_playwright_playwright_console_logs (type: 'error')"
echo "3. Vérifier : 0 erreur attendue"
echo ""
echo "Si erreurs détectées → Corriger → Revalider"
```

---

## 6. Comparaison avec la Proposition Initiale

| Aspect | Proposition Initiale | Proposition Révisée |
|--------|---------------------|---------------------|
| Nombre de skills | 8 skills séparés | 1 skill + 7 références |
| Taille SKILL.md | ~500+ lignes chacun | ~200 lignes total |
| Progressive Disclosure | Non | Oui (références par domaine) |
| Scripts réutilisables | Non | Oui (SQL, bash) |
| Déclenchement | Triggers séparés | 1 description complète |
| Maintenance | 8 fichiers à maintenir | 1 skill + références |

---

## 7. Prochaines Étapes

1. **Valider** cette architecture avec toi
2. **Créer** le fichier `CLAUDE.md` à la racine
3. **Créer** le skill `somtech/` avec ses références
4. **Tester** avec des cas d'usage réels
5. **Itérer** selon les retours

---

## Questions

1. Cette architecture te convient-elle ?
2. Y a-t-il des domaines à fusionner ou séparer davantage ?
3. Veux-tu que je crée le skill maintenant ?
