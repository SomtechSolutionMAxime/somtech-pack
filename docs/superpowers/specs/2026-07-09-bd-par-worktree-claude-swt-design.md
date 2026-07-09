# BD Supabase isolée et légère par worktree `claude-swt` — Design

- **Demande** : D-20260709-0003
- **Date** : 2026-07-09
- **Statut** : implémenté & testé (benchmark GO, lib + intégration livrées sur `feat/D-20260709-0003-…`)
- **Traçabilité** : Epic E-20260709-0009 · T-0037 (benchmark) · T-0038 (lib) · T-0039 (intégration) · T-0040 (docs)
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

| Profil | Services démarrés | RAM mesurée | Services coupés (`-x`) |
|---|---|---|---|
| `db` (défaut) | **postgres seul** | **65 Mo** | tous les 13 excludables |
| `auth` | postgres, postgrest, postgres-meta, gotrue, kong | 293 Mo | realtime, storage-api, imgproxy, mailpit, studio, edge-runtime, logflare, vector, supavisor |
| `full` | stack complète (comportement CLI actuel) | 1673 Mo | rien |

Mécanisme : `supabase start -x <liste,de,services>` exclut des services **sans modifier `config.toml`**.
`logflare` + `vector` (analytics) sont coupés dès `db`/`auth` — c'est le poste de ressources le plus lourd.

> ✅ **H1 levée (benchmark)** : le CLI 2.78.1 accepte d'exclure les 13 services
> (`gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`).
> **Correction de conception** : le profil `db` ne peut PAS garder PostgREST — sans `kong`, le health check
> `/rest-admin/v1/ready` échoue et le CLI arrête la stack. PostgREST/kong montent donc au profil `auth`, et `db`
> devient **Postgres seul** (1 conteneur, 65 Mo). Noms réels du CLI : `gotrue` (auth), `storage-api` (storage),
> `postgres-meta` (pg-meta), `logflare` (analytics), `mailpit` (ex-inbucket), `supavisor` (pooler).

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

> ✅ **H2 levée (benchmark)** : deux stacks `db` démarrées simultanément sur `project_id` + offsets distincts
> coexistent sans collision (68 + 67 Mo).

### 3.3 Allocation d'offset

Offset ∈ **[1..8]** (offset 0 = ports `5432x` par défaut, réservés au dev hors worktree ; 8 × stride 20 reste
sous 54499). L'offset est dérivé du hash de la session (`cksum`) puis avancé circulairement jusqu'au premier
**libre**. Deux sources d'occupation sont unies :

1. **Registre** (`~/.claude/swt-db-offsets/<sess>`) — réserve l'offset d'une session même quand sa stack est
   arrêtée (session conservée pour reprise) ;
2. **Scan des ports réels** (`lsof` sur le port db de chaque offset) — **indispensable** : le registre ne voit
   pas les stacks lancées hors du mécanisme (autres worktrees, `supabase start` manuel, anciens projets). Le
   benchmark d'intégration a révélé cette faille : un worktree existant occupait déjà l'offset candidat, invisible
   au registre seul. Le scan est la seule source de vérité fiable.

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

## 5. Étape 0 — Benchmark (exécuté ✅ — verdict GO)

Mesuré sur la machine cible (Supabase CLI 2.78.1, Docker), projets temporaires isolés (T-20260709-0037) :

| Profil | Conteneurs | RAM | Gain vs full |
|---|---:|---:|---:|
| full (baseline) | 12 | 1673 Mo | — |
| auth | 5 | 293 Mo | −82 % |
| **db (Postgres seul)** | **1** | **65 Mo** | **−96 %** |

- **H1 ✅** — les 13 services s'excluent via `-x`.
- **H2 ✅** — deux stacks `db` simultanées coexistent (68 + 67 Mo), aucune collision.
- **R1 ✅** — 65 Mo/stack ≪ critère 400-500 Mo → des dizaines de worktrees tiennent.

**Verdict : GO direction A.** Le critère de repli (si `db` > ~400-500 Mo/stack) n'est pas atteint — la direction B
(Postgres mutualisé) n'est pas nécessaire. La lib `swt-db.sh` resterait néanmoins réutilisable si le contexte
changeait.

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

Livré : `test-swt-db.sh` (unit, ci — pur/filesystem, sans Docker) + `test-swt-db-integration.sh` (smoke test réel
`up`/`down`, se skip si Docker absent). Les 6 tests claude-swt existants restent verts (non-régression).

---

## 7. Traçabilité et documentation

- **Demande** : D-20260709-0003 (Somtech Pack) → Epic E-20260709-0009 → stories T-0037/0038/0039/0040.
- **ADR/REF Architecture** : décision transversale → à consigner dans le dossier Architecture (REF puis ADR si
  adoptée), en lien avec le design worktree existant
  (`docs/superpowers/specs/2026-06-23-worktree-par-terminal-parallelisme-design.md`). **Reste à faire** : le
  dossier Architecture est sur Google Drive (écriture non disponible depuis cette session) — REF à déposer par
  Maxime ou via Somcraft.
- **Mémoires poste MAJ** : `reference_supabase-local.md`, `reference_gestion-des-ports.md`.

---

## 8. Risques (état)

| # | Risque | État |
|---|---|---|
| H1 | `-x` n'accepte pas toutes les exclusions | ✅ levé — 13 services excludables (CLI 2.78.1) |
| H2 | Plusieurs stacks CLI ne coexistent pas | ✅ levé — 2 stacks `db` simultanées OK |
| P1 | Patch `config.toml` casse l'auto-teardown | ✅ géré — `skip-worktree` + test dédié (vert) |
| R1 | L'élagage ne descend pas assez bas en RAM | ✅ écarté — 65 Mo/stack (−96 %) |
| R3 | Collision avec une stack lancée hors du mécanisme | ✅ géré — scan `lsof` des ports réels uni au registre (§3.3) ; attrapé par le test d'intégration |
| R2 | Le start au launch ralentit l'ouverture (~10-35 s) | ⏳ ouvert — profil `db` rapide (1 conteneur) ; option future : start lazy / en arrière-plan pendant que `claude` démarre |
