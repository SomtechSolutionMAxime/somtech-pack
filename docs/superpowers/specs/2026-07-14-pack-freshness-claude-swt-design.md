# Fraîcheur du somtech-pack à l'ouverture d'une session `claude-swt`

- **Demande** : D-20260715-0001
- **Application** : Somtech Pack (`2098c2fd-5448-46a3-bd98-83778e7a064d`)
- **Date** : 2026-07-14
- **Statut** : design validé (brainstorm), à décomposer via `plan-servicedesk`

---

## 1. Problème

Quand on ouvre une session de dev via `claude-swt`, rien ne garantit que le somtech-pack
installé dans le projet (`.somtech-pack/version.json` + `.claude/`) est à jour. On peut
travailler une session entière avec des skills/agents/hooks périmés sans le savoir.

Deux « packs » distincts existent :
- **Global du poste** (`~/.claude`, via `npx @somtech-solutions/pack setup`).
- **Pack projet** (`.somtech-pack` dans le repo client, via `npx @somtech-solutions/pack update`).

**Portée retenue : le pack PROJET.** Le global est hors-scope de cette demande.

### État existant

- `.claude/hooks/session-start-pack-version.sh` — hook SessionStart **déjà écrit**,
  robuste (cache global 24h `~/.somtech/pack-latest.json`, refresh détaché, comparaison
  semver pure bash, fail-silent). **Mais** : (a) il n'est **pas branché** dans
  `settings.json` (seul `session-start-app-state.sh` l'est), et (b) il se contente
  d'**avertir** — il ne déclenche aucune mise à jour.
- `scripts/shell/claude-swt.sh` — le lanceur (crée le worktree, source `.env`, lance
  `claude`, teardown au quit). **Ne vérifie rien** côté pack.

---

## 2. Principe directeur (ce qui tranche tout)

> **« Pack à jour » est une garantie qu'on ne peut donner qu'à la NAISSANCE d'une
> session, jamais en cours de vie.**

Claude Code charge skills, hooks et config **au démarrage**, depuis le `.claude/` d'alors.
Il n'existe pas de hot-reload ; et muter l'outillage d'une session vivante est
exactement le drift que la **règle d'or n°11** interdit. Conséquences :

- Les sessions **déjà ouvertes** (1, 3 ou N worktrees) sont **hors-scope** de l'automatisme :
  non perturbées, correctes, rafraîchies au **prochain** démarrage. Une nouvelle
  branche/ref qui apparaît dans le `.git` partagé ne touche ni leur HEAD, ni leur index,
  ni leur checkout.
- Le **seul** point d'action réel de l'automatisme est **l'instant du `claude-swt`**.

---

## 3. Contraintes non-négociables (règles d'or)

| # | Contrainte | Impact design |
|---|---|---|
| Git | Jamais de push sur `main` sans PR | L'auto-update produit une **PR draft**, jamais un push/merge direct sur main |
| n°4 / une-tâche-une-branche | Pas de bundle, pas de mélange | Le bump vit sur `chore/pack-vX`, **jamais** dans une branche de feature |
| n°11 | Pas de worktree drift, pas de hot-swap | Sessions vivantes hors-scope ; sync-all explicite et opt-in |
| Concurrence | N worktrees peuvent lancer en même temps | **Lock atomique + garde d'idempotence** → un seul écrivain |
| Non-destructif | Jamais clobberer du travail | Sync-all **skip les worktrees sales** |

---

## 4. Architecture — deux gestes

### Geste A — Auto à la naissance (single-writer gardé)

Point d'insertion : dans `claude-swt.sh`, **avant** de lancer `claude` (idéalement avant
même de créer le worktree, dans le repo principal `$main`).

Séquence :

1. **Détection (cachée, gratuite, fail-silent).** Réutilise la logique déjà présente dans
   `session-start-pack-version.sh` : lire `installed` depuis `$main/.somtech-pack/version.json`,
   lire `latest` depuis le cache global 24h `~/.somtech/pack-latest.json` (refresh détaché
   si périmé). Si pas de marqueur, pas de cache, ou pas en retard → **no-op silencieux**,
   on lance `claude` normalement.
2. **Si en retard** (`ver_gt latest installed`) :
   a. **Lock atomique** : `mkdir ~/.somtech/pack-update-<repo>.lock` (le `mkdir` est
      atomique : succès = on est l'unique écrivain ; échec = quelqu'un s'en occupe → skip).
      TTL/lazy-expiry pour éviter un lock orphelin (ex. `find -mmin +10 -delete` avant tentative).
   b. **Garde d'idempotence** : `git ls-remote --exit-code origin "chore/pack-v<latest>"`
      **ou** `gh pr list --head chore/pack-v<latest>`. Existe déjà (branche ou PR ouverte) →
      **skip** (une autre session l'a produit), release le lock, lancer `claude`.
   c. **Produire le bump** dans `$main` : brancher `chore/pack-v<latest>` sur `origin/main`,
      `npx @somtech-solutions/pack update --yes`, commit `chore(pack): bump vX→vY (D-20260715-0001)`,
      `git push -u origin`, `gh pr create --draft`.
   d. **Release le lock.**
3. **Lancer `claude`** dans le worktree comme aujourd'hui. La session courante voit la
   **PR à merger**, pas le pack instantané dans son propre worktree — c'est le compromis
   qui élimine course + worktree sali + push-main.

> « Auto » va **jusqu'à la PR**. Le **merge reste humain** (règle PR + gate staging).

### Geste B — Sync-all (manuel, opt-in)

Nouvelle commande shell `claude-swt-pack-sync` (à côté de `claude-swt-ls`,
`claude-swt-gc`, etc. dans `claude-swt.sh`).

Séquence :

1. `git fetch origin -q`.
2. Pour **chaque** worktree (`git worktree list --porcelain`) :
   - **Sale** (`git -C <wt> status --porcelain` non vide) → **skip + lister** (jamais de clobber).
   - **Propre** → `git -C <wt> rebase origin/main` (tire le `.claude/` du bump déjà mergé,
     via le commit canonique — pas de re-`npx` qui salirait).
3. **Rappel** en fin : « worktrees X, Y synchronisés ; sessions vivantes → **relance-les**
   pour charger le nouveau pack (pas de hot-reload) ».

`claude-swt-pack-sync` ne touche **que** les fichiers ; il ne redémarre aucune session.

---

## 5. Composants et frontières

| Unité | Rôle | Dépend de | Testable via |
|---|---|---|---|
| `session-start-pack-version.sh` (existant) | Détection semver + cache (sourçable) | `npm`, cache global | déjà testé (`.claude/hooks/tests`) — points d'injection env |
| `pack-freshness.sh` (nouveau, sourcé par `claude-swt.sh`) | Geste A : lock + garde + PR | fonctions de détection réutilisées, `git`, `gh`, `npx` | stubs `SOMTECH_PACK_FETCH`, faux `gh`/`git` sur repo jetable |
| `claude-swt-pack-sync` (nouveau, dans `claude-swt.sh`) | Geste B : rebase worktrees propres | `git worktree` | worktrees de test propres + sales |

Réutilisation forte : la **détection** n'est pas réécrite — on **source** les fonctions de
`session-start-pack-version.sh` (`read_version`, `ver_gt`, cache) déjà éprouvées.

---

## 6. Gestion d'erreurs / fail-safe

- **Tout le Geste A est fail-silent et non-bloquant** : aucune erreur (npm down, pas de
  réseau, `gh` non authentifié, lock présent) ne doit empêcher `claude` de démarrer.
  En cas de doute → skip + lancer la session.
- **Lock orphelin** : lazy-expiry (âge > seuil → réputé mort, on reprend la main).
- **`npx update` échoue** : abort du bump, cleanup de la branche `chore/pack-vX` locale,
  release du lock, lancer `claude`. Pas de PR à moitié faite.
- **Rebase en conflit (Geste B)** : `git rebase --abort`, marquer le worktree « conflit →
  à traiter à la main », continuer avec les autres.

---

## 7. Concurrence — cas explicites

| Scénario | Comportement |
|---|---|
| 1 seul lancement, pack en retard | Crée la PR `chore/pack-vX`. |
| 3 worktrees déjà **en cours d'exécution**, un bump survient | Les 3 sessions **ne bougent pas** (hors-scope). Rafraîchies au prochain démarrage, ou via `claude-swt-pack-sync` (fichiers) + relance. |
| 2+ lancements **simultanés**, pack en retard | Lock atomique → **un seul** passe ; les autres voient le lock ou la branche/PR existante → **skip**. Zéro PR dupliquée. |
| Lancement alors que la PR de bump existe déjà (pas encore mergée) | Garde d'idempotence → skip. |
| Repo sans `.somtech-pack/version.json` (non-pack) | No-op silencieux (déjà géré par la détection). |

---

## 8. Tests (rouge avant, vert après)

- **Détection** : déjà couverte ; ajouter au besoin un cas « installed < latest → signal ».
- **Geste A — garde d'idempotence** : branche/PR `chore/pack-vX` pré-existante ⇒ **aucune**
  seconde branche créée (test : compter les refs `chore/pack-*` = 1).
- **Geste A — lock** : deux invocations concurrentes ⇒ une seule crée la branche
  (sérialisation via `mkdir`). Bug à attraper : sans lock, deux branches/PR.
- **Geste A — fail-safe** : `gh`/`npx` en échec ⇒ code de sortie 0, `claude` lancé quand même.
- **Geste B — skip des sales** : worktree avec fichier non commité ⇒ **non rebasé**, listé.
  Bug à attraper : un rebase qui clobbererait du travail.
- **Geste B — rebase propre** : worktree clean derrière origin/main ⇒ `.claude/` mis à jour
  après la commande.

Chaque test doit avoir été **rouge** avant l'implémentation (règle d'or n°6).

---

## 9. Hors-scope (YAGNI)

- Le **pack global du poste** (`~/.claude`) — autre demande si besoin.
- Le **hot-reload** d'une session vivante — techniquement non supporté + interdit (règle n°11).
- Le **merge automatique** de la PR de bump — reste un geste humain (règle PR + gate staging).
- Brancher le hook `session-start-pack-version.sh` dans `settings.json` du pack : possible
  en bonus (nudge intra-session) mais **pas** le cœur de cette demande ; à trancher en story.

---

## 10. Amendements E1 (T-20260715-0001) — décisions structurantes figées

Le découpage a exposé 6 points laissés ouverts par la v1. Tranchés ici avant tout code (E2/E3/E4) :

1. **Emplacement de construction du bump (E3)** — le bump est construit dans un **worktree éphémère
   jeté**, créé par `git -C "$main" worktree add "$tmp" -b chore/pack-v<latest> origin/main`, puis
   retiré (`git worktree remove --force`) après le push. **Jamais** dans `$main`, jamais dans un
   worktree de travail. (`git worktree add` part d'un commit → aucune contamination du working tree
   de `$main`.)

2. **Contrat lock + idempotence (E3)** — lock atomique `mkdir "$LOCKDIR"` où
   `LOCKDIR="$HOME/.somtech/pack-update-<clé>.lock"` et **`clé` = hash court du chemin absolu de
   `$main` + URL du remote** (jamais le basename — deux repos homonymes ne doivent pas partager un
   lock). **Récupération de lock périmé** : si le lock a un mtime > `PF_LOCK_TTL` (défaut 600 s), il
   est réputé mort et retiré avant tentative. **Primauté de la garde réseau** : le lock local ne vaut
   qu'intra-machine ; la source de vérité anti-doublon reste `git ls-remote --heads origin
   chore/pack-v<latest>` **et** `gh pr list --head chore/pack-v<latest>`. Existe déjà → skip, quel que
   soit l'état du lock local.

3. **Nommage de branche** — `chore/pack-v<latest>` est une **branche de maintenance transversale**
   (bump de config, non rattachée à une Demande du repo client), **exemptée** de la règle d'ID
   `D-/P-` au même titre que les branches de domaine. Documenté dans le message de PR.

4. **Détection « session active » (E4)** — au lancement, `claude-swt` pose un **marqueur de session**
   `~/.somtech/swt-sessions/<sess>` contenant son **PID** ; retiré au teardown. Un worktree est réputé
   **actif** si son marqueur existe **et** que le PID est vivant (`kill -0`). Un marqueur orphelin
   (PID mort après crash) n'est pas « actif » → le worktree redevient éligible (pas de gel).

5. **Sort du hook `session-start-pack-version.sh`** — **hors-scope de cette demande.** Le hook fire
   *après* le boot de Claude (mauvais moment pour la promesse « fraîcheur à la naissance ») et
   doublerait le signal du launcher. On **ne le câble pas** dans `settings.json`. Il est **refactoré**
   pour sourcer la lib partagée (dé-duplication, E2 story 2.1) mais son câblage reste une décision
   ultérieure hors de ce chantier.

6. **Disponibilité du CLI** — **constaté** : `@somtech-solutions/pack` est publié (tags jusqu'à
   v1.9.0) et `update` est **non-interactif** via `--yes` (+ `--force` pour écraser des divergents,
   backup `.somtech.bak` auto). E3 s'appuie dessus **sans** clause « no-op si CLI absent » sur cet axe
   (le no-op hors-ligne / sans `gh` reste, lui, légitime).

### Emplacement de la logique partagée (E2)

`scripts/shell/pack-freshness.sh` — lib **sourçable, sans effet de bord**, fonctions **namespacées
`pf_*`** (pas de pollution du shell interactif où `claude-swt.sh` est sourcé). Consommée par :
- le **launcher** `claude-swt.sh` — sourcée depuis `~/.somtech/` (ajoutée à `install-claude-swt.sh`,
  à côté de `swt-db.sh`) ;
- le **hook** `session-start-pack-version.sh` — sourcée par chemin relatif
  (`<hook>/../../scripts/shell/pack-freshness.sh`, présent car le module `core` installe `.claude/`
  **et** `scripts/`), avec **fallback fail-silent** si absente (contrat du hook : ne jamais casser).

Tests : `pf_*` couverts par tests bash unitaires ; le hook conserve ses tests A–I (stdout inchangé,
test I recâblé sur `pf_refresh_cache`).

## 11. Suite

Décomposition Epic/Story (G/W/T tracé) via `plan-servicedesk` — faite : Demande D-20260715-0001,
epics E-20260715-0001..0004, stories T-20260715-0001..0008. Implémentation TDD story par story.
