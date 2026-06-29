---
name: merge
description: /merge — Merge PR, rebase local, deploy migrations + Edge Functions via MCP, tag release Docker/Package, et cleanup. Deploie les migrations AVANT le merge (le merge declenche le deploiement frontend) pour que la BD soit toujours prete avant le frontend. Worktree-aware (claude-swt) : diffère la suppression de branche quand un worktree lié est attaché. Utiliser quand l'utilisateur dit "merge", "merger la PR", "fusionner", ou "/merge". Protege automatiquement la branche staging (jamais de --delete-branch sur staging).
---

# /merge — Merge PR, rebase local et cleanup

Tu es un assistant de deploiement. Execute les etapes suivantes dans l'ordre, en t'arretant a la premiere erreur critique. Reponds toujours en francais.

> **Ordre de deploiement — regle critique** : les migrations BD sont deployees **AVANT** le merge sur `main`. Pourquoi : le merge sur `main` declenche le redeploiement du frontend (Netlify auto-publish, stack standard Somtech). Si on migrait apres le merge, le nouveau frontend tournerait contre l'ancienne BD pendant la fenetre de migration → erreurs en prod (colonnes/tables manquantes). En migrant d'abord, la BD est toujours prete avant que le frontend ne change. Bonus : si la migration echoue, on n'a pas encore merge → le frontend n'est pas deploye, on s'arrete proprement.

## Etape 1 : Identifier la PR a merger

1. Identifie la branche courante avec `git branch --show-current`.
2. Si la branche est `main`, verifie si l'utilisateur a passe un numero de PR en argument. Sinon, liste les PRs ouvertes avec `gh pr list --state open --json number,title,headRefName,url` et demande laquelle merger.
3. Si on est sur une branche de feature ou staging, cherche la PR associee :
   ```
   gh pr list --head $(git branch --show-current) --base main --state open --json number,title,url,mergeable,reviewDecision,statusCheckRollup
   ```
4. Si aucune PR trouvee, informe l'utilisateur et propose de lancer `/pousse` ou `/pousse-staging` selon la branche.

## Etape 2 : Verifications avant merge

1. Affiche un resume de la PR : titre, nombre de commits, fichiers modifies.
2. Verifie le statut des checks CI :
   ```
   gh pr checks <numero>
   ```
3. Si des checks echouent, affiche les details et demande a l'utilisateur s'il veut continuer malgre tout.
4. Affiche un recapitulatif clair et demande confirmation : "Pret a merger la PR #X — <titre>. On proceed ?"

## Etape 3 : Deploiement des migrations en prod via MCP (AVANT le merge)

> ⚠️ **Cette etape s'execute AVANT le merge** (cf. note d'ordre de deploiement en tete). On applique les migrations en prod pendant que l'**ancien** frontend est encore en ligne, puis on merge (ce qui deploie le nouveau frontend contre la BD deja migree).
>
> **Pre-requis de compatibilite (expand/contract)** : comme l'ancien frontend tourne un court instant contre la nouvelle BD, les migrations doivent etre **backward-compatible** (phase « expand » : ajouts de colonnes/tables nullable, pas de DROP ni de renommage cassant). Les suppressions destructives (« contract ») se font dans une livraison ulterieure, une fois l'ancien frontend retire. Si une migration n'est pas backward-compatible, **le signaler a l'utilisateur** avant de continuer.

1. Verifie si la PR contient des migrations SQL :
   ```
   gh pr diff <numero> --name-only | grep "supabase/migrations/"
   ```
2. **Si aucune migration** : Informe et passe directement a l'Etape 5 (merge) — la gate de coherence (Etape 4) est inutile s'il n'y a rien a deployer.
3. **Si des migrations sont detectees** :
   - Affiche le contenu de chaque fichier de migration. Le contenu est lisible depuis les fichiers de la branche source (deja checked-out si on est sur la branche feature) ou via `gh pr diff <numero>`.
   - **DEMANDE OBLIGATOIREMENT CONFIRMATION** avant toute action.
   - **Si l'utilisateur confirme** : Pour chaque migration (dans l'ordre chronologique) :
     - Extraire le timestamp du nom de fichier (les 14 premiers caracteres)
     - Extraire la description (le reste du nom sans `.sql`)
     ```
     mcp__supabase__apply_migration(name="<description>", query="<contenu SQL>")
     ```
     - **IMPORTANT** : `apply_migration` genere son propre timestamp. Corriger immediatement :
     ```sql
     -- Via mcp__supabase__execute_sql
     UPDATE supabase_migrations.schema_migrations
     SET version = '<TIMESTAMP_DU_FICHIER>'
     WHERE name = '<description>'
     AND version != '<TIMESTAMP_DU_FICHIER>';
     ```
   - Verifier le resultat :
     ```sql
     -- Via mcp__supabase__execute_sql
     SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
     ```
   - **Si l'utilisateur refuse** : ne pas merger non plus (le frontend ne doit pas partir sans sa BD). Informer que la livraison est suspendue : ni migration, ni merge.

## Etape 4 : Gate de coherence migrations (staging vs prod)

Apres tout deploiement de migrations (Etape 3) et **avant le merge**, verifier que staging et prod sont synchronises :

1. Recuperer les 10 dernieres migrations sur les deux environnements :
   ```sql
   -- Via mcp__supabase__execute_sql (prod)
   SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;

   -- Via mcp__supabase-staging__execute_sql (staging)
   SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;
   ```
2. **Comparer les versions** : les listes doivent etre identiques (memes timestamps, memes noms).
3. **Si divergence detectee** :
   - **BLOQUER** (ne pas merger) et afficher les differences dans un tableau clair.
   - Identifier la cause : timestamp genere par MCP non corrige, migration manquante, ou nom different.
   - Corriger via `UPDATE supabase_migrations.schema_migrations` sur l'environnement divergent.
   - Re-verifier apres correction.
4. **Si coherent** : afficher "Migrations prod/staging synchronisees" et passer au merge (Etape 5).

> Cette gate est **obligatoire** apres chaque deploiement de migrations. Ne pas la sauter.

## Etape 5 : Merge de la PR (worktree-aware)

> Les migrations sont deja en prod (Etapes 3-4). Ce merge declenche le redeploiement du frontend, qui tournera donc contre la BD deja migree.

### Plan de suppression de branche

```bash
HEAD_BRANCH=$(gh pr view <numero> --json headRefName -q '.headRefName')
source .claude/skills/merge/lib/worktree-aware-delete.sh
PLAN=$(mwt_plan_delete "$HEAD_BRANCH")
```

> Le helper `lib/worktree-aware-delete.sh` calcule le plan **sans rien supprimer**. Il renvoie une des 3 valeurs :

| Plan | Signification | Commande de merge |
|------|---------------|-------------------|
| `PROTECTED` | `HEAD_BRANCH` est `staging` | `gh pr merge <numero> --squash` **(jamais `--delete-branch`)** |
| `DELETE` | Aucun worktree lié n'a cette branche en checkout | `gh pr merge <numero> --squash --delete-branch` (flux classique) |
| `DEFER <path> <ts>` | La branche est checked-out dans un **worktree lié** (`claude-swt`) | `gh pr merge <numero> --squash` **(sans `--delete-branch`)** — voir ci-dessous |

**Pourquoi `DEFER`** : une branche checked-out dans un worktree ne peut pas être supprimée, et `--delete-branch` tente en plus de basculer sur `main` (possiblement détenu par un autre worktree) → échec. On diffère donc la suppression **locale** au teardown de session.

### Execution

1. Apres confirmation, executer la commande de merge correspondant au plan.
2. Si le merge echoue (conflits, branch protection), afficher l'erreur et proposer des solutions.
3. **Si le plan est `DEFER <path> <ts>`** :
   - Le merge distant est fait. Nettoyer **seulement la branche distante** (sans toucher au checkout local) :
     ```bash
     git push origin --delete "$HEAD_BRANCH" 2>/dev/null || true
     ```
   - **NE PAS** supprimer la branche locale ni le worktree (la session vit peut-être dedans).
   - Afficher le message :
     ```
     Worktree lié attaché à `<HEAD_BRANCH>` (<path>).
     Branche locale + worktree conservés. Après avoir fermé cette session Claude,
     lance depuis ton shell :  claude-swt-done <ts>
     (retire le worktree ET la branche locale en une fois)
     ```

## Etape 6 : Resynchronisation locale (worktree-aware)

> **Garde-fou worktree** : si la session tourne dans un worktree **lié** (`claude-swt`), `main` est checked-out dans le worktree principal et `git checkout main` ÉCHOUERA ici. Détecter le contexte d'abord :
> ```bash
> source .claude/skills/merge/lib/worktree-aware-delete.sh
> if mwt_in_linked_worktree; then IN_LINKED=1; else IN_LINKED=0; fi
> ```

### Cas worktree lié (`IN_LINKED=1`)
- **NE PAS** faire `git checkout main` (impossible — main est dans le principal).
- Mettre a jour la ref distante seulement : `git fetch origin main`.
- La branche feature locale est conservee (teardown via `claude-swt-done` — cf. Etape 5 `DEFER`).
- Sauter la suite de l'Etape 6 (le rebase staging et le cleanup local se font depuis le worktree principal). Passer a l'Etape 7.

### Cas standard (`IN_LINKED=0`)

1. `git checkout main`
2. `git pull origin main`

#### Si la branche mergee est `staging` :
- **NE PAS proposer de supprimer** la branche locale staging.
- Resynchroniser staging sur main : `git checkout staging && git rebase origin/main && git push origin staging`
- Revenir sur main : `git checkout main`
- **Cleanup des branches feature mergees via staging** : passer a l'Etape 6.5.

#### Si la branche mergee est une branche feature :
- Si le plan de l'Etape 5 etait `DELETE`, `gh --delete-branch` a deja supprime la branche distante. Demander a l'utilisateur s'il veut supprimer la branche locale.
  - **Si oui** : `git branch -d <nom-branche>`
  - **Si non** : Informe que la branche locale est conservee.

3. Confirmer que tout est propre avec `git status` et `git log --oneline -3`.

## Etape 6.5 : Cleanup des branches feature mergees via staging

**Uniquement si la branche mergee a l'Etape 5 etait `staging`.** (Sinon sauter a l'Etape 7.)

Le workflow `/pousse-staging` squash-merge les branches `feat/*`, `fix/*`, etc. dans `staging` localement. Apres un merge `staging → main` reussi, ces branches sont generalement obsoletes et peuvent etre supprimees.

1. **Lister les branches locales candidates** (toutes sauf `main` et `staging`) :
   ```bash
   git for-each-ref --format='%(refname:short)|%(committerdate:relative)|%(subject)' refs/heads/ \
     | grep -vE '^(main|staging)\|' \
     | grep -E '^(feat/|fix/|improvement/|chore/|proto/)'
   ```

2. **Pour chaque branche candidate, detecter si elle est deja sur main** :
   ```bash
   # Une branche est consideree mergee si tous ses changements sont deja sur main
   if git diff --quiet "$(git merge-base main "$branch")" "$branch" -- 2>/dev/null; then
     # Pas de changements specifiques a cette branche → safe a supprimer
     STATUS="merged"
   else
     # Changements non encore sur main → garder par defaut
     STATUS="unmerged"
   fi
   ```

3. **Detecter les branches attachees a un worktree lie** (ne jamais les supprimer ici) :
   ```bash
   source .claude/skills/merge/lib/worktree-aware-delete.sh
   # pour chaque branche : si mwt_plan_delete "$branch" commence par DEFER → la garder
   ```

4. **Afficher le tableau** des branches avec leur statut :
   ```
   Branches locales detectees :

   | Branche                      | Dernier commit | Statut    | Suppression |
   |------------------------------|----------------|-----------|-------------|
   | feat/billing-anthropic-keys  | il y a 2 jours | merged    | Recommande  |
   | fix/jwt-es256                | il y a 5 jours | merged    | Recommande  |
   | feat/work-in-progress        | il y a 1 heure | unmerged  | A garder    |
   | feat/session-en-cours        | il y a 1 heure | worktree  | A garder    |
   ```

5. **Demander a l'utilisateur** :
   ```
   Supprimer les branches mergees (locale + remote) ? (oui / non / une par une)
   ```

6. **Selon la reponse** :
   - **`oui`** : pour chaque branche `merged` **(jamais une branche `worktree`)**, executer :
     ```bash
     git branch -D "$branch"
     git push origin --delete "$branch" 2>/dev/null || true
     ```
     (le `-D` force car squash-merge ne laisse pas trace dans `git branch --merged`)
   - **`non`** : skipper et passer a l'Etape 7.
   - **`une par une`** : pour chaque branche `merged`, demander individuellement.

7. **Pour les branches `unmerged`** : ne jamais les supprimer automatiquement. Informer l'utilisateur qu'elles contiennent des changements pas encore sur main.

8. **Pour les branches `worktree`** : ne jamais les supprimer ici (un worktree lié y est attaché). Indiquer `claude-swt-done <timestamp>` pour les retirer proprement.

9. **Afficher le recap** :
   ```
   Branches supprimees : feat/billing-anthropic-keys, fix/jwt-es256
   Branches conservees : feat/work-in-progress (changements non merges), feat/session-en-cours (worktree lié)
   ```

## Etape 7 : Deploiement des Edge Functions en prod via MCP

> Les Edge Functions sont du backend dont le frontend peut dependre. Si une nouvelle Edge Function est appelee par le nouveau frontend, envisager de la deployer **avant le merge** (meme logique que les migrations, Etape 3) plutot qu'ici. Par defaut on les deploie apres le merge ; remonter avant le merge si le frontend en depend immediatement.

1. Verifie si le merge contenait des modifications de Edge Functions :
   ```
   gh pr diff <numero> --name-only | grep "supabase/functions/"
   ```
2. **Si aucune Edge Function modifiee** : Informe et termine.
3. **Si des Edge Functions sont detectees** :
   - Liste les fonctions impactees (extraire le nom du repertoire).
   - **DEMANDE OBLIGATOIREMENT CONFIRMATION** avant toute action.
   - **Si l'utilisateur confirme** : Pour chaque fonction :
     ```
     mcp__supabase__deploy_edge_function(name="<function_name>")
     ```
   - Verifier le deploiement :
     ```
     mcp__supabase__list_edge_functions
     ```

## Etape 8 : Tag de version pour deploiement Docker/Package

Certains projets (ex: SomCraft, ServiceDesk) deploient via des workflows GitHub Actions declenches sur un tag `v*`. Un simple merge sur `main` ne suffit PAS a deployer — il faut creer un tag pour que Docker image et/ou packages npm soient publies.

### Detection

1. Verifier si le projet a des workflows declenches par tags :
   ```bash
   grep -l "tags:\s*$" .github/workflows/*.yml 2>/dev/null || grep -l "tags:" .github/workflows/*.yml 2>/dev/null
   ```
   Ou plus precis :
   ```bash
   grep -l "'v\*'" .github/workflows/*.yml 2>/dev/null
   ```

2. **Si aucun workflow sur tag detecte** : Informer "Aucun workflow de release sur tag — rien a deployer via tag" et terminer.

3. **Si des workflows sur tag sont detectes** : Lister les workflows concernes (ex: `docker.yml`, `publish.yml`).

### Calcul de la prochaine version

1. Recuperer le dernier tag :
   ```bash
   git tag --sort=-v:refname | head -1
   ```
2. Par defaut, proposer un bump **patch** (ex: `v0.6.3` → `v0.6.4`).
3. Si le merge inclut des changements majeurs (BREAKING, nouveau feature important), proposer aussi les options minor/major.

### Confirmation

Afficher un recapitulatif et **DEMANDER OBLIGATOIREMENT CONFIRMATION** :
```
Dernier tag : v0.6.3
Prochaine version suggeree : v0.6.4 (patch)
Workflows declenches : Publish Docker Image, Publish Packages
On tag v0.6.4 ?
```

L'utilisateur peut :
- **Confirmer** la version suggeree
- **Proposer une autre version** (ex: "non, v0.7.0")
- **Refuser** le tag — informer que la PR est mergee mais pas deployee, le tag peut etre cree manuellement plus tard

### Execution

Apres confirmation :
```bash
git tag <version>
git push origin <version>
```

Puis verifier que les workflows sont bien queued :
```bash
gh run list --branch <version> --limit 3 --json name,status,url
```

Afficher les URLs pour que l'utilisateur puisse suivre :
```
- Publish Docker Image: https://github.com/.../actions/runs/...
- Publish Packages:     https://github.com/.../actions/runs/...
```

### Monitoring (optionnel)

Proposer a l'utilisateur de monitorer jusqu'a completion des workflows via le tool `Monitor` ou `gh run watch`. Pas obligatoire — l'utilisateur peut choisir de passer a autre chose.

## Regles de securite

- **Toujours deployer les migrations AVANT le merge** : le merge sur `main` declenche le deploiement frontend ; la BD doit etre prete avant. Ne jamais merger une PR contenant des migrations sans les avoir appliquees (ou explicitement decide de suspendre la livraison).
- Ne jamais faire de `git push --force`.
- Ne jamais merger sans confirmation explicite de l'utilisateur.
- Ne jamais utiliser `supabase db push --linked`.
- Ne jamais supprimer la branche `staging` (ni locale, ni remote).
- Ne jamais utiliser `--delete-branch` sur une PR dont la source est `staging`.
- Ne jamais supprimer une branche locale attachee a un worktree lie (plan `DEFER`) — toujours passer par `claude-swt-done <timestamp>`.
- Ne jamais pousser de migrations ou Edge Functions en production sans confirmation explicite.
- Ne jamais creer/pusher un tag de release sans confirmation explicite de la version (l'utilisateur peut refuser ou proposer une autre version).
- Ne jamais supposer qu'un merge sur `main` suffit a deployer : verifier les workflows GitHub Actions et tagger si necessaire.
- En cas d'erreur git ou gh, afficher l'erreur clairement et proposer une solution.

## Annexes du skill

- `lib/worktree-aware-delete.sh` — plan de suppression de branche worktree-aware (`mwt_plan_delete` → PROTECTED / DELETE / DEFER ; `mwt_in_linked_worktree`). Sourçable, pur, testable.
- `tests/test-worktree-aware-delete.sh` — test (repo jetable + worktrees réels) couvrant les 4 plans + la détection de worktree lié. Lancer : `bash .claude/skills/merge/tests/test-worktree-aware-delete.sh`.
- `tests/test-migration-before-merge.sh` — garde-fou anti-régression : verifie que la section « Deploiement des migrations » apparait AVANT la section « Merge de la PR » dans ce SKILL.md. Lancer : `bash .claude/skills/merge/tests/test-migration-before-merge.sh`.
