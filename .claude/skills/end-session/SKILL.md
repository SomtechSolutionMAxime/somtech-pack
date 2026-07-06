---
name: end-session
description: |
  Skill de fin de session Claude Code pour documenter automatiquement le travail accompli.
  DÉCLENCHEURS: /end-session, fin de session, clôturer session, terminer session, sync docs
  Met à jour CHANGELOG.md du projet (Ajouté/Modifié/Corrigé/Technique).
  ET si .somtech/app.yaml présent (STD-027) : met aussi à jour le doc Somcraft
  /operations/<app-slug>/etat-app.md (source de vérité de la mémoire externe d'état
  d'app) + le cache local .somtech/app-state.md (gitignored).
  ET ferme les branches mergées (local + distant, squash-merges inclus) en laissant
  ouvertes celles avec du travail non mergé (protège main/staging/wt-*/courante).
---

# End Session - Documentation Automatique

Ce skill analyse la session Claude Code en cours et met à jour la documentation du projet (CHANGELOG.md + mémoire externe d'état d'app STD-027 si applicable).

> **Note** : ce skill ne touche pas à `.claude/CLAUDE.md` du projet — depuis 2026-05-13, le pack ne pousse plus de template CLAUDE.md projet (cf. D-20260513-0009). Le CLAUDE.md global utilisateur (`~/.claude/CLAUDE.md`) couvre toutes les règles transversales. Les projets qui ont un `.claude/CLAUDE.md` local l'ont créé eux-mêmes, et `/end-session` n'y touche pas.

## Workflow

### 1. Analyser la session

Parcourir l'historique de la conversation pour identifier:

- **Décisions techniques**: choix d'architecture, patterns utilisés, compromis faits
- **Problèmes résolus**: bugs fixés, défis surmontés, solutions trouvées
- **Fichiers modifiés**: liste des fichiers créés/modifiés avec résumé des changements
- **Contexte important**: informations utiles pour les futures sessions

### 2. Mettre à jour CHANGELOG.md

Format standard pour les entrées:

```markdown
## [Non-versionné] - YYYY-MM-DD

### Ajouté
- Nouvelles fonctionnalités

### Modifié
- Changements aux fonctionnalités existantes

### Corrigé
- Bugs résolus

### Technique
- Décisions techniques, refactoring, dette technique
```

**Règles:**
- Créer le fichier s'il n'existe pas
- Ajouter une nouvelle section datée en haut
- Catégoriser les changements (Ajouté/Modifié/Corrigé/Technique)
- Être spécifique mais concis

### 3. Mettre à jour la mémoire externe d'état d'app (STD-027)

**Cette étape s'applique uniquement si `.somtech/app.yaml` existe dans le repo courant** (app liée à la mémoire externe selon STD-027). Sinon, sauter directement à l'étape 4.

#### Pré-requis MCP

- `mcp__claude_ai_Somcraft__read_document`
- `mcp__claude_ai_Somcraft__write_document` (ou `update_document`)

#### Workflow

**3a. Lire le mapping local**

Parser `.somtech/app.yaml` pour récupérer :
- `somcraft.workspace_id` (workspace du **client**)
- `somcraft.app_state_doc_path` (par défaut `/operations/<app-slug>/etat-app.md`)
- `servicedesk.app_slug`, `app_name`, `client_name`

**3b. Lire le doc Somcraft actuel**

```
mcp__claude_ai_Somcraft__read_document
  workspace_id=<workspace_id>
  path=<app_state_doc_path>
```

Conserver le contenu actuel comme base de comparaison.

**3c. Analyser les changements opérationnels de la session**

Identifier ce qui a changé pendant la session et qui mérite d'être enregistré dans l'état d'app. Distinguer ce qui va dans quelle section :

| Section | Quand la mettre à jour |
|---|---|
| **TL;DR** | Si la session a déplacé l'état global (passage en staging, blocker résolu, etc.) — sinon laisser |
| **Cycle de vie** | Si la phase a changé (build → acceptation, etc.) ou si les prochaines étapes ont évolué |
| **Environnements** | Si un env a changé d'état (déploiement, drift, panne) |
| **Tests** | Si le statut L1-L5 a évolué (passage vert/rouge, nouveau rapport QA) |
| **Décisions récentes & contraintes** | Si une décision opérationnelle nouvelle a été prise (freeze, contrainte temporaire) — pas les ADR/STD (ils vivent dans Architecture/) |
| **Dernière session** | **Toujours réécrite (overwrite)** — 2-4 bullets max sur ce qui n'est pas évident depuis git/SD/code |
| **Pièges & avertissements** | Si un nouveau piège a été identifié ou un ancien levé |

**3d. Composer le draft du nouveau doc**

Construire le contenu cible en gardant les sections inchangées et en mettant à jour celles impactées. Mettre à jour le frontmatter :
- `last_updated` : timestamp ISO 8601 UTC du moment courant
- `updated_by` : `claude-session-<short_id>` (ou `claude-end-session`)
- `current_branch` : résultat de `git rev-parse --abbrev-ref HEAD`
- `current_phase` : conserver sauf si la session a fait basculer la phase

**3e. Discipline anti-bloat (STD-027)**

Avant d'écrire, vérifier :
- TL;DR ≤ 3 phrases
- Dernière session ≤ 4 bullets, **overwrite obligatoire** (pas un journal)
- Pièges ≤ 3 items
- **Total du doc ≤ 1500 tokens**

Si dépassement : afficher un warning et proposer une troncature (Décisions récentes ou Pièges anciens à archiver). Ne PAS écrire silencieusement un doc qui dépasse.

**3f. Présenter le draft + validation utilisateur**

Afficher à l'utilisateur :
- Un résumé des sections modifiées (ex: « TL;DR mis à jour, Environnements: staging passé à ✅, Dernière session: 3 bullets »)
- Optionnel : un diff visible des changements
- Demander : « Appliquer ces changements à Somcraft + cache local ? (oui/non/ajuster) »

Si **oui** → étape 3g. Si **non** → skip étape Somcraft (l'étape 4 résumé restera). Si **ajuster** → proposer un nouveau draft basé sur les retours.

**3g. Écrire dans Somcraft**

```
mcp__claude_ai_Somcraft__update_document
  workspace_id=<workspace_id>
  path=<app_state_doc_path>
  content=<doc complet mis à jour>
```

**3h. Rafraîchir le cache local**

Écrire le même contenu dans `.somtech/app-state.md` (overwrite local). Le hook `SessionStart` lira ce cache au prochain boot.

#### Erreurs gérées

| Cas | Comportement |
|---|---|
| `.somtech/app.yaml` absent | Skip cette étape, passer à 4 (comportement actuel inchangé) |
| MCP Somcraft indisponible | Afficher erreur explicite, ne PAS modifier le cache local, suggérer de relancer plus tard |
| Doc Somcraft corrompu/manquant | Suggérer `/lier-app` pour recréer le doc, ne pas écrire |
| Dépassement 1500 tokens | Warning + proposition de troncature, refuser l'écriture silencieuse |
| Permissions Somcraft insuffisantes | Erreur explicite, vérifier permissions du workspace client |

### 4. Fermeture des branches mergées

`/end-session` est le signal « on a fini de travailler ». À ce moment, **fermer les branches déjà mergées** et **laisser ouvertes** celles qui portent encore du travail non mergé.

> Helper : `lib/close-merged-branches.sh`. Détecte les **squash-merges** (que `git branch --merged` rate). **Protège toujours** `main`/`master`/`staging`/`develop`/`wt/*` et la branche courante.

**Deux niveaux de certitude (sûreté anti-perte de données)** :
- **MERGED** = contenu déjà dans la base **ET** merge corroboré (vraie ancêtre git, **OU** PR mergée via `gh`, **OU** liste `CMB_CONFIRMED`) → supprimable local + distant.
- **REVIEW** = contenu dans la base mais merge **non corroboré** (risque de faux positif : branche net-zéro `add+revert`, backup, sous-ensemble jamais mergé) → **jamais supprimée automatiquement**, signalée pour revue manuelle.

**Procédure (le dry-run et le GO sont OBLIGATOIRES — la suppression distante est une action visible à des tiers, cf. mode autonome §4)** :

1. Mettre à jour les refs distantes : `git fetch origin --prune`.
2. **Aperçu obligatoire** (ne supprime rien) :
   ```bash
   source .claude/skills/end-session/lib/close-merged-branches.sh
   CMB_DRY_RUN=1 cmb_close origin/main
   ```
3. **Afficher le plan** à l'utilisateur (branches MERGED à supprimer, REVIEW conservées, KEEP conservées) et **demander un GO explicite** avant la passe destructive.
4. Après GO, exécuter :
   ```bash
   cmb_close origin/main          # supprime les MERGED (local + distant)
   # CMB_NO_REMOTE=1 cmb_close origin/main   # variante : local seulement (pas de push --delete)
   ```
   La corroboration `gh` est automatique si `gh` est installé. Sinon, ne seront supprimées que les **vraies ancêtres** (true merges) ; les squash-merges non confirmés tomberont en **REVIEW** (conservés) — les confirmer via `CMB_CONFIRMED="brancheA brancheB"` si besoin.
5. **Invariants** : ne JAMAIS supprimer `main`/`staging`/`wt-*`/branche courante ; les branches non mergées et REVIEW sont **conservées** et listées.

> **Worktree** : si la branche courante est elle-même mergée, elle est conservée (impossible de supprimer une branche checked-out) → la retirer après bascule, ou via `claude-swt-done <timestamp>` au teardown de session.

### 5. Préparer le worktree au teardown propre

> **Ne s'applique que si la session tourne dans un worktree `claude-swt`** (branche `wt/*`, cwd sous `~/worktrees/`). Sinon, sauter à l'étape 6.

**Pourquoi cette étape existe** : le teardown automatique de `claude-swt` (au quit) ne retire le worktree **que si les deux conditions suivantes sont vraies** — sinon il le conserve, souvent sans que l'utilisateur comprenne quoi le bloque :
1. `git status --porcelain` **vide** (aucun fichier suivi modifié ni fichier non suivi) ;
2. la branche courante **et** la socle `wt/<sess>` sont **ancêtres de `origin/main`** (aucun commit non mergé).

Or les étapes 2-3 de ce skill **écrivent** `CHANGELOG.md` (et `.somtech/app-state.md`) : laisser ces fichiers non commités **crée soi-même** la saleté qui bloque le teardown. Cette étape ferme cette boucle.

**5a. Diagnostiquer** (lecture pure — n'écrit rien) :

```bash
source .claude/skills/end-session/lib/worktree-teardown-check.sh
wtc_report origin/main
```

Le rapport classe ce qui bloque :
- **fichiers non commités** → `TRACKED` (suivis, à committer — dont les docs de fin de session), `ARTIFACT` (jetables : `.DS_Store`, `*.log`, `*.tmp`… → `.gitignore` ou suppression), `ORPHAN` (non suivis inconnus → **décision requise**) ;
- **commits non mergés** → branche (courante et/ou socle `wt/<sess>`) + nombre de commits absents de `origin/main`.

**5b. Remédier, avec validation** (jamais de suppression en silence — cf. règles d'or) :

| Catégorie | Action |
|---|---|
| `TRACKED` (docs de session) | **Committer** sur la branche de travail : `git add CHANGELOG.md && git commit -m "docs(session): fin de session <date>"`. (`.somtech/app-state.md` est gitignoré — il n'apparaît jamais comme bloqueur ; ne pas tenter de l'ajouter.) ⚠️ si la branche courante est la **socle `wt/*`**, committer dessus la rend non mergée → le worktree restera conservé jusqu'à ce que ce commit soit mergé dans `main` (via `/pousse-staging` → `/merge`). Le dire explicitement. |
| `ARTIFACT` | Proposer : ajouter au `.gitignore` (si récurrent) **ou** `rm` après confirmation. |
| `ORPHAN` | **Lister nommément** et demander à l'utilisateur : committer, ignorer, ou supprimer. **Ne jamais supprimer sans GO explicite.** |
| Commits non mergés | Afficher `git log origin/main..<branche>`. Orienter : soit **finir + merger** (`/pousse-staging` → `/merge`), soit **abandonner** (branche à supprimer manuellement). Un worktree portant du travail non mergé **doit** rester — c'est voulu (on ne perd rien). |

**5c. Re-diagnostiquer et informer honnêtement** : relancer `wtc_report`. Le verdict final va dans le résumé (étape 6) :
- ✅ **teardown-ready** → « ce worktree s'auto-nettoiera au quit, ou `claude-swt-done <sess>` depuis le repo principal » ;
- 🚧 **conservé** → lister ce qui reste et pourquoi (ex : « 2 commits non mergés sur `feat/x` → à merger avant retrait »). **Ne jamais laisser croire qu'un worktree sera supprimé s'il porte du travail non mergé.**

> Le retrait manuel se fait avec `claude-swt-done <sess>` (résout le worktree via `git worktree list`, fonctionne depuis le repo principal ou un autre worktree ; refuse proprement si le worktree est sale plutôt que d'annoncer un faux succès).

### 6. Résumé de fin de session

Afficher un résumé à l'utilisateur:

```
📋 Session terminée - Documentation mise à jour

📜 CHANGELOG.md:
   - X entrées ajoutées pour [DATE]

🧠 Mémoire externe d'état d'app (si applicable, STD-027):
   - Sections mises à jour: [liste]
   - Doc Somcraft: /operations/<app-slug>/etat-app.md (workspace client)
   - Cache local: .somtech/app-state.md rafraîchi

🌿 Branches:
   - Mergées fermées (local + distant): [liste]
   - À vérifier (contenu dans base, merge non confirmé): [liste]
   - Conservées (travail non mergé): [liste]

🧭 Worktree (si session claude-swt):
   - Verdict: ✅ teardown-ready → `claude-swt-done <sess>`
     OU 🚧 conservé — bloqueurs: [fichiers à traiter / commits à merger]

🔍 Résumé des changements:
   - [Liste des points clés]
```

## Exemple d'utilisation

Utilisateur tape `/end-session` à la fin d'une session de travail.

Claude:
1. Analyse la conversation
2. Identifie les éléments à documenter
3. Met à jour CHANGELOG.md à la racine du projet
4. Si `.somtech/app.yaml` présent : propose un draft de MAJ du doc Somcraft + cache local, demande validation, écrit après approbation (STD-027)
5. Ferme les branches mergées (local + distant), conserve celles avec du travail non mergé (helper `lib/close-merged-branches.sh`, protège main/staging/wt-*/courante)
6. Si session dans un worktree `claude-swt` : diagnostique les bloqueurs de teardown (helper `lib/worktree-teardown-check.sh`), commit les docs de session, gère artefacts/orphelins avec validation, informe honnêtement de ce qui reste
7. Affiche le résumé

## Notes

- Si CHANGELOG.md n'existe pas, le créer avec le format Keep a Changelog
- Toujours demander confirmation avant d'écrire si des changements majeurs sont détectés
- Adapter le niveau de détail selon l'ampleur de la session
- **Ne pas toucher à `.claude/CLAUDE.md` projet** — cf. D-20260513-0009 (le pack ne gère plus ce fichier)
- **Ne jamais annoncer qu'un worktree sera supprimé s'il porte du travail non mergé ou des fichiers non résolus** — le teardown claude-swt le conservera (par sûreté), et l'annoncer « propre » serait mensonger (cf. règle réalité-miroir)
