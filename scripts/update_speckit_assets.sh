#!/usr/bin/env bash
set -euo pipefail

#
# update_speckit_assets.sh — resynchronise les assets Speckit "pinnés" (templates/docs) dans un repo cible.
#
# Objectif:
# - garantir que les templates `.specify/templates/*` nécessaires existent et peuvent être mis à jour
# - NE JAMAIS modifier `memory/constitution.md`
#
# Usage:
#   ./scripts/update_speckit_assets.sh --target /path/to/repo [--dry-run] [--version spec-kit-assets-0.0.90]
#

usage() {
  cat <<'EOF'
update_speckit_assets.sh — Resync des assets Speckit (templates/docs) sans toucher à la constitution.

Usage:
  ./scripts/update_speckit_assets.sh --target /path/to/target_repo [options]

Options:
  --dry-run      Affiche ce qui serait fait, sans écrire.
  --version      Valeur écrite dans `.specify/SPECKIT_ASSETS_VERSION` (ex: spec-kit-assets-0.0.90)

Garanties:
  - NE MODIFIE JAMAIS `memory/constitution.md`
  - Backup des fichiers remplacés en `*.bak-YYYYMMDDHHMMSS`
EOF
}

TARGET=""
DRY_RUN=0
ASSETS_VERSION="spec-kit-assets-0.0.90"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --version) ASSETS_VERSION="${2:-}"; shift 2 ;;
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
log() { echo "[update_speckit_assets] $*"; }

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

write_file_overwrite_with_backup() {
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

content_releasenote_template() {
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

content_spec_improvement_template() {
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

main() {
  log "Target: ${TARGET}"
  log "Version: ${ASSETS_VERSION}"

  # Guardrail: never touch constitution
  if [[ -f "${TARGET}/memory/constitution.md" ]]; then
    log "Constitution detected -> will not touch: ${TARGET}/memory/constitution.md"
  fi

  ensure_dir "${TARGET}/.specify/templates"

  write_file_overwrite_with_backup "${TARGET}/.specify/SPECKIT_ASSETS_VERSION" "${ASSETS_VERSION}"$'\n'
  write_file_overwrite_with_backup "${TARGET}/.specify/templates/releasenote-template.md" "$(content_releasenote_template)"
  write_file_overwrite_with_backup "${TARGET}/.specify/templates/spec-template-improvement.md" "$(content_spec_improvement_template)"

  log "Terminé."
}

main

