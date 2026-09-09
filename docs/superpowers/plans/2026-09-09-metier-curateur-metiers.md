# Métier `curateur-metiers` — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire exister un troisième rôle d'agent, `curateur` (gabarits `curateur-metiers`, dossier `.curateur`, premier porteur `koksoak`), rendu depuis son ABC et gardé par les mêmes gardes que ses pairs — sans qu'une seule ligne de son métier soit écrite à la main.

**Architecture:** Le rôle est **une ligne** dans le registre (`ligne-directe/src/roles.js`) + son miroir CLI, **un classement** (`metier/curateur-metiers/classement.json`, dérivé de l'ABC 24377a34) dont `pack metier rendre` produit `CLAUDE.md`, `.claude/settings.json` et les chapitres, **quatre chapitres** écrits dans `metier/curateur-metiers/chapitres/`, et **une compétence de pose** décalquée de `/gestionnaire-client`. Les gardes du poste (`gardes/`) reçoivent le rôle ; le workflow `cycle-amelioration-metier` reçoit le rôle, les réceptacles inventoriés et la garde « un tour doit alléger ».

**Tech Stack:** Node ≥ 22 (`node --test`), ESM, aucune dépendance neuve. Bancs : `cli/test/*.test.js` (`cd cli && npm test`), `ligne-directe/tests/*.test.js` (`cd ligne-directe && npm test`).

**Spec:** `docs/superpowers/specs/2026-09-08-metier-curateur-metiers-design.md` · **ABC (source, ADR-040)** : Somcraft `24377a34-77c2-473f-8596-8c891ceefebe`, v1.0.0, format gabarit 2.0.1.

## Global Constraints

- **ADR-040 D3** : `CLAUDE.md`, `.claude/settings.json` et `metier/chapitres/*` du gabarit sont des **produits** de `pack metier rendre --role curateur-metiers`. Jamais édités à la main. `CONTEXTE.md`, `RONDE.md`, `.mcp.json` du gabarit sont écrits à la main (I6).
- **INV-ABC-2** : l'ABC précède le code. Toute divergence trouvée entre l'ABC et ce que le code exige se **règle dans l'ABC d'abord** (→ v1.1.0), jamais dans le classement seul.
- **Budgets du rendu** (`cli/src/metier/rendu.js:13`) : L0 ≤ 150 tokens, L1 ≤ 2 500 (durs), chapitre ≤ 6 000 (souple). Les énoncés doivent porter leurs accents (chasse `SANS_ACCENT`).
- **R1 du rendu** : un garde-fou en `persona`/`competence` sans `sans_garantie {motif, assume_par, definitif|echeance}` fait refuser le rendu.
- **Noms** : clé de registre `curateur` · gabarits `curateur-metiers` · dossier `.curateur` · `metier/curateur-metiers/` · slug ABC `ops-curateur-metiers` · code domaine `MET`.
- **Signatures** (ABC « Entrée au registre ») : `CLAUDE.md` → `/^# Tu es le curateur des métiers d'agents/` · `CONTEXTE.md` → `/^# Ce dont tu es le curateur/`.
- **Un ticket à la fois, TDD** : chaque tâche = test rouge → vert → commit sur `feat/D-20260908-0007-metier-curateur-metiers` (PR #344, draft).
- **Hors lot** : `T-20260908-0079` (amender `rondes.md` §5 via l'ABC de l'orchestrateur) ; le réveil horaire launchd (`naissance-representant/src/rendez-vous.js`) — la ronde du curateur est sa propre `/loop`, comme le dit son ABC.

---

## Ce que l'inventaire a mesuré, et qui change le plan

1. **Le piège des gardes est réel mais pas là où l'ABC le place.** Aucun des trois fils `gardes/{ecriture,sous-agent,terminal}.js` ne situe le rôle : ils lisent `process.env.SOMTECH_ROLE || 'orchestrateur'`, et **rien dans le dépôt ne pose `SOMTECH_ROLE`** (grep : seules les quatre gardes le citent). Seul `gardes/ligne-cliente.js` lit le rôle au lieu (`roleDuLieu(cwd)`, table `LIEU_DU_ROLE`). Conséquence : aujourd'hui **tout agent est jugé comme un orchestrateur** par trois gardes sur quatre — un curateur ne naîtrait pas « infirme », il naîtrait **gardé comme un orchestrateur**, et `ROLES_GARDES` ne mord jamais. Inscrire `curateur` dans les listes sans corriger les fils serait « garder un cas qui ne se produit pas ». → **Tâche 1** corrige les fils ; **Tâche 3** inscrit le rôle.
2. **`terminal-decision.js` sur le poste est périmé.** Le dépôt (`cli/src/metier/gardes/terminal.js:79`) **refuse** un rôle inconnu depuis T-20260826-0079 ; la copie sur `~/.somtech/gardes/` rend encore `allow`. Le tableau « Préalable de code » de l'ABC décrit le poste, pas la source. Se règle par `pack setup` après publication (Tâche 9), et se note dans l'ABC 1.1.0.
3. **Le rendu exige un dossier de gabarits complet avant de rendre** (`cli/src/commands/metier.js:120-135`) : `CONTEXTE.md`, `.mcp.json` et un `CLAUDE.md`/`.claude/settings.json` initiaux doivent exister. → Tâche 2 crée le dossier avec des fichiers d'amorce que le rendu remplace.
4. **Les bancs existants dérivent de `rolesConnus()`** : dès que la ligne entre dans `roles.js`, `gabarits-distribues`, `registre-des-roles-miroir`, `metier-gardes-roles-connus`, `la-pose-aboutit-pour-tout-role-du-registre`, `canal-par-role` (mandat_designe), `le-registre-decide-*` rougissent tant que gabarit, miroir CLI et noms de garde n'existent pas. D'où l'ordre : gabarit (T2) **avant** registre (T3).
5. **GF-MET-003 (fermer en citant)** : aucune couche existante ne lit le contenu d'un commentaire ; un hook `PreToolUse` sur `mcp__servicedesk__tickets` ne voit qu'un appel à la fois (le commentaire et le changement de statut sont deux appels). Une vraie couche = un **verbe unique de fermeture** qui exige `--dossier` et `--item` + un hook qui refuse `status=completed` en direct. C'est un lot en soi → **Tâche 7, à arbitrer** (§ Décisions).

---

## Décisions attendues du dirigeant avant d'exécuter

| # | Question | Reco |
|---|---|---|
| D1 | **ABC 1.1.0 avant le code** : corriger le tableau « Préalable » (3 fils ne situent pas le rôle ; terminal du dépôt refuse), déclarer `DOSSIER_DU_ROLE` dans l'entrée au registre, dater les échéances de GF-MET-003/004 (le rendu refuse une échéance sans date : « à construire dans D-… » n'est pas une date). | **Oui**, c'est INV-ABC-2 ; 20 minutes, Tâche 0. |
| D2 | **GF-MET-003, couche réelle dans ce lot ?** (A) garder la dérogation, échéance 2026-10-15, banc §10-1 reporté dans un ticket ; (B) construire le verbe `fermer-billet` + hook `fermeture` (Tâche 7, ~1 jour). | **(A)** — livrer le métier vivant d'abord ; (B) devient une story séparée sous la même demande, à mener juste après. Le premier tour se fait avec la garde en persona, et le banc §10-1 vient avec (B). |
| D3 | **Hiérarchie ServiceDesk** : un epic `E` sous `D-20260908-0007` avec une story par tâche (T0→T9) ? | **Oui**, création au GO (l'ABC §9 attend l'epic). |
| D4 | **Renommer `D-20260908-0004/-0005/-0006`** avec le préfixe `[AMELIORATION-METIER]` dans ce lot ? (Le design §7 le prévoit ; c'est une écriture ServiceDesk visible.) | **Oui**, Tâche 8 — sans ça le premier tour ne voit rien. |

---

### Task 0 : ABC 1.1.0 — ce que l'inventaire corrige dans la source

**Files:**
- Modify (Somcraft, MCP `write_document` avec `fingerprint`) : `/departement-ia/agents/ops-curateur-metiers/agent-brief-ops-curateur-metiers.md` (`24377a34-77c2-473f-8596-8c891ceefebe`)

**Interfaces:**
- Produces : `version_abc: "1.1.0"` que le classement (T2) cite ; échéances datées de GF-MET-003 (`2026-10-15`) et GF-MET-004 (`2026-09-30`).

- [ ] **Step 1 : relire l'ABC** avec `mcp__somcraft__read_document` et conserver le `fingerprint`.
- [ ] **Step 2 : amender** — quatre blocs, rien d'autre :
  1. Tableau « 🔴 Préalable de code » : remplacer par la mesure sur la **source** :

     | Garde (source `cli/src/metier/gardes/`) | Rôle inconnu | Ce qui manque |
     |---|---|---|
     | `terminal.js` | `deny` (ROLES_CONNUS) | inscription dans `roles-connus.js` |
     | `ecriture.js` | `deny` (ROLES_GARDES) | inscription |
     | `sous-agent.js` | `deny` (ROLES_GARDES) | inscription |
     | `ligne-cliente.js` | `deny` en creux si connu | inscription dans `roles-connus.js` |

     Et le paragraphe : « **Mesuré le 2026-09-09** : trois des quatre fils (`gardes/{ecriture,sous-agent,terminal}.js`) ne situent pas le rôle — ils lisent `SOMTECH_ROLE`, que rien ne pose — et jugent donc tout agent comme un orchestrateur. La copie du poste de `terminal-decision.js` est périmée (rend `allow`). Préalable : les fils situent le rôle au lieu (`DOSSIER_DU_ROLE`), puis le rôle est inscrit, puis le poste est remis à jour par `pack setup`. »
  2. « Entrée au registre » : ajouter la ligne `**\`DOSSIER_DU_ROLE\`** | \`.curateur\` → \`curateur-metiers\` — la table que les fils des gardes lisent pour situer le rôle ; jointe au registre par un banc`.
  3. GF-MET-003 dérogation : `**échéance** : 2026-10-15 — verbe unique de fermeture + garde \`fermeture\` (story séparée sous D-20260908-0007)`. GF-MET-004 dérogation : `**échéance** : 2026-09-30 — garde dans le cycle, livrée par D-20260908-0007`.
  4. §11 changelog : `| 1.1.0 | 2026-09-09 | D-20260908-0007 | Préalable de code remesuré sur la source ; DOSSIER_DU_ROLE ; échéances datées. |` et l'en-tête `Version 1.1.0`.
- [ ] **Step 3 : écrire** avec `write_document` (`fingerprint` de l'étape 1) ; relire ; vérifier que le corps rendu porte `1.1.0` (comparer taille annoncée / corps rendu).
- [ ] **Step 4 : commenter D-20260908-0007** : « ABC 1.1.0 — trois corrections d'inventaire, aucune règle nouvelle » avec le lien.

---

### Task 1 : les fils des gardes situent le rôle au lieu

**Files:**
- Modify : `cli/src/metier/gardes/roles-connus.js` (ajouter `DOSSIER_DU_ROLE`, `roleDuLieu`)
- Modify : `gardes/roles-connus.js` (copie identique — le banc `metier-gardes-roles-connus.test.js:43` l'exige)
- Modify : `gardes/ecriture.js:143`, `gardes/sous-agent.js:117`, `gardes/terminal.js:67`, `gardes/ligne-cliente.js:27-31,56-62`
- Test : `cli/test/metier-gardes-roles-connus.test.js`, `cli/test/metier-gardes-situent-le-role.test.js` (neuf)

**Interfaces:**
- Produces : `export const DOSSIER_DU_ROLE = { '.orchestrateur': 'orchestrateur', '.gestionnaire': 'gestionnaire-client' }` et `export function roleDuLieu(cwd): string|undefined` dans `roles-connus.js` (les deux copies). Les fils appellent `roleDuLieu(requete?.cwd || process.cwd()) || process.env.SOMTECH_ROLE`.

- [ ] **Step 1 : écrire le banc rouge** — `cli/test/metier-gardes-situent-le-role.test.js` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fil = (nom, requete) => JSON.parse(execFileSync(process.execPath, [join(RACINE, 'gardes', `${nom}.js`)],
  { input: JSON.stringify(requete), encoding: 'utf8', env: { ...process.env, SOMTECH_ROLE: '' } })).hookSpecificOutput;

// Le fil doit rendre un verdict DIFFÉRENT selon le lieu — sinon il ne situe rien.
// Un lieu qu'aucune table ne connaît (`.inconnu`) doit être refusé : la décision refuse un rôle absent.
const CAS = [
  ['ecriture',   { tool_name: 'Write', tool_input: { file_path: '/x/y.md' } }],
  ['sous-agent', { tool_name: 'Task',  tool_input: { subagent_type: 'Explore' } }],
  ['terminal',   { tool_name: 'Bash',  tool_input: { command: 'git status' } }],
];
for (const [nom, base] of CAS) {
  test(`le fil « ${nom} » situe le rôle au lieu, pas à une variable que rien ne pose`, () => {
    const orch = fil(nom, { ...base, cwd: '/tmp/depot/.orchestrateur/j-1' });
    const inconnu = fil(nom, { ...base, cwd: '/tmp/depot/.inconnu/z' });
    assert.equal(inconnu.permissionDecision, 'deny', `${nom} : un lieu inconnu doit être refusé — ${inconnu.permissionDecisionReason}`);
    assert.match(inconnu.permissionDecisionReason, /rôle/i);
    assert.notEqual(orch.permissionDecisionReason, inconnu.permissionDecisionReason,
      `${nom} : même raison pour deux lieux — le fil ne regarde pas le lieu`);
  });
}
```

- [ ] **Step 2 : lancer** `cd cli && node --test test/metier-gardes-situent-le-role.test.js` — attendu : **3 rouges** (les fils rendent le verdict d'orchestrateur pour `.inconnu`).
- [ ] **Step 3 : ajouter à `cli/src/metier/gardes/roles-connus.js`** (après `ROLES_CONNUS`) :

```js
/**
 * LE SEGMENT DE CHEMIN QUE LE CLI POSE POUR CHAQUE RÔLE → le nom sous lequel le rôle se
 * présente aux gardes. Vivait dans le seul fil `ligne-cliente.js` (`LIEU_DU_ROLE`) : les
 * trois autres fils lisaient `SOMTECH_ROLE`, que rien ne pose, et jugeaient tout agent
 * comme un orchestrateur (mesuré le 2026-09-09, D-20260908-0007). Joint au registre par
 * `metier-gardes-roles-connus.test.js`.
 */
export const DOSSIER_DU_ROLE = Object.freeze({
  '.orchestrateur': 'orchestrateur',
  '.gestionnaire': 'gestionnaire-client',
});

/** Le rôle, lu au lieu où l'agent vit. `undefined` est une mesure : la décision refuse. */
export function roleDuLieu(cwd, sep = '/') {
  if (typeof cwd !== 'string' || cwd === '') return undefined;
  const segments = cwd.split(sep);
  for (const [dossier, role] of Object.entries(DOSSIER_DU_ROLE)) {
    if (segments.includes(dossier)) return role;
  }
  return undefined;
}
```

- [ ] **Step 4 : copier** `cp cli/src/metier/gardes/roles-connus.js gardes/roles-connus.js`.
- [ ] **Step 5 : dans chaque fil**, importer `roleDuLieu` depuis `./roles-connus.js` (chemin : `join(ICI, 'roles-connus.js')` en import dynamique, avec repli sur `../../cli/src/metier/gardes/roles-connus.js`, comme le fil charge déjà sa décision) et remplacer `role: process.env.SOMTECH_ROLE || 'orchestrateur'` par `role: roleDuLieu(requete?.cwd || process.cwd()) || process.env.SOMTECH_ROLE`. Dans `gardes/ligne-cliente.js`, retirer `LIEU_DU_ROLE` et sa fonction locale ; importer la même.
  ⚠️ Ne plus mettre `'orchestrateur'` en repli : un lieu non situé se présente **sans rôle**, et chaque décision refuse déjà un rôle absent (message « déclarer ce rôle dans roles-connus.js »).
- [ ] **Step 6 : étendre le banc de jointure** `cli/test/metier-gardes-roles-connus.test.js` (après le test l.65) :

```js
test('⚠️ tout rôle du REGISTRE a son dossier dans DOSSIER_DU_ROLE, et il rend son nom de gabarit', async () => {
  const { DOSSIER_DU_ROLE, roleDuLieu } = await import('../src/metier/gardes/roles-connus.js');
  const { rolesConnus, role } = await import('../../ligne-directe/src/roles.js');
  for (const nom of rolesConnus()) {
    const r = role(nom);
    assert.equal(DOSSIER_DU_ROLE[r.dossier], r.gabarits, `« ${r.dossier} » → attendu « ${r.gabarits} »`);
    assert.equal(roleDuLieu(`/d/${r.dossier}/x`), r.gabarits);
  }
  assert.equal(roleDuLieu('/d/.inconnu/x'), undefined);
});
```

- [ ] **Step 7 : lancer** `cd cli && npm test` — attendu : tout vert (dont le neuf).
- [ ] **Step 8 : mutation** — remettre temporairement `|| 'orchestrateur'` dans `gardes/terminal.js`, relancer le banc neuf : doit rougir. Retirer.
- [ ] **Step 9 : commit** `fix(gardes): les fils situent le rôle au lieu — SOMTECH_ROLE n'était posé par personne — D-20260908-0007`.

---

### Task 2 : le classement, les chapitres, le gabarit — et le premier rendu

**Files:**
- Create : `metier/curateur-metiers/classement.json`
- Create : `metier/curateur-metiers/chapitres/{reflexes,anti-patterns,ronde-de-consolidation,amendement-abc}.md`
- Create : `.claude/templates/curateur-metiers/{CONTEXTE.md,RONDE.md,.mcp.json}` + amorces `CLAUDE.md`, `.claude/settings.json` (remplacées par le rendu)
- Modify : `cli/src/metier/rendu.js:131-132` (`cheminSur` refuse aussi `.curateur`)
- Test : `cli/test/metier-gabarit.test.js` (dénominateur = `readdirSync('metier/')`, rougit dès que le dossier existe), `cli/test/metier-rendu.test.js` (cas `.curateur`)

**Interfaces:**
- Produces : `metier/curateur-metiers/rendu/{L0.md,L1.md,chapitres/*.md,.claude/settings.json}` et le gabarit distribué. Le classement porte `"role": "curateur-metiers"`, `"version_abc": "1.1.0"`, `"source": "Somcraft 24377a34-77c2-473f-8596-8c891ceefebe"`.

- [ ] **Step 1 : test rouge** dans `cli/test/metier-rendu.test.js` :

```js
test('I5 — un artefact ne peut pas viser le lieu d un curateur', () => {
  const r = rendre({ ...classementMinimal(), chapitres: [{ nom: '../.curateur/x', abrege: 'a', version_pack: '1.0.0' }] });
  assert.ok(r.erreurs.some((e) => /\.curateur/.test(e)), r.erreurs.join('\n'));
});
```
  (`classementMinimal()` : reprendre la fabrique du fichier, l.13-40.) Lancer : rouge (le chemin passe).
- [ ] **Step 2 :** `cli/src/metier/rendu.js:131` — ajouter `.curateur` au côté de `.orchestrateur` et `.gestionnaire`. Vert.
- [ ] **Step 3 : écrire `metier/curateur-metiers/classement.json`** — transcription **item par item** de l'ABC 1.1.0, même forme que `metier/gestionnaire-client/classement.json` :
  - `identite` : le bloc « Identité » de l'ABC, tel quel (≤ 150 tokens).
  - `preambule` : le bloc « Préambule » de l'ABC, précédé des deux lignes `> **\`CLAUDE.md\` — ce fichier — est écrit par le pack…` / `> **\`CONTEXTE.md\`**…` (copier de gestionnaire-client).
  - `chapitres` : `reflexes`, `anti-patterns`, `ronde-de-consolidation`, `amendement-abc` — `abrege` et `version_pack: "<prochain tag>"` (lire `git tag --sort=-v:refname | head -1` et incrémenter la mineure).
  - `items` : `RA-MET-001..007` (`nature: "regle"`, `couche`, `enonce`, `enonce_socle`, `chapitre`, `cardinale` pour 002/001) ; `GF-MET-001..006` (`nature: "garde-fou"`) avec :
    - `GF-MET-001` : `couche: "capacite-absente"` — aucun droit `mcp__somcraft__write_document`/`update_block` (le rendu n'exige pas de champ ; le mécanisme est l'absence dans `droits`).
    - `GF-MET-002` : `couche: "refus-de-permission"`, `refus: ["Edit","Write","NotebookEdit"]`.
    - `GF-MET-003` : `couche: "persona"`, `sans_garantie: { motif, assume_par: "Maxime Leboeuf (dirigeant)", definitif: false, echeance: "2026-10-15" }`.
    - `GF-MET-004` : `couche: "competence"`, `sans_garantie: { …, echeance: "2026-09-30" }`.
    - `GF-MET-005`, `GF-MET-006` : `couche: "persona"`, `sans_garantie: { motif, assume_par, definitif: true }`.
  - `refus` : `["Edit","Write","NotebookEdit"]`.
  - `droits` : socle commun (copier de gestionnaire-client) + `"mcp__somcraft__read_document"`, `"mcp__somcraft__search_documents"`, `"mcp__somcraft__list_documents"`.
  - `hooks` : `{PreToolUse, Bash, terminal}`, `{PreToolUse, Task, sous-agent}`, `{PreToolUse, "Write|Edit|NotebookEdit|MultiEdit", ecriture}`, `{PreToolUse, Bash, ligne-cliente}`, et le hook `ouverture-ligne` **recopié mot pour mot** de `metier/orchestrateur/classement.json`.
- [ ] **Step 4 : écrire les quatre chapitres** dans `metier/curateur-metiers/chapitres/`, chacun sous 6 000 tokens, formulation positive, **chaque prescription renvoie à son item** (`RA-MET-…`/`GF-MET-…`) :
  - `reflexes.md` — RA-MET-002 (non établi ; couper la sonde), RA-MET-003 (citer dans les mots de la source), GF-MET-005/006 ; ton du rapport à un dirigeant.
  - `ronde-de-consolidation.md` — les 7 pas du tableau « La ronde » de l'ABC, avec pour chacun sa **condition de fin** (design §5.3) ; RA-MET-001 ; RA-MET-004 ; MEM-MET-001..003 (où s'inscrit quoi) ; condition de fin du tour (design §6.6).
  - `amendement-abc.md` — R2.2 (grain de l'item, issue, couche), RA-MET-005/006/007, GF-MET-004 (deux issues allègent), l'appel du workflow `cycle-amelioration-metier` avec ses `args` (`{ role: '<gabarit du métier visé>', receptacles: [...] }`, voir T5), GF-MET-001.
  - `anti-patterns.md` — les modes de panne du design §1 et de l'ABC : le réceptacle qu'on remplit sans vider, le tour qui trouve toujours, la fermeture-ménage, la règle écrite pour le geste et non la fonction, « faire attention à ».
- [ ] **Step 5 : créer le gabarit** `.claude/templates/curateur-metiers/` :
  - `CONTEXTE.md` à chevrons, première ligne `# Ce dont tu es le curateur`, rubriques de l'ABC « Ce que CONTEXTE.md doit porter » : `## À qui tu réponds`, `## Les métiers dont tu es le curateur`, `## Où vivent les réceptacles`, `## Où tu inscris ton dossier et tes heures`, `## Ce qui a déjà été tranché`.
  - `RONDE.md` à chevrons, rubriques : `## Ta cadence`, `## Ton parc, en une ligne`, `## Tes priorités du moment`, `## Ce que tu ne dois PAS attendre`, `## Où vit ton état à jour`, `## Les gestes que tu enjambes quand ton contexte s'appauvrit`.
  - `.mcp.json` : copier celui de `.claude/templates/orchestrateur/.mcp.json` (servicedesk + somcraft).
  - `CLAUDE.md` et `.claude/settings.json` : fichiers d'amorce d'une ligne (`# amorce — remplacée par pack metier rendre`) — le rendu les écrase.
- [ ] **Step 6 : rendre** — `cd cli && node bin/pack.js metier rendre --role curateur-metiers` (vérifier le nom du bin dans `cli/package.json`, champ `bin`), depuis la racine du dépôt. Lire le rapport : L0/L1 sous budget, `R1 : 6 garde-fous · 4 dérogés · 0 refusés`. Si refus : corriger le **classement** (ou l'ABC si c'est la source qui manque), jamais le rendu.
- [ ] **Step 7 : vérifier** — `node bin/pack.js metier verifier --role curateur-metiers` → `✅ conforme`. Puis `cd cli && npm test` : `metier-gabarit.test.js` doit être vert (il croise `metier/` et `.claude/templates/`). ⚠️ `gabarits-distribues`/`registre-des-roles-miroir` ne bougent pas encore (le rôle n'est pas au registre).
- [ ] **Step 8 : relire le `CLAUDE.md` rendu** en entier : première ligne = signature `# Tu es le curateur des métiers d'agents` ; la section « Ce que rien ne garantit » liste bien GF-MET-003/004/005/006.
- [ ] **Step 9 : commit** `feat(metier): classement, chapitres et gabarit du curateur-metiers, rendus depuis l'ABC 1.1.0 — D-20260908-0007`.

---

### Task 3 : inscription du rôle — registre, miroir CLI, gardes, et le banc qui les joint

**Files:**
- Modify : `ligne-directe/src/roles.js:245` (entrée `curateur`)
- Modify : `cli/src/commands/representant.js:61-63` (miroir `ROLES`), `:214` (ternaire `--nom`/`--client` → `meneUnChantier`-like : `--client` seulement pour `mandat_designe === 'client'`)
- Modify : `cli/src/metier/gardes/roles-connus.js` (`NOMS_DU_ROLE.curateur`, `DOSSIER_DU_ROLE['.curateur']`), `ecriture.js:66`, `sous-agent.js:42` (`ROLES_GARDES` + `PAS_A_TOI` paramétré), puis copies `gardes/roles-connus.js`, `gardes/ecriture-decision.js`, `gardes/sous-agent-decision.js`
- Modify : `ligne-directe/src/recensement.js:280` (`gabarit` sans défaut → lève si absent)
- Test : `cli/test/metier-gardes-roles-connus.test.js` (banc §10-3), `cli/test/metier-garde-sous-agent.test.js:29` (liste figée → dérivée), `ligne-directe/tests/canal-par-role.test.js:583`, `lieu-versionnable.test.js:53`, `le-lieu-porte-tout-le-metier.test.js:44`, `orchestrateur-lieu.test.js:42,225` (listes en dur → `rolesConnus()`)

**Interfaces:**
- Produces : `role('curateur')` = `{ libelle: 'curateur', libelle_pluriel: 'curateurs de métiers', dossier: '.curateur', mandat_designe: 'parc', gabarits: 'curateur-metiers', nature: 'interne', pose_automatique: true, bapteme: 'riviere', pair_de_chantier: false, libelle_de_pair: 'du curateur des métiers', lignes: [{ cle: 'dirigeant', nature: 'interne', chantier: 'dirigeant', titreRequis: true, auDirigeant: true }], entetes: { 'CLAUDE.md': /^# Tu es le curateur des métiers d'agents/, 'CONTEXTE.md': /^# Ce dont tu es le curateur/ } }`.

- [ ] **Step 1 : banc §10-3 rouge** — ajouter à `cli/test/metier-gardes-roles-connus.test.js` :

```js
test('⚠️ tout rôle dont le classement déclare une garde à ROLES_GARDES y est inscrit — sous ses deux noms', async () => {
  const { rolesConnus, role } = await import('../../ligne-directe/src/roles.js');
  for (const nom of rolesConnus()) {
    const cl = join(RACINE, 'metier', role(nom).gabarits, 'classement.json');
    if (!existsSync(cl)) continue; // un rôle sans classement n'a pas de hooks rendus
    for (const h of JSON.parse(readFileSync(cl, 'utf8')).hooks || []) {
      const mod = join(RACINE, 'cli', 'src', 'metier', 'gardes', `${h.garde}.js`);
      if (!existsSync(mod)) continue; // ouverture-ligne : garde de poste, pas de décision ici
      const { ROLES_GARDES } = await import(mod);
      if (!ROLES_GARDES) continue; // terminal/ligne-cliente décident sur ROLES_CONNUS
      for (const n of NOMS_DU_ROLE[nom] || [nom]) {
        assert.ok(ROLES_GARDES.has(n), `« ${n} » déclare la garde « ${h.garde} » mais elle ne le connaît pas : elle lui refuserait tout`);
      }
    }
  }
});
```

- [ ] **Step 2 : ajouter l'entrée** dans `ligne-directe/src/roles.js` avant la fermeture de `ROLES` (l.245), avec les valeurs de l'interface ci-dessus et un commentaire de trois lignes : rôle sans chantier ni client, `mandat_designe: 'parc'` (un parc de métiers), une seule ligne, au dirigeant, `titreRequis: true` (ABC : « sinon elle s'ouvre avec une liste d'autorisés vide »).
- [ ] **Step 3 : miroir CLI** `cli/src/commands/representant.js:61-63` : `curateur: { gabarit: 'curateur-metiers', dossier: '.curateur', libelle: 'Curateur' }`. Ligne 214 : `const designe = roleNom === 'representant' ? '--client' : '--nom'` (avec commentaire : le représentant est le seul rôle désigné par un client).
- [ ] **Step 4 : gardes** — `roles-connus.js` : `curateur: ['curateur', 'curateur-metiers']` et `'.curateur': 'curateur-metiers'` ; `ecriture.js:66` et `sous-agent.js:42` : `new Set(['orchestrateur', 'curateur', 'curateur-metiers'])`. Dans `sous-agent.js`, `PAS_A_TOI` cite les chefs d'équipe (texte d'orchestrateur) : le rendre neutre — `"Un sous-agent qui écrit porte un lot, et un lot ne t'appartient pas. Tes sous-agents d'analyse (lecture seule, résultat consigné au ServiceDesk) sont tes propres moyens."` Puis `cp` des trois fichiers vers `gardes/{roles-connus.js,ecriture-decision.js,sous-agent-decision.js}`.
- [ ] **Step 5 : `recensement.js:280`** — retirer le défaut `gabarit = 'orchestrateur'` ; lever `new TypeError('referenceDuMetier : gabarit requis')` si absent. Lancer `cd ligne-directe && npm test` pour voir qui l'appelait sans gabarit ; corriger l'appelant (jamais en remettant le défaut).
- [ ] **Step 6 : listes en dur → dérivées** — `metier-garde-sous-agent.test.js:29` : remplacer `assert.deepEqual([...ROLES_GARDES], ['orchestrateur'])` par une dérivation : `assert.deepEqual([...ROLES_GARDES].sort(), [...ROLES_CONNUS].filter((n) => n !== 'representant' && n !== 'gestionnaire-client').sort())` avec le commentaire : le représentant porte `refus-de-permission`, pas cette garde. Dans `ligne-directe/tests/{lieu-versionnable,le-lieu-porte-tout-le-metier,orchestrateur-lieu,canal-par-role}.test.js` : remplacer `['orchestrateur','gestionnaire-client']` par `rolesConnus().map((n) => role(n).gabarits)`.
- [ ] **Step 7 : lancer les deux suites** — `cd cli && npm test ; cd ../ligne-directe && npm test`. Tous verts, dont : `gabarits-distribues`, `registre-des-roles-miroir`, `la-pose-aboutit-pour-tout-role-du-registre`, `le-registre-decide-*`, `build-payload`. Le banc `le-registre-decide-du-pair-du-cadre-et-de-la-vue.test.js:432-455` (`copieAvecUnTroisiemeRole`) : relire son assertion sur `representant|orchestrateur` et l'étendre au troisième vrai rôle **sans** le rendre non discriminant (il injecte un 4e rôle `conseiller` : garder ce mécanisme).
- [ ] **Step 8 : mutation** — retirer `'curateur'` de `sous-agent.js` `ROLES_GARDES` : le banc §10-3 rougit sur `curateur` nommément. Remettre.
- [ ] **Step 9 : commit** `feat(roles): le rôle curateur entre au registre, au miroir CLI et dans les gardes — D-20260908-0007`.

---

### Task 4 : la pose — verbe `curateur`, module, aide, compétence `/curateur-metiers`

**Files:**
- Create : `ligne-directe/src/curateur.js`
- Modify : `ligne-directe/bin/ligne-directe.js:8-9,102-113,428-437`
- Modify : `cli/src/cli.js:135-146` (aide `curateur-update`), `cli/src/commands/agent.js:61,73`, `cli/src/commands/ou-naitre.js:55` (aides `--role`)
- Create : `.claude/skills/curateur-metiers/SKILL.md`
- Test : `ligne-directe/tests/cli.test.js` (verbe), `ligne-directe/tests/la-pose-aboutit-pour-tout-role-du-registre.test.js` (déjà dérivé)

**Interfaces:**
- Produces : `preparerLieuCurateur({ depot, nom })` → même contrat que `preparerLieuOrchestrateur` (`{ ok, lieu, refus? }`) ; verbe `node ligne-directe.js curateur <nom>`.

- [ ] **Step 1 : test rouge** dans `ligne-directe/tests/cli.test.js`, sur le modèle du cas `orchestrateur` existant (chercher `geste === 'orchestrateur'` / `'orchestrateur', 'j-…'` dans le fichier) :

```js
test('le verbe « curateur <nom> » pose le lieu .curateur/<nom> et rend du JSON', () => {
  const depot = depotJetable(); // fabrique existante du fichier
  const out = JSON.parse(execFileSync(process.execPath, [BIN, 'curateur', 'koksoak'], { cwd: depot, encoding: 'utf8' }));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.ok(existsSync(join(depot, '.curateur', 'koksoak', 'CLAUDE.md')));
});
```
  Rouge : « geste inconnu ».
- [ ] **Step 2 : `ligne-directe/src/curateur.js`** — décalque de `orchestrateur.js:106` : `export function preparerLieuCurateur({ depot, nom, ...opts }) { return preparerLieu({ depot, role: 'curateur', nom, ...opts }); }` avec la vérification de ligne (`verifierLigne`) reprise telle quelle — la ligne au dirigeant est obligatoire (`titreRequis`).
- [ ] **Step 3 : verbe** dans `bin/ligne-directe.js` : `else if (geste === 'curateur') { … }` jumeau du bloc `orchestrateur` (l.428-437) ; aide l.8-9 et un bloc l.113 « `curateur <nom>` — pose le lieu d'un curateur des métiers ». Vert.
- [ ] **Step 4 : aides CLI** — `cli.js:146` : `curateur-update` ; `agent.js:61,73` et `ou-naitre.js:55` : `--role orchestrateur (défaut) | representant | curateur | chef-equipe`.
- [ ] **Step 5 : `.claude/skills/curateur-metiers/SKILL.md`** — décalque de `.claude/skills/gestionnaire-client/SKILL.md` (244 l.) : frontmatter `name: curateur-metiers`, `description` qui **décide du déclenchement** (« Prépare le lieu d'un curateur des métiers d'agents … Utilise cette compétence quand on te demande de poser, installer, préparer un curateur des métiers — même si on dit seulement "fais naître koksoak" … NE PAS confondre avec /orchestrateur ni /gestionnaire-client »). Sections : principe (il propose, il n'adopte jamais) · prérequis (gabarits du pack présents, poste capable d'ouvrir une ligne au dirigeant) · le geste (`node $HOME/.somtech/ligne-directe/bin/ligne-directe.js curateur <nom>`) · si elle refuse · si elle crée le lieu (renseigner `CONTEXTE.md` et `RONDE.md`, **chevrons = refus de naissance**) · avant de le faire naître (`--model opus`, ligne au dirigeant) · ce qu'elle ne fait jamais (pas de chapitre « chefs d'équipe »). Arbre des fichiers : `CLAUDE.md` ← rendu · `CONTEXTE.md` · `RONDE.md` · `.mcp.json` · `.claude/settings.json` ← ce qu'il peut : lire, ServiceDesk, Somcraft en lecture, sa ligne, sous-agents `Explore`/`Plan`. Ce qu'il ne peut pas : écrire un fichier, écrire dans Somcraft.
- [ ] **Step 6 : suites vertes** (`cli` + `ligne-directe`). Commit `feat(pose): verbe curateur, module et compétence /curateur-metiers — D-20260908-0007`.

---

### Task 5 : le workflow reçoit le rôle, les réceptacles, et la garde « un tour doit alléger »

**Files:**
- Modify : `.claude/workflows/cycle-amelioration-metier.js:14-18` (rôles), `:74-96` (récolte), `:160-192` (dossier)
- Create : `.claude/workflows/lib/allegement.js` (fonction pure `tourAllege(propositions)`)
- Test : `cli/test/workflow-cycle-allegement.test.js` (banc §10-2)

**Interfaces:**
- Consumes : `args = { role: 'orchestrateur'|'gestionnaire-client'|'curateur-metiers', depuis?: string, receptacles?: string[] }` (`receptacles` = codes lisibles `D-…`/`E-…` inventoriés par R1.1).
- Produces : `export function tourAllege(propositions: {issue:string}[]): { allege: boolean, motif: string }` ; le workflow retourne `{ refuse: true, motif, propositions }` quand `propositions.length > 0` et qu'aucune n'a l'issue `fusionner`/`retirer`.

- [ ] **Step 1 : banc rouge** `cli/test/workflow-cycle-allegement.test.js` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tourAllege } from '../../.claude/workflows/lib/allegement.js';

test('un tour dont toutes les issues sont « adopter » est refusé', () => {
  const r = tourAllege([{ issue: 'adopter' }, { issue: 'adopter' }]);
  assert.equal(r.allege, false); assert.match(r.motif, /fusionner|retirer/);
});
test('une seule issue qui allège suffit', () => {
  assert.equal(tourAllege([{ issue: 'adopter' }, { issue: 'retirer' }]).allege, true);
});
test('un tour vide n est pas un tour qui n allège pas — c est un résultat (RA-MET-001)', () => {
  assert.equal(tourAllege([]).allege, true);
});
test('une issue inconnue ne compte pas comme un allègement', () => {
  assert.equal(tourAllege([{ issue: 'alleger' }]).allege, false);
});
```
  Rouge : module absent.
- [ ] **Step 2 : `lib/allegement.js`** :

```js
const ALLEGENT = new Set(['fusionner', 'retirer']);
export function tourAllege(propositions) {
  if (!Array.isArray(propositions) || propositions.length === 0) return { allege: true, motif: 'tour vide : un résultat, pas un refus' };
  const n = propositions.filter((p) => ALLEGENT.has(p?.issue)).length;
  return n > 0
    ? { allege: true, motif: `${n} proposition(s) allègent` }
    : { allege: false, motif: "aucune proposition ne porte l'issue « fusionner » ou « retirer » : le tour n'a fait que la moitié du travail (GF-MET-004)" };
}
```
  Vert.
- [ ] **Step 3 : workflow** — l.16 : `['orchestrateur', 'gestionnaire-client', 'curateur-metiers']` ; l.15 : `const receptacles = (args && Array.isArray(args.receptacles)) ? args.receptacles : []` ; prompt de récolte l.78-81 : « OÙ CHERCHER : ${receptacles.length ? `les réceptacles inventoriés : ${receptacles.join(', ')} — leurs epics et leurs stories, toutes applications confondues` : 'les tickets ServiceDesk de l'application « Somtech Pack » …'} » ; après la récolte (l.98) : `const a = tourAllege(recolte.propositions); if (!a.allege) return { role, depuis, refuse: true, motif: a.motif, propositions: recolte.propositions }` avec `import { tourAllege } from './lib/allegement.js'`. Vérifier que le moteur de workflows accepte un import relatif (chercher un `import` dans `analyse-decoupage-demande.js` ; sinon inliner la fonction et faire porter le banc sur une exportation du fichier workflow).
- [ ] **Step 4 :** `node --check .claude/workflows/cycle-amelioration-metier.js` ; `cd cli && npm test`. Commit `feat(workflow): cycle-amelioration-metier accepte le curateur, lit les réceptacles inventoriés et refuse un tour qui n'allège pas — D-20260908-0007`.

---

### Task 6 : `/orchestrateur` — la phrase périmée sur les sous-agents (design §9a)

**Files:**
- Modify : `.claude/skills/orchestrateur/SKILL.md:28-30,41`

- [ ] **Step 1 :** l.28-30 : `Ce qu'il ne peut PAS : écrire un fichier, ouvrir un sous-agent qui construit ou revoit — refusé par la garde sous-agent ; Explore et Plan (analyse, lecture seule) lui restent.` ; l.41 : `écrire ou modifier un fichier, ouvrir un sous-agent de construction`.
- [ ] **Step 2 :** `grep -n "ouvrir un sous-agent" .claude/skills/orchestrateur/SKILL.md` → seules les deux lignes corrigées. Commit `docs(orchestrateur): la compétence ne dit plus qu'un sous-agent est refusé en bloc — D-20260908-0007`.

---

### Task 7 (D2 = B seulement) : garde `fermeture` + verbe `fermer-billet`

Reporté en story séparée si D2 = A. Contenu si B : hook `PreToolUse` sur `mcp__servicedesk__tickets` (`gardes/fermeture.js` + `cli/src/metier/gardes/fermeture.js`) qui refuse `action: 'update'` avec `status: 'completed'` au rôle `curateur-metiers` ; verbe `node $HOME/.somtech/ligne-directe/bin/ligne-directe.js fermer-billet <T-…> --dossier <url-ou-code> --item <ID-ABC>` qui compose le commentaire « Repris dans <dossier>, item <ID> » puis passe le statut, et refuse sans les deux options ; banc §10-1 : le verbe sans `--item` rend non nul et le ticket n'a pas changé (double de ServiceDesk conforme au contrat MCP, jamais un faux plus cohérent que le service). ABC 1.2.0 : GF-MET-003 → `couche: "hook"`.

---

### Task 8 : ServiceDesk — le lot existe pour de vrai

- [ ] **Step 1 (D3) :** créer l'epic sous `D-20260908-0007` : `[FEAT] Métier curateur-metiers — rôle, rendu, gardes, pose, workflow`, application Somtech Pack (`2098c2fd-5448-46a3-bd98-83778e7a064d`), et une story par tâche T0…T6 + T9, avec G/W/T repris des `CT-MET-00x` de l'ABC (T1 ↔ `CT-MET-007` inversé ; T5 ↔ `CT-MET-002` ; T3 ↔ banc §10-3). Story T7 créée en `proposed` si D2 = A.
- [ ] **Step 2 :** passer la story en cours en `in_progress` au début de chaque tâche, `completed` au merge (règle 13).
- [ ] **Step 3 (D4) :** renommer `D-20260908-0004`, `-0005`, `-0006` : préfixe `[AMELIORATION-METIER] ` devant le titre (`mcp__servicedesk__demands` `update`, UUID) ; commenter chacune : « renommée pour être trouvable par le curateur (D-20260908-0007 §7) ».
- [ ] **Step 4 :** annexe §9 de l'ABC : remplacer `<E-… à créer>` par le code de l'epic (ABC 1.1.1, changelog).

---

### Task 9 : revue, merge, publication, poste — et la mesure qui prouve que le rôle est gardé

- [ ] **Step 1 : revue indépendante** (sous-agent fresh, modèle sonnet, jamais un fork) sur le diff complet, avec le brief : « vérifie que chaque banc rougit sur une mutation nommée ; que `CLAUDE.md`/chapitres du gabarit sont byte-identiques au rendu (`pack metier verifier --role curateur-metiers`) ; que rien n'est écrit à la main dans un produit de rendu ». Corriger, re-rendre, **refaire passer la revue si le diff a changé**.
- [ ] **Step 2 :** `gh pr ready 344` ; CI verte (`tests.yml` : cli, ligne-directe, python) ; `/merge`.
- [ ] **Step 3 : publier** — tag `v<mineure+1>` (le workflow `publish.yml` aligne `VERSION`/`pack.json` dans le paquet) ; attendre le run ; `npx @somtech-solutions/pack setup --yes` sur le poste ; vérifier `diff ~/.somtech/gardes/terminal-decision.js gardes/terminal-decision.js` → identique (c'est ce qui ferme la mesure n° 2).
- [ ] **Step 4 : CT-MET-007, à l'endroit** — depuis le dépôt principal (`~/GitRepo.nosync/somtech-pack`, branche à jour) : `/curateur-metiers koksoak` (pose, `CONTEXTE.md` et `RONDE.md` renseignés), puis, **avant la naissance**, mesurer les quatre fils par stdin avec `cwd=<dépôt>/.curateur/koksoak` : `Write` → deny · `Bash echo > x` → deny · `Task Explore` → allow · `Task general-purpose` → deny. Inscrire les quatre verdicts en commentaire sur la story T9 (PoW). La naissance de `koksoak` (ligne au dirigeant, `/loop` de `RONDE.md`) est le geste suivant, hors de ce plan.

---

## Auto-revue du plan

- **Couverture du design** : §5.1 ABC → T0 ; §5.2 tableau des fichiers → T2 (gabarit, classement), T3 (roles.js, gardes), T4 (skill, verbe), T5 (workflow), T6 (§9a) ; `rondes.md` §5 → hors lot (T-20260908-0079) ; §6.4bis → T5 ; §6.4ter/§10-1 → T7/D2 ; §7 renommage → T8 ; §9b → T1+T3 ; §10 bancs 2 et 3 → T5, T3 ; bancs hérités (lieu partiel, non versionnable, en-têtes, gabarit périmé) → dérivés de `rolesConnus()`, verts par T3 ; §11 → PR #344 sur `origin/main`.
- **Noms cohérents** : `curateur` (registre) / `curateur-metiers` (gabarit, metier/, workflow, nom de garde) / `.curateur` (dossier) — les trois sont joints par les bancs de T1 et T3.
- **Ce que le plan ne prouve pas** : que `/loop` posé à la naissance survit à une journée (l'ABC l'assume : « elle ne survit pas à la mort de l'agent ») ; que l'outil `Workflow` passe par le matcher `Task` (design §9, question ouverte) — **à mesurer en T9 Step 4** en ajoutant le cas `tool_name: 'Workflow'` aux quatre verdicts, et à porter à l'ABC selon le résultat.
