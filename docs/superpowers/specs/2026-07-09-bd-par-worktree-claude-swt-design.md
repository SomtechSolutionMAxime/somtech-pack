# BD Supabase isolée et légère par worktree `claude-swt` — Design

- **Demande** : D-20260709-0003
- **Date** : 2026-07-09
- **Statut** : design validé (brainstorm), en attente de plan d'implémentation
- **Portée** : transversale Somtech (tout projet utilisant `claude-swt` + Supabase local)

---

## 1. Problème

`claude-swt` fait naître un worktree isolé par session de dev (`~/worktrees/<repo>/<timestamp>`). Plusieurs
worktrees tournent en parallèle. Aujourd'hui, ils n'ont pas de BD dédiée : soit ils se partagent le même
Supabase local (données et migrations qui se marchent dessus, collision de ports), soit chacun lance son propre
`supabase start` complet — ~12 conteneurs Docker, ~2-3 Go RAM par stack. Deux ou trois worktrees suffisent à
mettre la machine à genoux.

Le besoin : **chaque worktree dispose de sa propre BD isolée, au coût de ressources le plus bas possible**, avec
la possibilité de choisir la richesse de la stack selon ce sur quoi on travaille (« ça dépend du worktree »).

L'isolation n'est **pas** le problème : le CLI Supabase isole déjà chaque stack par `project_id`. Le problème est
le **poids**.

---

## 2. Direction retenue

**Profils Supabase élagués** (direction A du brainstorm). Chaque worktree garde sa propre stack CLI Supabase,
isolée, mais on ne démarre que les services nécessaires au profil choisi au lancement. Le gain vient de couper
tout le superflu, pas de mutualiser de l'infra.

Directions écartées et pourquoi :

- **B — Postgres mutualisé** (1 Postgres partagé, une database logique par worktree) : empreinte minimale
  absolue, mais casse le modèle CLI Supabase (migrations à la main, `db reset` inopérant), `auth.uid()`/RLS
  délicat sans GoTrue dédié, isolation seulement logique. Gardée en **plan de repli** si le benchmark montre que
  l'élagage ne suffit pas.
- **C — Hybride** (Postgres nu en léger, stack complète en lourd) : deux chemins de code à maintenir, et un
  Postgres nu n'a pas le schéma `auth` de Supabase → des migrations échouent. Écartée.

---

## 3. Composants

### 3.1 Profils (mapping déclaratif profil → services)

| Profil | Services démarrés | Services coupés |
|---|---|---|
| `db` (défaut) | postgres, postgrest, pg-meta | auth, storage, realtime, studio, imgproxy, edge-runtime, **analytics/vector**, inbucket |
| `auth` | + gotrue, kong | storage, realtime, studio, imgproxy, edge-runtime, analytics |
| `full` | stack complète (comportement CLI actuel) | rien |

Mécanisme : `supabase start -x <liste,de,services>` exclut des services **sans modifier `config.toml`**.
`analytics` + `vector` (Logflare) sont coupés dès `db`/`auth` — c'est le poste de ressources le plus lourd.

> ⚠️ **Hypothèse à valider (H1)** : le flag `-x` accepte d'exclure l'ensemble de ces services (noms exacts et
> combinaisons). Vérifié à l'étape 0. `postgres` et le socle non-excludables restent la borne basse.

### 3.2 Isolation des ports

Deux stacks Supabase simultanées entrent en collision sur les ports hôte (le CLI lit ports et `project_id`
depuis `config.toml`). Solution : `claude-swt` patche le `config.toml` **du worktree** :

- `project_id = <repo>-<sess>` (unique par worktree) ;
- ports = base + **offset déterministe par session**, dans la plage réservée **54321-54499**
  (`~/.claude/ports-inventory.json`). Une stack consomme ~8 ports → stride ~20 → ~8 worktrees simultanés, ce qui
  couvre l'usage réel.

> ⚠️ **Piège géré (P1)** : `config.toml` est un fichier **tracké**. Le patcher le ferait apparaître dans
> `git status --porcelain`, ce qui déclencherait la conservation du worktree au teardown (claude-swt ligne 91) et
> **casserait l'auto-teardown**. Mitigation : `git update-index --skip-worktree supabase/config.toml` juste après
> le patch, pour masquer la modif du statut. Réversible (`--no-skip-worktree`).

> ⚠️ **Hypothèse à valider (H2)** : plusieurs stacks CLI coexistent proprement sur des ports/`project_id`
> distincts sans interférence (réseau Docker, noms de conteneurs, volumes). Vérifié à l'étape 0.

### 3.3 Allocation d'offset

Registre léger d'attribution des offsets, pour garantir l'unicité entre worktrees vivants :

- source de vérité : les stacks Supabase réellement démarrées (`supabase status` / conteneurs Docker nommés par
  `project_id`) + `~/.claude/ports-inventory.json` pour la plage réservée ;
- offset dérivé de la session avec **détection de collision** (si l'offset calculé est déjà pris par un worktree
  vivant, on prend le suivant libre). Éviter un pur hash sans vérification (risque de collision silencieuse).

### 3.4 Injection des credentials dans le worktree

`supabase start` émet l'URL de l'API, la `anon key` et la `service_role key` de **cette** stack. Pour que
`npm run dev` dans le worktree parle à sa propre BD, `claude-swt` écrit un `.env.local` (gitignored) dans le
worktree avec ces valeurs (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, …). Les ports étant
distincts par worktree, chaque `.env.local` pointe vers la bonne stack.

> **Règle d'or n°12** : la `service_role key` reste un secret local de dev (jamais commitée — `.env.local` est
> gitignored). On ne l'expose pas dans du code livré. Ici c'est un environnement de dev local isolé, conforme.

### 3.5 Intégration dans `claude-swt`

Deux points d'accroche dans `scripts/shell/claude-swt.sh` (`_claude-swt-launch`) :

- **Au launch** (après le `worktree add`, avant le lancement de `claude`, autour de la ligne 66-68) :
  1. si le repo n'a pas `supabase/config.toml` → ne rien faire (worktrees docs/refactor/somtech-pack : coût nul) ;
  2. résoudre le profil : flag CLI (`--db`/`--auth`/`--full`/`--no-db`) > défaut `db` ;
  3. patcher `config.toml` (project_id + ports) puis `skip-worktree` ;
  4. `supabase start -x <exclus-du-profil>` ;
  5. `supabase db reset` pour appliquer les migrations → BD prête avec le schéma ;
  6. écrire `.env.local`.
- **Au teardown** (après le quit, lignes 89-102) :
  - `supabase stop --project-id <id>` **systématique** (libère la RAM/CPU même si la session est conservée) ;
  - volumes **détruits** si la session est terminée (worktree retiré) ; **conservés** si la session est gardée
    pour reprise (redémarrage rapide, sinon `db reset` au prochain launch les recrée).

Flags ajoutés à `claude-swt` : `--db`, `--auth`, `--full`, `--no-db`. Rétro-compat : sans repo Supabase, le
comportement est strictement inchangé.

### 3.6 Découpage du code

- `scripts/shell/claude-swt.sh` : câblage launch/teardown + parsing des flags.
- `scripts/shell/swt-db.sh` (nouveau) : lib isolée et testable — mapping profil→services, allocation d'offset,
  patch `config.toml`, écriture `.env.local`, `stop`/cleanup. `claude-swt.sh` l'appelle ; la lib ne connaît pas
  claude-swt (interface par arguments : repo, worktree, session, profil).

---

## 4. Compatibilité workflow Somtech

`supabase db reset`, création/ordre des migrations, MCP push prod : **inchangés**. Le worktree conserve un
`config.toml` valide, seulement sur d'autres ports/`project_id`. `reference_gestion-des-ports.md` documente
l'allocation dynamique dans la plage réservée ; `reference_supabase-local.md` documente le mode par worktree.

---

## 5. Étape 0 — Benchmark (dé-risque la direction)

**À faire avant tout câblage.** Mesurer, sur la machine cible :

1. RAM/CPU d'un `supabase start` complet (baseline) vs profil `db` élagué
   (`-x analytics,vector,studio,imgproxy,realtime,storage-api,edge-runtime,inbucket`) vs profil `auth` ;
2. le nombre de stacks `db` qui tiennent simultanément dans une enveloppe raisonnable ;
3. valider **H1** (le `-x` accepte ces exclusions) et **H2** (coexistence propre de plusieurs stacks).

**Critère de décision** : si le profil `db` ne descend pas assez bas (ex. < ~400-500 Mo/stack) ou si N stacks ne
tiennent pas, on rebascule vers la **direction B** (Postgres mutualisé) sans avoir jeté la lib `swt-db.sh` (le
mapping profils et l'injection de credentials restent réutilisables).

---

## 6. Tests (règle d'or n°6 — rouge avant vert)

Dans `scripts/tests/` (à côté des `test-claude-swt-*.sh` existants) :

- **allocation d'offset non-collidante** : deux sessions simulées vivantes → offsets/ports distincts ; libération
  → offset réutilisable.
- **mapping profil→services** : `db`/`auth`/`full` produisent la bonne liste d'exclusions `-x`.
- **patch + skip-worktree** : après patch, `config.toml` a les bons ports/`project_id` **et** n'apparaît pas dans
  `git status --porcelain` (protège l'auto-teardown).
- **teardown appelle toujours `stop`** : quitter une session (conservée ou terminée) invoque
  `supabase stop --project-id` ; volumes détruits seulement si terminée.
- **rétro-compat** : repo sans `supabase/config.toml` → aucun appel Supabase, comportement claude-swt identique.

Chaque test doit être **rouge avant l'implémentation** de la brique correspondante.

---

## 7. Traçabilité et documentation

- **Demande** : D-20260709-0003 (Somtech Pack). Découpage en stories à faire au plan d'implémentation.
- **ADR/REF Architecture** : décision transversale → consigner dans le dossier Architecture (REF puis ADR si
  adoptée), en lien avec le design worktree existant
  (`docs/superpowers/specs/2026-06-23-worktree-par-terminal-parallelisme-design.md`).
- **Mémoires à MAJ** : `reference_supabase-local.md`, `reference_gestion-des-ports.md`.

---

## 8. Risques ouverts (à lever en priorité)

| # | Risque | Levée |
|---|---|---|
| H1 | `-x` n'accepte pas toutes les exclusions visées | Étape 0 (benchmark) |
| H2 | Plusieurs stacks CLI ne coexistent pas proprement | Étape 0 (benchmark) |
| P1 | Patch `config.toml` casse l'auto-teardown | `skip-worktree` (§3.2) + test dédié (§6) |
| R1 | L'élagage ne descend pas assez bas en RAM | Repli direction B, lib réutilisable (§5) |
| R2 | Le `db reset` au launch ralentit l'ouverture d'une session | Option : reset lazy / en arrière-plan pendant que `claude` démarre |
