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
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
