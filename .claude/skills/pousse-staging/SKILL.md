---
name: pousse-staging
description: /pousse-staging — Commit, push la branche courante, merge dans staging, et deploy migrations + Edge Functions sur Supabase staging via MCP. Fonctionne depuis n'importe quelle branche feat/fix/improvement/chore (workflow recommande) ou directement depuis staging (legacy). Aussi quand l'utilisateur dit "pousse staging", "push staging", "deploy staging", "envoie sur staging".
---

# /pousse-staging — Deployer une branche sur staging

Workflow de deploiement vers la branche `staging` permanente. Les migrations et Edge Functions sont deployees sur le projet Supabase staging via MCP (le Git integration est desactive).

## Deux modes d'execution

| Mode | Branche courante | Comportement |
|------|------------------|--------------|
| **Feature → staging** (recommande) | `feat/*`, `fix/*`, `improvement/*`, `chore/*`, `proto/*` | Push feat, merge --squash dans staging, deploy MCP, retour sur feat |
| **Direct staging** (legacy) | `staging` | Push direct staging, deploy MCP |

Le skill detecte le mode automatiquement a l'etape 1.

---

## Etape 1 : Detection du mode et verification de la branche

1. Verifie la branche courante : `git branch --show-current` (stocker dans `CURRENT_BRANCH`).
2. **Si `CURRENT_BRANCH` est `main`** : STOP. Informer l'utilisateur qu'on ne deploie jamais directement depuis main. Proposer `git checkout -b feat/<description>` ou `git checkout staging`.
3. **Si `CURRENT_BRANCH` est `staging`** : passer en mode **Direct staging** (sauter a l'etape 3 avec `FEATURE_BRANCH=""`).
4. **Sinon** (`feat/*`, `fix/*`, `improvement/*`, `chore/*`, `proto/*`) : passer en mode **Feature → staging**, stocker `FEATURE_BRANCH=$CURRENT_BRANCH`.
5. Verifie la fraicheur de la branche : `git log -1 --format="%cr" HEAD`.
6. Verifie si `main` a avance significativement :
   ```bash
   git fetch origin main
   git log HEAD..origin/main --oneline
   ```
   Si plus de 10 commits d'ecart, avertir l'utilisateur (sa branche est possiblement perimee).

## Etape 2 : Commit des changements (sur la branche courante)

1. `git status` pour voir l'etat du repo.
2. **S'il n'y a aucun changement** : passer a l'etape 2.5.
3. **S'il y a des changements** :
   - `git diff` et `git diff --staged` pour analyser.
   - `git log --oneline -5` pour le style des commits recents.
   - Stage les fichiers pertinents : `git add <fichier>` (jamais `git add .`).
   - Ne jamais commiter de fichiers sensibles (`.env`, credentials, secrets).
   - Genere un message de commit au format `type(scope): description`.
   - Le message doit se terminer par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
   - Cree le commit.

## Etape 2.5 : Validation des migrations vs PROD (pre-push)

Si des fichiers `supabase/migrations/` sont dans le diff de la branche :

1. Detecter les fichiers de migration :
   ```bash
   git diff main..HEAD --name-only -- supabase/migrations/
   ```
2. Pour chaque fichier, extraire le timestamp (les 14 premiers caracteres du nom de fichier).
3. Verifier que ce timestamp n'existe PAS deja en prod :
   ```sql
   -- Via mcp__supabase__execute_sql
   SELECT version FROM supabase_migrations.schema_migrations WHERE version = '<TIMESTAMP>';
   ```
4. **Si un timestamp existe deja en prod** :
   - **BLOQUER le push**.
   - Avertir : "La migration `<TIMESTAMP>` existe deja en prod. Cela causera un conflit."
   - Proposer : renommer le fichier avec un nouveau timestamp.
5. Si aucun conflit, continuer.

## Etape 2.6 : Gate migrations multi-contributeur (préflight staging)

> **Objectif** : attraper EN LOCAL les collisions de migrations entre contributeurs concurrents, AVANT de pousser sur staging. L'Etape 2.5 verifie contre **prod** ; ce gate verifie contre **staging** (ou un voisin vient peut-etre de pousser une migration que ma branche, coupee de `main`, ignore). No-op strict en mode solo.

**Quand l'exécuter** : sur la branche feat (mode Feature → staging), juste avant l'Etape 3. En mode Direct staging (deja sur `staging`), sauter ce gate.

Lancer le helper depuis la racine du repo :

```bash
bash .claude/skills/pousse-staging/lib/staging-migration-gate.sh
```

Ce que fait le gate (voir `lib/staging-migration-gate.sh`) :

1. `git fetch origin staging`.
2. Detecte les migrations presentes sur `origin/staging` mais **absentes** de la branche feat.
3. **Si aucune** (mode solo / staging non divergent) : **no-op, aucun prompt** — comportement strictement identique a avant. **C'est le cas courant.**
4. **Si divergence** : `git merge origin/staging` dans la branche feat, puis `supabase db reset` rejoue **toutes** les migrations (les miennes + celles du voisin) sur une base vierge en local.

Interpreter le **code de retour** du helper :

| Code | Signification | Action |
|------|---------------|--------|
| `0` | No-op (solo) **ou** merge + `db reset` OK | Continuer a l'Etape 3 |
| `2` | Conflit git lors du merge de `origin/staging` (le merge est EN COURS) | **STOP** — soit `git merge --abort` pour revenir à l'état d'avant le gate, soit résoudre les conflits + `git commit`, puis relancer `/pousse-staging` |
| `3` | **Collision de migrations attrapee EN LOCAL** par `db reset` | **STOP** — corriger (renommer/reordonner/fusionner la migration) avant de pousser. La collision a ete evitee sur staging. |

**Important** : ce gate exige une instance Supabase locale (pour `db reset`). En mode solo il ne lance jamais `db reset` (no-op avant), donc aucun cout ni prompt supplementaire pour un contributeur seul.

## Etape 3 : Push et merge dans staging

### Mode Feature → staging

1. **Push de la branche feature** :
   ```bash
   git push origin "$FEATURE_BRANCH"
   ```
   Si premiere fois : `git push -u origin "$FEATURE_BRANCH"`.

2. **Mettre a jour staging local** :
   ```bash
   git fetch origin staging
   git checkout staging
   git pull origin staging --ff-only
   ```
   Si `--ff-only` echoue (staging local a divergeded de origin/staging), STOP et demander a l'utilisateur (ne pas force-pull).

3. **Squash-merge de la branche feature dans staging** :
   ```bash
   git merge --squash "$FEATURE_BRANCH"
   ```
   - **Si conflits** : STOP, afficher les fichiers en conflit, et demander a l'utilisateur de resoudre manuellement (puis de relancer `/pousse-staging` depuis staging).
   - **Si aucun changement nouveau** (squash ne produit rien) : informer l'utilisateur que `staging` contient deja tous les commits de `$FEATURE_BRANCH`. Proposer de skiper le push staging mais quand meme verifier MCP/PR (etapes 4-6).

4. **Commit du squash** sur staging :
   - Generer un message au format `type(scope): description` base sur les commits de `$FEATURE_BRANCH` (utiliser `git log main..$FEATURE_BRANCH --oneline` pour resumer).
   - Le message doit se terminer par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
   - `git commit -m "<message>"`.

5. **Push staging** :
   ```bash
   git push origin staging
   ```

### Mode Direct staging (legacy)

1. **Push direct** :
   ```bash
   git push origin staging
   ```

## Etape 4 : Deploiement MCP staging

Apres le push reussi sur staging :

1. **Detecter les nouvelles migrations** (par rapport a main) :
   ```bash
   git diff main..HEAD --name-only -- supabase/migrations/
   ```
2. **Pour chaque nouvelle migration** (dans l'ordre chronologique) :
   - Extraire le timestamp du nom de fichier (14 premiers caracteres).
   - Extraire la description (le reste sans `.sql`).
   - Lire le contenu du fichier SQL.
   - Appliquer via MCP :
     ```
     mcp__supabase-staging__apply_migration(name="<description>", query="<contenu SQL>")
     ```
   - **IMPORTANT** : `apply_migration` genere son propre timestamp. Corriger immediatement :
     ```sql
     -- Via mcp__supabase-staging__execute_sql
     UPDATE supabase_migrations.schema_migrations
     SET version = '<TIMESTAMP_DU_FICHIER>'
     WHERE name = '<description>'
     AND version != '<TIMESTAMP_DU_FICHIER>';
     ```
3. **Detecter les Edge Functions modifiees** :
   ```bash
   git diff main..HEAD --name-only -- supabase/functions/
   ```
4. **Pour chaque Edge Function modifiee** :
   ```
   mcp__supabase-staging__deploy_edge_function(name="<function_name>")
   ```
5. **Validation post-deploiement** :
   - Migrations :
     ```sql
     -- Via mcp__supabase-staging__execute_sql
     SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
     ```
   - Edge Functions :
     ```
     mcp__supabase-staging__list_edge_functions
     ```

## Etape 5 : Gestion de la Pull Request staging → main

1. Verifie s'il existe deja une PR ouverte `staging -> main` :
   ```bash
   gh pr list --head staging --base main --state open --json number,title,url
   ```
2. **Si une PR existe** : afficher le lien et informer que le push l'a mise a jour.
3. **Si aucune PR n'existe** :
   - `git log main..HEAD --oneline` pour resumer les commits.
   - Creer la PR : `gh pr create --head staging --base main`.
   - Titre court et descriptif, body structure avec `## Resume`.
   - Afficher le lien.

**La branche staging est permanente — ne jamais utiliser `--delete-branch`.**

## Etape 6 : Detection et deploiement Fly.io (optionnel)

Si des apps Fly.io sont impactees par les changements sur staging :

1. **Inventaire** : utiliser un agent (subagent_type: Explore) pour trouver tous les `fly.toml` du repo (hors `node_modules`).
2. **Croiser avec les fichiers modifies** :
   ```bash
   git diff main..HEAD --name-only
   ```
3. **Rapport et confirmation** : presenter un tableau des apps impactees, demander confirmation avant tout deploiement.
4. **Deploiement** : pour chaque app confirmee :
   - Se placer dans le repertoire de l'app
   - `fly deploy`
   - `fly status`
   - Afficher le resultat

## Etape 7 : Retour sur la branche feature

**Uniquement en mode Feature → staging** :

```bash
git checkout "$FEATURE_BRANCH"
```

Afficher un recap final :

```
Deploye sur staging depuis la branche `<FEATURE_BRANCH>` :
- Push : <FEATURE_BRANCH> + staging
- Gate migrations multi-contributeur : <no-op | staging mergé, db reset OK>
- Migrations staging : <N> appliquees
- Edge Functions staging : <N> deployees
- PR staging→main : <URL>
- Branche courante : <FEATURE_BRANCH> (conservee pour iterations QA)

Prochaines etapes :
1. QA valide sur staging.
2. Si bugs : corriger sur <FEATURE_BRANCH>, relancer /pousse-staging.
3. Si OK : /merge <PR_NUMBER> pour deployer en prod.
```

## Regles de securite

- Ne jamais faire de `git push --force`.
- Ne jamais commiter de fichiers sensibles.
- Ne jamais supprimer la branche `staging` (ni locale, ni remote).
- Ne jamais utiliser `--delete-branch` sur une PR `staging → main`.
- Ne jamais utiliser `supabase db push --linked`.
- Ne jamais deployer Fly.io sans confirmation explicite.
- Ne jamais merger une branche feature sur `main` directement depuis ce skill — toujours passer par `staging` puis `/merge`.
- En cas de conflit lors du squash-merge : STOP, demander a l'utilisateur de resoudre.
- En cas d'erreur, afficher clairement et proposer une solution.

## Annexes du skill

- `lib/staging-migration-gate.sh` — implementation du gate migrations multi-contributeur (Etape 2.6). Sourçable et testable. Points d'injection en en-tete du fichier.
- `tests/test-staging-migration-gate.sh` — test reproductible (repo jetable + simulation `db reset` via sqlite) prouvant que la collision est attrapee en local. Lancer : `bash .claude/skills/pousse-staging/tests/test-staging-migration-gate.sh`.
