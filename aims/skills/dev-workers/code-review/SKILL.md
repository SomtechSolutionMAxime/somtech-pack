---
name: code-review
description: >
  Relire le code de l'autre dev-worker avec rigueur et bienveillance.
  Ce skill guide l'agent dans la structure d'une review (checklist de sécurité,
  performance, lisibilité, patterns), la formulation du feedback (approved vs
  changes_requested vs comment), et le suivi dans Desk. Utiliser ce skill quand
  une PR arrive avec un review_request.
---

# Code Review

Une bonne review détecte les bugs avant la prod, maintient la qualité du code, et aide l'autre dev à s'améliorer. Ce skill définit comment reviewer rigoureusement et humainement.

## Quand ce skill s'active

- Une tâche `pr.review_request` arrive de dev-worker-1 (ou dev-worker-2)
- Un bugfix ou hotfix demande une review rapide
- Une feature critique demande une revérification
- Un conflit merge doit être validé

## Étape 1 — Contexte et lecture initiale

### Parser la tâche review_request

La tâche contient :

```json
{
  "task_type": "pr.review_request",
  "from_agent": "dev-worker-1",
  "to_agent": "dev-worker-2",
  "priority": "P2",
  "payload": {
    "pr_url": "https://github.com/.../pull/47",
    "branch": "feat/invoicing-export",
    "spec_id": "uuid-spec",
    "summary": "Export Excel avec RLS et Edge Function",
    "checklist_done": [
      "✅ Ontologie lue",
      "✅ RLS configurée",
      "✅ TypeScript strict validé",
      "✅ Console: 0 erreur"
    ],
    "test_instructions": "1. Allez à /invoicing. 2. Cliquez 'Exporter'. 3. Vérifiez fichier téléchargé.",
    "known_limitations": []
  }
}
```

### Lire le contexte

- [ ] Lire la spec (depuis `payload.spec_id`)
- [ ] Lire l'ontologie si changement DB
- [ ] Vérifier `/security/ARCHITECTURE_DE_SECURITÉ.md` si RLS
- [ ] Consulter les commits depuis la branche pour comprendre la progression

## Étape 2 — Checklist de review

### Sécurité (Blocking issues)

| Point | Vérifier | Red flags |
|-------|----------|-----------|
| **SQL Injection** | Requêtes paramétrées ? Supabase client (paramètres typés) utilisé ? | Raw SQL sans échappement, string interpolation dans requêtes |
| **RLS** | Chaque table user a une policy restrictive ? | `SELECT *` sans RLS, policy `true`, policy récupère données d'autres users |
| **Auth** | Vérification `auth.uid()` côté serveur ? | Token JWT confiance aveugle, pas de vérification serveur |
| **Secrets** | Aucune clé API en dur ? `.env.local` gitignore ? | Clés Supabase, API keys, tokens visibles dans le code |
| **CORS** | Requêtes cross-origin validées ? | Wildcard CORS (`*`), origin non vérifiée |

**Si tu trouves un issue de sécurité** → Changes requested + Escalade via `error-escalation` si critique.

### Performance

| Point | Vérifier | Red flags |
|-------|----------|-----------|
| **N+1 Queries** | Requêtes Supabase regroupées ? Pas de boucle de requêtes ? | Boucle `for` avec `.select()` dedans, pas de `.with()` pour jointures |
| **Rendering** | Composants React mémorisés ? Pas de re-renders inutiles ? | `useCallback`/`useMemo` oubliés, états globaux mis à jour trop souvent |
| **Indexing** | Migrations créent des index sur colonnes recherchées ? | Requêtes `.where()` sur colonne sans index |
| **Bundle size** | Imports minimisés ? Bibliothèques allégées ? | Imports complets au lieu de ce qui est nécessaire, dépendances lourdes |

**Si tu trouves un issue perf** → Comment ou changes requested selon la sévérité.

### Lisibilité et maintenabilité

| Point | Vérifier | Red flags |
|-------|----------|-----------|
| **Nommage** | Variables = intention claire ? Fonctions = verbes (get, create, update) ? | Noms cryptiques (`x`, `temp`), styles incohérents (camelCase vs snake_case) |
| **Fonctions courtes** | Fonction < 30 lignes ? Une responsabilité ? | Fonction qui fait 200 lignes, plusieurs responsabilités |
| **Comments** | Codes bizarres expliqués ? TODO marqués ? Pas de comments sur l'évident | Comments inutiles (`// Ajouter 1`), pas de comments sur choix architecturaux |
| **Types** | Types explicites, pas de `any` ? Interfaces bien nommées ? | `any` partout, types union trop larges, pas de distinction entre `null` et `undefined` |
| **Duplication** | Code dupliqué extrait ? Logique commune factorisée ? | Même logique copiée 3 fois au lieu de créer une fonction |

**Si tu trouves des issues lisibilité** → Comment ou nit selon le contexte.

### Patterns projet

| Point | Vérifier | Red flags |
|-------|----------|-----------|
| **Conventions CLAUDE.md** | Kebab-case fichiers ? PascalCase composants ? Snake_case tables ? | Fichiers PascalCase, colonnes camelCase, composants verbes |
| **Error handling** | Erreurs loggées ? Utilisateur informé ? | Catch vide, erreurs silencieuses, no error message to user |
| **Logs** | Via `silo-logging` ou `console.error` structuré ? Pas de console.log debug ? | console.log partout, logs non structurés |
| **RLS patterns** | Policies vérifiées : `auth.uid()` côté serveur ? | `user_id` depuis le client sans vérification |
| **Edge Functions** | Authentification vérifiée ? Payload validé ? Erreurs retournées ? | Auth non vérifiée, pas de validation, erreurs non gérées |

**Si tu trouves une violation pattern** → Changes requested (c'est une règle du projet).

### Tests

| Point | Vérifier | Red flags |
|-------|----------|-----------|
| **Coverage** | Nouvelles fonctions ont tests ? Cas d'erreur testés ? RLS testée ? | Zéro test, tests qui passent mais ne testent rien, pas de RLS tests |
| **Test quality** | Tests testent le comportement, pas les détails ? Describe/it descriptifs ? | Tests trop brités, pas de setup/teardown, assertions faibles |
| **Intégration** | Supabase testée ? Edge Functions ? | Tests unitaires seulement, rien sur intégration réelle |

**Si tests manquent** → Changes requested avec demande spécifique.

## Étape 3 — Formulation du feedback

### Niveaux de sévérité

Chaque commentaire a une sévérité :

| Niveau | Quand | Exemple | Consequence |
|--------|-------|---------|-------------|
| **Blocking** | Sécurité, RLS, bugs | "RLS policy manquante : autres utilisateurs voient les données" | Must fix avant merge |
| **Suggestion** | Patterns, best practices | "Extraire cette logique dans une fonction séparée pour la tester" | Nice to have, peut être fait en PR suivante |
| **Nit** | Style mineur | "Typo dans le commentaire : 'invoices' au lieu de 'invoices'" | Cosmétique |

### Template de feedback structuré

**Pour un issue blocking :**

```markdown
## 🚨 Blocking: RLS Policy Missing

**Location**: `supabase/migrations/20260306_add_export_logs.sql`

**Issue**: La table `export_logs` n'a pas de RLS policy. Actuellement, un utilisateur peut voir les exports des autres.

**Current**:
```sql
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;
-- Pas de policy !
```

**Expected**:
```sql
CREATE POLICY "Users see only their own exports"
  ON export_logs
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Why**: Sinon la table sera une fuite de données dès le déploiement.

**Resolution**: Ajouter la policy et tester avec RLS test.
```

**Pour une suggestion :**

```markdown
## 💡 Suggestion: Extract Export Logic

**Location**: `app/invoicing/actions/export.ts` (lines 45-120)

**Observation**: La logique d'export (fetch → format → upload) se répète potentiellement si on ajoute d'autres formats (PDF, CSV).

**Suggestion**: Extraire la logique dans une classe `ExportService` avec des stratégies (ExcelStrategy, PDFStrategy).

**Example**:
```typescript
class ExportService {
  export(items, strategy: ExportStrategy) {
    return strategy.format(items).then(file => this.upload(file));
  }
}
```

**Benefit**: Testable, réutilisable, facile d'ajouter formats.

**Optional?**: Oui, peut être fait en PR future si ça complexifie celle-ci.
```

**Pour un nit :**

```markdown
## 🎨 Nit: Typo in Comment

**Location**: `supabase/functions/export-to-excel/index.ts` line 12

**Current**: `// Genere the file`

**Expected**: `// Generate the file`
```

### Tone guidelines

- **Bienveillant** : Tu aides, tu ne juges pas.
  - ✅ "Cette requête va faire N+1. On peut utiliser `.with()` pour faire une jointure ?"
  - ❌ "N+1 query, tu sais pas coder ?"

- **Contextuel** : Reconnaître quand un choix est conscient et documenté.
  - ✅ "Pourquoi utiliser `lodash` ici ? C'est lourd pour une simple fonction. Ou tu as une bonne raison ?"
  - ❌ "Pourquoi lodash, c'est de la bouillie."

- **Demander plutôt qu'affirmer** : Laisser la place à un débat technique.
  - ✅ "Ici tu utilises `Array.filter().map()`. Ça serait plus rapide avec une seule itération. Intéressé ?"
  - ❌ "Utilise une seule boucle, c'est inefficace."

## Étape 4 — Actions de review

### Approver (Approuvé)

Quand le code est bon et prêt à merger :

```json
{
  "task_type": "pr.review_result",
  "from_agent": "dev-worker-2",
  "to_agent": "dev-worker-1",
  "priority": "P2",
  "payload": {
    "pr_url": "https://github.com/.../pull/47",
    "action": "approved",
    "summary": "Code review completed — ready to merge",
    "feedback": {
      "security": "✅ RLS policies correct. Auth verified.",
      "performance": "✅ No N+1 queries, proper indexes.",
      "patterns": "✅ Follows conventions. Edge Function well-structured.",
      "tests": "✅ Coverage 85%, RLS tests included."
    },
    "confidence_level": "high",
    "blocking_issues": [],
    "suggestions": [
      "Dans la PR suivante : extraire ExportService en classe pour réutilisation."
    ]
  }
}
```

### Changes Requested (Changements demandés)

Quand il y a des issues à corriger avant merge :

```json
{
  "task_type": "pr.review_result",
  "from_agent": "dev-worker-2",
  "to_agent": "dev-worker-1",
  "priority": "P1",
  "payload": {
    "pr_url": "https://github.com/.../pull/47",
    "action": "changes_requested",
    "summary": "2 blocking issues, 1 suggestion",
    "blocking_issues": [
      {
        "location": "supabase/migrations/20260306_add_export_logs.sql",
        "title": "RLS Policy Missing",
        "detail": "export_logs table has no SELECT policy. Users can see each other's exports.",
        "priority": "critical",
        "resolution": "Add policy: CREATE POLICY users_see_own ON export_logs USING (auth.uid() = user_id);"
      },
      {
        "location": "app/invoicing/actions/export.ts line 67",
        "title": "Missing Error Handling",
        "detail": "Edge Function call not wrapped in try-catch. If it fails, user gets no feedback.",
        "priority": "high",
        "resolution": "Add try-catch and display error message to user."
      }
    ],
    "suggestions": [
      "Extract export logic into a class for testability (not blocking)."
    ]
  }
}
```

L'auteur (dev-worker-1) doit corriger les blocking issues et re-requêter review.

### Comment (Remarque)

Pour des questions, discussions, ou remarques non-bloquantes :

```json
{
  "task_type": "pr.review_comment",
  "from_agent": "dev-worker-2",
  "to_agent": "dev-worker-1",
  "priority": "P3",
  "payload": {
    "pr_url": "https://github.com/.../pull/47",
    "location": "app/invoicing/components/invoice-export-button.tsx line 28",
    "comment": "Question: why use `useMemo` here instead of `useCallback`? User callback shouldn't change, so memo seems unnecessary. What did I miss?",
    "discussion": true
  }
}
```

## Étape 5 — Suivi

Après chaque review, enregistrer les métriques :

```json
{
  "task_type": "internal.metrics",
  "from_agent": "dev-worker-2",
  "payload": {
    "review_for_pr": "47",
    "review_metrics": {
      "files_reviewed": 7,
      "lines_reviewed": 385,
      "time_spent_minutes": 45,
      "issues_found": {
        "blocking": 2,
        "suggestions": 1,
        "nits": 1,
        "total": 4
      },
      "categories": {
        "security": 1,
        "performance": 0,
        "patterns": 1,
        "tests": 1,
        "lisibilité": 1
      }
    },
    "action_taken": "changes_requested",
    "confidence_in_review": "high"
  }
}
```

## Anti-patterns

- **Rubber stamp approvals** : "Looks good!" sans vraiment lire. Tu es responsable du code que tu approuves.
- **Perfectionism blocking** : Demander des changements mineurs juste parce que tu aurais fais différent. C'est pas ton code, c'est bon s'il marche et suit les patterns.
- **Personal style wars** : Tu aimes kebab-case, l'autre préfère camelCase? Les conventions sont définies dans CLAUDE.md, pas d'opinion personnelle.
- **No security mindset** : Négliger les checks RLS, auth, secrets parce que "c'est probablement bon". Non. Vérifier toujours.
- **Approving tests manquants** : Si un changement logique n'a pas de test, c'est changes_requested, point.
- **Ignoring perf issues** : "Ça marche" ≠ "C'est bon". Une requête N+1 qui marche maintenant échouera quand le dataset grandit.
- **Being mean** : Feedback blessant crée de la friction. Ton job c'est d'aider, pas de montrer que tu es meilleur.
- **Bikeshedding** : Débattre infiniment sur des détails mineurs au lieu de laisser avancer. Quand c'est un nit, dis-le et move on.
