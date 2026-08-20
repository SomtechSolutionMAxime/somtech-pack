// metier-rendu.test.js — le rendu ABC → L0/L1/L2 (P-20260820-0001 phase 2, STD-047).
//
// Ce que ces tests gardent, et qui a coûté cher : un métier sans plafond devient
// une taxe permanente (33 000 tokens mesurés), et un garde-fou qui n'atterrit
// qu'en persona est une garantie fausse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compterTokens, rendre, BUDGETS } from '../src/metier/rendu.js';

/** Classement minimal valide — chaque garde-fou porte une couche qui garantit. */
function classementValide() {
  return {
    role: 'orchestrateur',
    version_abc: '2.0.0',
    // Une couche déclarée doit être réellement posée : un item classé « hook »
    // exige qu'un hook existe, un « refus-de-permission » que le refus soit
    // déclaré. Sans ça le classement dirait « garanti » sans rien garantir.
    refus: ['Write', 'Edit', 'Task'],
    hooks: [{ evenement: 'PreToolUse', outil: 'Bash', garde: 'ligne' }],
    items: [
      { id: 'GF-ORC-001', nature: 'garde-fou', couche: 'refus-de-permission', refus: ['Write', 'Edit'], enonce: 'N exécute jamais.', enonce_socle: 'Tu ne construis jamais.' },
      { id: 'GF-ORC-014', nature: 'garde-fou', couche: 'hook', enonce: 'Ta ligne est obligatoire.', enonce_socle: 'Ta ligne est obligatoire.' },
      { id: 'RA-ORC-001', nature: 'regle', couche: 'persona', enonce: 'Des faits, jamais le raisonnement.', chapitre: 'rendre-compte' },
    ],
    chapitres: [
      { nom: 'rendre-compte', abrege: 'Comment il parle au CTO.', version_pack: '1.81.0' },
    ],
  };
}

test('compterTokens surestime plutôt que de sous-estimer — une garde qui sous-compte ne garde rien', () => {
  // 350 caractères → 100 tokens au ratio déclaré de 3,5 car/token.
  assert.equal(compterTokens('a'.repeat(350)), 100);
  // le vrai coût d'un texte français dense est d'environ 4,2 car/token :
  // le compte rendu doit donc être PLUS GRAND que le compte réel, jamais plus petit.
  const reel = Math.ceil(350 / 4.2);
  assert.ok(compterTokens('a'.repeat(350)) > reel,
    'le comptage doit majorer le coût réel, sinon la garde laisse passer un dépassement');
});

test('compterTokens ne rend jamais 0 sur un texte non vide', () => {
  assert.equal(compterTokens(''), 0);
  assert.ok(compterTokens('x') >= 1);
});

test('un rendu valide produit L0, L1 et un fichier par chapitre', () => {
  const r = rendre(classementValide());
  assert.equal(r.ok, true, r.erreurs && r.erreurs.join(' · '));
  assert.ok(r.artefacts['L0.md']);
  assert.ok(r.artefacts['L1.md']);
  assert.ok(r.artefacts['chapitres/rendre-compte.md']);
});

test('R1 — un garde-fou qui n atterrit qu en persona FAIT ÉCHOUER le rendu', () => {
  const c = classementValide();
  c.items[0].couche = 'persona';
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('GF-ORC-001') && e.includes('persona')),
    `l'erreur doit nommer l'item et sa couche — reçu : ${JSON.stringify(r.erreurs)}`);
});

test('R2 — une compétence n est pas une couche de garantie, elle échoue comme la persona', () => {
  const c = classementValide();
  c.items[1].couche = 'competence';
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('GF-ORC-014')));
});

test('une couche inconnue est refusée — on ne classe pas dans une couche inventée', () => {
  const c = classementValide();
  // ⚠️ sur une RÈGLE, jamais sur un garde-fou : R1 attraperait la couche inconnue
  // à la place de cette garde, et le test resterait vert en l'éprouvant PAS.
  // Mesuré par mutation le 2026-08-20 : c'était le cas, et c'était sa seule survivante.
  c.items[2].couche = 'bonne-volonte';
  const r = rendre(c);
  assert.equal(r.ok, false);
  const e = r.erreurs.find((x) => x.includes('bonne-volonte'));
  assert.ok(e, `l erreur doit nommer la couche inventée — reçu : ${JSON.stringify(r.erreurs)}`);
  assert.ok(e.includes('couche inconnue'), `c est la garde de couche qui doit refuser, pas R1 — reçu : ${e}`);
});

test('I2 — un L1 qui dépasse son budget fait échouer le rendu, en nommant de combien', () => {
  const c = classementValide();
  // une règle démesurée : elle part en L1 parce qu'elle n'a pas de chapitre
  c.items.push({ id: 'RA-ORC-999', nature: 'regle', couche: 'persona', enonce: 'court', enonce_socle: 'x'.repeat(BUDGETS.L1 * 4) });
  const r = rendre(c);
  assert.equal(r.ok, false);
  const e = r.erreurs.find((x) => x.includes('L1'));
  assert.ok(e, `une erreur doit nommer L1 — reçu : ${JSON.stringify(r.erreurs)}`);
  assert.match(e, /\d+ *(tokens|jetons)/, 'l erreur doit dire de combien ça dépasse');
});

test('I2 — le budget de L0 mord aussi', () => {
  const c = classementValide();
  c.identite = 'y'.repeat(BUDGETS.L0 * 10);
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((x) => x.includes('L0')));
});

test('I4 — un chapitre sans abrégé ou sans version d origine est refusé', () => {
  const sansAbrege = classementValide();
  sansAbrege.chapitres[0].abrege = '';
  assert.equal(rendre(sansAbrege).ok, false);

  const sansVersion = classementValide();
  delete sansVersion.chapitres[0].version_pack;
  assert.equal(rendre(sansVersion).ok, false);
});

test('I4 — le chapitre rendu PORTE son abrégé et sa version, pas seulement le classement', () => {
  const r = rendre(classementValide());
  const ch = r.artefacts['chapitres/rendre-compte.md'];
  assert.ok(ch.includes('Comment il parle au CTO.'), 'l abrégé doit être dans le fichier rendu');
  assert.ok(ch.includes('1.81.0'), 'la version d origine doit être dans le fichier rendu');
});

test('une règle qui désigne un chapitre inexistant est refusée — pas de renvoi dans le vide', () => {
  const c = classementValide();
  c.items[2].chapitre = 'chapitre-fantome';
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('chapitre-fantome')));
});

test('I7 — chaque règle rendue cite l item d ABC dont elle dérive', () => {
  const r = rendre(classementValide());
  assert.ok(r.artefacts['chapitres/rendre-compte.md'].includes('RA-ORC-001'));
  assert.ok(r.artefacts['L1.md'].includes('GF-ORC-001'));
});

test('I5 — le rendu ne produit AUCUN chemin qui viserait le lieu d un agent', () => {
  const r = rendre(classementValide());
  for (const chemin of Object.keys(r.artefacts)) {
    assert.ok(!chemin.includes('.orchestrateur'), `chemin interdit : ${chemin}`);
    assert.ok(!chemin.includes('.gestionnaire'), `chemin interdit : ${chemin}`);
    assert.ok(!chemin.startsWith('/'), `chemin absolu interdit : ${chemin}`);
    assert.ok(!chemin.includes('..'), `remontée de chemin interdite : ${chemin}`);
  }
});

test('I6 — le rendu ne produit jamais de CONTEXTE.md', () => {
  const r = rendre(classementValide());
  assert.ok(!Object.keys(r.artefacts).some((c) => c.includes('CONTEXTE.md')));
});

test('un classement sans aucun garde-fou est refusé — un rôle sans garde-fou est un rôle mal décrit', () => {
  const c = classementValide();
  c.items = c.items.filter((i) => i.nature !== 'garde-fou');
  assert.equal(rendre(c).ok, false);
});

test('une dérogation à R1 exige un motif ET un nom qui l assume — sinon le refus tient', () => {
  const c = classementValide();
  c.items[0].couche = 'persona';

  c.items[0].sans_garantie = { motif: 'porte sur le contenu d un énoncé' };   // sans nom
  assert.equal(rendre(c).ok, false, 'un motif seul ne suffit pas à déroger');

  c.items[0].sans_garantie = { assume_par: 'le dirigeant' };                   // sans motif
  assert.equal(rendre(c).ok, false, 'un nom seul ne suffit pas à déroger');

  c.items[0].sans_garantie = { motif: 'porte sur le contenu d un énoncé', assume_par: 'le dirigeant', definitif: true };
  assert.equal(rendre(c).ok, true, 'motif + nom + définitif : la dérogation est recevable');
});

test('un item dérogé est EXPOSÉ dans le socle rendu — une dérogation ne se cache pas', () => {
  const c = classementValide();
  c.items[0].couche = 'persona';
  c.items[0].sans_garantie = { motif: 'aucune couche ne juge un énoncé', assume_par: 'le dirigeant', definitif: true };
  const r = rendre(c);
  assert.equal(r.ok, true);
  assert.deepEqual(r.deroges, ['GF-ORC-001']);
  const l1 = r.artefacts['L1.md'];
  assert.ok(l1.includes('GF-ORC-001'), 'l item dérogé doit apparaître dans le socle');
  assert.ok(l1.includes('aucune couche ne juge un énoncé'), 'son motif doit être lisible dans le socle');
  assert.ok(l1.includes('le dirigeant'), 'qui l assume doit être lisible dans le socle');
});

test('ce qui monte au socle EXIGE un énoncé court — sinon le socle recopie l ABC et le budget saute', () => {
  const c = classementValide();
  assert.equal(rendre(c).ok, true);

  delete c.items[0].enonce_socle;   // un garde-fou sans énoncé court
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('GF-ORC-001') && e.includes('enonce_socle')));
});

test('une règle rattachée à un chapitre n a PAS besoin d énoncé court — elle ne monte pas au socle', () => {
  const c = classementValide();
  // items[2] est une règle rattachée à un chapitre, et elle n'a pas d'enonce_socle
  assert.ok(!c.items[2].enonce_socle);
  assert.equal(rendre(c).ok, true);
});

test('un chapitre qui déclare un contenu le porte dans le fichier rendu, sous son en-tête', () => {
  const c = classementValide();
  c.chapitres[0].contenu = '## Comment tu écris\n\nDes faits, pas ton raisonnement.\n';
  const r = rendre(c);
  assert.equal(r.ok, true);
  const ch = r.artefacts['chapitres/rendre-compte.md'];
  assert.ok(ch.includes('Des faits, pas ton raisonnement.'), 'le contenu doit être dans le chapitre rendu');
  assert.ok(ch.indexOf('Comment il parle au CTO.') < ch.indexOf('Des faits'),
    'l en-tête (abrégé, fraîcheur) vient AVANT le contenu — c est ce qui permet de décider si on ouvre');
});

test('le budget L2 est SOUPLE : un chapitre trop gros avertit, il ne fait pas échouer', () => {
  const c = classementValide();
  c.chapitres[0].contenu = 'z'.repeat(BUDGETS.L2 * 5);
  const r = rendre(c);
  assert.equal(r.ok, true, 'un L2 trop gros ne bloque pas — il signale qu il couvre deux sujets');
  assert.ok(r.avertissements.some((a) => a.includes('rendre-compte')));
});

test('I3 — le rendu MESURE son volume face à l ABC et avertit s il le dépasse', () => {
  const c = classementValide();
  c.mots_abc = 10;                                   // un ABC minuscule
  c.chapitres[0].contenu = 'mot '.repeat(500);       // un métier bien plus gros
  const r = rendre(c);
  assert.ok(r.mesures.I3, 'le rendu doit rendre la mesure I3');
  assert.ok(r.mesures.I3.rapport > 1);
  assert.ok(r.avertissements.some((a) => a.includes('I3')),
    `I3 dépassé doit être dit — reçu : ${JSON.stringify(r.avertissements)}`);
});

test('I3 ne fait pas échouer le rendu — c est un invariant à mesurer, pas un gate (STD-047 §2.5 vs R4)', () => {
  const c = classementValide();
  c.mots_abc = 1;
  c.chapitres[0].contenu = 'mot '.repeat(2000);
  assert.equal(rendre(c).ok, true);
});

test('sans mots_abc, I3 se dit NON MESURÉ plutôt que de rendre un rapport inventé', () => {
  const r = rendre(classementValide());
  assert.equal(r.mesures.I3.mots_abc, null);
  assert.equal(r.mesures.I3.rapport, null);
});

// ——— corrections issues de la revue indépendante du 2026-08-20 ———

test('aucun item n apparaît deux fois dans L1 — le socle a un budget dur, il ne se paie pas en double', () => {
  const c = classementValide();
  c.items[0].cardinale = 1;                    // un garde-fou cardinal
  c.items[1].cardinale = 2;                    // un autre
  c.items[2].cardinale = 3;                    // une règle cardinale sans chapitre
  delete c.items[2].chapitre;
  c.items[2].enonce_socle = 'court';
  const l1 = rendre(c).artefacts['L1.md'];
  for (const id of ['GF-ORC-001', 'GF-ORC-014', 'RA-ORC-001']) {
    const n = l1.split(id).length - 1;
    assert.equal(n, 1, `${id} apparaît ${n} fois dans L1 — les sections doivent partitionner, pas se recouvrir`);
  }
});

test('un dérogé cardinal n apparaît pas non plus deux fois', () => {
  const c = classementValide();
  c.items[0].cardinale = 1;
  c.items[0].couche = 'persona';
  c.items[0].sans_garantie = { motif: 'm', assume_par: 'a', definitif: true };
  const l1 = rendre(c).artefacts['L1.md'];
  assert.equal(l1.split('GF-ORC-001').length - 1, 1);
});

test('une dérogation NON définitive exige une échéance — sinon la dette n a pas de fin', () => {
  const c = classementValide();
  c.items[0].couche = 'persona';
  c.items[0].sans_garantie = { motif: 'couche à construire', assume_par: 'le dirigeant' };
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('GF-ORC-001') && e.includes('échéance')),
    `une dérogation temporaire sans date est une permission de se taire — reçu : ${JSON.stringify(r.erreurs)}`);

  c.items[0].sans_garantie.echeance = '2026-09-30';
  assert.equal(rendre(c).ok, true);
});

test('une dérogation DÉFINITIVE n exige pas d échéance — il n y a rien à attendre', () => {
  const c = classementValide();
  c.items[0].couche = 'persona';
  c.items[0].sans_garantie = { motif: 'juge le contenu d un énoncé', assume_par: 'le dirigeant', definitif: true };
  assert.equal(rendre(c).ok, true);
});

test('le rendu MESURE ce que R1 refuse encore — une garde qui ne refuse plus rien doit se voir', () => {
  const derogé = classementValide();
  derogé.items[0].couche = 'persona';
  derogé.items[0].sans_garantie = { motif: 'm', assume_par: 'a', definitif: true };
  const rd = rendre(derogé);
  assert.equal(rd.mesures.R1.garde_fous, 2);
  assert.equal(rd.mesures.R1.deroges, 1);
  assert.equal(rd.mesures.R1.refuses, 0, 'un dérogé n est pas un refusé');

  // ⚠️ et le compteur doit BOUGER quand R1 refuse vraiment : un compteur figé
  // à zéro passerait le cas ci-dessus sans rien mesurer.
  const refusé = classementValide();
  refusé.items[0].couche = 'persona';              // garde-fou sans dérogation
  const rr = rendre(refusé);
  assert.equal(rr.ok, false);
  assert.equal(rr.mesures.R1.refuses, 1, 'R1 doit compter ce qu il refuse, pas rendre zéro en toute circonstance');
});

test('un chapitre sans nom, ou deux chapitres de même nom, sont refusés', () => {
  // ⚠️ on AJOUTE un chapitre sans nom plutôt que d'effacer celui qui existe :
  // l'effacer casserait le renvoi de la règle qui le vise, et c'est cette
  // autre erreur qui ferait rougir le test — pas la garde qu'il éprouve.
  // Mesuré par mutation le 2026-08-20.
  const sansNom = classementValide();
  sansNom.chapitres.push({ abrege: 'a', version_pack: '1.81.0' });
  const rs = rendre(sansNom);
  assert.equal(rs.ok, false, 'un chapitre sans nom rendrait chapitres/undefined.md');
  assert.ok(rs.erreurs.some((e) => e.includes("n'a pas de nom")),
    `c est la garde de nom qui doit refuser — reçu : ${JSON.stringify(rs.erreurs)}`);

  const doublon = classementValide();
  doublon.chapitres.push({ nom: 'rendre-compte', abrege: 'autre', version_pack: '1.81.0' });
  const r = rendre(doublon);
  assert.equal(r.ok, false, 'deux chapitres de même nom s écrasent en silence');
  assert.ok(r.erreurs.some((e) => e.includes('rendre-compte')));
});

// ——— le rendu produit aussi ce qui GARANTIT (STD-047 §2.2) ———

test('le rendu produit le fichier de droits, avec les refus et les hooks du classement', () => {
  const c = classementValide();
  c.hooks = [{ evenement: 'PreToolUse', outil: 'Bash', garde: 'terminal' }];
  const r = rendre(c);
  assert.equal(r.ok, true, r.erreurs?.join(' · '));
  const s = JSON.parse(r.artefacts['.claude/settings.json']);
  assert.deepEqual(s.permissions.deny, ['Write', 'Edit', 'Task']);
  assert.ok(!('allow' in s.permissions), "`allow` fait naître l agent injoignable (STD-047 R3)");
  assert.ok(s.hooks?.PreToolUse, 'le hook déclaré doit atterrir dans le fichier');
});

test('un item classé « hook » sans hook déclaré fait échouer le rendu — la couche serait un mot', () => {
  const c = classementValide();     // GF-ORC-014 est classé « hook »
  delete c.hooks;
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('GF-ORC-014') && e.includes('hook')),
    `classer en hook sans en déclarer un est une garantie fausse — reçu : ${JSON.stringify(r.erreurs)}`);

  c.hooks = [{ evenement: 'PreToolUse', outil: 'Bash', garde: 'ligne' }];
  assert.equal(rendre(c).ok, true);
});

test('un item classé « refus-de-permission » exige que le refus soit réellement déclaré', () => {
  const c = classementValide();
  delete c.refus;
  c.items[0].refus = ['Write'];
  assert.equal(rendre(c).ok, false, 'le classement ne déclare aucun refus : la couche est un mot');

  c.refus = ['Write'];
  assert.equal(rendre(c).ok, true);

  c.items[0].refus = ['NotebookEdit'];
  assert.equal(rendre(c).ok, false, 'le refus que l item nomme doit figurer dans ceux du classement');
});

test('la commande de hook rendue REFUSE quand la garde est absente du poste', () => {
  const c = classementValide();
  c.hooks = [{ evenement: 'PreToolUse', outil: 'Bash', garde: 'terminal' }];
  const cmd = JSON.parse(rendre(c).artefacts['.claude/settings.json'])
    .hooks.PreToolUse[0].hooks[0].command;

  // ⚠️ `node <fichier absent>` sort en code 1 — une erreur NON BLOQUANTE pour
  // Claude Code : le geste passerait pendant que le classement déclare l'item
  // « porté par un hook ». La commande doit donc se défendre elle-même.
  assert.ok(cmd.includes('-f '), 'la commande doit vérifier que la garde existe avant de l appeler');
  assert.ok(/permissionDecision"\s*:\s*"deny"/.test(cmd),
    'garde absente ⇒ la commande doit rendre elle-même un refus, pas laisser passer');
  assert.ok(cmd.includes('pack setup'), 'le refus doit dire comment installer la garde');
});

test('chaque cardinale DIT ce qui la garantit — sinon l agent ne peut pas le savoir', () => {
  // ⚠️ Trouvé par l'essai réel du 2026-08-20 : un orchestrateur né sur le métier
  // rendu a répondu « 7 — non établi, mon socle n'annonce rien sur ce qui
  // garantit les cardinales ». Il avait raison, et il ne l'a pas conclu de rien
  // (RA-ORC-004). La correction du doublon en L1 avait emporté l'information :
  // la section « refusés » portait la couche, la section « cardinales » non.
  const c = classementValide();
  c.items[0].cardinale = 1;                                   // portée par un refus
  c.items[1].cardinale = 2;                                   // portée par un hook
  c.items[2].cardinale = 3;                                   // portée par rien
  delete c.items[2].chapitre;
  c.items[2].enonce_socle = 'court';
  c.items[2].nature = 'garde-fou';
  c.items[2].sans_garantie = { motif: 'juge un énoncé', assume_par: 'le dirigeant', definitif: true };
  const l1 = rendre(c).artefacts['L1.md'];
  const bloc = l1.slice(l1.indexOf('cardinales'), l1.indexOf('Ce qui t'));
  assert.match(bloc, /GF-ORC-001[^\n]*refus-de-permission/, 'la cardinale portée par un refus doit le dire');
  assert.match(bloc, /GF-ORC-014[^\n]*hook/, 'la cardinale portée par un hook doit le dire');
  assert.match(bloc, /RA-ORC-001[^\n]*(aucune couche|rien ne la garantit)/i,
    'une cardinale que rien ne garantit doit le dire AUSSI — le silence se lit comme « non établi »');
});

test('le socle porte le PRÉAMBULE quand le classement en déclare un — L1, pas L0', () => {
  // ⚠️ Trouvé le 2026-08-20 : le socle rendu avait perdu la frontière entre les
  // deux fichiers du lieu et la définition de poste. Trois contrôles du harnais
  // existant rougissaient sur le gabarit intact — de vraies pertes, pas un
  // artefact de mesure. Elles ne tiennent pas dans les 150 tokens de L0 : elles
  // vont en tête de L1, qui est le socle proprement dit.
  const c = classementValide();
  c.preambule = '> **Deux fichiers, deux propriétaires.**\n\nEt la définition de poste.\n';
  const r = rendre(c);
  assert.equal(r.ok, true, r.erreurs?.join(' · '));
  assert.ok(r.artefacts['L1.md'].includes('Deux fichiers, deux propriétaires'));
  assert.ok(r.artefacts['L1.md'].indexOf('Deux fichiers') < r.artefacts['L1.md'].indexOf('Ce qui prime'),
    'le préambule ouvre le socle — il vient avant les règles');
  assert.ok(!r.artefacts['L0.md'].includes('Deux fichiers'), 'L0 reste l identité seule, dans ses 150 tokens');
});

test('un hook peut viser un chemin de garde EXISTANT, sans forcer ~/.somtech/gardes/', () => {
  // ⚠️ La garde d'ouverture de ligne vit dans `naissance-representant/hooks/`,
  // pas dans `gardes/`. Sans ce champ, le rendu écrivait un chemin qui n'existe
  // pas — et la convergence DÉSARMAIT tous les lieux en silence, en écrasant
  // leur settings.json par un gabarit qui ne portait plus le garde.
  // Trouvé en CI le 2026-08-20 par les tests de convergence (shell-tests).
  const c = classementValide();
  c.hooks = [{ evenement: 'PreToolUse', outil: '*', garde: 'ouverture-ligne',
               chemin: '$HOME/.somtech/naissance-representant/hooks/garde-ouverture-ligne.js' }];
  const cmd = JSON.parse(rendre(c).artefacts['.claude/settings.json']).hooks.PreToolUse[0].hooks[0].command;
  assert.ok(cmd.includes('naissance-representant/hooks/garde-ouverture-ligne.js'),
    'le hook doit viser le chemin déclaré, pas un chemin inventé');
  assert.ok(cmd.includes('-f ') && /permissionDecision"\s*:\s*"deny"/.test(cmd),
    'et il se défend toujours lui-même si la garde manque');
});

// ——— corrections de la revue indépendante du 2026-08-20 (2e passe) ———

test('FINDING 1 — le renvoi de la carte pointe là où les chapitres sont DISTRIBUÉS', () => {
  // 🔴 Le socle disait « chapitres/<nom>.md ». Distribué, il vit à la racine du
  // gabarit et les chapitres sont sous `metier/chapitres/`. Un agent né lisait
  // son CLAUDE.md, cherchait `chapitres/rondes.md` → ENOENT. AUCUN chapitre
  // n'était atteignable, ce qui défait toute la raison d'être du découpage.
  const l1 = rendre(classementValide()).artefacts['L1.md'];
  assert.ok(l1.includes('metier/chapitres/rendre-compte.md'),
    `la carte doit renvoyer à metier/chapitres/… — reçu : ${l1.match(/chapitres\/\S+/)?.[0]}`);
});

test('FINDING 6 — un chemin de garde qui porte un métacaractère de shell est REFUSÉ', () => {
  for (const chemin of ['$(rm -rf /)', '`whoami`', 'a"; evil; "b', "x';id;'"]) {
    const c = classementValide();
    c.hooks = [{ evenement: 'PreToolUse', outil: '*', garde: 'x', chemin }];
    const r = rendre(c);
    assert.equal(r.ok, false, `« ${chemin} » s exécuterait à CHAQUE geste de l agent`);
    assert.ok(r.erreurs.some((e) => e.includes('chemin')));
  }
  const bon = classementValide();
  bon.hooks = [{ evenement: 'PreToolUse', outil: '*', garde: 'x',
                 chemin: '$HOME/.somtech/naissance-representant/hooks/garde-ouverture-ligne.js' }];
  assert.equal(rendre(bon).ok, true);
});

test('un hook peut porter une commande DÉCLARÉE mot pour mot — on n en fabrique pas une seconde', () => {
  // ⚠️ La garde d'ouverture de ligne a déjà sa commande, dans la naissance. En
  // écrire une variante ici en ferait DEUX COPIES d'un même critère, qui
  // divergeraient en silence — et la convergence, qui compare mot pour mot,
  // désarmerait tous les lieux existants. Trouvé en CI le 2026-08-20.
  const c = classementValide();
  c.hooks = [{ evenement: 'PreToolUse', outil: '*', garde: 'ouverture-ligne', commande: 'CECI-EST-LA-COMMANDE-SOURCE' }];
  const cmd = JSON.parse(rendre(c).artefacts['.claude/settings.json']).hooks.PreToolUse[0].hooks[0].command;
  assert.equal(cmd, 'CECI-EST-LA-COMMANDE-SOURCE',
    'une commande déclarée est reprise telle quelle — jamais réécrite');
});

test('un hook sans outil déclaré ne porte PAS de « matcher » — la forme est celle de la source', () => {
  // ⚠️ La naissance pose son garde SANS `matcher` (il vaut pour tous les outils).
  // En ajouter un rendait le bloc structurellement différent de ce que la
  // convergence compare mot pour mot : elle aurait désarmé chaque lieu.
  const c = classementValide();
  c.hooks = [{ evenement: 'PreToolUse', garde: 'x', commande: 'CMD' },
             { evenement: 'PreToolUse', outil: 'Bash', garde: 'y', commande: 'CMD2' }];
  const h = JSON.parse(rendre(c).artefacts['.claude/settings.json']).hooks.PreToolUse;
  assert.deepEqual(Object.keys(h[0]), ['hooks'], 'sans outil : aucun matcher');
  assert.deepEqual(Object.keys(h[1]), ['matcher', 'hooks'], 'avec outil : le matcher reste');
});

test('un chapitre NOMME les items dont il répond, il ne recopie pas leur énoncé entier', () => {
  // ⚠️ Recopier le texte d'ABC dans chaque chapitre est la duplication même que
  // ce modèle combat : mesuré le 2026-08-20, ces sections pesaient 19 949 des
  // 27 862 octets dont le métier rendu avait grossi. L'ABC est la source ; le
  // chapitre dit de QUOI il répond, la forme courte suffit à le reconnaître.
  const c = classementValide();
  c.items[2].enonce = 'un énoncé d ABC très long qui ne doit pas être recopié ici';
  c.items[2].enonce_socle = 'La forme courte.';
  const ch = rendre(c).artefacts['chapitres/rendre-compte.md'];
  assert.ok(ch.includes('RA-ORC-001'), "l item doit être CITÉ — c'est I7, la traçabilité");
  assert.ok(!ch.includes('un énoncé d ABC très long'), "l'énoncé d'ABC ne se recopie pas");
  assert.ok(!ch.includes('La forme courte.'),
    "ni sa forme courte : le chapitre CITE ses items, l'ABC reste la source de leur texte");
});
