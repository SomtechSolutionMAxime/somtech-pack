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

Comportement:
  - modules/: crée uniquement le minimum si absent (structure modulaire via template)
  - .cursor/rules + .cursor/commands/somtech.* : installe toujours
    - si fichier existe -> backup en *.bak-YYYYMMDDHHMMSS puis overwrite
  - ajoute/écrase .cursor/generic/PLACEHOLDERS.md (backup si existant)

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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-rules) DO_RULES=0; shift ;;
    --no-somtech) DO_SOMTECH=0; shift ;;
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
    # By default, backups are created next to the file. For Cursor rules/commands,
    # store backups under `.cursor/_backups/{rules,commands}` to reduce noise.
    # NOTE: We never delete backups (keep all).
    local rel="${f#${TARGET}/}"
    local category=""

    if [[ "$rel" == ".cursor/rules/"* ]]; then
      category="rules"
    elif [[ "$rel" == ".cursor/commands/"* ]]; then
      category="commands"
    fi

    if [[ -n "$category" ]]; then
      local backup_dir="${TARGET}/.cursor/_backups/${category}"
      ensure_dir "$backup_dir"
      local b="${backup_dir}/$(basename "$f").bak-$(ts)"
      run "cp \"${f}\" \"${b}\""
    else
      local b="${f}.bak-$(ts)"
      run "cp \"${f}\" \"${b}\""
    fi
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

  log "Terminé."
}

main


