# Design — Réduire la corvée de MAJ du somtech-pack sur les repos clients

- **Demande** : D-20260722-0004
- **App** : Somtech Pack (`2098c2fd-...`) — **pas de BRD** → traçabilité EF **N/A** (règle d'or n°10 signalée)
- **Date** : 2026-07-22
- **Mode** : brainstorming autonome (session Maxime, via `/plan-servicedesk brain`)

## 1. Problème

Mettre à jour le somtech-pack sur les ~20 repos clients = **corvée manuelle** : `npx pack update` repo par repo, un diff/PR à réviser à chaque fois. À chaque release du pack, ça ne « scale » pas → les repos divergent, la valeur d'une amélioration du pack met des semaines à se propager.

## 2. Contrainte dure (pourquoi « un seul install global » est exclu)

Une partie de `.claude/` **doit** rester dans le repo, sinon on casse des acteurs réels :

| Doit rester per-repo | Pourquoi |
|---|---|
| `.mcp.json` (project_ref Supabase du client) | Filet anti-migration-croisée (CLAUDE.md) — jamais pointer un autre Supabase |
| `.somtech/app.yaml` | Identité de l'app (STD-027) |
| hooks à contexte repo (SessionStart état-app) | Ont besoin du repo pour fonctionner |
| `settings.json` (permissions/hooks du projet) | Spécifique au repo |
| **Reproductibilité** | Coéquipier qui clone, runner **CI**, agent **Orbit** autonome, machine neuve → doivent obtenir la config **sans dépendre du global de Maxime** |

⇒ Collapser tout en global casse CI / agents / coéquipiers + le MCP project-scoped. **Rejeté.**

## 3. Insight structurant

Réduire la surface per-repo **aide** (diffs plus petits, moins de review) mais **ne supprime pas** la corvée : tant que la propagation est manuelle, N repos = N gestes. **Le vrai levier est l'automatisation du fan-out**, pas la taille de la surface. Donc : **automatiser d'abord, rétrécir ensuite.**

## 4. Options examinées

### Fan-out (levier principal)
- **A. GitHub Action centrale dans le pack** — déclenchée sur tag release `v*` : pour chaque repo du registre, `npx pack update` + ouvre une **PR** (jamais push direct). Contrôle total, standard « release → propagate ». **← retenu.**
- **B. Agent planifié (routine Claude Code / `/schedule`)** — plus flexible (peut raisonner les conflits) mais plus coûteux/lourd. Réserve pour cas complexes.
- **C. Renovate/Dependabot** — le pack est déjà `@somtech-solutions/pack` sur GitHub Packages ; chaque repo le référence, Renovate bump la version + un CI lance `pack update`. Réutilise du battle-tested mais impose au pack d'être une vraie dépendance avec hook d'install. **Piste v2** si A montre ses limites.

**Registre des repos = ServiceDesk.** `applications.repo_url` liste déjà les apps + leur repo. Pas de liste à maintenir à la main : le fleet updater interroge SD (apps actives avec `repo_url` + pack installé).

### Surface per-repo (levier secondaire)
- **1a. Repo mince** : garde l'irréductible + **pin de version** ; le générique vient du global ou d'un `npx pack init --pinned` à la demande (CI/agents). Diffs minimes, mais un clone seul n'est plus autosuffisant sans étape d'install.
- **1b. Garder le générique committé** mais rendre la MAJ automatique. Reproductibilité intacte, diffs plus gros absorbés par l'automatisation.
- Décision : **1b d'abord** (ne casse rien), évaluer **1a** ensuite pour alléger les diffs.

### Visibilité de drift
`.somtech-pack/version.json` existe déjà. Ajouter une **vue « pack version coverage »** dans SD (comme `brd_coverage`) : quel repo sur quelle version → cible du fan-out + tableau de bord.

## 5. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Bruit de PR (20 PR/release) | Canary (1-2 repos puis flotte) ; auto-merge des diffs triviaux (skills/docs), review humaine seulement si `settings.json`/hooks changent |
| Sécurité des tokens (règle secrets) | **GitHub App least-privilege**, secret en env CI, **jamais dans le code** (STD-038) |
| Un mauvais release casse 20 repos | **Canary** + fan-out par **PR** (pas push direct) → la CI de chaque repo gate ; rollback = ne pas merger |
| Écrasement de customisations locales | `pack update` fait déjà diff/no-overwrite-sans-`--force` ; le fleet updater ouvre une **PR**, jamais `--force` |
| Règle d'or n°7 (ne pas toucher d'autres repos) | Le fleet updater est **l'unique automatisation centrale sanctionnée** pour ça, via PR, avec sa propre identité → à **bénir par un ADR** (exception cadrée, ≠ session ad hoc) |

## 6. Décision (2 tracks, automation-first)

- **Track 1 — Fleet updater (immédiat, fort gain, risque nul sur l'existant)** : GitHub Action centrale sur release `v*`, registre = SD `applications.repo_url`, `npx pack update` par repo → **PR** (canary puis flotte), token GitHub App least-privilege. Vue drift SD en support.
- **Track 2 — Rétrécir la surface per-repo (suite)** : définir l'irréductible vs global/générique + pin de version. Allège diffs et review. **Après** que Track 1 ait prouvé le pipeline (touche le modèle d'install → plus risqué).

**On commence par Track 1.**

## 7. Hors-scope

- Réécrire le modèle de merge global/projet de Claude Code (pas à nous).
- Un seul install global (casse CI/agents/coéquipiers + MCP project-scoped).
- Changer l'exigence `.mcp.json` per-repo (critique sécurité, reste).

## 8. Note traçabilité

Somtech Pack n'a **pas de BRD** → les stories ne tracent aucune EF (`Réalisé par : N/A`), signalé conformément à la règle d'or n°10. Si on veut de la traçabilité produit sur le pack, ouvrir un BRD pack en amont (hors-scope de cette demande).
