// le-registre-decide-de-la-pose-et-du-bapteme.test.js — DEUX DÉCISIONS QUI VIVAIENT AILLEURS
// QUE DANS LE REGISTRE (T-20260826-0076, points 1 et 2).
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUI A ÉTÉ MESURÉ, ET OÙ
//
//   • `naissance-representant/bin/naitre.js:272` — `if (role !== 'orchestrateur')`. La pose
//     d'un lieu absent n'existait QUE pour l'orchestrateur ; tout autre rôle du registre
//     sortait en `exit(1)`. Le cœur de la pose n'était pourtant PAS en dur : `preparerLieu`
//     (`lieu-agent.js:532`) prend le rôle en argument depuis toujours, et
//     `preparerLieuOrchestrateur` n'en est qu'une enveloppe de deux lignes.
//   • `ligne-directe/src/nom-de-riviere.js:302` — `if (role !== 'orchestrateur')`. Le baptême
//     par nom de rivière était réservé en dur ; tout autre rôle était nommé par son code.
//
// Le registre porte déjà l'en-tête qui condamne ces deux lignes : « Ajouter un rôle, c'est
// ajouter une ligne — jamais un module ». Ces deux comparaisons littérales faisaient de
// l'ajout d'un rôle un travail de MODULE : il fallait aller éditer deux fichiers qui ne
// parlent pas des rôles pour qu'un rôle neuf puisse naître.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ CE QUE CES ESSAIS GARDENT VRAIMENT — ET C'EST L'AUTRE MOITIÉ, LA PLUS DURABLE.
//
// Fermer les deux littéraux d'aujourd'hui ne garde rien de ce qu'on ajoutera demain. Le
// chantier en cours (P-20260819-0001) porte NEUF rôles : le premier d'entre eux inscrit sans
// dire comment il se pose ni comment il se nomme retomberait, en silence, sur un repli que
// personne n'a choisi pour lui. Ces essais PARCOURENT donc le registre — jamais une liste
// recopiée — et exigent de CHAQUE rôle qu'il déclare les deux. Un rôle ajouté sans elles fait
// rougir ce fichier avant d'atteindre un poste.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { role as roleDe, rolesConnus, rolesSansLieu, roleSansLieu, clesBrutesDesRolesSansLieu, poseAutomatique, poseManuelle, baptemeDuRole, RoleInconnu } from '../src/roles.js';
import { nomDeLAgentQuiNait, estUneRiviere } from '../src/nom-de-riviere.js';

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — LE REGISTRE DIT LES DEUX CHOSES, POUR CHAQUE RÔLE

test('CHAQUE rôle du registre dit si sa pose est automatique — sinon la décision vit ailleurs', () => {
  const muets = rolesConnus().filter((nom) => typeof roleDe(nom).pose_automatique !== 'boolean');
  assert.deepEqual(
    muets,
    [],
    'ces rôles ne disent pas si « naitre » peut poser leur lieu d’autorité : ' +
      `${muets.join(', ')}. Tant qu’ils se taisent, la décision se prend hors du registre — ` +
      'c’était la comparaison littérale « role !== \'orchestrateur\' » de naitre.js:272.',
  );
});

test('CHAQUE rôle du registre dit comment il est NOMMÉ à sa naissance', () => {
  const permis = ['riviere', 'code'];
  const muets = rolesConnus().filter((nom) => !permis.includes(roleDe(nom).bapteme));
  assert.deepEqual(
    muets,
    [],
    'ces rôles ne disent pas comment ils sont baptisés (« riviere » ou « code ») : ' +
      `${muets.join(', ')}. C’était la comparaison littérale de nom-de-riviere.js:302.`,
  );
});

// ⚠️ UN « false » N'EST PAS UNE PARESSE — ET SA RAISON DOIT VIVRE AU REGISTRE, PAS DANS UN
// COMMENTAIRE DE `naitre.js`. Le représentant garde sa pose manuelle pour un motif tranché par
// le dirigeant le 2026-08-16 ; si ce motif et le geste qui lève le blocage restent en dur dans
// la commande, on a DÉPLACÉ le littéral au lieu de l'enlever.
test('UN RÔLE QUI REFUSE LA POSE AUTOMATIQUE DIT POURQUOI, ET OÙ ALLER', () => {
  const manuels = rolesConnus().filter((nom) => roleDe(nom).pose_automatique === false);
  assert.ok(manuels.length > 0, 'le registre doit porter au moins un rôle à pose manuelle — sinon cet essai ne garde rien');

  for (const nom of manuels) {
    const dit = roleDe(nom).pose_manuelle;
    assert.ok(dit, `« ${nom} » refuse la pose automatique sans dire pourquoi`);
    assert.ok(
      typeof dit.motif === 'string' && dit.motif.trim().length > 20,
      `« ${nom} » doit NOMMER ce qui garde sa revue — sinon son refus passe pour un caprice (lu : ${JSON.stringify(dit.motif)})`,
    );
    assert.ok(
      typeof dit.geste === 'string' && dit.geste.trim().length > 10,
      `« ${nom} » doit dire OÙ ALLER quand sa pose est refusée — un refus sans geste laisse l’opérateur sur place (lu : ${JSON.stringify(dit.geste)})`,
    );
  }
});

// ⚠️ LES VALEURS D'AUJOURD'HUI SONT ÉPINGLÉES. Sans ça, les trois essais ci-dessus resteraient
// verts si quelqu'un mettait `pose_automatique: true` au représentant — c'est-à-dire si on
// posait d'autorité un lieu branché sur un canal que le client voit, la seule frontière que le
// dirigeant a demandé de ne pas franchir (2026-08-16).
test('LES VALEURS MESURÉES DES DEUX RÔLES EXISTANTS SONT ÉPINGLÉES', () => {
  assert.equal(roleDe('orchestrateur').pose_automatique, true, 'l’orchestrateur naît sans qu’un humain touche un écran');
  assert.equal(roleDe('orchestrateur').bapteme, 'riviere', 'il vit longtemps et porte plusieurs mandats : une rivière');
  assert.equal(roleDe('representant').pose_automatique, false, 'sa pose garde sa revue — arbitrage du dirigeant, 2026-08-16');
  assert.equal(roleDe('representant').bapteme, 'code', 'il porte le prénom de la personne qu’il représente');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — LES REPLIS SONT AU REGISTRE, EN UN SEUL ENDROIT
//
// Même raison que `lignesDuRole` : un `?? false` oublié chez un lecteur rendrait un rôle SANS
// repli, et le repli qui compte ici décide de poser ou non un lieu d'autorité.

test('UN RÔLE QUI NE DIT RIEN NE SE FAIT PAS POSER D’AUTORITÉ — le repli penche du côté qui n’écrit pas', () => {
  // La question se pose sur un rôle réel — le registre refuse de décider sur un inconnu.
  assert.equal(poseAutomatique('orchestrateur'), true);
  assert.equal(poseAutomatique('representant'), false);
});

test('LE REPLI DE `poseManuelle` NE FABRIQUE AUCUN GESTE — il dit qu’il n’en a pas', () => {
  const dit = poseManuelle('representant');
  assert.match(dit.geste, /gestionnaire-client/, 'le geste réel vient du registre');
  assert.match(dit.motif, /canal/i, 'et le motif aussi');
});

// ⚠️ LES DEUX REPLIS SONT ÉPROUVÉS, PAS SEULEMENT ÉCRITS. Aucun rôle déclaré ne les atteint —
// un essai plus haut s'en assure — donc sans ceci ils seraient du code jamais exécuté, dont on
// ne saurait qu'au neuvième rôle s'il tient ce que son commentaire promet. On retire la
// déclaration en mémoire, dans ce seul processus, et on la remet.
test('UN RÔLE QUI OUBLIE `pose_automatique` NE SE FAIT PAS POSER — le repli est éprouvé, pas supposé', () => {
  const r = roleDe('orchestrateur');
  const declare = r.pose_automatique;
  try {
    delete r.pose_automatique;
    assert.equal(poseAutomatique('orchestrateur'), false, 'clé absente : le repli doit refuser, pas poser');
    r.pose_automatique = 'oui'; // une valeur qui a l'air d'un « vrai » sans en être un
    assert.equal(poseAutomatique('orchestrateur'), false, 'seul un `true` explicite autorise une écriture sur le disque');
  } finally {
    r.pose_automatique = declare;
  }
  assert.equal(poseAutomatique('orchestrateur'), true, 'la déclaration est remise telle qu’elle était');
});

test('UN RÔLE QUI OUBLIE `pose_manuelle` REÇOIT UN REPLI QUI N’INVENTE RIEN', () => {
  const r = roleDe('representant');
  const declare = r.pose_manuelle;
  try {
    delete r.pose_manuelle;
    const dit = poseManuelle('representant');
    assert.ok(!/gestionnaire-client/.test(dit.geste), 'le repli ne sert PAS le geste d’un autre rôle');
    assert.match(dit.geste, /roles\.js/, 'il nomme le fichier où le geste manquant s’inscrit');
    assert.match(dit.motif, /ne dit pas/, 'et le motif dit qu’on ne sait pas, plutôt que d’en inventer un');
  } finally {
    r.pose_manuelle = declare;
  }
  assert.match(poseManuelle('representant').geste, /gestionnaire-client/, 'la déclaration est remise telle qu’elle était');
});

test('`baptemeDuRole` rend ce que le registre déclare', () => {
  assert.equal(baptemeDuRole('orchestrateur'), 'riviere');
  assert.equal(baptemeDuRole('representant'), 'code');
});

test('LES TROIS ACCESSEURS REFUSENT DE DÉCIDER SUR UN RÔLE INCONNU', () => {
  // Le registre l'écrit déjà : « DÉCIDER sur un rôle qu'on ne connaît pas reste interdit ».
  // Ces trois-là décident — deux d'entre eux décident d'écrire sur le disque.
  for (const accesseur of [poseAutomatique, poseManuelle, baptemeDuRole]) {
    assert.throws(() => accesseur('cuisinier'), RoleInconnu, `${accesseur.name} a décidé sur un rôle inconnu`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — LE BAPTÊME SUIT LE REGISTRE, POUR CHAQUE RÔLE

let bacs = [];
const bacNeuf = () => {
  const d = mkdtempSync(join(tmpdir(), 'smtk-bapteme-'));
  bacs.push(d);
  return d;
};
test.after(() => {
  for (const d of bacs) rmSync(d, { recursive: true, force: true });
  bacs = [];
});

test('LE BAPTÊME DE CHAQUE RÔLE EST CELUI QUE SON REGISTRE DÉCLARE — jamais celui d’un littéral', () => {
  for (const nom of rolesConnus()) {
    const attendu = roleDe(nom).bapteme;
    const r = nomDeLAgentQuiNait({
      role: nom,
      lieu: bacNeuf(), // un lieu vide : aucun `.nom-agent` inscrit, donc c'est le rôle qui tranche
      code: 'd-20260826-0001',
      // Le parc est VIDE et la mesure est complète : rien ne doit détourner le tirage.
      depot: bacNeuf(),
      listerAgents: () => [],
      lireRegistre: () => ({ lignes: {}, communs: {} }),
    });

    assert.ok(r.nom, `« ${nom} » n’a reçu aucun nom : ${r.message ?? ''}`);
    if (attendu === 'riviere') {
      assert.ok(
        estUneRiviere(r.nom),
        `« ${nom} » déclare le baptême par rivière et a reçu « ${r.nom} » (source : ${r.source})`,
      );
      assert.equal(r.attribue, true, `« ${nom} » déclare la rivière : elle doit être ATTRIBUÉE, pas subie`);
    } else {
      assert.equal(
        r.nom,
        'd-20260826-0001',
        `« ${nom} » déclare le baptême ${JSON.stringify(attendu)} et a reçu « ${r.nom} » (source : ${r.source})`,
      );
      assert.equal(r.attribue, false, `« ${nom} » déclare le code : rien n’est tiré du parc des rivières`);
    }
  }
});

// ⚠️ L'INSTRUMENT QUI DISCRIMINE VRAIMENT — ET IL EST LE SEUL, TANT QUE LE REGISTRE N'A QUE
// DEUX RÔLES.
//
// L'essai ci-dessus est VERT même sur le code d'avant le correctif : avec deux rôles dont un
// seul est l'orchestrateur, la comparaison littérale `role !== 'orchestrateur'` rend exactement
// ce que le registre déclare. Il ne prouve donc RIEN sur l'origine de la décision — il ne
// mordra qu'au troisième rôle. C'est un essai qui garde l'avenir, pas un essai qui a trouvé le
// défaut, et le dire ici évite de compter deux fois la même preuve.
//
// Ce qui discrimine, c'est de DÉPLACER LA DÉFINITION et de regarder si la décision suit. On
// change ce que le registre déclare, en mémoire, dans ce seul processus, et on le remet —
// `node --test` isole chaque fichier dans son processus, et le `finally` couvre l'échec.
// Sur le code d'avant, la décision ne bougeait pas : elle ne lisait pas le registre.
test('DÉPLACER LA DÉCLARATION DÉPLACE LA DÉCISION — c’est ce qui prouve que le littéral est parti', () => {
  const orchestrateur = roleDe('orchestrateur');
  const declare = orchestrateur.bapteme;
  try {
    orchestrateur.bapteme = 'code';
    const r = nomDeLAgentQuiNait({
      role: 'orchestrateur',
      lieu: bacNeuf(),
      code: 'd-20260826-0002',
      depot: bacNeuf(),
      listerAgents: () => [],
      lireRegistre: () => ({ lignes: {}, communs: {} }),
    });
    assert.equal(
      r.nom,
      'd-20260826-0002',
      `le registre déclare « code » et l’orchestrateur a reçu « ${r.nom} » : la décision ne vient pas du registre`,
    );
  } finally {
    orchestrateur.bapteme = declare;
  }
  assert.equal(roleDe('orchestrateur').bapteme, 'riviere', 'la déclaration est remise telle qu’elle était');
});

// ⚠️ ET LA MOITIÉ QUI PROTÈGE LES RIVIÈRES. Avant ce lot, un rôle qu'on ne connaît pas était
// nommé par son code EN SILENCE — la comparaison littérale rangeait « inconnu » avec
// « représentant ». Un rôle qui n'existe pas n'a pas de convention de nom : on ne lui en
// invente pas une, on refuse.
test('UN RÔLE INCONNU NE SE FAIT PLUS NOMMER EN SILENCE', () => {
  assert.throws(
    () => nomDeLAgentQuiNait({ role: 'cuisinier', lieu: bacNeuf(), code: 'peu-importe' }),
    RoleInconnu,
    'un rôle inconnu était rangé avec « pas orchestrateur » et repartait avec son code',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA SECONDE TABLE DU REGISTRE — `ROLES_SANS_LIEU`, ET QUI LA GARDE (2026-09-01)
//
// 🔴 CE QUE CES ESSAIS FERMENT, ET COMMENT LE TROU A ÉTÉ MESURÉ. `ROLES_SANS_LIEU` est née à
// la fusion de `E-20260825-0002` : un chef d'équipe est un rôle CONNU qui n'a pas de lieu, et
// qui ne peut pas entrer dans `ROLES` (une entrée sans `entetes` fait tomber
// `roleDuLieuOuRefus` sur `Object.entries(undefined)`). Elle décide de `baptemeDuRole` et
// nourrit l'aide en ligne : elle a donc L'AUTORITÉ d'une table du registre.
//
// ⚠️ ELLE N'EN AVAIT PAS LA GARDE, et les deux moitiés n'étaient PAS symétriques. Mesuré par
// mutation, contrôle négatif vert (0 · 0), les trois suites :
//
//   • RETIRER `chef-equipe` de la table   →  33 rouges. La table EST lue, elle EST vivante.
//   • AJOUTER un rôle bidon à la table    →   0 rouge. Personne ne regarde.
//   • AJOUTER le même rôle bidon à `ROLES` → 162 rouges. La PREMIÈRE table, elle, est gardée.
//
// Une seconde porte, la même autorité que la première, et aucune de sa garde. Le trou n'est
// pas « la table est fausse » : c'est que sa moitié « ce qu'on ne doit PAS y ajouter » n'était
// gardée par rien, à côté d'une moitié « ce qui doit y être » qui l'était.
//
// ⚠️ ET CE N'EST PAS UNE LISTE D'EXCEPTIONS QU'ON ÉLARGIT. Le troisième essai ci-dessous est
// celui qui mord vraiment : une entrée sans lieu n'a le droit de déclarer QUE `libelle` et
// `bapteme`. Elle ne peut donc pas se doter d'un `dossier` en douce et devenir un `ROLES`
// fantôme — le registre se mettrait à balayer des lieux qui n'existent pas. Épingler les noms
// se contourne en éditant l'épingle ; épingler la FORME oblige à dire ce qu'on veut faire.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('LA TABLE DES RÔLES SANS LIEU EST ÉPINGLÉE — l’y ajouter est un arbitrage, pas de l’entretien', () => {
  assert.deepEqual(
    rolesSansLieu().sort(), ['chef-equipe'],
    'un rôle a été ajouté ou retiré de `ROLES_SANS_LIEU` — cette table dit qui échappe à la ' +
      'table des lieux, et son contenu est une décision, pas une commodité de passage'
  );
});

test('AUCUN RÔLE N’EST DANS LES DEUX TABLES À LA FOIS — sinon la question « a-t-il un lieu ? » a deux réponses', () => {
  const deuxFois = rolesSansLieu().filter((nom) => rolesConnus().includes(nom));
  assert.deepEqual(
    deuxFois, [],
    `« ${deuxFois.join(', ')} » est déclaré dans ROLES et dans ROLES_SANS_LIEU — selon la ` +
      `fonction interrogée, il aurait un lieu ou n’en aurait pas, et rien ne dirait laquelle a raison`
  );
});

test('🔴 UNE ENTRÉE SANS LIEU NE DÉCLARE QUE `libelle` ET `bapteme` — elle ne devient pas un `ROLES` fantôme', () => {
  // Le champ qui compte est `dossier` : l'ajouter ici ferait balayer par le registre des lieux
  // qui n'existent pas. Mais on n'énumère pas les champs INTERDITS — une liste d'interdits
  // s'oublie au premier champ neuf. On énumère les champs PERMIS, et tout le reste tombe.
  const PERMIS = ['libelle', 'bapteme'];
  for (const nom of rolesSansLieu()) {
    const entree = roleSansLieu(nom);
    assert.ok(entree, `« ${nom} » est énuméré mais son entrée est introuvable`);
    // 🔴 `Reflect.ownKeys` ET PAS `Object.keys` — la garde était aveugle, et c'est mesuré.
    // `Object.defineProperty(entree, 'dossier', { enumerable: false })` posait un champ que
    // la production lit parfaitement (`entree.dossier`, `'dossier' in entree`) et que
    // `Object.keys` ne rendait pas : le « ROLES fantôme » que cet essai prétend interdire
    // passait sous lui, 0 rouge sur 2 085 essais. Une garde qui énumère doit énumérer comme
    // celui qui LIT, jamais comme celui qui DÉCLARE.
    const interdits = Reflect.ownKeys(entree).map(String).filter((c) => !PERMIS.includes(c));
    assert.deepEqual(
      interdits, [],
      `« ${nom} » déclare ${interdits.map((c) => `\`${c}\``).join(', ')} — un rôle SANS lieu qui ` +
        `porte les clés d'un rôle QUI EN A UN est la moitié d'une entrée de \`ROLES\`, et le ` +
        `registre la traitera comme telle sans que personne l'ait décidé`
    );
    assert.ok(
      typeof entree.libelle === 'string' && entree.libelle.length > 0,
      `« ${nom} » n'a pas de libellé lisible`
    );
    assert.ok(
      ['riviere', 'code'].includes(entree.bapteme),
      `« ${nom} » ne dit pas comment il est nommé à sa naissance (\`bapteme\` = ${JSON.stringify(entree.bapteme)}) — ` +
        `sans quoi il retombe sur un repli que personne n'a choisi pour lui, exactement comme un rôle de \`ROLES\``
    );
  }
});

test('🔴 LA TABLE ELLE-MÊME N’A AUCUNE ENTRÉE CACHÉE — les clés BRUTES, pas les énumérables', () => {
  // Un cran au-dessus du champ caché : une ENTRÉE posée non énumérable aurait toute
  // l'autorité de la table — `baptemeDuRole` lit par indexation, qui la voit — en restant
  // invisible à `rolesSansLieu()`, donc à l'épingle qui la garde.
  const brut = clesBrutesDesRolesSansLieu();
  assert.deepEqual(
    brut.table.map(String).sort(), ['chef-equipe'],
    `la table porte des clés que \`rolesSansLieu()\` ne rend pas (brut : ${brut.table.map(String).join(', ')}) — ` +
      `une entrée cachée décide autant qu'une entrée déclarée, et aucune épingle ne la voit`
  );
  for (const [nom, cles] of Object.entries(brut.entrees)) {
    assert.deepEqual(
      cles.map(String).sort(), ['bapteme', 'libelle'],
      `« ${nom} » porte des champs bruts que l'énumération ne rend pas : ${cles.map(String).join(', ')}`
    );
  }
});

test('🔴 `roleSansLieu` NE DÉCIDE NULLE PART EN PRODUCTION — le banc que le commentaire promettait', () => {
  // 🔴 CE BANC N'EXISTAIT PAS, ET LE COMMENTAIRE DE `roleSansLieu` AFFIRMAIT LE CONTRAIRE.
  // Mesuré par une passe de fond : elle a importé la fonction dans `bin/naitre.js`, lui a fait
  // décider une branche, et les 2 085 essais du dépôt sont restés VERTS. Une garantie écrite
  // au-delà de ce qui est mesuré arrête la personne qui allait vérifier — c'est le mode
  // d'erreur le plus cher de ce dépôt, et il venait d'être commis dans le geste qui en fermait
  // un autre.
  //
  // ⚠️ ON GARDE L'APPEL, PAS LE MOT. Chercher la chaîne « roleSansLieu » dans les sources
  // rendrait vrai un banc qu'un renommage désarme. On liste les fichiers de PRODUCTION et on
  // refuse l'IMPORT — la seule façon d'atteindre la fonction depuis un autre module.
  const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const PRODUCTION = ['ligne-directe/src', 'naissance-representant/src', 'naissance-representant/bin', 'cli/src'];

  const fichiers = [];
  const balayer = (dir) => {
    let entrees;
    try { entrees = readdirSync(dir); } catch { return; }
    for (const e of entrees) {
      const chemin = join(dir, e);
      if (statSync(chemin).isDirectory()) balayer(chemin);
      else if (e.endsWith('.js')) fichiers.push(chemin);
    }
  };
  for (const d of PRODUCTION) balayer(join(RACINE, d));

  // ⚠️ CONTRÔLE DE L'INSTRUMENT : un balayage qui ne trouve rien rendrait ce banc vert pour
  // la mauvaise raison. On exige d'avoir vraiment lu du code de production.
  assert.ok(fichiers.length > 50, `le balayage n'a trouvé que ${fichiers.length} fichier(s) de production — l'instrument est cassé, pas le lot`);

  const coupables = fichiers.filter((f) => {
    if (f.endsWith(`${'/'}roles.js`)) return false; // sa propre définition
    const src = readFileSync(f, 'utf8');
    return /import\s*\{[^}]*\broleSansLieu\b[^}]*\}\s*from/.test(src)
        || /\bclesBrutesDesRolesSansLieu\b/.test(src);
  });
  assert.deepEqual(
    coupables.map((f) => f.slice(RACINE.length)), [],
    `ces fichiers de PRODUCTION importent un accesseur réservé aux bancs — ils contourneraient ` +
      `\`role()\`, la seule porte qui doit décider d'un rôle`
  );
});
