# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).
Le pack suit le versioning [SemVer](https://semver.org/lang/fr/) — la version est exposée dans `pack.json` et figée par un tag git `v<MAJOR>.<MINOR>.<PATCH>` à chaque livraison.

## [1.2.0] - 2026-06-23

Regroupe les évolutions du pack depuis v1.1.0 : nouveaux skills de gouvernance documentaire (BRD, ontologie, schéma de données, agent brief, alignés sur les STD-033 à STD-036) et durcissement du plugin `somtech-somcraft-deployer` (provisioning du sidecar Gotenberg pour l'export PDF SomCraft ≥ v0.31.0).

### Ajouté

- **Skill `/brd`** (PR #62, E-20260529-0007) — commande de gestion du BRD d'une application, référence STD-033. Étendu au **grain module** (PR #69, E5-S1) et **cross-référencé** vers le workflow `analyse-decoupage-demande` (PR #70, E5-S2).
- **Skill `/ontology`** (PR #64, STD-035, D-20260605-0006) — gestion de l'ontologie d'une app.
- **Skill `/agent-brief`** (PR #65, STD-036) — gestion de l'Agent Brief (renommé **ABD → ABC, Agent Brief Canonique** en PR #68).
- **Skill `/schema-doc`** (PR #66, STD-034, D-20260605-0005) — wrapper de gestion du `data_schema` + pointer SD.

### Modifié

- **Skills BRD — alignement pattern pointer Somcraft + auth uniforme** (PR #67, D-20260605-0003).
- **Plugin `somtech-somcraft-deployer` v1.4.1 → v1.5.0** (PR #61) — alignement du skill sur SomCraft v0.21 (résorption du drift v0.4.x).
- **Plugin `somtech-somcraft-deployer` v1.5.0 → v1.6.0 — provisioning sidecar Gotenberg dans l'upgrade** (PR #71, T-20260603-0010) :
  - Le skill `deploy-somcraft` (modes `install` et `upgrade`) provisionne désormais le **sidecar Gotenberg** (export PDF) en Phase 4, avant le `fly deploy`, pour toute version SomCraft cible **≥ v0.31.0**. Sans cette étape, l'export PDF était cassé après un upgrade (Puppeteer in-process retiré de l'image en v0.31.0).
  - L'étape **délègue au script versionné `tools/provision-gotenberg-sidecar.sh`** du repo SomCraft cloné (source de vérité, idempotent) — pas de duplication de logique dans le skill. Gate de version via `sort -V`.
  - Phase 5 (smoke tests) : nouveau **Test 4 — export PDF** via MCP `export_document` (vérifie le `download_url`, détecte `PDF generation failed`).
  - `commands/deploy-somcraft-upgrade.md` + `references/fly-deployment.md` mis à jour (secret `GOTENBERG_URL` staged par le script, pas posé manuellement).
  - Mode `upgrade` : la Phase 4 étape 5 est idempotente et **obligatoire** pour ≥ v0.31.0 — documenté explicitement pour interdire de la court-circuiter.

## [1.1.0] - 2026-05-15

Première montée de version depuis la mise en place du versioning. Cette version regroupe la fin de la demande **D-20260513-0012** (audit complet post-nettoyage, 7 stories), le fix de design `security/` opt-in, et la mémoire externe d'état d'application (STD-027) commencée le 2026-05-12.

### Ajouté

- **Mémoire externe d'état d'application (STD-027)** (2026-05-12, PR #45, D-20260512-0004) :
  - Skill `/lier-app` — associe un repo à une application Somtech, crée `.somtech/app.yaml` + doc Somcraft `/operations/<app-slug>/etat-app.md`
  - Skill `/sync-app-state` — synchronise l'état d'app entre repo et Somcraft
  - Hook `SessionStart` — charge automatiquement l'état au démarrage de session Claude Code
  - Extension `/end-session` — met à jour le doc Somcraft de fin de session
  - Templates et structure `.somtech/` à la racine du repo
- **Nouveau module `security`** dans `pack.json` (2026-05-15, PR #59) — opt-in (`default: false`), permet d'opt-in via `--modules core,features,security` sans écraser l'architecture sécurité projet-spécifique
- **`mcp-expose-v1.0.0.zip`** (2026-05-15, PR #56, T-20260513-0041) — fichier `.zip` versionné du plugin mcp-expose (20 K)
- **`somtech-somcraft-deployer-v1.4.1.zip`** (2026-05-13, PR #53, T-20260513-0049) — regen du `.zip` plugin (36 K)

### Modifié

- **Plugin `somcraft-deployer`** v1.4.0 → **v1.4.1** (PR #53, T-20260513-0049) — source du nom client migrée de `.claude/CLAUDE.md` vers `.somtech/app.yaml` (créé par `/lier-app`). Pas de fallback bricolage : échec explicite si `.somtech/app.yaml` absent
- **Module `core`** (PR #59) — retrait de `security/` (devient module opt-in distinct). `core` = `.claude/`, `scripts/`, `docs/`
- **Script `somtech_pack_pull.sh`** (PR #50 + #57) — pull autonome, flags `--modules core|features|security|mockmig|plugins`, `--ref`, `--dry-run`. Exclusions explicites de `.claude/CLAUDE.md` et `.claude/settings.json` (jamais écrasés)
- **Skill `webapp-testing`** (PR #55, T-20260513-0040) — retrait complet de la section Construction Gauthier (UUIDs, emails `@constructiongauthier.local`, 149 tests CG). Skill 100 % générique, fichier passe de 198 à 97 lignes
- **Skills `/scaffold-aims` et `/somtech-pack-maj`** (PR #52, T-20260513-0037) — nettoyage des références mortes vers `install_somtech_pack.sh` (Tier 1) et `.cursor/`. Section « Options avancées » de `/somtech-pack-maj` réécrite avec les vrais flags du script
- **Templates bootstrap** (PR #57, T-20260513-0042) — `constitution.example.md` + `ARCHITECTURE_DE_SECURITÉ.example.md` : 29 mentions `.cursor/rules/*.mdc` remplacées par références à `.claude/agents/`, `.claude/skills/`, `~/.claude/CLAUDE.md` global et `.mcp.json`
- **`CLAUDE.md` racine du pack** (PR #56 + #59) — tableau modules à jour, retrait `.claude/CLAUDE.md` (fichier supprimé) et `playwright-tests` (skill supprimé), description du dossier `security/` clarifiée

### Supprimé

- **Template `.claude/CLAUDE.md` projet** (PR #49, D-20260513-0009) — retrait complet (anti-duplication avec le CLAUDE.md global utilisateur). Les projets peuvent garder leur propre `.claude/CLAUDE.md` local s'ils en ont un. Adaptation de `/end-session`, `/somtech-pack-maj`, `/somtech-pack-install`
- **Skill `/playwright-tests`** (PR #54, T-20260513-0039) — 100 % spécifique Construction Gauthier (pas de frontmatter YAML, chemin Mac hardcodé, 9 emails `@constructiongauthier.com`). 5 fichiers, −459 lignes
- **Legacy Cursor** (PR #46, Tier 1) — `.cursor/` (70+ fichiers), `scripts/install_somtech_pack.sh` (1074 lignes), `scripts/migrate_cursor_backups.sh`. Le pack devient un pack honnête : Claude Code + plugins Cowork uniquement

### Refactoré

- **Tier 2 — réécriture template `.claude/CLAUDE.md`** (PR #47) — aligné sur la stack 2026 (ADR-012 Next.js, DO TOR1, règles d'or actuelles, STD-001/002/027, workflow Demande → Epic → Story). Suivi par le retrait complet en PR #49
- **Tier 3 — audit legacy potentiel** (PR #48) — README ajouté à `features/audio-transcription-analysis`

### Corrigé

- **Régression scripts pull + skills** (PR #50) — pull autonome, exclusion `settings.json` du pull, fix du merge JSON dans `/lier-app`
- **Nettoyage post-audit** (PR #51) — fix `somtech_pack_add` + suppression de 2 orphelins

### Technique

- `scripts/update_speckit_assets.sh` (PR #56) — passage de `-rw-r--r--` à `-rwxr-xr-x` (chmod +x)
- Mise en place du versioning SemVer + convention de tag git `v<MAJOR>.<MINOR>.<PATCH>` (2026-05-15)

## [1.0.0] - 2025-02-01

Version initiale historique (tag rétroactif posé le 2026-05-15 pour figer l'état antérieur à la mise en place du versioning).

### Ajouté

- **Skills Claude Code** (`.claude/skills/`)
  - `mockmig/` — workflow de migration avec 6 phases (init, discover, analyze, plan, execute, status)
  - `git-module/` — gestion des sous-modules git avec 5 phases (status, add, list, sync, remove)
- **Templates bootstrap** (`.claude/templates/bootstrap/`)
  - Templates ontologie, memory, security, session
- **Schémas** (`.claude/schemas/`)
  - `mockmig/session.schema.json`
- **Configuration**
  - `.gitignore` pour ignorer les fichiers `.DS_Store`

### Modifié

- `mockmig/phases/discover.md` — mise à jour du workflow de découverte
- `mockmig/phases/execute.md` — mise à jour du workflow d'exécution

### Technique

- Synchronisation avec origin/main (38 fichiers récupérés)
- Nettoyage des `.DS_Store` accidentellement committés

> **Note** : la mention historique `.claude/CLAUDE.md instructions projet` qui figurait dans cette entrée a été retirée — ce fichier a depuis été supprimé du pack le 2026-05-13 (cf. PR #49, intégré dans v1.1.0).
