---
name: pr-workflow
description: >
  Créer des Pull Requests bien structurées, avec commits atomiques, descriptions claires,
  et lien avec les tickets. Ce skill guide l'agent dev-worker dans la création de la PR,
  le respect des conventions de commit, le processus de merge, et les métriques. Utiliser
  ce skill après code-implementation et test-writing, quand le code est prêt à être revu.
---

# PR Workflow

Une bonne PR est une conversation entre toi et ton revieweur. Elle doit être claire, self-contained, et traçable. Ce skill définit comment créer une PR qui accelere la review au lieu de la ralentir.

## Quand ce skill s'activate

- Code et tests sont terminés et validés localement
- Feature est complète selon la spec (au moins un acceptence criteria)
- Commits sont atomiques et messages décrits
- Aucune branche main locale, toujours feature branch
- Prêt à passer le flambeau au reviewer

## Étape 1 — Préparation avant le push

### Vérifier la branche

```bash
# Vérifier qu'on est sur une branche feature, pas main
git branch -a | grep "\*"  # Doit afficher: feat/invoicing-export ou fix/rls-policy

# Jamais push sur main. Si tu es sur main:
git checkout -b feat/feature-name
```

### Commits atomiques

Chaque commit doit être auto-contenu (une seule responsabilité) :

```bash
# ✅ BON : commits séparés
commit 1: feat(invoicing): create export_logs table
commit 2: feat(invoicing): add InvoiceExportButton component
commit 3: feat(invoicing): implement export-to-excel Edge Function
commit 4: test(invoicing): add export integration tests

# ❌ MAUVAIS : trop dans un commit
commit 1: feat(invoicing): implement entire export feature + tests + migrations + components
```

Voir historique :

```bash
git log --oneline origin/main..HEAD
```

Doit afficher des commits clairs et séparés, pas un charabia.

### Messages de commit

Format obligatoire : `type(scope): description`

**Types** (de CLAUDE.md) :
- `feat` : nouvelle fonctionnalité
- `fix` : bugfix
- `chore` : modifications qui ne changent pas le code (deps, config)
- `refactor` : rewrite sans changer le comportement
- `test` : ajout de tests
- `docs` : documentation

**Scope** : partie du projet affectée (invoicing, auth, rls, db)

**Description** : impératif, < 50 chars, pas de point à la fin

**Exemples** :

```bash
✅ feat(invoicing): add export to Excel
✅ fix(rls): add missing SELECT policy on invoices
✅ test(invoicing): add RLS test for export_logs
✅ chore(deps): upgrade @supabase/supabase-js to v2.39.0
✅ refactor(export): extract formatting logic into utils

❌ feat(invoicing): added the export feature with all its components and tests and migrations...
❌ Fix bug
❌ feat(invoicing): export feature (capitale en début, > 50 chars)
```

**Vérifier avant push** :

```bash
git log --format="%h %s" origin/main..HEAD | while read commit msg; do
  if ! echo "$msg" | grep -E "^[a-z]+\([a-z-]+\): [a-z]" > /dev/null; then
    echo "❌ Commit message not conventional: $msg"
  fi
done
```

## Étape 2 — Push et création de la PR

### Pousser vers le remote

```bash
git push origin feat/invoicing-export
```

GitHub devrait proposer "Create a pull request" automatiquement.

### Titre de la PR

Le titre = premier commit message (GitHub propose le commit message du premier commit) :

```
feat(invoicing): add export to Excel
```

Ne pas refaire le titre, laisser GitHub auto-remplir depuis le commit.

### Template de description PR

Remplir **complètement** le template PR (chaque section aide le revieweur) :

```markdown
## Summary

Ajouter la fonctionnalité d'export des factures en Excel pour permettre aux
utilisateurs de récupérer leurs données pour analyse externe.

## Type of change

- [x] Feature (new functionality)
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation

## Spec / Ticket

Références :
- Spec: #invoicing-export
- Related ticket: TK-150

## What changed

**Frontend:**
- ✅ New `InvoiceExportButton` component with date range picker
- ✅ New `ExportDialog` modal for export configuration
- ✅ Error handling with user-facing messages

**Backend:**
- ✅ New `export_logs` table with RLS policy
- ✅ New Edge Function `export-to-excel` to generate XLSX
- ✅ Index on `export_logs.user_id` for query performance

**Database:**
- ✅ Migration: create_export_logs table + RLS policy
- ✅ Trigger: log_export to track exports (optional future)

## Testing

Manual test steps:
1. Sign in as any user
2. Navigate to `/invoicing`
3. Click "Export to Excel" button
4. Select date range 2026-01-01 to 2026-12-31
5. Click "Export"
6. Verify file downloads with name `invoices_2026-01_2026-12.xlsx`
7. Open file and verify contains 10 invoices with columns: Date, Invoice #, Amount TTC

Automated tests:
- [x] Unit tests for `calculateInvoiceTotal` (100% coverage)
- [x] Integration tests for `export_logs` table (Insert, Select with RLS)
- [x] E2E test for export flow (Playwright)
- [x] RLS tests: user cannot see other user exports

Test results: All passing ✅

## Checklist

Before merge, ensure:

- [x] Code follows CLAUDE.md conventions (kebab-case files, PascalCase components, snake_case tables)
- [x] TypeScript strict mode: no `any` types
- [x] RLS policies added for new tables
- [x] Migration tested locally (`supabase db reset` passes)
- [x] Console errors: 0
- [x] Tests written and passing (coverage > 80%)
- [x] Commits are atomic and messages follow conventional commits
- [x] No secrets or API keys in code
- [x] Documentation updated (if applicable)

## Notes / Known Limitations

- Export limited to 10,000 rows (pagination in future PR)
- File generated in Excel format only (CSV/PDF possible in future)
- Export is synchronous (< 5s for typical dataset)

## Screenshots (if UI change)

### Before
[Screenshot of old invoice page]

### After
[Screenshot of new export button and dialog]
```

## Étape 3 — Lier avec les tickets Desk

Après créer la PR, créer une tâche Desk pour lier la PR au workflow :

```json
{
  "task_type": "pr.created",
  "from_agent": "dev-worker-1",
  "to_agent": "dev-orchestrator",
  "priority": "P2",
  "payload": {
    "pr_number": 47,
    "pr_url": "https://github.com/...",
    "branch": "feat/invoicing-export",
    "spec_id": "uuid-spec",
    "related_task_id": "uuid-task",
    "summary": "Ready for review — 4 commits, 385 lines added, all tests passing",
    "commit_count": 4,
    "commits": [
      "feat(invoicing): create export_logs table",
      "feat(invoicing): add InvoiceExportButton component",
      "feat(invoicing): implement export-to-excel Edge Function",
      "test(invoicing): add export integration tests"
    ],
    "test_results": {
      "unit": "42 tests passing",
      "integration": "8 tests passing",
      "e2e": "2 tests passing",
      "rls": "6 policies verified",
      "coverage": "85.1%"
    },
    "ready_for_review": true
  }
}
```

## Étape 4 — Processus de review

### Attendre la review

Dev-worker-2 recevra une `pr.review_request` via Desk et verra la PR sur GitHub.

- Max attente : 24 heures
- Si urgent (hotfix P1) : escalade manuellement par Slack

### Actions de review possible

| Action | Meaning | Next step |
|--------|---------|-----------|
| **Approved** | Code bon, prêt à merge | Merge et fermer PR |
| **Changes Requested** | Issues à corriger | Corriger, push nouveaux commits, demander re-review |
| **Commented** | Questions ou discussions | Répondre et clarifier |

### Incorporer le feedback

Quand reviewer demande changes :

1. **Corriger le code** sur la même branche
2. **Créer un nouveau commit** (ne pas amend le commit original)
   ```bash
   git commit -m "fix(invoicing): address review feedback — add RLS policy"
   ```
3. **Pousser le commit** (pas force push)
   ```bash
   git push origin feat/invoicing-export
   ```
4. **Re-requêter review** via Desk ou GitHub

**Ne pas** :
- Force-push (`git push --force`) sauf si absolument nécessaire
- Amend les commits originaux (complique l'historique)
- Ignorer le feedback sans discuter

## Étape 5 — Merge et fermeture

### Quand merger

PR peut être merged quand :

- ✅ Revieweur a approuvé (`approved`)
- ✅ Tous les tests sont verts
- ✅ Zéro conflits avec main
- ✅ Au moins 1 approval

### Processus de merge

```bash
# Mettre à jour main en local (optionnel, GitHub gère)
git checkout main
git pull origin main

# Merger via GitHub UI (recommandé)
# → Click "Merge pull request" button
# → Garder "Create a merge commit" (ne pas squash)
# → Confirmer

# Ou via CLI
git merge --no-ff feat/invoicing-export
git push origin main
```

**Convention** : Utiliser "Create a merge commit" (pas squash, pas rebase) pour garder l'historique des commits atomiques.

### Après merge

1. **Nettoyer la branche locale**
   ```bash
   git branch -d feat/invoicing-export
   git push origin --delete feat/invoicing-export
   ```

2. **Créer une tâche de déploiement** dans Desk
   ```json
   {
     "task_type": "deployment.requested",
     "from_agent": "dev-worker-1",
     "to_agent": "dev-orchestrator",
     "priority": "P2",
     "payload": {
       "pr_number": 47,
       "merged_at": "2026-03-06T15:30:00Z",
       "target_branch": "main",
       "deployment_requirements": {
         "migrations": ["20260306_create_export_logs"],
         "edge_functions": ["export-to-excel"],
         "env_vars_needed": []
       }
     }
   }
   ```

3. **Mettre à jour Desk**
   ```json
   {
     "task_type": "task.completed",
     "from_agent": "dev-worker-1",
     "task_id": "uuid-original-task",
     "payload": {
       "completion_status": "merged",
       "pr_number": 47,
       "completion_metrics": {
         "total_commits": 4,
         "lines_added": 385,
         "tests_added": 14,
         "coverage": "85.1%",
         "time_spent_hours": 4.5
       }
     }
   }
   ```

## Conventions et standards

### Taille idéale de PR

| Métrique | Target |
|----------|--------|
| Commits | 2-5 (si plus, considérer split) |
| Lines changed | < 400 (si plus, considérer split) |
| Files modified | < 10 (si plus, considérer split) |
| Review time | 30-60 minutes |

Trop gros → review lente. Trop petit → overhead.

### Description détaillée ?

**OUI si** :
- Change de logique métier (ajouter feature)
- Refactor complexe
- Nouvelle dépendance
- Change de DB schema

**NON si** :
- Typo fix
- Simple bugfix cosmétique
- Mise à jour d'une dépendance patch (1.2.3 → 1.2.4)

### Screenshots

Inclure si :
- ✅ Change UI (ajouter bouton, nouveau formulaire)
- ❌ Backend uniquement (Edge Function, migration)

## Métriques

Après merge, enregistrer :

```json
{
  "task_type": "internal.metrics",
  "from_agent": "dev-worker-1",
  "payload": {
    "pr_number": 47,
    "workflow_metrics": {
      "created_at": "2026-03-04T10:00:00Z",
      "merged_at": "2026-03-06T15:30:00Z",
      "days_open": 2,
      "commits": 4,
      "lines_added": 385,
      "lines_removed": 12,
      "files_changed": 7,
      "review_iterations": 1,
      "time_in_review_minutes": 45,
      "tests_added": 14,
      "coverage": "85.1%"
    },
    "quality_metrics": {
      "review_approved": true,
      "test_passing": true,
      "console_errors": 0,
      "security_issues": 0,
      "accessibility_issues": 0
    }
  }
}
```

## Anti-patterns

- **Giant PR** : Mettre 2000 lignes dans une PR. Tu formes pas un reviewer, tu le punies. Split en PRs plus petites.
- **Commits squashés** : Perdre l'historique atomique. Chaque commit = une idée, merge with `--no-ff`.
- **Main not updated** : Brancher de main vieille de 2 semaines. Rebase régulièrement : `git rebase origin/main`.
- **No testing** : "Tests can come later". Non. PR sans tests = changes_requested.
- **Force push** : Changer l'historique de commits publiés. Force push = ton problème, pas celui du reviewer.
- **Vague description** : "Fixed stuff" comme description PR. Ton reviewer ne sait pas ce qu'il lit.
- **Ignoring CI** : Des tests échouent mais tu merges quand même. CI est ton ami, pas un ennemi.
- **No spec link** : PR sans trace vers la spec ou ticket. Demain personne ne saura pourquoi ça a été changé.
