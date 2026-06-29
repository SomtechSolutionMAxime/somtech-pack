---
name: audit-securite
description: |
  Auditer la sécurité technique d'une app cliente Somtech (code applicatif, RLS,
  frontend, API, infra, pentest runtime non-destructif). Orchestre un audit
  multi-couches, vérifie chaque finding de façon adversariale (anti-faux-positifs),
  et produit un rapport Somcraft + des tickets ServiceDesk pour les findings confirmés.
  TRIGGERS : audit sécurité, auditer la sécurité, security audit, audit complet sécurité,
  pentest staging, audit de sécurité de l'app.
  NE PAS confondre avec audit-rls (RLS d'une table seule) ni audit-loi25 (conformité Loi 25).
disable-model-invocation: false
# Pas de `allowed-tools` restrictif : cet orchestrateur a besoin de Task (sub-agents),
# Bash/Read/Grep/Glob/WebFetch (couches statiques) ET des MCP servicedesk + somcraft +
# supabase (Phase 4 livrable) + claude-in-chrome (pentest). Les noms MCP varient selon
# la session — une whitelist bloquerait la livraison. La garantie « lecture seule » est
# portée par les garde-fous ci-dessous (instructions), pas par un sandbox d'outils.
---

# Audit de sécurité technique — `/audit-securite`

Orchestrateur d'audit de sécurité **multi-couches** d'une app cliente Somtech
(Next.js + Supabase + RLS, hébergement DO/Fly). Réutilise les briques existantes,
comble les trous (applicatif avancé, frontend, API, infra avancée, pentest runtime,
STD-038), vérifie chaque finding de façon adversariale, et livre un rapport consolidé.

> **Cadre** : demande D-20260629-0002. Spec de référence :
> `Architecture/docs/superpowers/specs/2026-06-29-audit-securite-skill-design.md`.

---

## ⛔ Garde-fous (NON négociables — lire avant tout)

1. **Lecture seule partout** sauf deux écritures finales : le rapport Somcraft et la
   création de tickets ServiceDesk. **Aucune** migration, **aucun** SQL destructif,
   **aucune** écriture/suppression de données, aucun `apply_migration`.
2. **Pentest = staging uniquement.** La couche `pentest` s'exécute **exclusivement**
   sur l'`url_staging` issue de `.somtech/app.yaml`, et **refuse durement** toute URL
   identifiée comme production (vérification explicite AVANT toute requête). En cas de
   doute sur la nature de l'URL → refus.
3. **Repo courant uniquement** (règle d'or n°7). Le skill n'agit que sur le repo de
   l'app auditée. Aucune action sur un autre repo, aucune action cross-projet.
4. **Secrets** : ne jamais lire, copier ni exfiltrer un secret à droits élevés. On
   **détecte sa présence indue** (STD-038) sans **jamais** recopier sa valeur dans le
   rapport ou un ticket (masquer : `sb_secret_••••`).
5. **Tickets uniquement sur verdict `confirme` ou `incertain`** (après la phase 3) :
   `confirme` → ticket `incident` ; `incertain` → ticket `improvement` à valider.
   **Jamais** de ticket sur un finding `refute` (annexe du rapport seulement) ni non vérifié.
6. **Accès Supabase via MCP** : introspection / `SELECT` uniquement. Jamais de write.

Si une étape exige de violer un garde-fou → **arrêter la couche concernée** et le
consigner dans le rapport (couche « non exécutée — raison »), sans contourner.

---

## Schéma de finding (contrat inter-phases — identique dans toutes les couches)

Chaque sub-agent de couche **renvoie une liste de findings** à ce schéma exact. La
phase 3 remplit `verdict`/`raison_verdict` ; la phase 4 consomme le résultat.

```yaml
finding:
  id: string                # stable dans un run : <PREFIXE>-NNN (voir préfixes ci-dessous)
  couche: code|rls|frontend|api|infra|pentest
  titre: string
  severite: critique|high|medium|low
  description: string
  cible: string             # fichier:ligne | endpoint | table | URL
  preuve: string            # extrait de code | requête | trace runtime (secrets masqués)
  remediation: string
  reference: string|null    # STD-038 | ADR-xxx | CWE-xxx | null
  verdict: confirme|refute|incertain   # rempli en phase 3 (vide en phase 2)
  raison_verdict: string|null
```

**Préfixes d'`id` par couche** (cohérents de la phase 2 à la phase 4) :
`code → APP-`, `rls → RLS-`, `frontend → FE-`, `api → API-`, `infra → INFRA-`, `pentest → PEN-`.

**Mapping sévérité → priorité de ticket** (phase 4) : `critique → high`,
`high → high`, `medium → medium`, `low → low`.

---

## Entrée

Argument optionnel `--couche <nom>` (répétable). Valeurs : `code`, `rls`, `frontend`,
`api`, `infra`, `pentest`. **Défaut (aucun argument) = toutes les couches.**
Exemples : `/audit-securite` (tout), `/audit-securite --couche rls --couche pentest`.

Avant de commencer, charger le contexte :
- `.somtech/app.yaml` (STD-027) → `url_staging`, `supabase_ref`/`project_ref`, `app_slug`,
  `somcraft.workspace_id`. **Si absent** → `url_staging = null`, la couche `pentest`
  est **désactivée** (signalée), les couches statiques restent exécutables.
- `/ontologie/02_ontologie.yaml` (si présent) → entités à données personnelles (PII).
- STD-038 (`~/.claude/memory/feedback_secrets-supabase-droits-eleves.md` ou le standard)
  → critère de détection des secrets à droits élevés.

Puis dérouler les 4 phases ci-dessous, dans l'ordre.

---

## Phase 1 — Reconnaissance *(séquentiel, rapide)*

Établir la **carte de surface** qui paramètre la phase 2. Produire un objet :

```yaml
carte_surface:
  app_slug: string
  url_staging: string|null        # depuis .somtech/app.yaml ; null si absent
  url_prod: string|null           # prod connue (app.yaml + ServiceDesk production_url) — pour REFUS DUR du pentest
  supabase_ref: string|null
  somcraft_workspace_id: string|null
  routes_pages: [string]          # app/**/page.tsx (ou pattern du projet)
  routes_api: [string]            # app/**/route.ts | supabase/functions/*
  composants_frontend: [string]
  tables_sensibles: [string]      # entités PII d'après l'ontologie
  dependances: [string]           # depuis package.json
```

Procédure :
1. Lire `.somtech/app.yaml` → `url_staging`, `supabase_ref`, `app_slug`, `workspace_id`.
   Récupérer aussi **`url_prod`** : champ prod de `app.yaml` **et** `production_url` de
   l'app dans ServiceDesk (`mcp__servicedesk__applications` action `list`). Réunir les
   deux dans `url_prod` — c'est la liste d'exclusion dure du pentest (garde-fou couche 6).
2. Lire l'ontologie → entités marquées données personnelles → `tables_sensibles`.
   Si pas d'ontologie : déduire des migrations (`supabase/migrations/*`) les tables
   avec une colonne `user_id` ou contenant des champs personnels évidents.
3. Énumérer les routes : `app/**/route.ts` + `app/**/page.tsx` ; et les Edge Functions
   `supabase/functions/*/index.ts`. Adapter au pattern réel du projet (Glob).
4. Lire `package.json` → `dependances`.

> **Drift ontologie** (règle d'or n°1) : si une table sensible évidente du schéma est
> absente de l'ontologie, le **signaler** dans le rapport (section couverture) — ne pas
> auditer en silence par-dessus.

---

## Phase 2 — Audit par couche *(fan-out parallèle)*

Pour **chaque couche demandée** (défaut = toutes ; `pentest` **sauté** si
`url_staging == null`), dispatcher **un sub-agent** (Task) avec le prompt de couche
correspondant + la carte de surface. Les couches sont indépendantes → les lancer
**en parallèle** (un seul message, plusieurs Task).

| Couche | Prompt | Réutilise |
|---|---|---|
| `code` | `prompts/couche-code.md` | patterns code-review (statique) |
| `rls` | `prompts/couche-rls.md` | **appelle `audit-rls`** + STD-038 |
| `frontend` | `prompts/couche-frontend.md` | — |
| `api` | `prompts/couche-api.md` | logique `vulnerability-scan` (npm/secrets) |
| `infra` | `prompts/couche-infra.md` | logique `vulnerability-scan` (headers) |
| `pentest` | `prompts/couche-pentest.md` | — (garde-fous durs) |

> **Réutilisation réaliste** : `audit-rls` est un skill du pack (invocable). En
> revanche `vulnerability-scan`/`pr-security-gate` sont des skills **AIMS** non
> distribués aux apps clientes → les couches `api`/`infra` **exécutent directement**
> la logique équivalente (`npm audit`, scan de secrets, `curl -I` headers), comme
> documenté dans leurs prompts. Si `vulnerability-scan` est disponible dans la session,
> l'appeler ; sinon, exécution directe (les prompts gèrent les deux cas).

**Sortie de la phase 2** : une **liste agrégée** de tous les findings (toutes couches),
chacun au schéma commun, `verdict` encore vide. Préfixer les `id` par couche.

---

## Phase 3 — Vérification adversariale *(le point clé)*

Pour **chaque finding**, dispatcher un sub-agent **réfutateur** (prompt
`prompts/verif-adversariale.md`) dont la consigne est de **chercher pourquoi c'est un
faux positif** (guard compensatoire ailleurs, policy ailleurs, contexte non
exploitable). Dispatcher par lot pour le parallélisme.

Règle de verdict (remplie dans `verdict` + `raison_verdict`) :
- preuve solide, réfutation non trouvée → `confirme` ;
- réfutation trouvée et étayée → `refute` (+ raison) ;
- doute → `incertain`. **Tout finding `critique`/`high` douteux reste `incertain`**
  (escaladé), **jamais** `refute` silencieux. Le défaut « réfuté » ne s'applique
  qu'aux findings `medium`/`low` à preuve faible.

**Sortie** : la même liste avec verdicts ; les `refute` partent en annexe du rapport.

---

## Phase 4 — Livrable *(rapport Somcraft + tickets ServiceDesk)*

Suivre le gabarit `references/livrable.md`. En résumé :

**A. Rapport Somcraft** — `mcp__somcraft__write_document` (ou le MCP Somcraft de la
session), workspace **client** (`somcraft.workspace_id`), path
`/operations/<app-slug>/audits/audit-securite-<YYYY-MM-DD>.md`. Contenu : résumé
exécutif + score par couche, findings `confirme` par sévérité (avec preuve, cible,
remédiation, référence), matrice de couverture (couches exécutées / sautées), annexe
des `refute`.

**B. Tickets ServiceDesk** (findings `confirme` **uniquement**) :
1. Récupérer l'`application_id` réel via `mcp__servicedesk__applications` action `list`
   — **jamais l'inventer**.
2. Créer **1 epic ombrelle** : « Audit sécurité `<app>` `<YYYY-MM-DD>` » via
   `mcp__servicedesk__epics`.
3. Pour chaque finding `confirme` : 1 ticket `incident`, titre préfixé `[FIX]`
   (ou `[DEBT]` si non urgent), priorité = mapping sévérité, **G/W/T de reproduction**,
   lien PoW vers le rapport Somcraft. Rattacher à l'epic.
4. Pour chaque finding `incertain` : 1 ticket `improvement` avec tag de revue,
   **jamais** fermé automatiquement.
5. **Zéro ticket** pour les `refute`.

> **Anti-bruit & secrets** : aucun ticket sans `confirme` ; ne jamais inclure la valeur
> d'un secret dans un ticket ou le rapport (masquer).

---

## Critères de succès (rappel spec §8)

- Un run produit rapport Somcraft + tickets SD sans intervention manuelle.
- Le pentest **refuse** une URL non-staging (test négatif explicite).
- Une faille RLS cross-user est **détectée en statique** (couche `rls`) **et prouvée
  en runtime** (couche `pentest`) → corrélation.
- Faible taux de faux positifs : tout `critique`/`high` listé est exploitable ou
  marqué `incertain` (à valider).
- Zéro écriture DB, zéro action prod, zéro action hors repo courant.
