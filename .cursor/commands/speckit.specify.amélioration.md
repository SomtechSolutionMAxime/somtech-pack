---
description: Create or update a feature-improvement specification that explicitly references the current codebase state.
handoffs: 
  - label: Build Technical Plan
    agent: speckit.plan
    prompt: Create a plan for the spec. I am building with...
  - label: Clarify Spec Requirements
    agent: speckit.clarify
    prompt: Clarify specification requirements
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text typed after `/speckit.specify.amélioration` **is** the improvement brief. Assume it is always available even if `$ARGUMENTS` appears literally below. Do not ask the user to repeat it unless it is empty.

Given that brief, execute the following workflow:

1. **Generate a concise short name** (2‑4 words) exactly like `/speckit.specify`:
   - Keep the action‑noun style (ex. `enrich-client-profile`, `improve-ticket-escalation`)
   - Preserve specific acronyms/terms that describe the feature.

2. **Determine the next feature number and create the working branch/spec folder**:
   - `git fetch --all --prune`
   - Inspect remote branches, local branches, and `specs/` directories for the pattern `[0-9]+-<short-name>`
   - Pick the next number (N+1) and run `.specify/scripts/bash/create-new-feature.sh --json "$ARGUMENTS" --number N+1 --short-name "<short-name>"`
   - Only run the script once per feature; keep the JSON output (branch + spec paths).

3. **Load `.specify/templates/spec-template-improvement.md`** (the dedicated improvement template).  
   - If this file is missing for any reason, fall back to `.specify/templates/spec-template.md` but ensure you manually inject the sections described below (Current State, Gap Analysis, Cross-impacts, etc.).

4. **Build the code-intelligence dossier before writing anything**:
   1. Parse the user brief → extract actors, modules, entities, actions, non-functional constraints.
   2. Derive search tokens (singular/plural, snakeCase/PascalCase, translations if relevant).
   3. **Automatic legacy context detection**:
      - Search `specs/*/spec.md` and `modules/*/prd/*.md` for the short-name (exact match) and for key actors/entities inferred from the brief.
      - When matches are found, capture:
        - Feature/spec path (`specs/00X-.../spec.md`)
        - Section titles (user stories, requirements) + their priorities
        - Related PRD sections (`modules/{module}/prd/{module}.md`)
      - Populate `Source Spec / Feature` in the template with the best matching spec path(s).
      - Pre-fill `Legacy Context → Existing User Stories` with the imported stories (title, priority, summary) referencing their original source.
      - If multiple matches tie, list them all with short justification.
   4. Run a mix of semantic and textual exploration across the repo:
      - `codebase_search` for each core concept (default target: repo root, then narrow to `src/`, `modules/`, `supabase/`, `tests/`, `docs/` when matches appear).
      - `rg`/`grep` when looking for exact symbols or to confirm occurrences.
      - Walk both frontend and backend folders, plus `modules/*/prd`, `modules/*/tests`, and `specs/*` to capture prior work.
   5. For every meaningful match, capture:
      - File path + component/function/class/endpoint name
      - One‑line summary of what it currently does
      - Detected gaps vs the requested improvement (if obvious)
   6. Categorise findings by layer: `Frontend UI`, `Backend/API`, `Data/DB`, `Tests`, `Docs/PRD`, `Other Modules`.
   7. **Validation rule**: before writing the spec, ensure each applicable layer has at least one concrete reference. If a layer is legitimately unused, document the rationale. If one or more expected layers have zero references, pause and request user confirmation (include a summary of missing layers). Do not proceed without either adding references or recording explicit user approval.
   8. If **no relevant code is discovered**, explicitly note it in the spec (section “Constats code”) and recommend falling back to `/speckit.specify`. This should be extremely rare, but must be clearly logged.

5. **Compose the improvement-focused specification** (still written to `SPEC_FILE`):
   - Populate every section provided by the improvement template:
     - `Legacy Context` (existing stories + artefacts referenced from the prior spec/PRD)
     - `Current State Overview` (summaries per layer with inline references, ex. ``src/modules/clients/...``)
     - `Gap Analysis & Opportunities`
     - `Improvement Stories` under `User Scenarios & Testing`
     - `Required Enhancements & Functional Requirements`
     - `Cross-module / Cross-layer Impacts`
     - `Success Criteria`, `Assumptions`, `Dependencies`, `Risks`, `Open Questions`
   - User Scenarios, Functional Requirements, Success Criteria, Assumptions, Dependencies, Risks, etc., must all mention the interplay with existing assets when relevant (e.g., “Extend `ClientProfileCard` to display … and update `modules/clients/prd/clients.md` accordingly”).
   - Keep the [NEEDS CLARIFICATION] policy identical to `/speckit.specify` (max 3, only for critical unknowns). When you add such markers, include the code reference that triggered the question.
   - Document every impact that is required “ailleurs” (other layers, docs, analytics, RLS) so downstream agents know the full blast radius.

6. **Quality safeguards & checklist**:
   1. Create `FEATURE_DIR/checklists/requirements.md` using the template below, augmented with improvement-specific checks:
   
      ```markdown
      # Specification Quality Checklist: [FEATURE NAME]
      
      **Purpose**: Validate specification completeness and quality before proceeding to planning
      **Created**: [DATE]
      **Feature**: [Link to spec.md]
      
      ## Content Quality
      
      - [ ] No implementation details (languages, frameworks, APIs)
      - [ ] Focused on user value and business needs
      - [ ] Written for non-technical stakeholders
      - [ ] All mandatory sections completed
      
      ## Requirement Completeness
      
      - [ ] No [NEEDS CLARIFICATION] markers remain
      - [ ] Requirements are testable and unambiguous
      - [ ] Success criteria are measurable and technology-agnostic
      - [ ] All acceptance scenarios are defined
      - [ ] Edge cases are identified
      - [ ] Scope is clearly bounded
      - [ ] Dependencies and assumptions identified
      
      ## Improvement Readiness
      
      - [ ] Code analysis covers frontend, backend, data, tests, and docs when applicable
      - [ ] Current State Overview cites concrete files or explicitly notes absence of code
      - [ ] Cross-module impacts are documented
      - [ ] Required enhancements map to existing artefacts (or justify new ones)
      - [ ] Recommended follow-up (plan/tasks) is compatible with the standard workflow
      
      ## Notes
      
      - Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
      ```
   
   2. Review each checklist item. If something fails, update the spec and re-check (max 3 iterations). Quote the relevant spec snippet for every failure.
   3. If [NEEDS CLARIFICATION] markers remain, follow the same questioning protocol as `/speckit.specify` (table with options A/B/C/Custom).

   c. **Handle Validation Results**:

      - **If all items pass**: Mark checklist complete and proceed to step 6

      - **If items fail (excluding [NEEDS CLARIFICATION])**:
        1. List the failing items and specific issues
        2. Update the spec to address each issue
        3. Re-run validation until all items pass (max 3 iterations)
        4. If still failing after 3 iterations, document remaining issues in checklist notes and warn user

      - **If [NEEDS CLARIFICATION] markers remain**:
        1. Extract all [NEEDS CLARIFICATION: ...] markers from the spec
        2. **LIMIT CHECK**: If more than 3 markers exist, keep only the 3 most critical (by scope/security/UX impact) and make informed guesses for the rest
        3. For each clarification needed (max 3), present options to user in this format:

           ```markdown
           ## Question [N]: [Topic]
           
           **Context**: [Quote relevant spec section]
           
           **What we need to know**: [Specific question from NEEDS CLARIFICATION marker]
           
           **Suggested Answers**:
           
           | Option | Answer | Implications |
           |--------|--------|--------------|
           | A      | [First suggested answer] | [What this means for the feature] |
           | B      | [Second suggested answer] | [What this means for the feature] |
           | C      | [Third suggested answer] | [What this means for the feature] |
           | Custom | Provide your own answer | [Explain how to provide custom input] |
           
           **Your choice**: _[Wait for user response]_
           ```

        4. **CRITICAL - Table Formatting**: Ensure markdown tables are properly formatted:
           - Use consistent spacing with pipes aligned
           - Each cell should have spaces around content: `| Content |` not `|Content|`
           - Header separator must have at least 3 dashes: `|--------|`
           - Test that the table renders correctly in markdown preview
        5. Number questions sequentially (Q1, Q2, Q3 - max 3 total)
        6. Present all questions together before waiting for responses
        7. Wait for user to respond with their choices for all questions (e.g., "Q1: A, Q2: Custom - [details], Q3: B")
        8. Update the spec by replacing each [NEEDS CLARIFICATION] marker with the user's selected or provided answer
        9. Re-run validation after all clarifications are resolved

   d. **Update Checklist**: After each validation iteration, update the checklist file with current pass/fail status

7. Report completion with branch name, spec file path, checklist results, and readiness for the next phase (`/speckit.clarify` or `/speckit.plan`).

**NOTE:** The script creates and checks out the new branch and initializes the spec file before writing.

## General Guidelines

- Continue to focus on **WHAT** users need and **WHY**, while grounding recommendations in the actual codebase.
- Reference files/functions using inline code formatting and keep quotes short (no giant dumps).
- When citing snippets, respect the project’s documentation rules (use ```startLine:endLine:path``` format when needed).
- If a section of the template is irrelevant, remove it entirely rather than leaving “N/A”.
- Document assumptions whenever you infer behaviour from the current implementation.
- Default to reasonable industry practices for unspecified technical details; escalate only when the decision significantly impacts scope, security, or UX.

### Success Criteria Guidance (unchanged but contextualised)

### Section Requirements

- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation

When creating this spec from a user prompt:

1. **Make informed guesses**: Use context, industry standards, and common patterns to fill gaps
2. **Document assumptions**: Record reasonable defaults in the Assumptions section
3. **Limit clarifications**: Maximum 3 [NEEDS CLARIFICATION] markers - use only for critical decisions that:
   - Significantly impact feature scope or user experience
   - Have multiple reasonable interpretations with different implications
   - Lack any reasonable default
4. **Prioritize clarifications**: scope > security/privacy > user experience > technical details
5. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
6. **Common areas needing clarification** (only if no reasonable default exists):
   - Feature scope and boundaries (include/exclude specific use cases)
   - User types and permissions (if multiple conflicting interpretations possible)
   - Security/compliance requirements (when legally/financially significant)

**Examples of reasonable defaults** (don't ask about these):

- Data retention: Industry-standard practices for the domain
- Performance targets: Standard web/mobile app expectations unless specified
- Error handling: User-friendly messages with appropriate fallbacks
- Authentication method: Standard session-based or OAuth2 for web apps
- Integration patterns: RESTful APIs unless specified otherwise

### Success Criteria Guidelines

Success criteria must be:

1. **Measurable**: Include specific metrics (time, percentage, count, rate)
2. **Technology-agnostic**: No mention of frameworks, languages, databases, or tools
3. **User-focused**: Describe outcomes from user/business perspective, not system internals
4. **Verifiable**: Can be tested/validated without knowing implementation details

**Good examples**:

- "Users can complete checkout in under 3 minutes"
- "System supports 10,000 concurrent users"
- "95% of searches return results in under 1 second"
- "Task completion rate improves by 40%"

**Bad examples** (implementation-focused):

- "API response time is under 200ms" (too technical, use "Users see results instantly")
- "Database can handle 1000 TPS" (implementation detail, use user-facing metric)
- "React components render efficiently" (framework-specific)
- "Redis cache hit rate above 80%" (technology-specific)
