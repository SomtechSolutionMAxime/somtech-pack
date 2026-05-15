# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Non-versionné] - 2026-05-15

Suite et fin de la demande **D-20260513-0012** (audit complet post-nettoyage, 7 stories).

### Modifié

- **Skill `webapp-testing`** (PR #55, T-20260513-0040) — retrait complet de la section dédiée Construction Gauthier (UUIDs, emails `@constructiongauthier.local`, 149 tests CG). Skill 100 % générique désormais. Fichier passe de 198 à 97 lignes.
- **Templates bootstrap** (PR #57, T-20260513-0042) — `constitution.example.md` et `ARCHITECTURE_DE_SECURITÉ.example.md` : les 29 mentions `.cursor/rules/*.mdc` remplacées par des références à `.claude/agents/`, `.claude/skills/`, `~/.claude/CLAUDE.md` global (règles d'or) et `.mcp.json` (MCPs). Section Annexes du constitution réécrite cohérente avec stack 2026.
- **`CLAUDE.md` racine** (PR #56, T-20260513-0041) — retrait de la ligne `.claude/CLAUDE.md` du tableau (fichier supprimé en D-20260513-0009), retrait note transition « Tier 2 — epic E-20260513-0011 » (Tier 2 terminé), retrait de `playwright-tests` de la liste des skills.

### Ajouté

- **`mcp-expose-v1.0.0.zip`** (PR #56, T-20260513-0041) — fichier `.zip` versionné du plugin mcp-expose généré (20 K). Le manifest déclarait v1.0.0 sans `.zip` correspondant.

### Supprimé

- **Skill `/playwright-tests`** (PR #54, T-20260513-0039) — 100 % spécifique Construction Gauthier (pas de frontmatter YAML, chemin Mac hardcodé, 9 emails `@constructiongauthier.com`). 5 fichiers, −459 lignes. Le contenu peut vivre dans le repo CG en local.

### Technique

- `scripts/update_speckit_assets.sh` (PR #56, T-20260513-0041) — passage de `-rw-r--r--` à `-rwxr-xr-x` (chmod +x).

## [Non-versionné] - 2026-05-13

### Modifié

- **Plugin `somcraft-deployer`** (PR #53, T-20260513-0049) — bump **v1.4.0 → v1.4.1** : source du nom client migrée de `.claude/CLAUDE.md` vers `.somtech/app.yaml` (créé par `/lier-app`, STD-027). Pas de fallback bricolage : échec explicite si `.somtech/app.yaml` absent. Nouveau `somtech-somcraft-deployer-v1.4.1.zip` (36 K).
- **Skills `/scaffold-aims` et `/somtech-pack-maj`** (PR #52, T-20260513-0037) — nettoyage des références mortes vers `install_somtech_pack.sh` (script supprimé Tier 1) et `.cursor/` (dossier supprimé Tier 1). Section « Options avancées » de `somtech-pack-maj` réécrite avec les vrais flags du script (`--modules core|features|mockmig|plugins`, `--ref`, `--dry-run`).

### Supprimé

- **Template `.claude/CLAUDE.md` projet** (PR #49, D-20260513-0009) — retrait complet du template poussé aux projets (anti-duplication avec le CLAUDE.md global utilisateur). Adaptation de `/end-session`, `/somtech-pack-maj`, `/somtech-pack-install`. Les projets peuvent garder leur propre `.claude/CLAUDE.md` local s'ils en ont un.

### Refactoré

- **Tier 1 — legacy Cursor supprimé** (PR #46) — `.cursor/` (70+ fichiers), `scripts/install_somtech_pack.sh` (1074 lignes), `scripts/migrate_cursor_backups.sh`. Le pack devient un pack honnête : Claude Code + plugins Cowork uniquement.
- **Tier 2 — réécriture template `.claude/CLAUDE.md`** (PR #47) — aligné sur la stack 2026 (ADR-012 Next.js, DO TOR1, règles d'or actuelles, STD-001/002/027, workflow Demande → Epic → Story). Suivi par le retrait complet en PR #49.
- **Tier 3 — audit legacy potentiel** (PR #48) — README ajouté à `features/audio-transcription-analysis`.

### Corrigé

- **Régression scripts pull + skills** (PR #50) — pull autonome rendu fonctionnel, exclusion `settings.json` du pull, fix du merge JSON dans `/lier-app`.
- **Nettoyage post-audit** (PR #51) — fix `somtech_pack_add` + suppression de 2 orphelins.

## [Non-versionné] - 2026-05-12

### Ajouté

- **Mémoire externe d'état d'application — Phase 2** (PR #45, demande D-20260512-0004, epic E-20260512-0003) — implémentation STD-027 :
  - Skill `/lier-app` — associe un repo à une application Somtech, crée `.somtech/app.yaml` + doc Somcraft `/operations/<app-slug>/etat-app.md`
  - Skill `/sync-app-state` — synchronise l'état d'app entre repo et Somcraft
  - Hook `SessionStart` — charge automatiquement l'état au démarrage de session Claude Code
  - Extension `/end-session` — met à jour le doc Somcraft de fin de session
  - Templates et structure `.somtech/` à la racine du repo

## [Non-versionné] - 2025-02-01

### Ajouté

- **Skills Claude Code** (.claude/skills/)
  - `mockmig/` — workflow de migration avec 6 phases (init, discover, analyze, plan, execute, status)
  - `git-module/` — gestion des sous-modules git avec 5 phases (status, add, list, sync, remove)
- **Templates bootstrap** (.claude/templates/bootstrap/)
  - Templates ontologie, memory, security, session
- **Schémas** (.claude/schemas/)
  - `mockmig/session.schema.json`
- **Configuration**
  - `.gitignore` pour ignorer les fichiers `.DS_Store`

### Modifié

- `mockmig/phases/discover.md` — mise à jour du workflow de découverte
- `mockmig/phases/execute.md` — mise à jour du workflow d'exécution

### Technique

- Synchronisation avec origin/main (38 fichiers récupérés)
- Nettoyage des `.DS_Store` accidentellement committés

> **Note** : la mention historique `.claude/CLAUDE.md instructions projet` qui figurait dans cette entrée a été retirée — ce fichier a depuis été supprimé du pack le 2026-05-13 (cf. PR #49).
