---
name: audit-preprod
description: |
  Auditer une fonction déjà livrée mais jamais validée formellement, AVANT de la
  déclarer bonne pour la production. Orchestre un audit multi-axes (BRD/traçabilité,
  code applicatif, DB/sécurité, tests/CI) qui sonde l'ÉTAT RÉEL DÉPLOYÉ (branche sur
  origin/main + BD prod ET staging via MCP), vérifie chaque finding de façon
  adversariale, calibre la sévérité contre la baseline du projet, et produit un
  rapport priorisé + un projet ServiceDesk.
  TRIGGERS : audit pré-production, audit preprod, valider une fonction avant prod,
  audit d'une fonction livrée mais non validée, re-audit de l'état déployé,
  vérifier une feature en prod jamais recettée, /audit-preprod.
  Utiliser dès qu'une fonction est codée/déployée mais n'a jamais eu de validation
  formelle, ou pour un re-audit après une série de correctifs. NE PAS confondre avec
  audit-securite (audit de sécurité pur, toutes couches) ni audit-rls (RLS d'une table).
disable-model-invocation: false
# Pas de `allowed-tools` restrictif : cet orchestrateur a besoin de Task (sub-agents),
# Bash/Read/Grep/Glob (analyse statique) ET des MCP servicedesk + somcraft + supabase
# (sondage live + livrable). Les noms MCP varient selon la session — une whitelist
# bloquerait la livraison. La garantie « lecture seule » est portée par les garde-fous
# ci-dessous (instructions), pas par un sandbox d'outils.
---

# Audit pré-production d'une fonction — `/audit-preprod`

Orchestrateur d'audit d'une **fonction déjà déployée mais jamais validée formellement**.
Un audit pré-production **n'est pas une revue de code de plus** : il vérifie ce qu'une
revue de diff ne voit pas — l'**état réel** des environnements déployés, la **cohérence**
d'application des règles, et si les garde-fous (tests) **tournent vraiment**.

> **Cadre** : RETEX Somcraft `d897bd45` (`/standards/retex-audit-preproduction-fonction.md`),
> issu de l'audit réel du module *ma-place-rh / sondage climat* (Construction Gauthier,
> 2026-06-30 — projets `P-20260630-0001` / `P-20260630-0002`). Mirror structurel de
> `audit-securite`.

---

## ⛔ Garde-fous (NON négociables — lire avant tout)

1. **Lecture seule partout** sauf deux écritures finales : le rapport Somcraft et le
   projet + tickets ServiceDesk. **Aucune** migration, **aucun** SQL destructif, aucune
   écriture/suppression de données, aucun `apply_migration`. Accès Supabase = introspection
   / `SELECT` uniquement.
2. **On audite l'état DÉPLOYÉ, pas l'arbre de travail.** Le code de référence est une
   branche prise sur **`origin/main`** (ce qui est en prod), et on sonde les **BD prod ET
   staging réelles** via MCP. Un audit qui lit seulement le working tree rate le drift,
   les grants et les policies réellement en place.
3. **Sonde le réel, ne déduis pas.** Un finding « live » (grant, policy, exécutabilité
   `anon`, présence d'un test dans un gate CI) n'est **jamais** conclu depuis le seul
   code : il est **prouvé** par une requête sur l'environnement réel. Corroborer avec les
   outils natifs quand ils existent (`get_advisors`).
4. **Les sous-agents n'ont PAS de MCP/Somcraft.** (Friction n°1 du RETEX §3.1.) Le
   sondage live (prod/staging) et **toute** écriture documentaire (Somcraft/ServiceDesk)
   restent à l'**orchestrateur**. Les sous-agents font **lecture de code + analyse**, et
   **listent ce qui doit être vérifié en live** — ils ne le vérifient pas eux-mêmes.
5. **Repo courant uniquement** (règle d'or n°7). Aucune action sur un autre repo,
   aucune action cross-projet. Le MCP Supabase ne doit viser que le `project_ref` du repo.
6. **Prod = lecture seule stricte.** On lit prod pour constater l'état réel ; on n'y
   écrit **jamais**, on n'y applique **aucune** correction (règles d'or n°2 et n°3).
7. **Secrets** : ne jamais lire, copier ni exfiltrer un secret à droits élevés. Détecter
   sa présence indue sans **jamais** recopier sa valeur (masquer : `sb_secret_••••`).
8. **Tickets/stories uniquement sur verdict `confirme` ou `incertain`** (après la phase 4).
   **Jamais** sur un finding `refute` (annexe du rapport seulement) ni non vérifié.

Si une étape exige de violer un garde-fou → **arrêter l'axe concerné** et le consigner
dans le rapport (« axe non exécuté — raison »), sans contourner.

---

## Discipline de contexte (RETEX §3.2 & §3.5)

Orchestrer N agents + lire de gros artefacts fait exploser le contexte. **Déléguer
agressivement, garder les gros outputs dans des fichiers, ne ramener que les findings.**

- **Gros document = slice par plage de caractères / `grep` sur le fichier sauvegardé**,
  jamais tout charger en contexte. Vaut pour le BRD `.md` (~160K), la sortie
  `get_advisors` (~477K), les gros dumps. Filtrer `get_advisors` par objet audité.
- **Scratch non versionné** : tout artefact volumineux récupéré (projection BRD, dumps
  advisors) va dans le répertoire scratch de session, jamais dans le repo.

---

## Schéma de finding (contrat inter-phases — identique dans tous les axes)

Chaque sub-agent d'axe **renvoie une liste de findings** à ce schéma. La phase 3 remplit
les champs `live_*` (sondage orchestrateur), la phase 4 remplit `verdict` + les
**3 dimensions**. **Chaque finding porte 3 dimensions** (RETEX §2.4 & §3.4) : sans elles,
on crie au loup ou on minimise à tort.

```yaml
finding:
  id: string                # stable dans un run : <PREFIXE>-NNN (voir préfixes ci-dessous)
  axe: brd|code|db-securite|tests-ci
  titre: string
  description: string
  cible: string             # fichier:ligne | endpoint | table | fonction | workflow CI
  preuve_statique: string   # extrait de code / config (ce que le sous-agent a lu)
  a_sonder_en_live: string|null  # ce que l'orchestrateur doit prouver sur prod/staging (phase 3)
  remediation: string
  reference: string|null    # EF/RA du BRD | STD-xxx | ADR-xxx | CWE-xxx | null
  # --- rempli en phase 3 (orchestrateur, sondage réel) ---
  live_prod: string|null    # constat réel prod (requête + résultat) | null si N/A
  live_staging: string|null # constat réel staging
  corroboration: string|null # ex. "get_advisors confirme" | "advisor muet"
  # --- rempli en phase 4 (vérif adversariale + calibration) ---
  severite: critique|high|medium|low|null   # calibrée, pas brute
  exploitabilite: string|null   # scénario CONCRET d'exploitation, ou "non exploitable — <raison>"
  ecart_baseline: string|null   # ce pattern est-il un outlier ou la norme du projet ? (ex. "167× dans le projet")
  verdict: confirme|refute|incertain|null
  raison_verdict: string|null
```

**Préfixes d'`id` par axe** : `brd → BRD-`, `code → APP-`, `db-securite → DBSEC-`,
`tests-ci → CI-`.

**Mapping sévérité → priorité de ticket** (phase 5) : `critique → high`, `high → high`,
`medium → medium`, `low → low`.

---

## Entrée

Argument attendu : la **fonction / le module** à auditer (ex. `/audit-preprod module=ma-place-rh/climat`
ou en langage naturel « audite la fonction sondage de climat »). Argument optionnel
`--axe <nom>` (répétable) : `brd`, `code`, `db-securite`, `tests-ci`. **Défaut = tous.**

Avant de commencer, charger le contexte :
- `.somtech/app.yaml` (STD-027) → `url_staging`, `supabase_ref`/`project_ref` **prod**,
  `app_slug`, `somcraft.workspace_id`, refs staging. **Requis** pour le sondage live ;
  si absent, le signaler — l'audit tombe en mode statique dégradé (couverture réduite).
- `/ontologie/02_ontologie.yaml` (si présent) → entités concernées par la fonction.
- Le **pointer BRD** (voir phase 1) pour l'axe `brd`.

Puis dérouler les 5 phases ci-dessous, dans l'ordre.

---

## Phase 1 — Cadrage & projection BRD *(orchestrateur, séquentiel)*

**But** : figer le périmètre déployé et préparer les entrées des sous-agents (qui n'ont
ni MCP ni Somcraft — c'est ici qu'on résout leurs deux frictions).

1. **Prendre une branche sur `origin/main`** (état prod) : `git fetch origin && git worktree`
   déjà en place — vérifier que le code lu correspond bien à `origin/main`, pas à une
   branche de feature locale. Identifier les **fichiers, migrations et le périmètre
   déployé** de la fonction (routes, composants, tables, RPC, Edge Functions, workflows CI).
2. **Projection BRD éphémère** (RETEX §3.2, option A — la retenue) : l'orchestrateur
   récupère le `brd.yaml` via `get_brd_pointer` (ServiceDesk, cf. STD-033 / STD-031 §2.7.8)
   au **bon grain** (module si `module_id` non-NULL, sinon app) et l'écrit dans un
   **fichier de scratch non versionné**. On passe **le chemin** aux sous-agents. La
   projection YAML (EF/RA/HS structurés, sans narratif) est bien plus petite que le `.md`
   de ~160K → un seul appel MCP au lieu de slicer.
   - ⚠️ **Vérifier la fraîcheur** : comparer la `version` du pointer YAML à la version
     d'en-tête du `.md`. Dans l'audit réel, le pointer **traînait** (0.12.0 vs doc plus
     avancé). Si désync → re-sync (`set_brd_pointer`) **ou** retomber sur le `.md` pour ce
     run (slice/grep). **Jamais** de copie BRD versionnée dans le repo (option B rejetée :
     elle dérive de Somcraft et devient un mensonge).
3. Produire la **carte de cadrage** (passée à chaque sous-agent) :

```yaml
cadrage:
  fonction: string                 # nom lisible de la fonction/module auditée
  app_slug: string
  ref_git: string                  # commit d'origin/main audité
  supabase_ref_prod: string|null
  supabase_ref_staging: string|null
  somcraft_workspace_id: string|null
  fichiers: [string]               # fichiers du périmètre déployé
  migrations: [string]             # supabase/migrations/* de la fonction
  routes_pages: [string]
  routes_api: [string]             # app/**/route.ts | supabase/functions/*
  tables_rpc: [string]             # tables + fonctions SQL de la fonction
  workflows_ci: [string]           # .github/workflows/* pertinents
  brd_yaml_path: string|null       # chemin scratch de la projection BRD (ou null → mode .md)
  brd_frais: true|false            # résultat du check de fraîcheur
```

> **Drift ontologie** (règle d'or n°1) : si une entité évidente de la fonction est absente
> de l'ontologie, le **signaler** dans le rapport (section couverture) — ne pas auditer en
> silence par-dessus.

---

## Phase 2 — Fan-out par axe *(sub-agents, analyse statique, PARALLÈLE)*

Pour **chaque axe demandé** (défaut = tous), dispatcher **un sub-agent** (Task) avec le
prompt d'axe + la carte de cadrage. Les axes sont indépendants → les lancer **en
parallèle** (un seul message, plusieurs Task). **Agent frais, jamais l'auteur du code ;
posture adversariale (« trouve les trous, pas valider »).**

| Axe | Prompt | Question centrale |
|---|---|---|
| `brd` | `prompts/axe-brd.md` | chaque comportement livré est-il tracé à une EF/RA du BRD ? |
| `code` | `prompts/axe-code.md` | bugs, régressions, **corrections incomplètes**, états limites |
| `db-securite` | `prompts/axe-db-securite.md` | RLS, grants, `SECURITY DEFINER` (search_path + EXECUTE), anon |
| `tests-ci` | `prompts/axe-tests-ci.md` | les tests **existent** ET **tournent dans un gate bloquant** ? |

**Rappel garde-fou n°4** : ces sous-agents lisent le code et **listent** dans
`a_sonder_en_live` ce qu'il faut prouver sur prod/staging — ils **ne sondent pas** (pas
de MCP). Ne jamais supposer qu'un sous-agent a MCP/Somcraft.

**Sortie de la phase 2** : une **liste agrégée** de findings (tous axes), au schéma commun,
`live_*` et `verdict`/dimensions encore vides. Préfixer les `id` par axe.

---

## Phase 3 — L'orchestrateur sonde le réel *(le cœur de l'audit)*

L'orchestrateur **ferme les angles morts des sous-agents** (RETEX §2.6). Pour chaque
finding dont `a_sonder_en_live` est non-null :

1. **Sonder prod ET staging** via MCP Supabase (`execute_sql` en `SELECT`/introspection,
   `list_tables`, `get_logs`) : grants réels (`information_schema.role_routine_grants`,
   `has_function_privilege('anon', …)`), policies (`pg_policies`), présence/état d'objets.
   Remplir `live_prod` et `live_staging` avec **la requête + son résultat**.
2. **Corroborer avec les outils natifs** : `get_advisors` (filtré par objet audité — c'est
   énorme, ne pas tout charger). Noter dans `corroboration` si l'advisor confirme ou reste
   muet. Rappel RETEX §2.3 : « le code fait REVOKE donc c'est OK » est faux — Supabase peut
   accorder `EXECUTE` à `anon` par un chemin que `REVOKE FROM PUBLIC` ne couvre pas. **Le
   réel tranche.**
3. **Inventaire de cohérence d'une règle** (RETEX §3.3, angle mort n°1) : quand un finding
   porte sur une **règle** (« REVOKE anon sur les SECURITY DEFINER », « toute table user a
   une policy `user_id = auth.uid()` »), ne pas se contenter d'un spot-check — faire
   l'**inventaire exhaustif** de son application sur le périmètre (ex. « appliquée 4/10 »).
   La cohérence partielle est elle-même un finding.
4. **Divergence prod vs staging** : si `live_prod ≠ live_staging`, c'est un finding en soi
   (rupture de la synchronicité, règle d'or n°3).

> Si le sondage live est **impossible** (pas de `.somtech/app.yaml`, MCP absent), ne pas
> deviner : marquer le finding `incertain` avec `live_*: "non sondé — <raison>"` et
> l'escalader dans le rapport. Un audit honnête distingue « prouvé » de « supposé ».

---

## Phase 4 — Vérification adversariale + calibration 3 dimensions

Pour **chaque finding**, dispatcher un sub-agent **réfutateur** (prompt
`prompts/verif-adversariale.md`, lecture de code seule, **pas de MCP** — il s'appuie sur
`live_prod`/`live_staging` déjà remplis par l'orchestrateur). Dispatcher par lot pour le
parallélisme. Sa mission : **chercher pourquoi c'est un faux positif** ET **calibrer les
3 dimensions**.

Chaque finding ressort avec :
- `severite` **calibrée** (pas la sévérité brute d'un axe) ;
- `exploitabilite` = **scénario concret** (« un utilisateur `anon` appelle `RPC X` avec…
  et obtient… ») ou « non exploitable — <raison, ex. garde applicative en amont> » ;
- `ecart_baseline` = ce pattern est-il un **outlier** ou la **norme** du projet ? (ex.
  « pattern présent 167× → la fonction n'est pas un outlier, mais l'incohérence interne
  4/10 en est un »).

**Règle de verdict** (RETEX §2.4 + garde-fou anti-sous-estimation) :
- preuve live solide + réfutation non trouvée → `confirme` ;
- réfutation trouvée et étayée (guard compensatoire, contrôle ailleurs, contexte non
  atteignable) → `refute` + raison ;
- doute → `incertain`. **Tout finding `critique`/`high` douteux reste `incertain`**
  (escaladé), **jamais** `refute` silencieux. Le défaut « réfuté » ne vaut que pour les
  `medium`/`low` à preuve faible.

**Cross-check orchestrateur avant publication** (RETEX §3.4) : l'orchestrateur relit les
3 dimensions de chaque finding `confirme`/`incertain` et corrige toute sévérité sur/sous-
évaluée. Un finding brut « MAJEUR » sans contexte d'exploitabilité + baseline est réputé
non calibré → renvoyer en calibration.

---

## Phase 5 — Livrable *(rapport priorisé + projet ServiceDesk)*

Suivre le gabarit `references/livrable.md`. En résumé — **un seul rapport** qui transforme
l'audit en **décision** (RETEX §2.5) :

**A. Rapport Somcraft** — `write_document` du MCP Somcraft de la session, workspace
**client** (`somcraft.workspace_id`), path
`/operations/<app-slug>/audits/audit-preprod-<fonction>-<YYYY-MM-DD>.md`. Contenu :
verdict global (bon pour prod ? oui/non/sous conditions), **tableau des écarts
(sévérité × exploitable ?)**, **plan priorisé P1/P2/P3 (effort × bloquant service ?)**
distinguant « bloquant service » vs « dette planifiée », matrice de couverture (axes
exécutés/sautés), annexe des `refute`.

**B. Projet ServiceDesk** (findings `confirme`/`incertain` — RETEX §4.5, « officialiser »).
Un **projet** (pas juste un epic) tracé au rapport, ses epics/stories tracés aux findings
et aux EF du BRD. Détails, G/W/T, mapping priorité, anti-bruit et masquage des secrets :
voir `references/livrable.md`.

> **Anti-bruit & secrets** : aucun ticket/story sans `confirme`/`incertain` ; jamais la
> valeur d'un secret dans le rapport ou un ticket (masquer). `application_id` /
> `workspace_id` réels, récupérés des sources — **jamais inventés**.

---

## Critères de succès

- Un run produit un **rapport priorisé** + un **projet ServiceDesk** sans intervention
  manuelle, avec un **verdict go/no-go** clair.
- Chaque finding `confirme` porte ses **3 dimensions** (sévérité calibrée · scénario
  d'exploitabilité · écart baseline) et une **preuve live** (prod et/ou staging), pas une
  déduction du code.
- Les **deux angles morts structurels** du RETEX sont couverts : (a) **cohérence d'une
  règle** vérifiée par inventaire exhaustif (pas spot-check) ; (b) « **tests existent** »
  et « **tests tournent en CI** » traités comme **deux questions séparées**.
- Faible taux de faux positifs : tout `critique`/`high` listé est exploitable (scénario)
  ou marqué `incertain`.
- **Zéro écriture DB, zéro action prod, zéro action hors repo courant**, aucun secret en
  clair, aucune copie BRD versionnée.
