---
name: branch-strategy
description: >
  Créer et gérer les branches Git (feat/, fix/, chore/), coordonner les
  worktrees et gérer les merges vers main. Ce skill guide dev-orchestrator
  dans la gestion du cycle Git complet : création de branche, assignation aux
  workers, création de PR, review, et merge. Utiliser ce skill quand une tâche
  est assignée (créer la branche), quand une PR est ouverte (coordonner la
  review), et quand on merge (vérifier les conditions).
---

# Branch Strategy

Git n'est pas juste un outil de versioning — c'est le nerveux central du workflow de développement. Une bonne stratégie de branche minimise les conflits, facilite les reviews, et rend le main toujours stable.

## Philosophie

**Règle d'or** : `main` doit TOUJOURS être déployable. Aucun code incomplet ne doit y arriver. Aucune branche ne doit vivre plus d'une semaine.

## Convention de nommage

Les branches suivent le pattern `{type}/{description-kebab-case}`.

### Types autorisés

| Type | Cas d'usage | Exemple |
|------|-----------|---------|
| `feat/` | Nouvelle fonctionnalité ou amélioration | `feat/promotions-v1` |
| `fix/` | Correction de bug | `fix/checkout-total-zero` |
| `chore/` | Refactoring, dépendances, docs, sans impact fonctionnel | `chore/eslint-upgrade` |

**NE PAS utiliser** : `dev/`, `test/`, `temp/`, `WIP/` (trop vague, pas de nettoyage).

### Description

La partie après le `/` décrit QUOI en kebab-case, pas qui.

```
✅ feat/invoicing-system
✅ fix/nil-pointer-checkout
✅ chore/upgrade-jest

❌ feat/john-work
❌ fix/try-something
❌ chore/stuff
```

## Workflow Git standard

### 1. Création de branche (dev-orchestrator)

Quand une tâche est assignée, dev-orchestrator crée la branche et l'enregistre dans Desk.

```bash
# Depuis main à jour
git pull origin main

# Créer la branche
git checkout -b feat/promotions-v1

# Pousser la branche vide pour la "réserver"
git push -u origin feat/promotions-v1
```

Log dans silo-logging :

```json
{
  "action": "git.branch.created",
  "detail": "Branche feat/promotions-v1 créée et poussée",
  "meta": {
    "branch": "feat/promotions-v1",
    "from": "main",
    "task_id": "TSK-145-1"
  }
}
```

### 2. Assignation au worker (via Desk)

Inclure le nom de la branche dans le payload `task.assign` (voir task-distribution) :

```json
{
  "payload": {
    "task_id": "TSK-145-2",
    "branch": "feat/promotions-v1",
    "title": "Formulaire de code promo..."
  }
}
```

Le worker se checkout simplement : `git checkout feat/promotions-v1`

### 3. Code et commits

Le worker fait ses commits sur la branche. Format de commit obligatoire (Conventional Commits) :

```
type(scope): description

body (optionnel)
```

Exemples :

```
feat(checkout): add promo code field to form
fix(api): validate promo code expiration
chore(tests): add e2e test for promo workflow
```

**Types de commit** : `feat`, `fix`, `chore`, `test`, `docs`, `refactor`

### 4. Création de PR

Quand le worker estime que la tâche est prête (acceptance criteria satisfaits), créer une PR :

```bash
git push origin feat/promotions-v1
```

Puis ouvrir une PR sur GitHub avec ce template :

```markdown
## Description
Implémente le système de codes promo pour réduire la facture en checkout.

## Related Ticket
TK-145

## Acceptance Criteria
- [ ] Table promos créée avec RLS
- [ ] Endpoint /api/promos/validate fonctionne
- [ ] Formulaire accepte le code et montre le discount
- [ ] Tests e2e passent

## Changes
- Added `supabase/migrations/20260306_add_promos_table.sql`
- Added `app/api/promos/route.ts`
- Modified `components/checkout/PromoField.tsx`
- Added `tests/e2e/promo.spec.ts`

## Testing
- [ ] Local tests pass
- [ ] No console errors
- [ ] Database migrations work on fresh DB

## Screenshots
[If UI changes: add screenshots]
```

Notifier Desk que la PR est créée :

```json
{
  "task_type": "pr.created",
  "from_agent": "dev-worker-1",
  "to_agent": "dev-orchestrator",
  "payload": {
    "task_id": "TSK-145-2",
    "pr_number": 234,
    "branch": "feat/promotions-v1",
    "title": "Add promo code checkout integration",
    "url": "https://github.com/...",
    "files_changed": 6,
    "additions": 184,
    "deletions": 32
  }
}
```

### 5. Review (dev-orchestrator + dev-worker)

Dev-orchestrator (ou le 2e worker) review la PR :

```
CHECKLIST DE REVIEW :

☐ Branche est basée sur main à jour
☐ Acceptance criteria sont satisfaits
☐ Code suit le style du projet (Prettier, ESLint)
☐ Pas de console errors ou warnings
☐ Tests e2e passent
☐ Migrations SQL peuvent être appliquées sur une DB vierge
☐ RLS est configuré si données utilisateur
☐ Pas de secrets hardcodés (API keys, tokens)
☐ Documentation mise à jour si nécessaire
☐ Commits suivent Conventional Commits

Si tout est OK → Approuver
Si problèmes → Commenter + demander des changements
```

Notifier Desk du résultat :

```json
{
  "task_type": "pr.review_result",
  "from_agent": "dev-orchestrator",
  "to_agent": "dev-worker-1",
  "payload": {
    "pr_number": 234,
    "approved": true,
    "comments": [],
    "status": "ready_to_merge"
  }
}
```

Ou si problèmes :

```json
{
  "approved": false,
  "comments": [
    {
      "file": "supabase/migrations/20260306_add_promos_table.sql",
      "line": 45,
      "text": "Missing RLS policy for promos table — need policy to ensure users can't modify other users' used_promos"
    }
  ],
  "status": "changes_requested"
}
```

### 6. Merge vers main

Conditions pour merger :

- PR approuvée ✅
- Tous les tests passent ✅
- Branche est basée sur main à jour ✅
- Aucun conflit ✅
- Seconde approbation si c'est du code sensible (RLS, auth, facturation) ✅

Merger depuis GitHub ou CLI :

```bash
# Depuis main, à jour
git pull origin main

# Fusionner la PR (crée un merge commit)
git merge --no-ff feat/promotions-v1

# Pousser
git push origin main

# Supprimer la branche
git push origin --delete feat/promotions-v1
git branch -d feat/promotions-v1
```

Log du merge :

```json
{
  "action": "git.branch.merged",
  "detail": "PR #234 mergée vers main",
  "meta": {
    "branch": "feat/promotions-v1",
    "pr_number": 234,
    "task_id": "TSK-145-2",
    "commit_count": 5,
    "files_changed": 6
  }
}
```

## Gestion des conflits

### Prévention

- **Garder les branches courtes** : Une branche vit max 3-5 jours
- **Rebase régulièrement** : Si main a avancé pendant que vous codez, `git rebase origin/main` pour rester à jour
- **Sections du code disjointes** : Des workers qui modifient le même fichier = conflit garanti

### Résolution

Si un conflit survient au merge :

```bash
git merge --no-ff feat/promotions-v1
# CONFLICT in components/checkout/PromoField.tsx

# Éditer le fichier, résoudre les sections
nano components/checkout/PromoField.tsx

# Marquer comme résolu
git add components/checkout/PromoField.tsx

# Compléter le merge
git commit -m "Merge feat/promotions-v1 (resolved conflict in PromoField)"
```

**Jamais** de merge automatique sans vérifier. Un conflit masqué = bug caché.

Escalader au dev-orchestrator si la résolution est complexe :

```json
{
  "task_type": "escalation.merge_conflict",
  "priority": "high",
  "from_agent": "dev-worker-1",
  "to_agent": "dev-orchestrator",
  "payload": {
    "branch": "feat/promotions-v1",
    "pr_number": 234,
    "conflicting_file": "components/checkout/PromoField.tsx",
    "conflict_type": "code_logic",
    "description": "Both workers modified the discount calculation logic. Need to decide which approach is correct."
  }
}
```

## Worktree rules (convention Somtech)

Quand dev-orchestrator doit isoler un travail (ex: spike urgent, branche complexe), utiliser un worktree :

### Nommage

`{nom-du-repo}-{nom-de-la-feature}`

Exemple : `maquettev4-auth-flow`

### Emplacement

Au même niveau que le repo (parent directory).

Si le repo est `/path/to/maquettev4`, le worktree sera `/path/to/maquettev4-auth-flow`

### Création

```bash
# Depuis le repo principal
cd /path/to/maquettev4

# Créer le worktree (crée une branche locale feat/auth-flow)
git worktree add ../maquettev4-auth-flow -b feat/auth-flow

# Basculer dedans
cd ../maquettev4-auth-flow

# Vérifier
git status
```

### Lister les worktrees

```bash
git worktree list
```

Output :

```
/path/to/maquettev4           (bare)
/path/to/maquettev4-auth-flow feat/auth-flow
```

### Suppression

```bash
git worktree remove ../maquettev4-auth-flow
git branch -d feat/auth-flow
```

### Quand utiliser worktree ?

- Migration complexe qui isole le main
- Spike concurrent à des PR en review
- Experimental branch qu'on veut tester avant de proposer en PR

**NE PAS utiliser worktree** pour du dev normal. C'est pour des cas exceptionnels.

## Synchronisation entre workers

Quand deux workers travaillent sur la MÊME branche (rare mais possible pour un travail vraiment collaboratif) :

**Ne pas faire ça** en temps normal. Favoriser deux brâches séquentielles avec dépendance claro.

Si absolument nécessaire (ex: deux fonctionnalités liées) :

1. Convenir d'une structure : qui code quelle section
2. Committer régulièrement (toutes les 30 min de travail)
3. `git pull` avant chaque session de code
4. Tests continus pour éviter les regressions

Mieux : créer une tâche "review + intégration" après que chacun finisse sa section.

## Métriques de branche

Rapporter ces métriques pour chaque branche (voir silo-logging) :

```json
{
  "action": "git.metrics.branch",
  "meta": {
    "branch": "feat/promotions-v1",
    "lifetime_days": 3,
    "commits": 8,
    "files_changed": 6,
    "pr_number": 234,
    "review_cycles": 1,
    "time_to_merge_hours": 72
  }
}
```

Interpréter :

- **lifetime_days > 7** : Branche trop longue, risque de divergence
- **commits >> task_count** : Commits non-atomiques, hard à review
- **review_cycles > 2** : Acceptation criteria pas clairs ou code pas prêt

## Anti-patterns

- **Main instable** : Un merge non-testé vers main = cascade de broken builds. **JAMAIS** merger sans tests verts.
- **Branche "éternelle"** : Une branche qui vit 2 semaines accumule des conflits et des dettes techniques. Max 5 jours.
- **Commit vague** : "Update" ne dit rien. "fix(checkout): handle edge case in discount calculation" est utile.
- **PR énorme** : Une PR avec 50 fichiers changés est impossible à review. Découper en PRs plus petites.
- **Rebase public** : Rebaser une branche qu'on a poussée change l'historique. Les autres workers verront des conflits fantômes. Utiliser `git merge` ou demander aux autres de rebase aussi.
- **Merge commit ignoré** : Le merge commit crée un "point de branchement" dans l'historique. C'est utile pour `git bisect`. Ne pas squasher le merge (sauf instruction explicite).
