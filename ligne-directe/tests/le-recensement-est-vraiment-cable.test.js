// LE RECENSEMENT EST VRAIMENT CÂBLÉ AU VEILLEUR (E-20260819-0005).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE BANC EXISTE À CÔTÉ DE CELUI QUI ÉPROUVE LA MESURE
//
// `unRecensement` peut être parfait et le veilleur ne jamais l'appeler. Un câblage manquant ne
// produit AUCUNE erreur : la ronde ne tourne pas, le geste `recensement` répond « geste
// inconnu », et tout a l'air installé. C'est le motif que ce dépôt a payé plusieurs fois — un
// dispositif indiscernable d'un dispositif mort.
//
// ⚠️ ET IL ÉPROUVE UNE CHOSE QUE L'AUTRE BANC NE PEUT PAS : que le recensement N'ENVOIE RIEN.
// Le geste de remise à jour (`/clear`) existe et il est rendu dans le compte rendu ; s'il
// partait tout seul, il effacerait le fil d'orchestrateurs en plein travail. « Le registre
// propose, il n'impose pas » n'est une propriété que si personne ne peut l'enfreindre sans
// qu'un banc rougisse.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Veilleur } from '../src/veilleur.js';
import { posteHerdr } from './aide/faux-herdr.js';

let bac;
before(() => {
  bac = mkdtempSync(join(tmpdir(), 'recensement-cable-'));
});
after(() => rmSync(bac, { recursive: true, force: true }));

function veilleurNu(nom) {
  return new Veilleur({ cheminSocket: join(bac, `${nom}.sock`), identite: { equipe: 'T' } });
}

test('le geste « recensement » est servi — sans quoi personne ne pourrait interroger le registre', async () => {
  const v = veilleurNu('geste');
  let appels = 0;
  v.recensementDuPoste = async () => {
    appels += 1;
    return { agents: [], resume: 'rien' };
  };
  const rendu = await v.traiterGeste({ geste: 'recensement' });
  assert.equal(appels, 1, 'le geste doit atteindre le recensement, pas répondre « geste inconnu »');
  assert.ok(rendu.resume, 'et il rend le compte rendu tel quel');
});

test('le geste RECENSE à la demande — il ne ressert pas la mesure du dernier tour', async () => {
  const v = veilleurNu('frais');
  let appels = 0;
  v.recensementDuPoste = async () => ({ appel: ++appels });
  const un = await v.traiterGeste({ geste: 'recensement' });
  const deux = await v.traiterGeste({ geste: 'recensement' });
  // ⚠️ UNE PHOTO QUI PÉRIME SANS LE DIRE EST LE DÉFAUT D'ORIGINE. Rendre le dernier tour ferait
  // répondre « qui est à jour » avec l'état d'avant la publication qu'on vient de faire.
  assert.notDeepEqual(un, deux, 'chaque interrogation doit MESURER, pas relire');
});

test('deux rondes ne se chevauchent pas — la cadence est un intervalle, pas une horloge', async () => {
  const v = veilleurNu('chevauchement');
  let enCours = 0;
  let maxSimultanes = 0;
  v.recensementDuPoste = async () => {
    enCours += 1;
    maxSimultanes = Math.max(maxSimultanes, enCours);
    await new Promise((r) => setTimeout(r, 60));
    enCours -= 1;
    return {};
  };
  const minuteur = v.recenser(10);
  await new Promise((r) => setTimeout(r, 200));
  clearInterval(minuteur);
  assert.equal(maxSimultanes, 1, 'jamais deux rondes en vol');
});

test('une ronde qui jette ne tue pas le recenseur — il doit survivre à son propre échec', async () => {
  const v = veilleurNu('resilience');
  let passages = 0;
  v.recensementDuPoste = async () => {
    passages += 1;
    throw new Error('herdr injoignable');
  };
  const minuteur = v.recenser(10);
  await new Promise((r) => setTimeout(r, 120));
  clearInterval(minuteur);
  // Un recenseur qui meurt au premier tour raté est PIRE que pas de recenseur : il a l'air
  // installé, et le journal cesse simplement de porter des lignes que personne n'attend.
  assert.ok(passages >= 2, `le recenseur doit repasser après un tour en échec (${passages} passage(s))`);
});

test('le recensement s’arrête avec le veilleur — un intervalle qui lui survit tient le processus en vie', async () => {
  const v = veilleurNu('arret');
  let passages = 0;
  v.recensementDuPoste = async () => {
    passages += 1;
    return {};
  };
  // Un serveur factice : `arreter()` attend la fermeture du socket local, qu'un veilleur nu n'a
  // pas — sans lui, la promesse reste en vol et ce banc PEND au lieu d'échouer.
  v.serveur = { close: (rappel) => rappel() };
  v.recenser(10);
  await new Promise((r) => setTimeout(r, 60));
  await v.arreter();
  const apresArret = passages;
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(passages, apresArret, 'après `arreter()`, plus aucune ronde ne doit partir');
  assert.ok(apresArret > 0, 'et il faut qu’il y en ait eu AVANT — sinon ce banc ne prouve rien');
});

test('le câblage RÉEL du veilleur ne pose AUCUN geste sur aucun pane — le registre lit, il n’agit pas', async () => {
  const p = posteHerdr(bac, [], 'muet');
  const depot = join(bac, 'depot-muet');
  const lieu = join(depot, '.orchestrateur', 'd-20260819-0001');
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), "# Tu es l'orchestrateur de ce chantier\n\nvieux métier.\n");
  writeFileSync(join(lieu, 'CONTEXTE.md'), "# Ce qui est propre à ce dépôt\n\nrien.\n");
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  p.pane('w1:p1', { boite: '' });
  p.panes([{ pane_id: 'w1:p1', foreground_cwd: lieu }]);

  const v = veilleurNu('muet');
  const avant = { PATH: process.env.PATH, HOME: process.env.HOME, HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH };
  let rendu;
  try {
    process.env.PATH = p.path;
    process.env.FAUX_HERDR_ETAT = p.etat;
    // ⚠️ LE POSTE RÉEL EST MIS HORS DE PORTÉE, ET IL FAUT DIRE POURQUOI — mesuré en écrivant ce
    // banc. `panes()` agrège TOUTES les sessions herdr trouvées sous le répertoire personnel :
    // exécuté tel quel, ce banc voyait les treize sessions de la machine et rendait quatorze
    // fois le même lieu. Un `HOME` jetable ne laisse qu'une session — celle qu'on désigne.
    process.env.HOME = join(bac, 'foyer-jetable');
    process.env.HERDR_SOCKET_PATH = join(p.etat, 'socket');
    rendu = await v.recensementDuPoste();
  } finally {
    for (const [cle, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
    delete process.env.FAUX_HERDR_ETAT;
  }

  // Le banc doit d'abord prouver qu'il a VU quelque chose — sinon « aucun geste posé » serait
  // vrai pour la raison la plus banale du monde : le recensement n'a rien trouvé à faire.
  assert.ok(rendu.agents, `l’inventaire a refusé (${rendu.inventaireRefuse})`);
  assert.equal(rendu.agents.length, 1, 'le câblage réel doit trouver le lieu posé');
  // ⚠️ ET IL DOIT L'AVOIR RECONNU, pas seulement compté. Sans cette ligne, le banc resterait
  // vert le jour où le câblage cesserait de résoudre les rôles — il compterait un agent au rôle
  // « non établi » et se déclarerait satisfait.
  assert.equal(rendu.agents[0].role.nom, 'orchestrateur', 'le câblage réel ÉTABLIT le rôle');

  const gestes = p.appels().filter((a) => a[1] === 'prompt' || a[1] === 'send-keys' || a[1] === 'send-text');
  assert.deepEqual(gestes, [], 'AUCUN geste ne doit partir : un « /clear » spontané effacerait le fil d’un agent au travail');
});

test('le câblage RÉEL rend « refusée » sur un lieu qu’il n’a PAS PU LIRE — jamais « aucun rôle »', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // CE BANC EXISTE PARCE QU'UNE PASSE DE REVUE A TROUVÉ L'ÉTAT `refusée` INATTEIGNABLE.
  //
  // Le recensement rend le rôle en TROIS états : « établi », « non établi » (mesuré, aucun rôle
  // connu ne correspond) et « refusée » (le lieu ne s'est pas laissé lire). Le troisième existe
  // parce que les deux appellent des gestes OPPOSÉS : « non établi » envoie POSER un lieu,
  // « refusée » envoie REFAIRE LA MESURE. Classer un lieu complet mais illisible en « lieu à
  // demi posé » enverrait re-poser un lieu qui existe.
  //
  // ⚠️ ET IL PASSE PAR LE CÂBLAGE RÉEL, pas par un `roleDuLieu` injecté. Le banc de la mesure
  // (`le-recensement-porte-tous-les-roles`) éprouve ce troisième état contre un collaborateur
  // QUI JETTE — un double que le vrai code ne produisait pas. Il restait donc vert pendant que
  // l'état était structurellement hors d'atteinte en production. C'est le seul banc du dépôt
  // qui appelle la VRAIE fonction sur un VRAI lieu rendu illisible par ses permissions.
  const p = posteHerdr(bac, [], 'illisible');
  const depot = join(bac, 'depot-illisible');
  const lieu = join(depot, '.orchestrateur', 'd-20260822-0002');
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), "# Tu es l'orchestrateur de ce chantier\n\nun métier COMPLET.\n");
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n\nrien.\n');
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  chmodSync(join(lieu, 'CLAUDE.md'), 0o000);

  // ⚠️ LA MISE EN CONDITION SE PROUVE, ELLE NE SE SUPPOSE PAS. Sous un compte privilégié,
  // `chmod 000` n'empêche pas la lecture : le lieu redeviendrait lisible, le rôle s'établirait,
  // et ce banc rougirait en accusant le code d'un défaut qu'il n'a pas. On échoue ici, en
  // nommant la cause, plutôt que de laisser le verdict porter sur autre chose que sa question.
  let lectureRefusee = false;
  try {
    readFileSync(join(lieu, 'CLAUDE.md'), 'utf8');
  } catch {
    lectureRefusee = true;
  }
  assert.ok(
    lectureRefusee,
    `le fichier reste lisible malgré « chmod 000 » (uid ${process.getuid?.() ?? '?'}) — ce banc ne peut ` +
      'pas fabriquer sa condition sous un compte privilégié, et ne mesure donc rien',
  );

  p.pane('w1:p1', { boite: '' });
  p.panes([{ pane_id: 'w1:p1', foreground_cwd: lieu }]);

  const v = veilleurNu('illisible');
  const avant = { PATH: process.env.PATH, HOME: process.env.HOME, HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH };
  let rendu;
  try {
    process.env.PATH = p.path;
    process.env.FAUX_HERDR_ETAT = p.etat;
    process.env.HOME = join(bac, 'foyer-jetable-illisible');
    process.env.HERDR_SOCKET_PATH = join(p.etat, 'socket');
    rendu = await v.recensementDuPoste();
  } finally {
    for (const [cle, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
    delete process.env.FAUX_HERDR_ETAT;
    chmodSync(join(lieu, 'CLAUDE.md'), 0o600); // pour que le bac se laisse ranger
  }

  assert.ok(rendu.agents, `l’inventaire a refusé (${rendu.inventaireRefuse})`);
  assert.equal(rendu.agents.length, 1, 'l’agent n’est JAMAIS omis parce qu’on n’a pas su lire son lieu');
  const role = rendu.agents[0].role;
  assert.equal(
    role.mesure,
    'refusée',
    `le câblage réel doit dire « je n’ai pas pu lire », pas « aucun rôle » (rendu : ${JSON.stringify(role)})`,
  );
  assert.equal(role.nom, null, 'un lieu illisible n’établit aucun rôle');
  assert.match(role.raison ?? '', /ne s.est pas laissé lire/, 'la raison doit dire CE QUI a refusé');
  // ⚠️ ET LE COMPTE DOIT LE PORTER. Un état atteint dans une entrée mais absent du résumé se
  // perd : c'est le résumé qu'on lit.
  assert.equal(rendu.compte?.roleNonMesure, 1, 'le résumé compte les rôles qu’il n’a PAS PU mesurer');
});

test('le câblage RÉEL n’écarte PAS un agent que herdr a vu SANS nom — anonyme ≠ pas vu', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // MUTATION SURVIVANTE, TROUVÉE EN REVUE PORTAIL — et c'est le cœur déclaré de T-20260822-0011.
  //
  // `nomDeLAgent` distingue « vu, sans nom » (ANONYME → le faire se nommer) de « pas vu »
  // (NON MESURÉ → refaire la mesure). Son comportement unitaire est éprouvé — mais uniquement
  // contre un `nomsConnus` fabriqué à la main dans un banc. Le SEUL producteur réel de cette
  // forme est le veilleur, et il n'avait aucun banc : remettre le `.filter((a) => a.name)`
  // laissait les 805 essais VERTS.
  //
  // ⚠️ DEUX ÉTAGES JUSTES DONT LA JOINTURE N'EST PAS GARDÉE. Le filtre remis, les 34 agents
  // anonymes du poste basculeraient tous en « nom NON MESURÉ » : le registre enverrait refaire
  // une mesure qui a parfaitement réussi, et cesserait de dire qui est inadressable.
  const p = posteHerdr(bac, [{ pane_id: 'w1:p1', foreground_cwd: '/tmp/un-projet' }], 'sans-nom');
  p.pane('w1:p1', { boite: '' });
  p.panes([{ pane_id: 'w1:p1', foreground_cwd: '/tmp/un-projet' }]);

  const v = veilleurNu('sans-nom');
  const avant = { PATH: process.env.PATH, HOME: process.env.HOME, HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH };
  let rendu;
  try {
    process.env.PATH = p.path;
    process.env.FAUX_HERDR_ETAT = p.etat;
    process.env.HOME = join(bac, 'foyer-jetable-sans-nom');
    process.env.HERDR_SOCKET_PATH = join(p.etat, 'socket');
    rendu = await v.recensementDuPoste();
  } finally {
    for (const [cle, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
    delete process.env.FAUX_HERDR_ETAT;
  }

  assert.ok(rendu.agents, `l’inventaire a refusé (${rendu.inventaireRefuse})`);
  assert.equal(rendu.agents.length, 1, 'l’agent est recensé — un sans-nom n’est jamais omis');
  const nom = rendu.agents[0].nom;
  assert.equal(
    nom.mesure,
    'aucun',
    `herdr l’a VU sans nom : c’est un ANONYME, pas une mesure ratée (rendu : ${JSON.stringify(nom)})`,
  );
  assert.equal(nom.valeur, null, 'et son nom n’est jamais comblé depuis son mandat ou son lieu');
  assert.equal(rendu.compte.anonymes, 1, 'le compte le porte du bon côté…');
  assert.equal(rendu.compte.nomsNonMesures, 0, '…et surtout pas de l’autre');
});

test('le câblage RÉEL fournit une référence PAR RÔLE — un jeu vide tuerait la colonne « à jour »', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // MUTATION SURVIVANTE, TROUVÉE EN REVUE DE FOND ET RESTÉE VIVANTE APRÈS UN PREMIER CORRECTIF.
  //
  // Un banc éprouvait déjà que `unRecensement` réagit correctement à `references: {}`. Mais le
  // CÂBLAGE, lui, n'était gardé par rien : remplacer `referencesDesRoles({})` par `{}` dans le
  // veilleur laissait les 815 essais verts. Le registre bascule alors en « aucune référence ne
  // m'a été donnée » pour TOUS les rôles — c'est-à-dire que la colonne « à jour / en retard »
  // meurt en silence, en rendant partout « je ne sais pas », la réponse la plus rassurante
  // possible pour un instrument qui ne mesure plus rien.
  //
  // ⚠️ ÉPROUVER LA FONCTION NE GARDE PAS SON CÂBLAGE. C'est le même motif que les noms du
  // veilleur : deux étages justes, jointure non gardée.
  const p = posteHerdr(bac, [], 'references');
  const depot = join(bac, 'depot-references');
  const lieu = join(depot, '.orchestrateur', 'd-20260822-0003');
  const METIER = "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n";
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), METIER);
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n\nrien.\n');
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');

  // Le foyer jetable porte le gabarit du pack, là où `referenceDuPoste` va RÉELLEMENT le
  // chercher — c'est ce qui rend l'écart mesurable au lieu de « pas de référence ».
  const foyer = join(bac, 'foyer-references');
  const gabarits = join(foyer, '.claude', 'plugins', 'marketplaces', 'somtech-pack', '.claude', 'templates', 'orchestrateur');
  mkdirSync(gabarits, { recursive: true });
  writeFileSync(join(gabarits, 'CLAUDE.md'), METIER); // identique au lieu posé : donc « à jour »

  p.pane('w1:p1', { boite: '' });
  p.panes([{ pane_id: 'w1:p1', foreground_cwd: lieu }]);

  const v = veilleurNu('references');
  const avant = { PATH: process.env.PATH, HOME: process.env.HOME, HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH };
  let rendu;
  try {
    process.env.PATH = p.path;
    process.env.FAUX_HERDR_ETAT = p.etat;
    process.env.HOME = foyer;
    process.env.HERDR_SOCKET_PATH = join(p.etat, 'socket');
    rendu = await v.recensementDuPoste();
  } finally {
    for (const [cle, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
    delete process.env.FAUX_HERDR_ETAT;
  }

  assert.ok(rendu.agents, `l’inventaire a refusé (${rendu.inventaireRefuse})`);
  assert.equal(rendu.agents.length, 1);
  const a = rendu.agents[0];
  assert.equal(a.role.nom, 'orchestrateur', 'contrôle : le rôle est établi');
  // ⚠️ L'ÉCART EST RÉELLEMENT CALCULÉ — c'est ce qu'un jeu de références vide rendrait
  // impossible, en laissant `aJour: null` partout.
  assert.equal(a.aJour, true, `le câblage doit APPORTER la référence du rôle (reference: ${JSON.stringify(a.reference)})`);
  assert.equal(rendu.compte.aJour, 1, 'et le compte doit le porter');
  assert.equal(
    a.reference?.refus,
    undefined,
    'la référence du câblage réel est TROUVÉE, pas « on ne m’a rien donné »',
  );
});

test('le câblage RÉEL : un registre des noms EN PANNE ne fait perdre ni agents ni distinction', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // CE BANC A CHANGÉ DE SUJET EN COURS D'ÉCRITURE, ET LA MESURE QUI L'A FAIT CHANGER VAUT
  // D'ÊTRE INSCRITE.
  //
  // Deux passes de revue ont relevé que la branche `catch` du câblage des noms
  // (`veilleur.js`, `nomsConnus = { mesure: 'refusée', raison }`) n'était gardée par rien : la
  // remettre à `null` laissait tout vert. J'ai voulu la garder par le câblage réel — et j'ai
  // mesuré qu'elle est PRESQUE INATTEIGNABLE, pour une raison délibérée et documentée :
  //
  //   `herdr.agents()` sans socket AVALE l'échec de chaque session (« se contenter de la plus
  //   récente ferait conclure *cet agent est mort* pour tout agent vivant dans une autre
  //   session »). Une source de noms en panne rend donc `[]`, pas une exception. Le `catch` du
  //   veilleur n'est atteint que si herdr est ENTIÈREMENT injoignable — cas où `panes()` refuse
  //   aussi, où l'inventaire est refusé, et où aucune entrée n'est rendue : sa `raison` n'est
  //   alors lue par personne. C'est un MUTANT ÉQUIVALENT, pas une garde manquante, et le forcer
  //   par un double fabriquerait une garde sur un chemin que la production n'emprunte pas.
  //
  // Ce qui EST atteignable, et que ce banc garde : une source de noms en panne ne doit faire
  // perdre NI les agents, NI la distinction « pas vu » / « pas de nom ». C'est la conduite que
  // le lot revendique, et elle passe par un autre chemin que celui qu'on croyait.
  const p = posteHerdr(bac, [], 'noms-en-panne');
  p.pane('w1:p1', { boite: '' });
  p.panes([{ pane_id: 'w1:p1', foreground_cwd: '/tmp/un-projet' }]);
  // La source des noms est cassée pour de vrai : `agents.json` illisible.
  writeFileSync(join(p.etat, 'agents.json'), '{ ceci n’est pas du JSON');

  const v = veilleurNu('noms-en-panne');
  const avant = { PATH: process.env.PATH, HOME: process.env.HOME, HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH };
  let rendu;
  try {
    process.env.PATH = p.path;
    process.env.FAUX_HERDR_ETAT = p.etat;
    process.env.HOME = join(bac, 'foyer-jetable-noms');
    process.env.HERDR_SOCKET_PATH = join(p.etat, 'socket');
    rendu = await v.recensementDuPoste();
  } finally {
    for (const [cle, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
    delete process.env.FAUX_HERDR_ETAT;
  }

  assert.ok(rendu.agents, `l’inventaire a refusé (${rendu.inventaireRefuse})`);
  // ⚠️ LA MOITIÉ QUI COMPTE LE PLUS : on perd des NOMS, jamais des AGENTS. Un registre de noms
  // en panne qui ferait disparaître les agents transformerait une perte d'enrichissement en
  // perte d'inventaire — et le dirigeant lirait « personne ne travaille ».
  assert.equal(rendu.agents.length, 1, 'une source de noms en panne ne fait perdre AUCUN agent');
  const nom = rendu.agents[0].nom;
  assert.equal(nom.mesure, 'refusée', 'et le nom se dit NON MESURÉ…');
  assert.equal(nom.valeur, null, '…jamais comblé depuis le mandat ou le lieu');
  // ⚠️ ET SURTOUT PAS « aucun ». « pas vu » et « pas de nom » appellent des gestes opposés :
  // refaire la mesure d'un côté, faire se nommer l'agent de l'autre. C'est la distinction que
  // tout ce lot existe pour tenir, et c'est ici qu'une source en panne pourrait la faire tomber.
  assert.notEqual(nom.mesure, 'aucun', 'une source muette ne rend JAMAIS « il n’a pas de nom »');
  assert.equal(rendu.compte.nomsNonMesures, 1, 'le compte le porte du bon côté…');
  assert.equal(rendu.compte.anonymes, 0, '…et surtout pas de l’autre');
  assert.match(nom.raison ?? '', /n’a pas vu ce pane|SOUS-COMPTE/, 'et la raison dit que la source sous-compte');
});

test('herdr ENTIÈREMENT injoignable : le recensement REFUSE en le disant, il ne JETTE pas', async () => {
  // ⚠️ MUTATION SURVIVANTE, PUIS MESURE QUI CHANGE SON STATUT — et c'est la démarche qui compte
  // ici. J'ai d'abord cru la branche `catch` du câblage des noms équivalente : `herdr.agents()`
  // avale l'échec de chaque session, donc elle n'est atteinte que si herdr est ENTIÈREMENT
  // injoignable, cas où `panes()` refuse aussi. J'ai vérifié plutôt que de conclure — et les deux
  // rendus DIFFÈRENT :
  //
  //   • avec le `catch` : `recensementDuPoste()` rend `{ inventaireRefuse: "« herdr » n'a pas pu
  //     être lancé (ENOENT)…" }` — un refus NOMMÉ, que le geste `recensement` rend tel quel ;
  //   • sans lui : la méthode JETTE, et l'appelant reçoit une exception au lieu d'un diagnostic.
  //
  // Un refus qu'on peut lire et une exception ne sont pas la même chose pour celui qui interroge
  // le registre : le premier dit CE QUI a manqué, le second dit seulement que ça a cassé. Ce
  // n'était donc pas un mutant équivalent, et ce banc le garde.
  const v = veilleurNu('herdr-absent');
  const avant = { PATH: process.env.PATH, HOME: process.env.HOME, HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH };
  let rendu;
  let jete = null;
  try {
    // Aucun herdr nulle part : ni dans le PATH, ni sous le foyer, ni au socket désigné.
    process.env.PATH = '/nonexistent';
    process.env.HOME = join(bac, 'foyer-sans-herdr');
    process.env.HERDR_SOCKET_PATH = '/nonexistent/socket';
    rendu = await v.recensementDuPoste();
  } catch (err) {
    jete = err?.message ?? String(err);
  } finally {
    for (const [cle, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
  }

  assert.equal(jete, null, `le recensement ne doit JAMAIS jeter : l’appelant doit pouvoir LIRE le refus (${jete})`);
  assert.ok(rendu.inventaireRefuse, 'et le refus est NOMMÉ, pas laissé vide');
  assert.match(rendu.inventaireRefuse, /herdr/, 'il dit ce qui n’a pas répondu');
  // ⚠️ ET RIEN DANS LE RENDU NE SE LIT « RIEN À SIGNALER ». Un inventaire refusé qui rendrait
  // `agents: []` serait indiscernable d'un poste vide — le pire mensonge que ce registre puisse
  // faire, puisqu'il se lit comme un succès.
  assert.notDeepEqual(rendu.agents, [], 'un inventaire refusé ne rend jamais une liste VIDE');
});

test('les DEUX ceintures d’arrêt ne peuvent pas tomber ensemble — mesuré, chacune est invisible seule', async () => {
  // ⚠️ CE BANC EXISTE PARCE QU'UNE MUTATION A SURVÉCU. `arreter()` retient la ronde de deux
  // façons : il pose `this.arrete`, et il libère le minuteur. Retirer l'une OU l'autre ne fait
  // rougir aucun banc — chacune couvre l'autre. Le banc d'au-dessus prouve donc « au moins une
  // des deux tient », ce qui est vrai mais moins que ce qu'on croit lire.
  //
  // Celui-ci prouve la propriété qui compte VRAIMENT et qui ne dépend d'aucune des deux
  // implémentations : après un arrêt, un veilleur ne recense plus, même si son minuteur a
  // survécu. On l'éprouve en désarmant `clearInterval` — le minuteur continue donc de battre —
  // et en vérifiant que rien ne part quand même.
  const v = veilleurNu('deux-ceintures');
  let passages = 0;
  v.recensementDuPoste = async () => {
    passages += 1;
    return {};
  };
  v.serveur = { close: (rappel) => rappel() };
  const minuteur = v.recenser(10);
  await new Promise((r) => setTimeout(r, 60));
  assert.ok(passages > 0, 'il faut que la ronde ait tourné AVANT — sinon ce banc ne prouve rien');

  await v.arreter();
  // On RÉARME le minuteur derrière l'arrêt : c'est la mutation, jouée par le banc lui-même.
  const rearme = setInterval(() => {
    if (v.arrete || v.recensementEnCours) return;
    v.recensementEnCours = true;
    v.recensementDuPoste().finally(() => {
      v.recensementEnCours = false;
    });
  }, 10);
  const apresArret = passages;
  await new Promise((r) => setTimeout(r, 80));
  clearInterval(rearme);
  clearInterval(minuteur);

  assert.equal(passages, apresArret, 'même avec un minuteur survivant, un veilleur arrêté ne recense plus');
});

test('un tour qui PEND n’éteint pas la ronde — sans ce garde-fou, elle meurt en silence', async () => {
  // ⚠️ RELEVÉ EN PASSE DE REVUE DE FOND, et c'est le pire mode de panne de ce dispositif. Les
  // appels à `herdr` n'ont pas de délai propre : un socket VIVANT MAIS MUET fait pendre la
  // promesse pour toujours. Sans course contre une horloge, ni le `catch` ni le `finally` ne
  // s'exécutent — `recensementEnCours` reste `true`, et plus AUCUN tour ne part. La ronde
  // s'éteint sans une ligne d'erreur : indiscernable d'un dispositif mort.
  //
  // Le banc « une ronde qui jette » ne l'attrape pas : une promesse rejetée se résout, une
  // promesse qui pend, non. Ce sont deux pannes différentes, et une seule était gardée.
  const v = veilleurNu('qui-pend');
  // Le serveur factice : `arreter()` attend la fermeture du socket local, qu'un veilleur nu n'a
  // pas — sans lui, ce banc PEND au lieu d'échouer, ce qui serait une jolie ironie ici.
  v.serveur = { close: (rappel) => rappel() };
  let departs = 0;
  const journal = [];
  v.recensementDuPoste = () => {
    departs += 1;
    return new Promise(() => {}); // ne se résout JAMAIS
  };
  const minuteur = v.recenser(10, { delaiMaxMs: 40, journaliser: (m) => journal.push(m) });
  await new Promise((r) => setTimeout(r, 220));
  clearInterval(minuteur);
  await v.arreter().catch(() => {});

  assert.ok(departs >= 2, `la ronde doit repartir après un tour qui pend (${departs} départ(s))`);
  // ⚠️ ET L'ABANDON SE DIT : un tour abandonné muet ferait lire un journal qui saute des tours
  // sans raison, et chercher la panne du mauvais côté.
  assert.ok(
    journal.some((l) => /ABANDONN/i.test(l)),
    'l’abandon doit être journalisé'
  );
  assert.ok(
    journal.some((l) => /n’est PAS « aucun orchestrateur »|PAS « aucun orchestrateur »/.test(l)),
    'et il ne doit jamais pouvoir se lire « aucun orchestrateur »'
  );
});
