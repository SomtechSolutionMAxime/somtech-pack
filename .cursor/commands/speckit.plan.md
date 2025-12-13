---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Cartographier dynamiquement les règles**:
   - Lister tous les fichiers `.cursor/rules/*.md`.
   - Pour chaque fichier, extraire:
     - Identifiant (nom du fichier sans extension)
     - Titre (première ligne commençant par `#`, sinon identifiant)
     - Catégorie déduite (UI, QA, PRD, backend, sécurité, observabilité, DevOps, etc.) en se basant sur le nom du fichier et/ou des tags présents dans le contenu.
     - Résumé (première section ou début de fichier) et chemin absolu.
   - Stocker ces entrées dans `RulesCatalog` (structure interne) pour pouvoir filtrer plus tard.

3. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).
   - Parse the improvement spec to capture:
     - `Legacy Context` (existing stories, artefacts, source spec path)
     - `Current State Overview` grouped by layer
     - `Gap Analysis & Opportunities` table
     - `Required Enhancements & Functional Requirements`
     - `Cross-module / Cross-layer Impacts`
   - Build a structured “rework inventory” mapping each referenced artefact to its planned modification (file path, layer, dependency notes). This inventory will feed later sections (project structure, gates, plan summary).

   - Lier chaque élément du “rework inventory” à la ou les règles applicables en utilisant `RulesCatalog` (ex. si des vues UI sont touchées → règles `ui-*.md`, `browser-validation-strategy.mdc`, etc.).
   - Construire `ApplicableRules[]` = {id, titre, catégorie, résumé, chemin, justification (pourquoi la règle s’applique)}.

4. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Summary with both the primary improvement goal and the shortlisted artefacts from the rework inventory.
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION") and highlight reused components/services when relevant.
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified), ensuring any cross-module impact or debt flagged in the spec is documented either in Constitution gates ou dans les sections “Rework Scope” et “Règles & Checkpoints”.
   - Insérer `ApplicableRules[]` dans la section “Règles & Checkpoints” du plan (nouveau bloc du template) en citant explicitement les fichiers de règles et les phases concernées (ex. “Règle UI – vérifier MCP Playwright en Phase Story 1”).
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Phase 1: Update agent context by running the agent script
   - Re-evaluate Constitution Check post-design

5. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, generated artifacts, et rappel des règles critiques identifiées.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Agent context update**:
   - Run `.specify/scripts/bash/update-agent-context.sh cursor-agent`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
