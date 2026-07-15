# Découpage — Fraîcheur du somtech-pack à l'ouverture d'une session `claude-swt`

- **Demande** : D-20260715-0001
- **Application** : Somtech Pack (`2098c2fd-5448-46a3-bd98-83778e7a064d`)
- **Grain BRD** : application — **BRD absent (vérifié)** → **Exception actée : outillage interne hors périmètre BRD**
- **Design doc apparié** : `2026-07-14-pack-freshness-claude-swt-design.md`
- **Source** : workflow `analyse-decoupage-demande` (verdict initial `pret_a_creer: false`) **révisé** après décisions Maxime (2026-07-14)

---

## Traçabilité — Exception « outillage interne hors BRD »

`somtech-pack` n'a **jamais eu de BRD** (vérifié indépendamment : pointeur ServiceDesk `null` +
aucun BRD produit dans le workspace Somcraft « Somtech » — seuls des cadres STD et le BRD du
module Mémoire, hors périmètre, remontent). C'est de l'**outillage interne** (pack de config +
marketplace de plugins), sans surface produit client. **Décision (Maxime, 2026-07-14)** : traiter
ce chantier **hors périmètre BRD**. Les stories ne tracent donc **pas** vers une EF ; elles se
rattachent à **cette note d'exception**, consignée sur la Demande. Conforme à la règle d'or n°10
(la traçabilité EF est explicitement N/A, pas silencieusement ignorée).

---

## Corrections appliquées vs le découpage brut du workflow

| Défaut (critique) | Sévérité | Correction retenue |
|---|---|---|
| EF-PACK-001/002/003 « À CRÉER » alors que reco = exception | **bloquant** | **Exception actée** → aucune EF créée ; `ef_tracee = N/A (hors BRD)` partout |
| Story 2.2 « câbler le hook » pré-empte le spike | majeur | **Câblage du hook sorti du périmètre cœur** : le launcher (avant boot) est le point de signal pour claude-swt ; le hook SessionStart (post-boot) serait un double-signal au mauvais moment → hors-scope de cette demande |
| Story 3.1 trop grosse (6+ comportements) | majeur | **Éclatée en 3 stories** : happy-path / concurrence / durcissement |
| E4 FF-only exclut tout worktree réel | majeur | **Reprofilé** : rebase opt-in de la branche de travail (décision Maxime) |
| E4 « session active » sans mécanisme | majeur | **Story dédiée** (4.1) : lock de session posé par claude-swt |
| CLI `pack update` supposé peut-être absent | mineur | **Constaté publié + non-interactif** (`--yes/--force`) → pas de clause no-op sur cet axe |
| Nommage `chore/pack-vX` viole la traçabilité | mineur | Branche de **maintenance transversale** (exempte d'ID, comme les branches de domaine) — tranché en E1 |
| Références `D-20260714-XXXX` | mineur | Épinglé **D-20260715-0001** |

---

## Découpage révisé (4 epics)

### E1 — Amender le design doc (décisions structurantes)
- **Problem** : le design doc existe mais laisse 6 points techniques ouverts qui changent l'archi de E3/E4.
- **Outcome** : design doc amendé et validé ; aucun point ouvert à l'entrée de E3.
- **Story 1.1** — *Amender `2026-07-14-pack-freshness-claude-swt-design.md`* · `ef_tracee: N/A (hors BRD)` · test: N/A (livrable REF)
  - **G** : les 6 inconnues (emplacement du bump, contrat lock+idempotence, nommage de branche, détection « session active », sort du hook, CLI publié) ouvertes dans le design v1.
  - **W** : on statue chaque point dans le design doc.
  - **T** : le doc fixe explicitement : (1) bump construit dans un **worktree éphémère jeté** (jamais `$main` ni un worktree de travail) ; (2) **lock atomique `mkdir` à clé unique** dérivée du chemin absolu/remote (pas du basename) + récupération de lock périmé + **primauté de la garde réseau** `git ls-remote`/`gh pr list` sur le lock local ; (3) branche `chore/pack-vX` = maintenance transversale (exemptée d'ID) ; (4) « session active » = **lock de session** posé par claude-swt au lancement, retiré au teardown ; (5) **hook SessionStart hors-scope** (le launcher porte le signal) ; (6) CLI publié + non-interactif → pas de clause no-op sur cet axe.

### E2 — Signal de fraîcheur à la naissance (lecture pure)
- **Problem** : la détection existe (hook robuste : cache 24h, semver bash, fail-silent) mais n'est pas exploitée par le launcher ; `claude-swt` ne signale rien.
- **Outcome** : au lancement `claude-swt` sur un projet consommateur en retard, un avertissement clair **avant le boot** ; silence total si à jour, hors-ligne, ou marqueur absent. Zéro écriture git, jamais bloquant.
- **Story 2.1** — *Extraire la détection en module bash sourçable partagé* · `N/A (hors BRD)` · test: unit bash
  - **G/W/T** : `read_version`/`fetch_latest`/`ver_gt` + lecture cache vivent inline dans le hook → extraites dans un module sourçable, comportement inchangé ; un test rouge-avant/vert-après sur `ver_gt` prouve la non-régression ; hook **et** launcher consomment la même logique (zéro duplication).
- **Story 2.2** — *Étape pack-check dans `claude-swt` (détection + affichage seul)* · `N/A (hors BRD)` · test: unit bash
  - **G/W/T** : après le `git fetch` de `_claude-swt-launch`, une étape source la détection ; projet en retard → avertissement avant boot ; projet à jour / hors-ligne / sans `gh`/`npm` / marqueur absent → **rien**, pas d'appel réseau synchrone bloquant ajouté au chemin critique.

### E3 — Auto-PR single-writer gardé (cœur de valeur)
- **Problem** : détecter ne suffit pas ; une seule session doit déclencher la MAJ sans casser les règles d'or (jamais push main sans PR, ne pas salir un worktree, pas de course).
- **Outcome** : sur retard, **exactement une** session construit `chore/pack-vX` dans un worktree éphémère, ouvre une PR draft, et dégrade en no-op silencieux offline ; merge humain.
- **Story 3.1** — *Happy-path : bump isolé + PR draft (un seul writer supposé)* · `N/A (hors BRD)` · test: unit bash
  - **G/W/T** : retard détecté, un seul lancement → bump construit dans un **worktree éphémère jeté après push**, commit, `gh pr create --draft` ; **ni `$main` ni aucun worktree de travail** n'est modifié ; une PR draft `chore/pack-vX` existe.
- **Story 3.2** — *Concurrence : lock atomique + garde d'idempotence* · `N/A (hors BRD)` · test: unit bash
  - **G/W/T** : 2+ sessions concurrentes sur un projet en retard → **lock `mkdir` clé unique** + garde `git ls-remote`/`gh pr list` → **une seule** crée la PR, les autres skippent proprement ; un **lock périmé** après crash est récupéré (pas de gel des MAJ futures).
- **Story 3.3** — *Durcissement : rollback + no-op offline + non-bloquant* · `N/A (hors BRD)` · test: unit bash
  - **G/W/T** : si `gh` échoue après le push → la branche poussée est **nettoyée** (pas de branche orpheline qui gèle la garde) ; hors-ligne / sans `gh` → **no-op silencieux** ; le geste est **détaché** → le boot de `claude` n'est jamais ralenti ni bloqué.

### E4 — Sync manuel opt-in : rebase de la branche de travail
- **Problem** : après merge d'une MAJ, les worktrees ouverts restent en retard ; il faut les rattraper sans clobberer du travail ni drifter une session vivante.
- **Outcome** : `claude-swt-pack-sync` rebase **opt-in** la branche de travail des worktrees **propres et sans session active** sur `origin/main` ; skip + liste les sales / actifs ; rappelle que les sessions vivantes doivent redémarrer.
- **Story 4.1** — *Lock de session posé par `claude-swt` (détection « session active »)* · `N/A (hors BRD)` · test: unit bash
  - **G/W/T** : au lancement, `claude-swt` pose un **lock de session** dans le worktree ; au teardown, il le retire ; un worktree avec lock présent est réputé **actif**. Test : lock présent ⇒ actif ; absent ⇒ inactif.
- **Story 4.2** — *`claude-swt-pack-sync` : rebase opt-in sûr* · `N/A (hors BRD)` · test: unit bash
  - **G/W/T** : mix de worktrees (propres à jour, propres en retard, sales, avec session active) ; `claude-swt-pack-sync` → seuls les **propres sans session active** sont **rebasés opt-in** sur `origin/main` ; les sales et actifs sont **skippés et listés** sans toucher leur working tree ni leur historique ; rappel « relance les sessions vivantes » ; résumé final distingue synchronisés / skippés-sales / sessions-actives.

---

## Ordre recommandé
1. **E1** — amender le design (débloque E3/E4)
2. **E2** — signal à la naissance (plus petite tranche, lecture pure)
3. **E3** — auto-PR gardé (3.1 → 3.2 → 3.3 ; la résilience 3.2/3.3 précède toute activation réelle)
4. **E4** — sync manuel opt-in (indépendant, après E3)

## Compromis assumé (à communiquer)
La session qui **déclenche** l'auto-PR naît quand même avec l'ancien pack (son worktree vient
d'`origin/main` d'avant le merge) ; **seules les sessions suivantes** profitent du merge humain.
C'est intrinsèque au principe « fraîcheur = garantie à la naissance ».

## Niveaux de test
Infra shell → L1-L5 (RLS/UI/console) **N/A**. Le risque qualité est la couverture
concurrence / idempotence / offline / rollback / lock-orphelin → **tests unit bash** (style
`bats`, cf. `test-pack-version-check.sh`), exigence **Red→Green** sur chaque story de code.

## Gate `pret_a_creer`
Verdict brut du workflow : `false` (défaut bloquant EF + majeurs). **Tous les défauts sont
résolus** par les décisions Maxime (exception BRD ; E4 rebase opt-in) + le reprofilage ci-dessus.
Création soumise au **GO explicite de Maxime** (validation humaine du gate, tracée ici).
