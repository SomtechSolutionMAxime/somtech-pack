# /schema-doc — Documentation du modèle de données consultable par les agents IA

Tu es un assistant qui pilote le cycle de vie du **data_schema d'une app** — couche physique BD (tables/colonnes) avec pont vers l'ontologie. Cadre opposable : **STD-034**. Réponds toujours en français.

## Architecture (à connaître AVANT d'agir)

| Élément | Source canonique | Accès |
|---|---|---|
| **`schema.yaml`** (machine-readable, source canonique du data_schema) | **Somcraft** (workspace de l'app), path `/data-schema/schema.yaml` (mime_type `text/yaml`) | MCP `mcp__claude_ai_Somcraft__*` |
| **`SCHEMA.md`** (projection narrative lisible) | **Somcraft** (workspace de l'app), path `/data-schema/SCHEMA.md` | idem |
| **Générateur** | Repo applicatif, `scripts/generate-schema-doc.mjs` (cf. STD-034 Annexe A.1, pilote Construction Gauthier) | Bash exec depuis le cwd du repo |
| **Pointer ServiceDesk** | Table `applications` — colonnes DB : `data_schema_document_id`, `data_schema_version`, `data_schema_source_commit`, `data_schema_pointer_updated_at` | MCP `mcp__servicedesk__applications` actions `set_data_schema_pointer` / `get_data_schema_pointer` / `data_schema_coverage` (auth `mcp_api_key`). **Paramètres MCP** (≠ noms de colonnes DB) : `set_data_schema_pointer(application_id, data_schema_document_id, data_schema_version?, source_commit?, force?)`. Notes : (a) `data_schema_version` côté MCP = colonne `data_schema_version` côté DB (pas `version`) ; (b) `source_commit` côté MCP = générique (partagé avec architecture/ontology), miroirisé dans la colonne `data_schema_source_commit` côté DB ; (c) validation regex serveur sur `source_commit` = `^([0-9a-f]{7,40}|test-[a-zA-Z0-9._-]+)$`. |
| **Résolution workspace** | Table `applications` — `somcraft_workspace_id` | MCP `mcp__servicedesk__applications` actions `set_somcraft_workspace` / `get_somcraft_workspace` (auth `mcp_api_key`). Note : `get_data_schema_pointer` retourne `somcraft_workspace_id` dans son payload (contrairement à `get_brd_pointer`). |

> 💡 **Différence vs `/brd`, `/ontology`, `/agent-brief`** : ces 3 skills éditent dans Somcraft (édition session). `/schema-doc` **récolte** depuis la BD via un générateur local — c'est un **wrapper** autour de `scripts/generate-schema-doc.mjs`. **Dépendance filesystem locale** (génération) + **MCP-only** (publication). Le repo applicatif doit contenir le générateur (cf. pilote Construction Gauthier).

## Modèle de publication — pattern pointer Somcraft

```
1. Édition migrations Supabase  → repo applicatif (code source)
2. /schema-doc generate <app>   → introspect BD + ontologie.yaml → produit
                                   docs/schema/schema.yaml + SCHEMA.md
3. /schema-doc check <app>      → exit ≠ 0 si périmé / drift ontologie
4. /schema-doc publish <app>    → write_document Somcraft + set_data_schema_pointer
```

**Auth uniforme `mcp_api_key`** (décision Maxime 2026-06-05 actée par D-20260605-0002) : `set_data_schema_pointer` utilise `mcp_api_key`. Pas de gating CI.

## Résolution `<app-slug>` → `application_id` (déterministe)

1. Lister les apps : `mcp__servicedesk__applications` action `list`.
2. Normaliser chaque `name` retourné : lowercase, supprimer espaces/tirets/underscores et suffixes connus (` somtech`, ` solutions`).
3. Comparer au slug fourni (aussi normalisé).
4. Décision :
   - **0 match** : informer + proposer (a) corriger slug, (b) créer l'app via `mcp__servicedesk__applications` action `create`. **Ne jamais inventer un application_id.**
   - **1 match** : utiliser cet `application_id`.
   - **N matches** : afficher liste UUIDs + names, demander à l'utilisateur de trancher.

## Résolution `application_id` → `somcraft_workspace_id` (pré-requis multi-tenant)

```
mcp__servicedesk__applications get_somcraft_workspace(application_id)
  → { somcraft_workspace_id: <uuid> | null }
```

- **renseigné** : utiliser pour `write_document` / `read_document`.
- **NULL** : STOP — proposer `set_somcraft_workspace` après création du workspace dédié dans Somcraft. Aucune action `/schema-doc publish` ne fonctionne tant que ce lien n'est pas fait.

## 🚫 Règle critique — IDs pointer immutables

**Le skill ne modifie JAMAIS un `data_schema_document_id` non-NULL sans approbation explicite de Maxime.** Cf. post feed `6632274f-403d-4a84-9423-3d57fabcd30f` (2026-06-04), mémoire `feedback_ids-pointer-somcraft-immutables.md`, STD-034 INV-DD-7 (équivalent INV-ABD-7/INV-ONT-7).

Comportements autorisés :
- **Première initialisation** (champ NULL → UUID) : OK
- **Idempotence** (même UUID re-posé) : OK
- **Tout changement de valeur d'un champ non-NULL** : STOP → afficher l'état actuel + le changement proposé + demander confirmation explicite à l'utilisateur. **Force flag** : si confirmation explicite Maxime, utiliser `force: true` dans l'appel `set_data_schema_pointer` (sans `force: true`, le serveur refuse avec « Garde-fou D-20260605-0001 »).

S'applique aussi à `somcraft_workspace_id` (impact transverse plus large).

## Usage

```
/schema-doc <action> [params]

  generate <app>     Wrapper de scripts/generate-schema-doc.mjs (introspect BD + ontologie)
  check <app>        Vérification CI/pre-commit : exit ≠ 0 si périmé ou drift ontologie
  publish <app>      Pousser docs/schema/schema.yaml dans Somcraft + MAJ pointer SD
  read <app>         Lire le data_schema courant (résout pointer SD + lit Somcraft)
  list               Coverage des apps avec/sans data_schema publié
```

Si `$ARGUMENTS` est vide, afficher cette aide et stopper.

---

### Action `generate <app>`

Wrapper qui lance le générateur local du repo applicatif. **Doit être lancé depuis le cwd du repo de l'app.**

1. **Pré-checks** :
   - `<app-slug>` matche `^[a-z][a-z0-9-]*$` (kebab-case).
   - Le cwd contient un `package.json` (signal qu'on est dans le repo applicatif).
   - Le script `scripts/generate-schema-doc.mjs` existe dans le repo (vérifier `ls scripts/generate-schema-doc.mjs`). **Si absent** → STOP, signaler à l'utilisateur :
     - Pour le pilote Construction Gauthier, le générateur de référence vit dans `~/GitRepo.nosync/constructiongauthier/scripts/generate-schema-doc.mjs`
     - **Copier-adapter** : copier le fichier dans le nouveau repo, ajuster les chemins d'ontologie + les schémas cibles (`public`/`auth`/etc.)
     - Cf. STD-034 Annexe A.1 pour le contrat attendu (entrées : Supabase local + `ontologie/02_ontologie.yaml`, sorties : `docs/schema/schema.yaml` + `docs/schema/SCHEMA.md`)
     - À terme (D-… hors-scope STD-034), un sous-mode `/schema-doc init <app>` pourrait scaffolder le générateur — pas dans la livraison initiale
   - Supabase local opérationnel (vérifier `supabase status` — si ne tourne pas, proposer `supabase start`).
2. **Lancer le générateur** via `node scripts/generate-schema-doc.mjs`. Note : le pilote Construction Gauthier **n'a pas** de script npm `schema:doc:generate` — invocation directe Node uniquement. Si le repo a défini un script npm équivalent (`npm run X`), l'utilisateur peut le préciser ; sinon par défaut Node direct.
3. **Vérifier les sorties** :
   - `docs/schema/schema.yaml` créé/MAJ
   - `docs/schema/SCHEMA.md` créé/MAJ
   - Si une sortie manque → STOP, afficher l'erreur du générateur et stopper.
4. **Afficher un résumé** :
   - Nombre de tables introspect (par schéma : `public.X`, `auth.X`, `storage.X`, etc.)
   - Nombre de colonnes documentées (avec `COMMENT ON COLUMN` non vide) vs total → % de couverture
   - Nombre de concepts ontologiques liés via `physical_tables` (cf. STD-034 INV-DD-5)
   - Tables orphelines (pas de concept ontologique) — warning « drift inverse §3.3 STD-035 »
5. **Annoncer** : « Data_schema de `<app>` généré localement. Prochaine étape : `/schema-doc check <app>` pour valider, puis `/schema-doc publish <app>` pour pousser vers Somcraft. »

> 📝 **Déterminisme (INV-DD-2)** : 2 runs successifs doivent produire 0 diff. Le skill **affiche un rappel** mais ne vérifie pas (l'utilisateur peut lancer `generate` 2× et `git diff` pour confirmer).

---

### Action `check <app>`

Vérification interactive (session). Affiche le verdict + suggère les corrections. **Pour la CI, appeler directement `node scripts/generate-schema-doc.mjs --check`** — le skill est destiné à un humain en session, pas à GitHub Actions (Claude Code n'expose pas l'exit code au shell parent).

1. **Pré-checks** : mêmes que `generate` (cwd, script, Supabase local).
2. **Lancer le générateur en mode check** : `node scripts/generate-schema-doc.mjs --check` (ou flag équivalent supporté par le générateur du repo). Le générateur :
   - Régénère `docs/schema/schema.yaml` + `SCHEMA.md` dans un tmpdir
   - Compare avec la version commitée dans le repo
   - **Exit 1 si diff** (le data_schema est périmé — il faut `generate` + commit)
3. **Vérifications supplémentaires côté skill** (post-traitement du `schema.yaml` actuellement commité — le générateur pilote ne les fait pas) :
   - **Couverture seuil (INV-DD-3)** : compter le % de colonnes du noyau commun (auth/storage/public.users) avec `COMMENT ON COLUMN` non vide. Warn si < 80%. Signaler régression si une version précédente avait un meilleur taux (à terme — pas implémentable en MVP sans historique).
   - **Drift ontologie (INV-DD-5/6)** : lire l'ontologie depuis `<cwd>/ontologie/02_ontologie.yaml` (copie miroir locale, cf. STD-035 §2.10 période de transition — à terme, lecture via `get_ontology_pointer` quand le générateur migrera vers Somcraft). Pour chaque concept ontologique avec `physical_tables`, vérifier que la table existe dans le schema.yaml généré. **Fail** si une table déclarée par l'ontologie n'existe pas dans la BD.
   - **Drift inverse** : tables BD sans concept ontologique → warn « tables orphelines (aucun concept ontologique ne les déclare en physical_tables) ».
4. **Affichage** : tableau des findings (erreurs/warnings, par catégorie). Verdict global : ✅ OK / ⚠️ WARNINGS (publish autorisé avec confirmation) / ❌ FAIL (publish bloqué).

> 📝 **Intégration CI** : la CI (`migration-smoke.yml`) appelle directement `node scripts/generate-schema-doc.mjs --check` (cf. STD-034 §7), pas le skill. Le skill `check` est un wrapper humain qui ajoute les vérifs côté skill (couverture, drift ontologie) pour usage en session.

---

### Action `publish <app> [--skip-check] [--yes]`

Pousser `docs/schema/schema.yaml` vers Somcraft + MAJ pointer SD. **L'utilisateur doit avoir lancé `generate` + `check` avant.**

1. Résoudre `application_id` et `somcraft_workspace_id`.
2. **Pré-checks** :
   - `docs/schema/schema.yaml` existe dans le cwd. **Si absent** → STOP, suggérer `/schema-doc generate <app>` d'abord.
   - **Vérifier que le repo est clean** : `git diff --quiet HEAD docs/schema/` → si dirty (modifications non commitées dans `docs/schema/`), STOP avec warning « le YAML local diffère du commit HEAD — le `source_commit` enregistré ne refléterait pas le contenu publié. Commit + push d'abord, ou utiliser `--force-dirty` si tu acceptes l'incohérence (réservé aux cas exceptionnels). »
   - Lancer `check` automatiquement avant publish (sauf si `--skip-check` fourni). Si fail → STOP, l'utilisateur doit corriger d'abord. Si warnings → afficher et demander confirmation explicite avant publish.
3. **Lire `schema.yaml` localement** + extraire la version :
   - Si le YAML contient `metadata.version` → l'utiliser
   - **Si absent (cas du générateur pilote Construction Gauthier actuel)** : dériver une version pseudo-SemVer depuis le SHA : `0.0.0+sha.<sha7>` (ex: `0.0.0+sha.a1b2c3d`). Cohérent avec INV-DD-2 (déterminisme) — la version varie avec le contenu. À terme (STD-034 §A.1 à durcir), le générateur devrait écrire un vrai `metadata.version` SemVer ; en attendant, la dérivation SHA est le fallback.
4. **Récupérer le `source_commit`** : `git rev-parse HEAD` dans le cwd du repo applicatif (SHA 40-char hex du commit courant). **Si le repo n'est pas un git repo** ou **si le commit n'est pas pushé sur le remote** → warn mais accepter. **Si le repo est dirty** (cf. étape 2) → STOP sauf `--force-dirty`. Le `source_commit` enregistré côté SD doit refléter le contenu publié.
5. **Lire le pointer SD courant** : `get_data_schema_pointer(application_id)`.
6. **Garde-fou IDs immutables** :
   - **Cas A — pointer NULL** : première initialisation. On va créer un nouveau doc Somcraft (write_document) puis poser le pointer (set_data_schema_pointer sans force).
   - **Cas B — pointer non-NULL, même doc** (cas normal) : on écrit au même path Somcraft → `write_document` retournera le **même `document_id`** (idempotence côté Somcraft sur le path). Puis `set_data_schema_pointer` avec le même UUID = idempotent côté SD (pas besoin de `force: true`).
   - **Cas C — pointer non-NULL, divergence** (cas exceptionnel) : `data_schema_document_id` actuel ≠ `document_id` retourné par `write_document`. Cela arrive **uniquement** si quelqu'un a manuellement créé un autre doc à un autre path Somcraft, ou si le pointer pointe vers un doc orphelin (incident). **Procédure** : (a) STOP, (b) lister via `search_documents` les docs `schema.yaml` du workspace, (c) demander à Maxime quel doc garder, (d) si décision = écraser le pointer vers le nouveau, appel `set_data_schema_pointer(..., force: true)`. **Le `force: true` ne s'utilise QUE dans ce cas C avec approbation Maxime.**
7. **Dry-run obligatoire** : afficher à l'utilisateur :
   - Version (depuis `metadata.version` ou dérivée du SHA — préciser laquelle)
   - `source_commit` à enregistrer
   - Path Somcraft cible (`/data-schema/schema.yaml`)
   - État pointer SD : NULL (cas A) / même doc (cas B) / divergence (cas C, requiert intervention)
   - Couverture %, nombre de tables, ponts ontologie
   - Demander **GO explicite** (« ok », « publie »). Sauf `--yes` (mode CI scripts uniquement).
8. **Écrire le YAML** dans Somcraft via `mcp__claude_ai_Somcraft__write_document(workspace_id=<somcraft_workspace_id>, path="/data-schema/schema.yaml", content=<contenu lu>)`. Capture le `document_id` retourné.
9. **Écrire `SCHEMA.md`** si présent dans `docs/schema/SCHEMA.md` : `write_document(path="/data-schema/SCHEMA.md", content=<contenu lu>)`. Projection narrative (optionnelle mais recommandée).
10. **MAJ pointer SD** via `set_data_schema_pointer(application_id, data_schema_document_id=<id>, data_schema_version=<X.Y.Z ou 0.0.0+sha.X>, source_commit=<SHA>)` (auth `mcp_api_key`). **Paramètre MCP `source_commit`** (pas `data_schema_source_commit` — c'est le nom de colonne DB). Ajouter `force: true` **uniquement** dans le cas C de l'étape 6 avec approbation explicite Maxime.
11. **Annoncer** : « data_schema de `<app>` v`<X.Y.Z>` publié — Somcraft doc `<id>`, pointer ServiceDesk MAJ, source_commit `<SHA>`. `<n>` tables, `<m>%` couverture. »

---

### Action `read <app>`

Lit le data_schema courant publié.

1. Résoudre `application_id`.
2. Lire le pointer SD via `get_data_schema_pointer(application_id)` → retourne `{ data_schema_document_id, somcraft_workspace_id, data_schema_version, data_schema_source_commit, data_schema_pointer_updated_at }` (noms canoniques côté serveur).
3. Si `data_schema_document_id` est NULL → informer + suggérer `/schema-doc generate <app>` puis `/schema-doc publish <app>`.
4. Lire `schema.yaml` via `mcp__claude_ai_Somcraft__read_document(document_id=<data_schema_document_id>)`.
5. **Parsing YAML** : si échec → erreur exacte + STOP. Pas de réparation auto.
6. Afficher un résumé structuré :
   - Métadonnées (app, version, source_commit, date de publication)
   - Décompte tables par schéma (public/auth/storage/etc.)
   - % couverture colonnes commentées
   - Ponts ontologiques (nombre de concepts liés via `physical_tables`)
   - Affichage YAML complet sur demande

---

### Action `list`

Coverage du data_schema sur les apps Somtech.

1. `mcp__servicedesk__applications` action `data_schema_coverage` → résumé (`with_schema` / `without_schema`).
2. Affichage tableau lisible : nom app, version publiée (ou « — »), `data_schema_pointer_updated_at`, `source_commit` (court 7 chars).

---

## Phase 1 universelle (STD-034 INV-DD-4) — rappel

Avant de pousser une migration Supabase qui touche au schéma :

1. Implémenter la migration dans `supabase/migrations/`
2. `supabase db reset` (vérifier que la migration passe sur base vierge)
3. `/schema-doc generate <app>` — régénère `docs/schema/schema.yaml`
4. `/schema-doc check <app>` — vérifier déterminisme, couverture, pont ontologie
5. Si concept métier touché → **amender l'ontologie d'abord** (cf. STD-035 INV-ONT-6 ordre : ontologie → BRD → data_schema)
6. Commit `docs/schema/schema.yaml` + `SCHEMA.md` + migration dans le même commit
7. Push + PR (le gate CI `schema:doc:check` doit être vert)
8. Après merge : `/schema-doc publish <app>` (depuis le cwd du repo applicatif sur main à jour)

---

## Voir aussi — pattern pointer Somcraft transverse

| Document | Skill associé | Workspace | Édité par |
|---|---|---|---|
| **BRD** | `/brd` | Workspace de l'app cliente | Humain/agent en session |
| **Ontologie** | `/ontology` | Workspace de l'app cliente | Humain/agent en session |
| **Architecture** | Publisher CI | Workspace de l'app cliente | CI du repo (récolte code) |
| **Data schema** | `/schema-doc` (ce skill) | Workspace de l'app cliente | **Récolté depuis la BD** + script local |
| **ABD** (agent) | `/agent-brief` | **Workspace Somtech** (workspace unique) | Humain + agent lui-même |

Différence majeure `/schema-doc` vs autres skills : **récolte automatique depuis la BD** (introspection via le générateur local), pas édition session humain/agent. Le YAML est dérivé du code de la BD, pas écrit à la main.

---

## Anti-patterns à refuser

- **Éditer manuellement `docs/schema/schema.yaml`** — il est généré, toute édition sera écrasée au prochain `generate`. Pour modifier le contenu : modifier la migration + `COMMENT ON COLUMN`, puis régénérer.
- **Publier sans `check` propre** — un `publish` avec drift ontologie ou couverture en régression est interdit.
- **Bumper la version à la main** dans `schema.yaml` — la version est gérée par le générateur (cf. STD-034 §2.6 cycle de vie).
- **Écraser un `data_schema_document_id` non-NULL sans approbation Maxime** (cf. règle critique IDs immutables / INV-DD-7).
- **Modifier `somcraft_workspace_id` non-NULL** sans approbation (impact transverse encore plus large).
- **Lancer `publish` depuis un autre repo** que celui de l'app — le générateur lit le filesystem du repo applicatif. Lancer depuis `~/GitRepo.nosync/<app-repo>`.
- **Publier sans `source_commit`** — la traçabilité d'édition serait perdue. Le skill récupère le SHA via `git rev-parse HEAD`.
- **Inventer un `application_id`** quand la résolution échoue (interdit par CLAUDE.md global).

---

## Références opposables

- **STD-034** : Somcraft `/standards/STD-034-documentation-modele-donnees-agents-ia.md` (cadre opposable du data_schema) — PR Architecture #35
- **STD-035** : Ontologie (pont `physical_tables` ↔ data_schema, INV-ONT-4) — PR Architecture #36
- **STD-031 §2.7.8** : Pattern pointer Somcraft + résolution workspace (architecture.yaml)
- **STD-033 §2.11** : Pattern pointer Somcraft (BRD)
- **STD-030** : Hiérarchie ServiceDesk
- **Post feed pattern pointer** : `6632274f-403d-4a84-9423-3d57fabcd30f`
- **Mémoire IDs pointer immutables** : `feedback_ids-pointer-somcraft-immutables.md`
- **D-20260605-0001** : Pointer data_schema + ontology livré côté SD (2026-06-05)
- **D-20260605-0002** : Auth uniforme `mcp_api_key` (2026-06-05)
- **D-20260605-0005** : cette demande (création skill `/schema-doc`)
- **Pilote 1 — Construction Gauthier** : `scripts/generate-schema-doc.mjs` éprouvé, `schema.yaml` + `SCHEMA.md` générés
- **Pilote 2 — Action Progex** : candidat pour valider la généralité (STD-034 `draft → accepted`)
