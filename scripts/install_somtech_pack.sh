#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
install_somtech_pack.sh — Pack autonome: installe rules Cursor + commandes Somtech dans un repo cible.

Usage:
  ./scripts/install_somtech_pack.sh --target /path/to/target_repo [options]

Options:
  --dry-run      Affiche ce qui serait fait, sans écrire.
  --no-rules     N'installe pas les fichiers .cursor/rules.
  --no-somtech   N'installe pas les commandes somtech.* dans .cursor/commands.
  --no-speckit   N'installe pas les assets Speckit (bootstrap minimal).

Comportement:
  - modules/: crée uniquement le minimum si absent (structure modulaire via template)
  - .cursor/rules + .cursor/commands/somtech.* : installe toujours
    - si fichier existe -> backup en *.bak-YYYYMMDDHHMMSS puis overwrite
  - ajoute/écrase .cursor/generic/PLACEHOLDERS.md (backup si existant)
  - speckit (bootstrap minimal): crée uniquement si manquant, ne remplace jamais l'existant
    - NE JAMAIS écraser `memory/constitution.md` si déjà présent.

Exemples:
  # Test sans écrire
  ./scripts/install_somtech_pack.sh --target . --dry-run

  # Installation réelle dans le repo courant
  ./scripts/install_somtech_pack.sh --target .
EOF
}

TARGET=""
DRY_RUN=0
DO_RULES=1
DO_SOMTECH=1
DO_SPECKIT=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-rules) DO_RULES=0; shift ;;
    --no-somtech) DO_SOMTECH=0; shift ;;
    --no-speckit) DO_SPECKIT=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argument inconnu: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "${TARGET}" ]]; then
  echo "Erreur: --target est requis." >&2
  usage
  exit 2
fi

ts() { date +"%Y%m%d%H%M%S"; }
log() { echo "[install_somtech_pack] $*"; }

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY-RUN: $*"
  else
    eval "$@"
  fi
}

ensure_dir() {
  local d="$1"
  [[ -d "$d" ]] && return 0
  run "mkdir -p \"${d}\""
}

backup_if_exists() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local b="${f}.bak-$(ts)"
    run "cp \"${f}\" \"${b}\""
  fi
}

write_file() {
  local dst="$1"
  local content="$2"
  ensure_dir "$(dirname "$dst")"
  backup_if_exists "$dst"
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY-RUN: write ${dst} (len=${#content})"
  else
    printf "%s" "$content" > "$dst"
  fi
}

write_file_if_missing() {
  local dst="$1"
  local content="$2"
  if [[ -f "$dst" ]]; then
    log "Skip (exists): ${dst}"
    return 0
  fi
  ensure_dir "$(dirname "$dst")"
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY-RUN: write-if-missing ${dst} (len=${#content})"
  else
    printf "%s" "$content" > "$dst"
  fi
}

#
# Pack autonome
#  - Les contenus sont embarqués ci-dessous (heredocs).
#  - Les placeholders ({{...}}) sont documentés dans .cursor/generic/PLACEHOLDERS.md
#

# -----------------------
# Structure minimale module
# -----------------------
create_min_module_structure_if_missing() {
  # Ne crée que le minimum demandé (template).
  ensure_dir "${TARGET}/modules/_template"
  ensure_dir "${TARGET}/modules/_template/prd"
  ensure_dir "${TARGET}/modules/_template/tests"
  ensure_dir "${TARGET}/modules/_shared"
}

write_placeholders_doc() {
  local dst="${TARGET}/.cursor/generic/PLACEHOLDERS.md"
  local content
  content=$(
    cat <<'EOF'
# Placeholders — Somtech pack

Ces placeholders peuvent apparaître dans les règles/commandes installées.

- `{{PROJECT_NAME}}` : nom du projet
- `{{DEV_SERVER_URL}}` : URL de dev (ex: `http://localhost:5173`)
- `{{MCP_SUPABASE_TOOL_PREFIX}}` : préfixe des outils MCP Supabase du projet (si utilisés)
- `{{MCP_SUPABASE_DEPLOY_EDGE_FUNCTION_TOOL}}` : nom complet de l’outil MCP pour déployer les Edge Functions (si utilisées)
- `{{MCP_RAILWAY_TOOL_PREFIX}}` : préfixe des outils MCP Railway (si utilisés)

À faire dans le projet cible:
- Remplacer ces valeurs (ou documenter où trouver les noms exacts des outils MCP).
EOF
  )
  write_file "$dst" "$content"
}

content_rule_00_orchestrator() {
  cat <<'EOF'
---
alwaysApply: true
---
# Agent : Orchestrateur

## Mission
Analyser chaque demande utilisateur, identifier l'intention, choisir **un seul agent** et la **commande** appropriée.
Toujours appliquer `Charte_de_conception.mdc` si elle existe.

## Règles d'or
1) Lire et appliquer `Charte_de_conception.mdc` si présente.  
2) Sélectionner **un seul** agent + commande.  
3) Si ambiguïté forte → poser 1 question max.  
4) Respecter `00-git-main-protection.mdc` (jamais de push direct sur `main`).  
5) Après modif impactant UI/Back/DB/Docs → exécuter (si applicable) :
   - `Docs Maintainer :: *lint-docs`
   - `Gouvernance Produit :: *validate-prd`

## Validation UI (obligatoire)
Après toute modification UI :
- Utiliser le navigateur intégré MCP Playwright (`mcp_playwright_*`)
- Interagir avec la page modifiée
- Capturer les logs console (`mcp_playwright_playwright_console_logs` type: "error")
- Objectif : **0 erreur console**

## Base de données (si Supabase)
- Adopter une stratégie cohérente (ce pack est orienté **déclaratif** via `supabase/schemas/`).
- Les outils MCP (si disponibles) sont référencés via placeholders :
  - `{{MCP_SUPABASE_TOOL_PREFIX}}...`
  - `{{MCP_SUPABASE_DEPLOY_EDGE_FUNCTION_TOOL}}`

## Structure modulaire
Référence : `.cursor/rules/00-module-structure.mdc`
EOF
}

content_rule_00_git_main_protection() {
  cat <<'EOF'
---
alwaysApply: true
---
# Protection de la branche main

## Règle: ne jamais pousser sur `main`, toujours passer par une PR

- **Interdit**: tout push direct sur `main` (local ou distant), y compris `git push`, `git push origin main`, `gh pr merge`, `gh release create` sans PR.
- **Obligatoire**: travailler sur une branche dédiée (ex. `feat/*`, `fix/*`, `chore/*`), ouvrir une Pull Request vers `main`, laisser la CI et la revue valider avant merge.

## Bonnes pratiques
- Créer une branche descriptive avant de commencer.
- Ouvrir une PR tôt pour bénéficier des retours et de la CI.
- Préférer le merge via PR (squash ou rebase selon conventions) après approbation.
EOF
}

content_rule_00_module_structure() {
  cat <<'EOF'
---
alwaysApply: true
---
# Architecture modulaire du projet (générique)

## Principe
Le projet est organisé en **modules métier indépendants**, chacun avec son code, sa doc PRD et ses tests.

## Structure recommandée
```
modules/
  {module}/
    mcp/              ← Serveur MCP (si applicable)
    prd/
      {module}.md
    tests/
      unit/
      e2e/
  _template/
    mcp/
    prd/
    tests/
  _shared/
```

## Documentation & traçabilité
- PRD module : `modules/{module}/prd/{module}.md`
- Tests module : `modules/{module}/tests/`
- Tests UI globaux (si UI) : `tests/ui/`
- Mapping obligatoire : PRD ↔ code ↔ tests
- Changelog : dans le PRD module (date + résumé)
EOF
}

content_rule_04_dev_frontend() {
  cat <<'EOF'
---
description: "Agent Dev Frontend — UI, validations client, tests, performance"
alwaysApply: false
---
# Agent : Développeur Frontend

## Persona
- UI fiable, accessible, maintenable
- Gère états: loading/vide/erreur/succès
- Respecte `Charte_de_conception.mdc` (i18n, tokens, formats)

## Structure
- UI : `src/pages/`, `src/components/`
- Tests UI globaux : `tests/ui/`
- Tests module : `modules/{module}/tests/`

## DoD (Front)
- Accessibilité OK, responsive, erreurs gérées proprement
- Après modif UI : validation navigateur MCP Playwright + console = 0 erreur
EOF
}

content_rule_05_dev_backend() {
  cat <<'EOF'
---
description: "Agent Dev Backend — API, logique métier, migrations, sécurité"
alwaysApply: false
---
# Agent : Développeur Backend

## Persona
- Contract-first, idempotent, traçable
- Validation stricte des entrées; erreurs explicites
- Aucun secret en logs

## Structure
- DB (Supabase) : `supabase/schemas/` (déclaratif) + `supabase/migrations/` (générées)
- Tests module : `modules/{module}/tests/`
- PRD module : `modules/{module}/prd/{module}.md` (RLS, index, data model)

## Règles DB (si Supabase)
- Cette base est orientée **déclaratif** : on modifie `supabase/schemas/` puis on génère les migrations.
- RLS obligatoire sur les tables exposées.
- Si outils MCP disponibles : utiliser `{{MCP_SUPABASE_TOOL_PREFIX}}...` et `{{MCP_SUPABASE_DEPLOY_EDGE_FUNCTION_TOOL}}`.
EOF
}

content_rule_08_devops() {
  cat <<'EOF'
---
description: "Agent DevOps — Docker, CI/CD, déploiement, secrets, observabilité"
alwaysApply: false
---
# Agent : DevOps

## Persona
- Build & déploiement sûrs, reproductibles
- Images minimalistes, non-root; secrets externalisés; rollback documenté

## Structure modulaire
- Template module : `modules/_template/`
- MCP (si applicable) : `supabase/functions/*-mcp/`

## Déploiement (placeholders)
- Railway (si utilisé) : outils `{{MCP_RAILWAY_TOOL_PREFIX}}...`
- Supabase Edge Functions (si utilisées) : `{{MCP_SUPABASE_DEPLOY_EDGE_FUNCTION_TOOL}}`
EOF
}

content_rule_09_gouvernance_produit() {
  cat <<'EOF'
---
alwaysApply: false
description: Agent de gouvernance produit — MAJ PRD, cohérence code/tests, traçabilité
---
### Gouvernance PRD (générique)

#### Règle
- Toute modification produit doit être reflétée dans la doc :
  - PRD module : `modules/{module}/prd/{module}.md`
  - PRD maître (si présent) : `docs/PRD.md`
- Mettre à jour : user stories, règles métier, G/W/T, flux, data model, API/contrats, mapping code↔tests, changelog.

#### Formats
- Critères d’acceptation : « Étant donné … Quand … Alors … »
- Changelog : `YYYY-MM-DD` puis listes Ajout/Modification/Suppression
EOF
}

content_rule_10_docs_maintainer() {
  cat <<'EOF'
---
description: "Agent Docs Maintainer — lint docs, mapping PRD↔code↔tests, changelogs"
alwaysApply: false
---
# Agent : Docs Maintainer

## Mission
- Garantir la cohérence doc (PRD maître + modules)
- Maintenir mapping PRD↔code↔tests

## DoD
- Lint docs OK (si script présent)
- Changelogs à jour
- PRD module à jour pour chaque module impacté
EOF
}

content_rule_browser_validation_strategy() {
  cat <<'EOF'
---
alwaysApply: true
description: Stratégie de validation UI (navigateur MCP) vs tests automatisés
---
# Stratégie de validation navigateur et tests

## Obligatoire après toute modif UI
- Naviguer vers la page modifiée via MCP Playwright
- Interagir (clics/champs)
- Capturer la console : `mcp_playwright_playwright_console_logs` type `error`
- Objectif : **0 erreur console**

## Tests automatisés (optionnel)
- Réservés aux parcours critiques / non-régression (ex: `tests/ui/`)
EOF
}

content_rule_ui_browser_interactive() {
  cat <<'EOF'
---
description: Outils du navigateur intégré (MCP Playwright) — mémo d’usage
alwaysApply: false
---
# Navigateur intégré — mémo MCP Playwright

Outils courants :
- `mcp_playwright_playwright_navigate`
- `mcp_playwright_playwright_click`
- `mcp_playwright_playwright_fill`
- `mcp_playwright_playwright_screenshot`
- `mcp_playwright_playwright_console_logs` (type: `error`)

Workflow recommandé :
1) navigate → 2) interactions → 3) console_logs(type:error) → 4) screenshot
EOF
}

content_rule_declarative_database_schema() {
  cat <<'EOF'
---
description: Gestion DB Supabase — approche déclarative
alwaysApply: false
---
# Database — Schema déclaratif (Supabase)

## Principe
- Les changements de schéma se font dans `supabase/schemas/*.sql` (état final)
- Les migrations (`supabase/migrations/`) sont générées à partir du diff

## Règles
- Éviter le drift : pas de modifications manuelles non tracées
- Conserver les fichiers schemas lisibles (ordre stable, noms explicites)
- RLS et index documentés dans le PRD du module concerné
EOF
}

content_rule_create_rls_policies() {
  cat <<'EOF'
---
description: RLS — règles de base (Supabase/Postgres)
alwaysApply: false
---
# Database — Create RLS policies (résumé)

## Principes
- Activer RLS sur les tables exposées
- Politiques explicites par action (select/insert/update/delete)
- Utiliser `auth.uid()` pour l’utilisateur courant
- Documenter les invariants dans le PRD du module
EOF
}

content_rule_supabase_sql_style() {
  cat <<'EOF'
---
description: Guide de style SQL Postgres (résumé)
alwaysApply: false
---
# Postgres SQL Style Guide (résumé)

- Keywords SQL en minuscules (`select`, `from`, `where`)
- Nommage en `snake_case`
- Tables au pluriel, colonnes au singulier
- Ajouter des index cohérents avec les requêtes
EOF
}

content_rule_supabase_mcp() {
  cat <<'EOF'
---
description: MCP Supabase (générique) — placeholders
alwaysApply: false
---
# MCP Supabase — règles d’usage (générique)

Si des outils MCP Supabase sont configurés dans le projet :
- Préfixe : `{{MCP_SUPABASE_TOOL_PREFIX}}...`
- Déploiement Edge Functions : `{{MCP_SUPABASE_DEPLOY_EDGE_FUNCTION_TOOL}}`

Règles :
- DDL via migrations (générées) / outillage contrôlé
- DML/inspection via outil dédié
- Revue security/perf après changements sensibles
EOF
}

content_command_somtech_deploy() {
  cat <<'EOF'
# Livraison Somtech (générique)

Objectif : commit → push branche → PR vers `main` (jamais de push direct sur main), PRD module à jour, release notes.

## Pré-vol
- `git status`, `git diff`, `git diff --staged`
- Vérifier absence de secrets

## Qualité (recommandé)
- `npm run lint` / `npm run typecheck` / `npm run build` (si applicable)
- `npm run lint:docs` (si applicable)
- (si UI) validation navigateur MCP Playwright + console=0 erreur

## PR
- Ouvrir une PR vers `main`
- Mentionner les modules impactés + liens vers `modules/<module>/prd/<module>.md`

## Release notes
- Créer : `<numero_pr>.<nom_pr>.releasenotes.md`
- Déposer dans : `modules/<module>/releasenotes/` (si structure modulaire)
EOF
}

content_command_somtech_diagnostic() {
  cat <<'EOF'
# Assistant Diagnostic d'Erreurs (générique)

But : analyser méthodiquement une erreur console/log pour identifier la cause racine.

Format de sortie attendu :
## CAUSE RACINE PROBABLE
- Hypothèse principale
- Niveau de confiance
- Preuves
- Points à vérifier
- Facteurs de confusion possibles
EOF
}

content_command_somtech_polish() {
  cat <<'EOF'
# Polish UI/UX (générique)

Objectif : améliorer cohérence visuelle, accessibilité, états UI.

Checklist rapide :
- Hiérarchie typographique
- Espacements (4/8px)
- Contraste WCAG AA
- États hover/focus/disabled
- Navigation clavier

Validation obligatoire :
- Navigateur MCP Playwright
- `console_logs` type `error` → 0 erreur
EOF
}

content_command_somtech_ontologie() {
  cat <<'EOF'
# Reconstruction ontologique orientée agents (générique)

But : analyser un système existant (code, DB, PRD) et produire une ontologie reconstruite, orientée agents.

Livrables attendus (fichiers) :
1) `/ontologie/01_ontologie.md`
2) `/ontologie/02_ontologie.yaml`
3) `/ontologie/03_incoherences.md`
4) `/ontologie/04_diagnostic.md`

Règle : se baser sur ce que le système fait réellement; proposer améliorations dans le diagnostic final.
EOF
}

content_speckit_config() {
  cat <<'EOF'
# Spec-Kit Configuration
#
# Ce fichier active le workflow Speckit (spec-kit) dans ce projet.
#
# Règle de base : ne pas dupliquer.
# - Si vous avez déjà une configuration Speckit, ce fichier ne doit pas être écrasé par le Somtech pack.
#
# Références:
# - Constitution: `memory/constitution.md`
# - Specs: `specs/`
# - Templates: `.specify/templates/`
#
# Doc upstream: https://github.com/github/spec-kit

Spec-Kit est activé sur ce projet.

## Structure

- Constitution : `memory/constitution.md`
- Spécifications : `specs/`
- Templates : `.specify/templates/`

## Commandes disponibles

Les commandes spec-kit sont disponibles via votre assistant IA :
- `/speckit.constitution`
- `/speckit.specify`
- `/speckit.plan`
- `/speckit.tasks`
- `/speckit.implement`
EOF
}

content_speckit_specs_readme() {
  cat <<'EOF'
# Spécifications - Spec-Kit

Ce répertoire contient les spécifications de features générées avec spec-kit.

## Structure

Chaque feature suit cette structure :

```
specs/{numero}-{nom-feature}/
  ├── spec.md              ← Spécification fonctionnelle
  ├── plan.md              ← Plan d'implémentation technique
  ├── tasks.md             ← Détail des tâches (généré par /speckit.tasks)
  ├── contracts/           ← Contrats API (si applicable)
  │   ├── api-spec.json
  │   └── ...
  ├── data-model.md        ← Modèle de données (si applicable)
  ├── quickstart.md        ← Guide de démarrage rapide
  └── research.md          ← Recherches techniques (si applicable)
```

## Commandes Spec-Kit

1. `/speckit.constitution` — Établir/valider les principes du projet (voir `memory/constitution.md`)
2. `/speckit.specify` — Créer une nouvelle spécification fonctionnelle
3. `/speckit.plan` — Générer un plan d'implémentation technique
4. `/speckit.tasks` — Générer le détail des tâches depuis le plan
5. `/speckit.implement` — Implémenter les tâches

## Templates

Les templates utilisés par les commandes sont dans :

- `.specify/templates/`

## Références

- Spec Kit (upstream) : https://github.com/github/spec-kit
EOF
}

content_speckit_constitution_template() {
  cat <<'EOF'
# Constitution du Projet

> IMPORTANT: Ce fichier ne doit jamais être écrasé automatiquement.
> Si une constitution existe déjà, elle fait autorité pour le projet.

## Vision & Mission

Décrire l’objectif du projet, la cible, et les principaux résultats attendus.

## Principes de Développement

- Qualité avant vitesse
- Traçabilité PRD ↔ code ↔ tests
- Sécurité par défaut (secrets hors repo, RLS si applicable)

## Workflow Speckit (Spec-Kit)

- `/speckit.specify` → `specs/{numero}-{nom-feature}/spec.md`
- `/speckit.plan` → `specs/{numero}-{nom-feature}/plan.md`
- `/speckit.tasks` → `specs/{numero}-{nom-feature}/tasks.md`
- `/speckit.implement` → implémente les tâches
EOF
}

content_speckit_assets_version() {
  cat <<'EOF'
spec-kit-assets-0.0.90
EOF
}

content_speckit_template_releasenote() {
  cat <<'EOF'
# Release Notes — <titre>

**Version** : <version>  
**Date** : <date>  
**PR** : #<numero_pr> — <titre_pr>  
**Module** : <nom_module> (`<chemin_module>`)

---

## 🎯 Résumé

<résumé_court>

---

## ✨ Nouvelles fonctionnalités

### 1. <feature_1_titre>
- <feature_1_point_1>
- <feature_1_point_2>
- <feature_1_point_3>

### 2. <feature_2_titre>
- <feature_2_point_1>
- <feature_2_point_2>
- <feature_2_point_3>

### 3. <feature_3_titre>
- <feature_3_point_1>
- <feature_3_point_2>
- <feature_3_point_3>

### 4. <feature_4_titre>
- <feature_4_point_1>
- <feature_4_point_2>
- <feature_4_point_3>

### 5. <feature_5_titre>
- <feature_5_point_1>
- <feature_5_point_2>
- <feature_5_point_3>

---

## 🔧 Améliorations techniques

- <amélioration_1>
- <amélioration_2>
- <amélioration_3>
- <amélioration_4>
- <amélioration_5>

---

## 📊 Impact utilisateur

### Avant
- <avant_point_1>
- <avant_point_2>
- <avant_point_3>

### Après
- <après_point_1>
- <après_point_2>
- <après_point_3>

---

## 🧪 Tests et validation

### Parcours testés
- <parcours_test_1>
- <parcours_test_2>
- <parcours_test_3>

### Console navigateur
- <console_resultat>

---

## 📁 Fichiers modifiés

- `<chemin_fichier_1>` : <description_modif>
- `<chemin_fichier_2>` : <description_modif>
- `<chemin_fichier_3>` : <description_modif>
- …

**Total** : +<lignes_ajoutées> / -<lignes_supprimées>

---

## 🎨 Captures d'écran

### <capture_1_titre>
<description_capture_1>

### <capture_2_titre>
<description_capture_2>

---

## 🔗 Références

- **PR** : #<numero_pr>
- **Module PRD** : `<chemin_prd>`
- **User Story** : <code_story>
- **Documentation associée** : <chemin_doc>

---

**Auteur** : <auteur>  
**Validation** : <mécanisme_validation>  
**Environnement** : <stack_version>
EOF
}

content_speckit_template_spec_improvement() {
  cat <<'EOF'
# Feature Improvement Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: Improvement brief: "$ARGUMENTS"  
**Source Spec / Feature**: `[link or path to original spec if available]`

---

## Legacy Context *(mandatory)*

### Existing User Stories (reference only)

- **Story ID / Title**: [Retrieve from prior spec or PRD]  
  _Current behaviour summary + file references (ex. `src/modules/clients/...`)_  
- **Story ID / Title**: ...

### Existing Assets & Touchpoints

| Layer        | Artefacts & Notes |
|--------------|-------------------|
| Frontend UI  | `src/...` – [Brief description of behaviour] |
| Backend/API  | `supabase/...` / `modules/...` – [Endpoints, logic] |
| Data / DB    | `supabase/migrations/...` – [Tables, policies] |
| Tests        | `tests/...` – [Coverage summary] |
| Docs / PRD   | `modules/{module}/prd/...` – [Sections impacted] |
| Other        | [Analytics, integrations, etc.] |

---

## Current State Overview *(mandatory)*

Provide concise findings from the repository analysis. Include citations like ``src/components/...``.

- **Frontend UI**: [How the UI currently behaves / gaps]
- **Backend & Services**: [Endpoints, business logic, queues, etc.]
- **Data & Schema**: [Tables, relationships, constraints, RLS]
- **Automated Tests**: [Existing coverage, missing cases]
- **Documentation / PRD**: [Current rules, discrepancies]
- **External Dependencies**: [Integrations, contracts]

If nothing relevant found: note it explicitly and recommend falling back to `/speckit.specify`.

---

## Gap Analysis & Opportunities *(mandatory)*

| Area / Layer | Current Behaviour | Limitation | Opportunity / Desired Change |
|--------------|------------------|------------|------------------------------|
| Frontend UI  | [Describe]       | [Gap]      | [Improvement]                |
| Backend/API  | [Describe]       | [Gap]      | [Improvement]                |
| Data/DB      | ...              | ...        | ...                          |
| Cross-module | ...              | ...        | ...                          |

---

## User Scenarios & Testing *(mandatory)*

> Combine context from legacy stories + new expectations. Each story must remain independently testable.

### Improvement Story 1 – [Title] (Priority: P1)

- **Context from current state**: [Reference files / behaviours]
- **Desired experience**: [Plain language description]
- **Independent Test**: [Describe the slice that can be validated alone]
- **Acceptance Scenarios**:
  1. **Given** [initial condition], **When** [action], **Then** [expected result]
  2. ...

### Improvement Story 2 – [Title] (Priority: P2)

[Same structure as above]

### Improvement Story 3 – [Title] (Priority: P3)

[Same structure]

*(Add more as needed.)*

### Edge Cases

- What happens when [boundary condition tied to existing implementation]?
- How does the system handle [error scenario]?
- How do imported datasets / sync jobs behave when [condition]?

---

## Required Enhancements & Functional Requirements *(mandatory)*

### Enhancement Map

| Req ID | Description | Impacted Artefacts | Notes / Clarifications |
|--------|-------------|--------------------|------------------------|
| ENH-001 | [Desired change] | `src/...`, `modules/.../prd/...` | [Reference to gap] |
| ENH-002 | ... | ... | ... |

### Functional Requirements

- **FR-001**: System MUST … (cite relevant files)
- **FR-002**: …
- **FR-00X**: … `[NEEDS CLARIFICATION: ...]` if applicable.

### Key Entities (include if data involved)

- **[Entity]**: [Purpose, key attributes, links to existing schema]
- **[Entity]**: …

---

## Cross-module / Cross-layer Impacts *(mandatory)*

- **Docs / PRD**: [Sections to update, e.g., `modules/clients/prd/clients.md`]
- **RLS / Security**: [Policies/checks affected]
- **Analytics / Observability**: [Events or dashboards]
- **Integrations**: [Contracts, webhooks, MCP modules]
- **Change Management**: [Comms, training, enablement]

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: [Metric tied to improved flow, e.g., “Advisors access full profile in <30s”]
- **SC-002**: [Adoption/completion rate uplift]
- **SC-003**: [Quality/support metric]
- **SC-004**: [Business impact]

> Criteria must remain technology-agnostic, verifiable, and user-focused.

---

## Assumptions

- [Assumption connected to current implementation]
- [Assumption about dependencies or data]

## Dependencies

- [Dependency on other teams/modules/specs]
- [Feature flag, experiment, legal validation, etc.]

## Risks & Mitigations

- **Risk**: [Description tied to existing code] → **Mitigation**: [...]
- ...

## Open Questions / Clarifications

- [Use [NEEDS CLARIFICATION: ...] markers with context + file reference]

## Notes for `/speckit.plan` & `/speckit.tasks`

- Summary of most critical enhancements + impacted artefacts to guide the next steps.

---

> **Reminder**: Cite files using inline code formatting (``path/to/file``) and include short snippets with the `startLine:endLine:path` convention when examples are necessary.
EOF
}

install_speckit_assets() {
  log "Speckit bootstrap: ensure minimal assets (no overwrite)"

  # .speckit (config)
  write_file_if_missing "${TARGET}/.speckit" "$(content_speckit_config)"

  # specs/README.md (doc)
  ensure_dir "${TARGET}/specs"
  write_file_if_missing "${TARGET}/specs/README.md" "$(content_speckit_specs_readme)"

  # constitution: create ONLY if missing (NEVER overwrite)
  ensure_dir "${TARGET}/memory"
  write_file_if_missing "${TARGET}/memory/constitution.md" "$(content_speckit_constitution_template)"

  # templates (required by somtech.deploy.md & spec improvement flow)
  ensure_dir "${TARGET}/.specify/templates"
  write_file_if_missing "${TARGET}/.specify/SPECKIT_ASSETS_VERSION" "$(content_speckit_assets_version)"
  write_file_if_missing "${TARGET}/.specify/templates/releasenote-template.md" "$(content_speckit_template_releasenote)"
  write_file_if_missing "${TARGET}/.specify/templates/spec-template-improvement.md" "$(content_speckit_template_spec_improvement)"
}

install_rules() {
  log "Install rule: 00_orchestrator.mdc"
  write_file "${TARGET}/.cursor/rules/00_orchestrator.mdc" "$(content_rule_00_orchestrator)"

  log "Install rule: 00-git-main-protection.mdc"
  write_file "${TARGET}/.cursor/rules/00-git-main-protection.mdc" "$(content_rule_00_git_main_protection)"

  log "Install rule: 00-module-structure.mdc"
  write_file "${TARGET}/.cursor/rules/00-module-structure.mdc" "$(content_rule_00_module_structure)"

  log "Install rule: 04_dev_frontend.mdc"
  write_file "${TARGET}/.cursor/rules/04_dev_frontend.mdc" "$(content_rule_04_dev_frontend)"

  log "Install rule: 05_dev_backend.mdc"
  write_file "${TARGET}/.cursor/rules/05_dev_backend.mdc" "$(content_rule_05_dev_backend)"

  log "Install rule: 08_devOps.mdc"
  write_file "${TARGET}/.cursor/rules/08_devOps.mdc" "$(content_rule_08_devops)"

  log "Install rule: 09_Gouvernance_Produit.mdc"
  write_file "${TARGET}/.cursor/rules/09_Gouvernance_Produit.mdc" "$(content_rule_09_gouvernance_produit)"

  log "Install rule: 10_docs_maintainer.mdc"
  write_file "${TARGET}/.cursor/rules/10_docs_maintainer.mdc" "$(content_rule_10_docs_maintainer)"

  log "Install rule: browser-validation-strategy.mdc"
  write_file "${TARGET}/.cursor/rules/browser-validation-strategy.mdc" "$(content_rule_browser_validation_strategy)"

  log "Install rule: ui-browser-interactive.mdc"
  write_file "${TARGET}/.cursor/rules/ui-browser-interactive.mdc" "$(content_rule_ui_browser_interactive)"

  log "Install rule: declarative-database-schema.mdc"
  write_file "${TARGET}/.cursor/rules/declarative-database-schema.mdc" "$(content_rule_declarative_database_schema)"

  log "Install rule: create-rls-policies.mdc"
  write_file "${TARGET}/.cursor/rules/create-rls-policies.mdc" "$(content_rule_create_rls_policies)"

  log "Install rule: supabaseprojetct.mdc"
  write_file "${TARGET}/.cursor/rules/supabaseprojetct.mdc" "$(content_rule_supabase_sql_style)"

  log "Install rule: supabase-mcp.mdc"
  write_file "${TARGET}/.cursor/rules/supabase-mcp.mdc" "$(content_rule_supabase_mcp)"
}

install_somtech_commands() {
  log "Install command: somtech.deploy.md"
  write_file "${TARGET}/.cursor/commands/somtech.deploy.md" "$(content_command_somtech_deploy)"

  log "Install command: somtech.diagnostic.md"
  write_file "${TARGET}/.cursor/commands/somtech.diagnostic.md" "$(content_command_somtech_diagnostic)"

  log "Install command: somtech.polish.md"
  write_file "${TARGET}/.cursor/commands/somtech.polish.md" "$(content_command_somtech_polish)"

  log "Install command: somtech.ontologie.créer.md"
  write_file "${TARGET}/.cursor/commands/somtech.ontologie.créer.md" "$(content_command_somtech_ontologie)"
}

main() {
  # 1) modules/ : ne fait rien si le template existe déjà, sinon crée le minimum.
  if [[ -d "${TARGET}/modules/_template" ]]; then
    log "modules/_template existe déjà -> pas de création de structure modulaire."
  else
    log "Création structure modulaire minimale (template)…"
    create_min_module_structure_if_missing
  fi

  # 2) .cursor/ : dossiers nécessaires
  ensure_dir "${TARGET}/.cursor/rules"
  ensure_dir "${TARGET}/.cursor/commands"
  ensure_dir "${TARGET}/.cursor/generic"

  # 3) Cursor : backup + overwrite si existant
  write_placeholders_doc
  if [[ "${DO_RULES}" == "1" ]]; then install_rules; fi
  if [[ "${DO_SOMTECH}" == "1" ]]; then install_somtech_commands; fi
  if [[ "${DO_SPECKIT}" == "1" ]]; then install_speckit_assets; fi

  log "Terminé."
}

main


