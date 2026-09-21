// UNE BOÎTE OCCUPÉE NE COUPE PLUS LA PAROLE DU DIRIGEANT (T-20260818-0049).
//
// ⚠️ CONVERTI PAR D-20260921-0003 — LIRE CECI AVANT TOUT LE RESTE. Le rattrapage que ce fichier
// éprouvait (« on soumet le texte de l'autre, puis on écrit ») est ÉTEINT : la délivrance ne soumet
// plus JAMAIS la boîte d'autrui (ordre du dirigeant : « je veux que ça cesse » — une de ses phrases est
// partie coupée, deux fois, le 2026-09-21). Devant une boîte occupée, `remettre` refuse donc de
// nouveau, mais avec une cause NOMMÉE (`soumission-interdite`) : aucune touche d'envoi, aucune
// écriture, le texte de l'autre reste où son auteur l'a laissé. Les essais ci-dessous gardent ce
// qu'ils protégeaient d'AUTRE que la soumission — la fenêtre d'observation, le dialogue apparu pendant
// l'attente, les textes jamais fusionnés — et n'exigent plus que la parole PASSE : elle ne passe pas, et
// le refus le dit. L'historique du défaut d'origine (2026-08-18) reste ci-dessous, tel qu'écrit.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT, DANS LES MOTS DU DIRIGEANT
//
//   « je reçois ce message de espace client ça marche pas votre solution ça me bloque et je
//     dois me connecter sur terminal et même débloqué je peux plus parler avec lui »
//   « c un vrai problème tout le monde est bloqué »
//   « là les boîtes occupées on fait un Enter dessus sinon ça part jamais »
//
// ⚠️ CE N'EST PAS UNE GARDE TROP ZÉLÉE : C'EST UNE MOITIÉ LIVRÉE. Mesuré le 2026-08-18 :
//
//   • `1dae9c7` (T-20260817-0006, v1.63.0) a posé le VETO ici — `remettre()` lève quand la
//     boîte du destinataire porte déjà un texte. Avant lui, elle écrivait sans rien regarder.
//   • `eceba2e` (T-20260816-0114, v1.63.0) a livré le REMÈDE le même jour — attendre, relire,
//     et SOUMETTRE le texte coincé pour son auteur.
//   • Mais le remède vit dans `naissance-representant/src/livraison.js` et n'est appelé que par
//     `livrer.js`, `rendez-vous.js`, `naitre.js`. **Jamais par ce chemin-ci.**
//
// Le chemin par lequel arrive la parole du dirigeant a donc reçu le veto sans le rattrapage.
// C'est pour ça qu'il doit ouvrir un terminal : le refus lui-même le lui dit.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA RÈGLE QU'IL A POSÉE, ET QUI COMMANDE LA FORME DU REMÈDE
//
//   « On ne doit jamais être bloqué via le Slack. Sinon on est pris. »
//
// Une garde sur un canal de parole AVERTIT — elle ne coupe pas. On ne retire pas la mesure,
// on retire le VETO : le diagnostic reste, la conséquence change.
//
// ⚠️ ET LE DISCRIMINANT QUI ÉVITE DE CASSER CE QUE LA GARDE PROTÉGEAIT. Soumettre n'est sans
// risque que pour un texte qu'un AGENT a collé — il a déjà été envoyé par quelqu'un qui croit
// l'avoir remis, donc le soumettre n'invente rien, ça achève un geste commencé. Un texte TAPÉ
// par un humain interrompu au milieu d'une phrase ne se soumet pas : le geste ne se défait pas.
// Les deux se distinguent à l'écran — un texte collé se replie en `[Pasted text #N]`, un texte
// tapé se lit entier. `estUnEspaceReserve` porte déjà cette lecture (`boite.js`).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let bac;
let pathOriginal;

/**
 * Un faux herdr piloté PAR LE GESTE, jamais par un compteur de lectures.
 *
 * ⚠️ C'EST LA LEÇON D'UN BANC QUI NE POUVAIT PAS ÉCHOUER, relevée dans ce dépôt même
 * (T-20260817-0008) : un double qui vide la boîte au n-ième `read` la vide AVANT que le
 * correctif n'agisse, et l'essai passe au vert sur un code qui ne fait rien. Ici, la boîte
 * ne se vide que si un `send-keys Enter` est RÉELLEMENT parti.
 *
 * @param occupePar  le texte déjà coincé dans la boîte d'autrui (ce que le dirigeant subit)
 * @param sourd      si vrai, la touche d'envoi ne libère jamais la boîte
 */
function fauxHerdr({ occupePar = '', sourd = false } = {}) {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const OCCUPE = ${JSON.stringify(occupePar)};
const SOURD = ${JSON.stringify(sourd)};

// Le geste, jamais le compteur : la boîte se vide quand — et seulement quand — Entrée est parti.
const entrees = passes.filter((a) => a[0] === 'agent' && a[1] === 'send-keys').length;
const prompts = passes.filter((a) => a[0] === 'agent' && a[1] === 'prompt');

if (cmd === 'agent read') {
  let boite = '';
  if (OCCUPE && (SOURD || entrees === 0)) boite = OCCUPE;          // le texte d'autrui, coincé
  else if (prompts.length && (SOURD || entrees < 2)) boite = '';    // notre texte : prompt le soumet
  process.stdout.write(['~/un-chantier', SEP, '\\u276f ' + boite, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') {
  process.stdout.write(JSON.stringify({ result: { agent: { agent_status: entrees ? 'working' : 'idle' } } }));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'working' } } }));
  process.exit(0);
}
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  return journal;
}

const appels = (journal) =>
  readFileSync(journal, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'ld-boite-occupee-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
  // Le cas COLLÉ ne doit rien attendre ; on borne le cas TAPÉ pour que le banc reste court.
  process.env.LIGNE_IMMOBILITE_MS = '60';
});
after(() => {
  process.env.PATH = pathOriginal;
  delete process.env.LIGNE_IMMOBILITE_MS;
  rmSync(bac, { recursive: true, force: true });
});

// ═══ LE ROUGE QUI PORTE LE DÉFAUT ══════════════════════════════════════════════════════

test('UNE BOÎTE OCCUPÉE PAR UN TEXTE COLLÉ REFUSE, NOMMÉMENT — on ne soumet pas la boîte d’un autre, on n’écrit pas par-dessus', async () => {
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  // Le texte exact que le dirigeant a vu dans son refus, le 2026-08-18.
  const journal = fauxHerdr({ occupePar: '[Pasted text #83 +7 lines]' });

  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant, reçu par Slack.'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err?.name}`);
      // ⚠️ LA CAUSE NOMMÉE, pas seulement un refus : un `remettre` qui n'aurait plus de délivrance du tout
      // refuserait aussi — mais pour une autre raison, que l'expéditeur ne saurait pas lire.
      assert.match(err.message, /on ne soumet JAMAIS/i, `le refus doit nommer la règle — reçu : ${err.message}`);
      assert.ok(err.message.includes('w5:p8'), 'et le pane');
      return true;
    }
  );

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(gestes.includes('agent read'), 'la boîte a bien été OBSERVÉE — sinon l’absence de geste ne prouve rien');
  assert.ok(!gestes.includes('agent send-keys'), 'la boîte d’autrui ne doit JAMAIS être soumise');
  assert.ok(!gestes.includes('agent prompt'), 'et notre message n’est pas écrit par-dessus : ils partiraient collés');
});

test('LES DEUX TEXTES NE SONT JAMAIS FUSIONNÉS — c’est ce que la garde protégeait', async () => {
  // ⚠️ CET ESSAI A ÉTÉ CORRIGÉ SUR REJET D'UNE PASSE DE REVUE DE FOND (le 2026-08-18) : ce qu'il faut
  // interdire n'est pas « un caractère de plus », c'est LA FUSION DE DEUX AUTEURS — le texte d'un tiers
  // abouté au nôtre, partant comme un seul message que personne n'a écrit ensemble.
  //
  // ⚠️ CONVERTI PAR D-20260921-0003 : la fusion était évitée en soumettant d'abord le texte du tiers.
  // Elle l'est maintenant en n'écrivant RIEN. Aucun `prompt` ne part, donc aucun message — fusionné ou
  // non — ne peut partir ; et le refus dit pourquoi (`soumission-interdite`), sinon l'expéditeur croit
  // avoir parlé.
  const journal = fauxHerdr({ occupePar: '[Pasted text #83 +7 lines]' });
  const { remettre } = await import('../src/herdr.js');

  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant, reçu par Slack.'),
    (err) => /on ne soumet JAMAIS/i.test(err.message)
  );

  const tous = appels(journal);
  const ecrits = tous.filter((a) => a[0] === 'agent' && a[1] === 'prompt');
  assert.equal(ecrits.length, 0, 'AUCUN message écrit : ni le nôtre seul, ni le nôtre abouté à celui du tiers');
  assert.ok(
    !tous.some((a) => a[0] === 'agent' && a[1] === 'send-keys'),
    'et la touche d’envoi n’est pas partie : le texte du tiers reste dans SA boîte, séparé du nôtre'
  );
});

// ═══ LA MOITIÉ QUI PROTÈGE — ces essais doivent rester verts après le correctif ═════════

test('UNE PHRASE QUE QUELQU’UN EST EN TRAIN DE TAPER N’EST PAS SOUMISE À SA PLACE', async () => {
  // ⚠️ QUATRIÈME FORME DE CET ESSAI, ET CHAQUE RÉÉCRITURE A ÉTÉ APPRISE, PAS CHOISIE.
  //   1. boîte que rien ne libérait → le refus tombait pour une autre raison ;
  //   2. texte changeant à chaque LECTURE → il mesurait les lectures, pas le temps ;
  //   3. refus instantané sur tout texte tapé → **il laissait le dirigeant PRIS** : « va voir
  //      l'écran » n'est pas un geste qu'on pose depuis Slack ;
  //   4. celle-ci — ce qui protège n'est pas le TYPE du texte, c'est qu'il BOUGE. Un texte
  //      tapé et immobile signifie que son auteur est parti : on le soumet, et on prévient.
  //      Un texte qui bouge signifie que quelqu'un est là : on s'abstient, et il le fera.
  //
  // C'est la seule forme où la garde protège une personne réelle sans en emmurer une autre.
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const marqueur = join(bac, 'premiere-lecture-tape');
  try { rmSync(marqueur); } catch { /* premier passage */ }
  // ⚠️ CE RÉGLAGE A ÉTÉ CORRIGÉ PARCE QU'UNE MUTATION LUI SURVIVAIT (T-20260818-0049).
  //
  // Le seuil du double valait 40 ms — MOINS que le temps d'un appel à herdr, qui lance un
  // processus (mesuré : ~150 ms). Le texte « bougeait » donc de lui-même, fenêtre ou pas, et
  // condamner la fenêtre d'observation ne faisait rougir personne. Le banc mesurait la latence
  // du poste, pas la garde — exactement le défaut qu'il est censé traquer chez les autres.
  //
  // Le seuil doit être AU-DESSUS de la latence naturelle et EN DESSOUS de la fenêtre :
  // sans fenêtre, on relit trop tôt pour voir bouger → on soumet → l'essai rougit ;
  // avec la fenêtre, on relit après → on voit bouger → on s'abstient.
  const SEUIL_MOUVEMENT_MS = 800;
  const fenetreAvant = process.env.LIGNE_IMMOBILITE_MS;
  process.env.LIGNE_IMMOBILITE_MS = '1500';
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const MARQUEUR = ${JSON.stringify(marqueur)};
const args = process.argv.slice(2);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
if (cmd === 'agent read') {
  // LE TEMPS, PAS LE COMPTE : la phrase ne s'allonge qu'une fois la fenêtre d'observation
  // écoulée. Quelqu'un tape. Sans fenêtre, on ne le verrait jamais.
  let t0;
  try { t0 = Number(fs.readFileSync(MARQUEUR, 'utf8')); }
  catch { t0 = Date.now(); fs.writeFileSync(MARQUEUR, String(t0)); }
  const phrase = 'je reprends la migration demain matin si' + (Date.now() - t0 >= ${SEUIL_MOUVEMENT_MS} ? ' tu confirmes' : '');
  process.stdout.write(['~/x', SEP, '\\u276f ' + phrase, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant.'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err?.name}`);
      assert.ok(err.message.includes('w5:p8'), 'le refus nomme le pane');
      // ⚠️ ON EXIGE LA BONNE CAUSE, PAS SEULEMENT UN REFUS — et c'est ce qui manquait.
      //
      // La forme précédente de cet essai n'exigeait qu'un rejet nommant le pane. Or son double
      // était CASSÉ (une interpolation non résolue laissait « \${SEUIL_MOUVEMENT_MS} » dans le
      // script généré) : herdr plantait, l'écran devenait illisible, et le refus tombait pour
      // « je n'ai pas su lire l'écran ». L'essai passait — sur un chemin qui n'a rien à voir
      // avec ce qu'il prétend éprouver, et la mutation de la fenêtre lui survivait.
      //
      // Un refus n'est une preuve que si c'est LE refus qu'on attendait.
      assert.match(
        err.message,
        /BOUG/i,
        `le refus doit porter sur le MOUVEMENT du texte, pas sur autre chose — reçu : ${err.message}`
      );
      return true;
    }
  );

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  // ⚠️ LA PREUVE QUE LE DOUBLE A RÉPONDU. Deux assertions NÉGATIVES ne prouvent rien si rien
  // n'a eu lieu : un double mort les satisfait toutes les deux. On exige donc d'abord que la
  // boîte ait été lue PLUSIEURS fois — c'est-à-dire qu'on ait réellement observé.
  const lectures = gestes.filter((g) => g === 'agent read').length;
  assert.ok(lectures >= 2, `la boîte doit avoir été OBSERVÉE — vu ${lectures} lecture(s)`);
  assert.ok(
    !gestes.includes('agent send-keys'),
    'ON NE SOUMET PAS la phrase de quelqu’un qui est en train de la taper — le geste ne se défait pas'
  );
  assert.ok(
    !gestes.includes('agent prompt'),
    'et on n’écrit pas par-dessus : les deux textes partiraient collés en un seul message'
  );
  process.env.LIGNE_IMMOBILITE_MS = fenetreAvant;
});

test('UNE BOÎTE QU’ON N’A PAS LIBÉRÉE NE REÇOIT RIEN — on n’écrit pas par-dessus, jamais', async () => {
  // ⚠️ RÉÉCRIT LUI AUSSI APRÈS UNE MUTATION SURVIVANTE. Sa première forme n'exigeait qu'un
  // échec — or l'échec tombait de toute façon plus bas, donc condamner le refus de délivrance
  // ne le faisait pas rougir. Ce qui compte n'est pas QU'ON ÉCHOUE, c'est QU'ON N'AIT PAS ÉCRIT :
  // écrire par-dessus un texte qu'on n'a pas pu libérer, c'est la FUSION — le défaut même que
  // la garde de v1.63.0 était venue fermer. Un correctif qui la rouvrirait aurait tourné en rond.
  const journal = fauxHerdr({ occupePar: '[Pasted text #83 +7 lines]', sourd: true });
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');

  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant.'),
    (err) => err instanceof RemiseEchouee && /on ne soumet JAMAIS/i.test(err.message) // ⚠️ D-20260921-0003 : la cause est nommée, même sur une boîte « sourde »
  );

  const ecrits = appels(journal).filter((a) => a[0] === 'agent' && a[1] === 'prompt');
  assert.equal(
    ecrits.length,
    0,
    'AUCUNE écriture : la boîte porte encore le texte d’autrui, y écrire collerait les deux en un seul message'
  );
});

test('UNE BOÎTE LIBRE NE PAIE AUCUNE TOUCHE EN PLUS — on ne délivre que ce qui bloque', async () => {
  const journal = fauxHerdr({ occupePar: '' });
  const { remettre } = await import('../src/herdr.js');

  await remettre('w5:p8', 'coucou');

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(!gestes.includes('agent send-keys'), 'rien à délivrer : la touche d’envoi ne part pas');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE SECOND DÉFAUT, ET C'EST CELUI QUE LE DIRIGEANT DÉCRIT EN DERNIER (T-20260818-0049)
//
//   « là les boîtes de texte ne se vident pas sur les fenêtres herdr et c'est vraiment un
//     très gros problème »
//
// Sa formulation déplace le sujet d'un cran, et elle a raison de le faire : le symptôme n'est
// pas le refus, c'est que LE TEXTE RESTE. Mesuré dans le code : `remettre()` SOUMET bien ce
// qu'elle écrit — `agent prompt` soumet, et si le texte reste elle envoie la touche d'envoi.
// L'hypothèse « elle écrit seulement » est donc écartée.
//
// ⚠️ MAIS ELLE NE RELIT QU'UNE FOIS, IMMÉDIATEMENT. Une touche d'envoi part, une seule lecture
// suit, sans un instant d'attente — et si le terminal n'a pas encore traité la touche, le refus
// tombe : « le message est resté dans la boîte de saisie — il n'a pas été soumis ». C'est le
// message EXACT que le dirigeant a reçu, et il peut être FAUX : la touche avait pu marcher.
//
// Une lecture unique ne dit rien quand le système retarde. `delivrerLaBoite`, à côté, relit
// jusqu'à `essais` fois en dormant entre deux — parce qu'une boîte ne se vide pas dans
// l'instant. Ici, rien. C'est la même asymétrie que le lot principal : le savoir-faire existait
// dans un module et manquait dans l'autre.

test('LA BOÎTE A LE TEMPS DE SE VIDER — une lecture unique ne dit rien quand le terminal retarde', async () => {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  // Le double reproduit le RETARD : après Entrée, la boîte reste pleine à la première
  // relecture et ne se vide qu'à la suivante. Piloté par le GESTE et le compte de lectures
  // POSTÉRIEURES à l'envoi — jamais par un compteur global, qui viderait la boîte trop tôt.
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const iEnter = passes.findIndex((a) => a[1] === 'send-keys');
const promptFait = passes.some((a) => a[1] === 'prompt');
// Combien de fois a-t-on relu DEPUIS la touche d'envoi ?
const luesDepuisEnter = iEnter === -1 ? 0 : passes.slice(iEnter).filter((a) => a[1] === 'read').length;

if (cmd === 'agent read') {
  // Notre texte reste collé après le prompt ; la touche d'envoi le libère, mais SEULEMENT à
  // partir de la deuxième relecture — le terminal a mis un instant à traiter la touche.
  const reste = promptFait && (iEnter === -1 || luesDepuisEnter < 1) ? 'notre message' : '';
  process.stdout.write(['~/x', SEP, '\\u276f ' + reste, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre } = await import('../src/herdr.js');
  // AVANT LE CORRECTIF : une seule relecture, immédiate, et le refus tombe alors que la touche
  // d'envoi avait marché. Le dirigeant reçoit « il n'a pas été soumis » sur un message soumis.
  const preuve = await remettre('w5:p8', 'notre message');
  assert.ok(preuve, 'la remise doit aboutir : la touche d’envoi a marché, il fallait laisser le temps de le voir');

  const lectures = appels(journal).filter((a) => a[1] === 'read').length;
  const enter = appels(journal).filter((a) => a[1] === 'send-keys').length;
  assert.equal(enter, 1, 'UNE SEULE touche d’envoi — on ne matraque pas la boîte');
  assert.ok(lectures >= 3, `la boîte doit être relue plusieurs fois après la touche — vu ${lectures} lectures`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CONTRÔLE QUE LE DIRIGEANT DEMANDE — et c'est le vrai livrable (T-20260818-0049)
//
//   « Ok on doit enlever le blocage commencer et mettre un contrôle pour s'assurer que les
//     messages sont bien soumis. »
//
// Son ordre est meilleur que celui qu'on poussait. On cherchait à garder le veto en le
// doublant d'un rattrapage ; lui renverse : on ne refuse plus, et on VÉRIFIE QUE ÇA PART.
// C'est plus sûr, parce que ça s'attaque à la cause au lieu de gérer la conséquence — si
// chaque message est soumis, une boîte ne se remplit pas, et le veto n'a plus d'objet.
//
// ⚠️ ET LE CONTRÔLE PORTE SUR NOTRE PROPRE TEXTE, PAS SEULEMENT SUR CELUI D'AUTRUI. C'est la
// moitié qui a manqué à `v1.63.0` : on a appris à refuser d'écrire sur le texte d'un autre
// avant d'avoir appris à constater que le nôtre était parti.
//
// ⚠️ CE QUI N'EST PAS UNE PREUVE : `ok: true`, « la boîte était libre », le code de sortie de
// la touche d'envoi. La seule preuve admise est que LE TEXTE N'EST PLUS DANS LA BOÎTE.

test('NOTRE PROPRE TEXTE ÉCRIT ET NON SOUMIS FAIT ÉCHOUER LA REMISE — jamais un « ok » dessus', async () => {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  // La boîte était LIBRE — donc aucun veto, aucune délivrance : on écrit. Et notre texte reste,
  // quoi qu'on fasse. C'est le mode de panne que le dirigeant décrit : « ça ne part jamais ».
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const promptFait = passes.some((a) => a[1] === 'prompt');
if (cmd === 'agent read') {
  process.stdout.write(['~/x', SEP, '\\u276f ' + (promptFait ? 'notre message qui ne part jamais' : ''), SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  await assert.rejects(
    () => remettre('w5:p8', 'notre message qui ne part jamais'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err?.name}`);
      assert.match(err.message, /pas été soumis/i, 'le refus doit dire que le message n’est PAS parti');
      return true;
    },
    'un message écrit et jamais soumis ne doit JAMAIS rendre un succès — l’émetteur croirait avoir parlé'
  );

  // ET LA TOUCHE D'ENVOI A BIEN ÉTÉ TENTÉE : on ne se contente pas de constater l'échec, on
  // essaie d'abord de le lever. Un contrôle qui ne fait que refuser laisserait le dirigeant
  // exactement où il était.
  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(gestes.includes('agent send-keys'), 'on tente la touche d’envoi avant de renoncer');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// « IL RESTE PRIS » — LA MOITIÉ QUE LE REFUS INSTANTANÉ LAISSAIT OUVERTE (T-20260818-0049)
//
// Le refus qui suit un texte TAPÉ nomme le pane et le geste. Il est actionnable — POUR
// QUELQU'UN QUI EST DEVANT LE TERMINAL. Or celui qui l'attend est sur Slack, souvent au
// téléphone. Mesuré, mot pour mot, ce qu'il recevait :
//
//   « Je n'ai pas pu remettre ton message […] Le geste : va voir l'écran
//     (« herdr agent focus w5:p8 »), et renvoie ton message. »
//
// **Il ne peut pas.** Le refus était juste, nommé, instantané — et il le laissait exactement
// où il était. C'est « une porte sur deux » posée par le correctif qui ferme la première.
//
// ⚠️ SA CONSIGNE, ET ELLE TRANCHE : « je dois pouvoir débloquer en écrivant un message, ça va
// lancer les deux messages ». Donc même devant un texte tapé, son message doit PARTIR.
//
// LA FORME QUI HONORE LES DEUX. On ne refuse plus d'emblée : on OBSERVE brièvement.
//   • le texte BOUGE → quelqu'un a les doigts sur le clavier, il soumettra lui-même dans
//     quelques secondes. On s'abstient, on le dit, et l'état se résout tout seul. Ce n'est pas
//     « être pris » : c'est transitoire, nommé, et le prochain message passe.
//   • le texte est IMMOBILE → son auteur est parti. On le soumet, ET ON PRÉVIENT LE
//     DESTINATAIRE de ce qui est parti en son nom. L'incident devient CONSTATABLE au lieu
//     d'être inexplicable — c'est ce qui rend le geste réparable.

test('UN TEXTE TAPÉ ET IMMOBILE N’EST PAS SOUMIS NON PLUS — le message ne part pas, et le refus le dit', async () => {
  // ⚠️ CONVERTI PAR D-20260921-0003. Ce texte-là était le cas où la soumission passait pour sûre
  // (« son auteur est parti ») ; le dirigeant a tranché que ça ne l'est jamais. Il reste éprouvé que
  // la fenêtre est observée (le texte est lu plusieurs fois) et que le refus est NOMMÉ.
  const journal = fauxHerdr({ occupePar: 'je reprends la migration demain matin si' });
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');

  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant, reçu par Slack.'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err?.name}`);
      assert.match(err.message, /on ne soumet JAMAIS/i, `la cause nommée — reçu : ${err.message}`);
      return true;
    }
  );

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(gestes.filter((g) => g === 'agent read').length >= 2, 'le texte a bien été OBSERVÉ avant le refus');
  assert.ok(!gestes.includes('agent send-keys'), 'le texte immobile n’est PAS soumis pour son auteur');
  assert.ok(!gestes.includes('agent prompt'), 'et la parole n’est pas écrite par-dessus');
});

test('AUCUN AVIS NE PART POUR UN GESTE QUI N’A PAS EU LIEU — le refus dit ce qui est resté dans la boîte', async () => {
  // ⚠️ CONVERTI PAR D-20260921-0003. L'avis « votre boîte était bloquée, un texte est parti sous votre
  // signature » voyageait avec le message livré. Il n'y a plus de geste, donc plus de message ni d'avis :
  // annoncer un texte soumis qui ne l'a pas été serait mentir. Ce qui remplace l'avis est le REFUS fait à
  // l'expéditeur : il nomme la règle, et il cite ce qui est resté dans la boîte, pour qu'on sache où aller.
  const journal = fauxHerdr({ occupePar: '[Pasted text #83 +7 lines]' });
  const { remettre } = await import('../src/herdr.js');

  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant, reçu par Slack.'),
    (err) => {
      assert.match(err.message, /on ne soumet JAMAIS/i, 'la règle est nommée');
      assert.match(err.message, /\[Pasted text #83/, 'et ce qui est resté dans la boîte est CITÉ');
      assert.doesNotMatch(err.message, /a été soumis pour son auteur/, 'aucune soumission n’est annoncée');
      return true;
    }
  );

  const ecrits = appels(journal).filter((a) => a[0] === 'agent' && a[1] === 'prompt');
  assert.equal(ecrits.length, 0, 'rien n’est écrit, donc aucun avis « BOÎTE DE SAISIE ÉTAIT BLOQUÉE » ne voyage');
});

test('UNE LIVRAISON ORDINAIRE NE PORTE PAS UN MOT DE PLUS — on n’annonce pas un incident qui n’a pas eu lieu', async () => {
  const journal = fauxHerdr({ occupePar: '' });
  const { remettre } = await import('../src/herdr.js');

  await remettre('w5:p8', 'coucou');

  const ecrits = appels(journal).filter((a) => a[0] === 'agent' && a[1] === 'prompt');
  assert.equal(ecrits[0][3], 'coucou', 'rien n’a bloqué : le message part seul, sans avis');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA TROISIÈME MOITIÉ MANQUANTE — L'AVIS DE PERTE (T-20260818-0049)
//
// ⚠️ RELEVÉ PAR UNE PASSE DE REVUE FRAÎCHE, QUI A REJETÉ, et le rejet était juste. C'est la
// TROISIÈME fois dans ce lot qu'une moitié reste derrière — et cette fois dans le correctif
// écrit pour fermer les deux premières.
//
//   • le GESTE (`delivrerLaBoite`) a suivi ;
//   • l'avis de BOÎTE BLOQUÉE a suivi ensuite, sur rejet d'une première revue ;
//   • l'avis de BOÎTE VIDÉE, lui, était resté.
//
// CE QUE CETTE ISSUE SIGNIFIE, et pourquoi elle n'est pas un cas limite. Après l'attente, la
// boîte peut être trouvée VIDE — ni immobile, ni changée. Deux causes, et on n'en connaît
// aucune : soit son auteur l'a soumise pendant qu'on regardait (bénin, et `delivrance.js`
// documente que c'est LE CAS MAJORITAIRE), soit le texte a disparu SANS être soumis, et il
// est alors perdu — un texte non soumis n'existe nulle part ailleurs.
//
// `delivrerLaBoite` rend donc `{ ok: true, cause: 'vide-cause-inconnue', soumis: false,
// texteDisparu }`. Or `remettre()` ne testait que `!ok` (faux) et `soumis` (faux) : AUCUNE
// branche ne la traitait. Le message du dirigeant partait seul, et personne n'apprenait jamais
// qu'une boîte avait porté un texte dont le sort reste inconnu.
//
// ⚠️ ET C'EST LE CAS ORDINAIRE, PAS L'ACCIDENT : il survient dès qu'un tiers finit sa phrase
// et la soumet pendant notre fenêtre d'observation. C'est-à-dire l'usage normal.

test('UNE BOÎTE TROUVÉE VIDE NE SE TAIT PAS — on ne sait pas si le texte est parti ou perdu', async () => {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const marqueur = join(bac, 'premiere-lecture-videe');
  try { rmSync(marqueur); } catch { /* premier passage */ }
  const SEUIL_VIDAGE_MS = 800;
  const fenetreAvant = process.env.LIGNE_IMMOBILITE_MS;
  process.env.LIGNE_IMMOBILITE_MS = '1500';
  // Le tiers termine sa phrase et la SOUMET LUI-MÊME pendant qu'on observe : la boîte devient
  // vide. Piloté par le TEMPS — le seuil dépasse la latence d'un appel (~150 ms), sans quoi la
  // boîte se viderait avant qu'on ait rien observé et l'essai mesurerait la machine.
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const MARQUEUR = ${JSON.stringify(marqueur)};
const args = process.argv.slice(2);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
if (cmd === 'agent read') {
  let t0;
  try { t0 = Number(fs.readFileSync(MARQUEUR, 'utf8')); }
  catch { t0 = Date.now(); fs.writeFileSync(MARQUEUR, String(t0)); }
  const boite = Date.now() - t0 >= ${SEUIL_VIDAGE_MS} ? '' : 'je reprends la migration demain matin si';
  process.stdout.write(['~/x', SEP, '\\u276f ' + boite, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre } = await import('../src/herdr.js');
  const preuve = await remettre('w5:p8', 'Message du dirigeant, reçu par Slack.');
  assert.ok(preuve, 'le message du dirigeant doit partir — la boîte est libre');

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  // ⚠️ LA PREUVE QUE LE DOUBLE A RÉPONDU — sans lectures, une assertion sur le contenu ne
  // mesure rien. Un double mort satisferait le reste.
  const lectures = gestes.filter((g) => g === 'agent read').length;
  assert.ok(lectures >= 2, `la boîte doit avoir été OBSERVÉE — vu ${lectures} lecture(s)`);
  assert.ok(
    !gestes.includes('agent send-keys'),
    'on n’a RIEN soumis : la boîte s’est vidée toute seule, on ne s’en attribue pas le geste'
  );

  const ecrits = appels(journal).filter((a) => a[0] === 'agent' && a[1] === 'prompt');
  assert.equal(ecrits.length, 1, 'un seul message écrit');
  const livre = String(ecrits[0][3]);
  assert.ok(
    livre.includes('Message du dirigeant, reçu par Slack.'),
    'la parole du dirigeant est livrée entière'
  );
  assert.match(
    livre,
    /je reprends la migration demain matin si/,
    'et le texte disparu est RECOPIÉ — c’est la seule chose qui rende la perte réparable'
  );
  process.env.LIGNE_IMMOBILITE_MS = fenetreAvant;
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA QUATRIÈME MOITIÉ — LE DIALOGUE QUE LA DÉLIVRANCE ELLE-MÊME PROVOQUE (T-20260818-0049)
//
// ⚠️ RELEVÉ PAR UNE PASSE DE CONFIRMATION QUI A REJETÉ, et c'est le plus grave des quatre.
//
// LE MÉCANISME. On soumet le texte coincé d'un tiers. Ce texte peut être une COMMANDE, et sa
// soumission déclenche chez le destinataire une demande de permission. L'écran porte alors
// « Do you want to proceed? ❯ 1. Yes » AU-DESSUS d'une boîte parfaitement lisible et vide.
// `delivrerLaBoite` ne teste que `boiteEstVide` avant de conclure `soumis` : elle voit la boîte
// vide, rend `ok`, et `remettre()` écrit — SANS JAMAIS REGARDER L'ÉCRAN À NOUVEAU.
//
// Or écrire devant un dialogue ne livre pas un message : ça CONFIRME l'option affichée. C'est
// mesuré dans ce dépôt (T-20260817-0006 : un texte ordinaire a fait exécuter la commande
// proposée, le fichier a été créé). Le dirigeant reçoit un accusé de réception pour un message
// que personne n'a lu, et une action que personne n'a validée est partie.
//
// ⚠️ C'EST LE RATTRAPAGE QUI OUVRE LE DANGER QUE LE LOT EXISTE POUR FERMER. La garde d'entrée
// consulte bien l'écran — mais AVANT la délivrance. Entre le geste et l'écriture, plus rien.
//
// ET LE MODULE FRÈRE LE FAIT DÉJÀ : après une délivrance réussie, `livrerBrief` relit l'état
// et rejoue `obstacleAvantLivraison` — « la délivrance a pu mettre le destinataire au travail
// (mesuré) et sa boîte a pu se remplir à nouveau entre-temps. Le refus se re-décide sur ce
// qu'on voit maintenant, jamais sur le fait qu'on a agi. » Encore une moitié, encore la même.

test('UN DIALOGUE APPARU PENDANT L’ATTENTE ARRÊTE TOUT — on n’écrit pas sur une confirmation', async () => {
  // ⚠️ CONVERTI PAR D-20260921-0003. Le scénario d'origine — notre touche d'envoi soumet une commande, et
  // c'est CETTE soumission qui provoque le dialogue — ne peut plus se produire : la touche ne part plus.
  // Ce qui reste éprouvable, et qui protégeait la même chose (écrire sur un dialogue CONFIRME l'action), est
  // le dialogue qui apparaît PENDANT l'attente d'observation : la boîte d'autrui porte un texte, puis
  // l'écran se couvre d'une demande de permission. On s'arrête sur le dialogue — cause `dialogue`, plus
  // précise que la règle générale — et rien n'est soumis ni écrit.
  //
  // ⚠️ CET ESSAI NE PEUT PAS NOMMER `soumission-interdite` : la garde du dialogue passe AVANT la règle,
  // exprès — un dialogue est le cas où même l'écriture est dangereuse, pas seulement la touche. Il éprouve
  // donc cette ANTÉRIORITÉ : c'est `dialogue` qui doit répondre, pas la règle.
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const lectures = passes.filter((a) => a[0] === 'agent' && a[1] === 'read').length;
if (cmd === 'agent read') {
  if (lectures < 1) {
    // Première lecture (avant l'attente) : une boîte occupée par un texte COLLÉ, aucun dialogue.
    process.stdout.write(['~/x', SEP, '\\u276f [Pasted text #83 +7 lines]', SEP, '  auto mode on'].join('\\n'));
  } else {
    // PENDANT l'attente : l'agent demande une permission. La boîte garde son texte, lisible sous le dialogue.
    process.stdout.write([
      '~/x', 'Bash(rm -rf /tmp/travaux)', '', 'Do you want to proceed?', '\\u276f 1. Yes',
      '  2. No, and tell Claude what to do differently', SEP, '\\u276f [Pasted text #83 +7 lines]', SEP, '  auto mode on',
    ].join('\\n'));
  }
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'working' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant, reçu par Slack.'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err?.name}`);
      assert.match(err.message, /DIALOGUE/i, `le refus doit nommer le dialogue — reçu : ${err.message}`);
      assert.doesNotMatch(err.message, /on ne soumet JAMAIS/i, 'la garde du dialogue répond AVANT la règle générale');
      // Et il n'avoue AUCUN geste posé : aucune touche n'est partie, un « DÉJÀ SOUMIS » serait faux.
      assert.doesNotMatch(err.message, /DÉJÀ SOUMIS/, 'aucune touche d’envoi n’est partie, le refus ne l’affirme pas');
      return true;
    },
    'écrire devant un dialogue CONFIRME l’action affichée — le message n’est même pas reçu'
  );

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(gestes.filter((g) => g === 'agent read').length >= 2, 'l’écran a bien été relu APRÈS l’attente — c’est ce chemin qu’on éprouve');
  assert.ok(!gestes.includes('agent send-keys'), 'aucune touche d’envoi devant un dialogue');
  assert.ok(!gestes.includes('agent prompt'), 'ET RIEN N’A ÉTÉ ÉCRIT : une écriture ici aurait APPROUVÉ « rm -rf », pas livré un message');
});

// ═══ LA FENÊTRE DE CE CHEMIN-CI EST À LUI, ET RIEN NE LA GARDAIT (T-20260818-0076) ═══
//
// ⚠️ RELEVÉ EN PASSE DE REVUE DE FOND, BLOQUANT, ET LE REJET ÉTAIT JUSTE. Le lot T-20260818-0076
// a fixé la fenêtre du chemin ENTRE AGENTS à six secondes, dérivées d'un budget de bout en bout
// — quinze secondes — que le critère de son jalon impose à `bin/livrer.js`. **La ligne du
// dirigeant n'a jamais eu ce budget.** Son premier jet a pourtant ramené les deux chemins sur
// une même constante : la fenêtre d'ici serait passée de dix à six secondes par ricochet d'une
// contrainte étrangère, sans mesure et sans qu'un seul essai ne rougisse.
//
// Tous les essais de ce fichier fixent `LIGNE_IMMOBILITE_MS` à la main (60 ms, 1500 ms) pour
// aller vite — ils n'exercent donc JAMAIS le défaut. Muter `FENETRE_LIGNE_DU_DIRIGEANT_MS` de
// 10 s à 6 s laissait la suite entière verte. **Un réglage que personne n'éprouve est un
// réglage que le premier passant peut changer.**

test('LA FENÊTRE DE LA LIGNE DU DIRIGEANT EST LA SIENNE — pas celle d’un budget qui n’est pas le sien', async () => {
  const { FENETRE_LIGNE_DU_DIRIGEANT_MS, FENETRE_ENTRE_AGENTS_MS } = await import('../src/delivrance.js');

  // ⚠️ CE QUE CET ESSAI GARDE N'EST PAS LE CHIFFRE DIX — c'est que ce chemin DÉCIDE LE SIEN.
  //
  // Le chiffre lui-même est **[non établi]** : ni dix ni six secondes ne sortent d'une mesure du
  // temps qui sépare deux frappes d'un humain qui hésite. Ce qui EST établi, c'est que le budget
  // de bout en bout du chemin entre agents ne s'applique pas ici — donc qu'aligner l'un sur
  // l'autre est un raisonnement faux, quel que soit le nombre qui en sort.
  //
  // La garde porte donc sur la SÉPARATION : le jour où quelqu'un voudra aligner les deux, il
  // devra le faire en connaissance de cause, en retirant cet essai et en disant pourquoi.
  assert.notEqual(
    FENETRE_LIGNE_DU_DIRIGEANT_MS,
    FENETRE_ENTRE_AGENTS_MS,
    'les deux chemins n’ont pas la même contrainte : celui d’en face est borné par un budget de ' +
      'bout en bout que la ligne du dirigeant n’a pas. Les aligner, c’est appliquer ici une ' +
      'mesure faite ailleurs — le défaut même que T-20260818-0076 ferme, retourné.'
  );
  assert.ok(
    FENETRE_LIGNE_DU_DIRIGEANT_MS >= 10_000,
    `la fenêtre de la ligne du dirigeant ne se raccourcit pas sans une mesure DE CE CHEMIN — ` +
      `trouvée à ${FENETRE_LIGNE_DU_DIRIGEANT_MS} ms`
  );
});

test('LA REMISE OBSERVE LA FENÊTRE DE SON PROPRE CHEMIN — pas celle d’à côté', async () => {
  // ⚠️ CETTE GARDE VIENT D'UNE MUTATION SURVIVANTE, et elle dit pourquoi l'essai d'à côté ne
  // suffisait pas. Vérifier que la CONSTANTE vaut dix secondes ne prouve rien sur ce que le
  // chemin LIT : remplacer sa lecture par un `6000` écrit en dur laissait la suite verte.
  // C'est la forme exacte du défaut d'origine — une valeur juste, déclarée quelque part, et un
  // appelant qui en utilise une autre.
  //
  // On mesure donc le TEMPS QU'UNE VRAIE REMISE ATTEND, sans régler `LIGNE_IMMOBILITE_MS` :
  // c'est le seul témoin de ce que le chemin applique en usage réel.
  const { FENETRE_LIGNE_DU_DIRIGEANT_MS } = await import('../src/delivrance.js');
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const fenetreAvant = process.env.LIGNE_IMMOBILITE_MS;
  delete process.env.LIGNE_IMMOBILITE_MS;
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
if (cmd === 'agent read') {
  const soumis = fs.readFileSync(JOURNAL, 'utf8').includes('send-keys');
  const phrase = soumis ? '' : 'un compte rendu que son auteur n\\u2019a pas soumis';
  process.stdout.write(['~/x', SEP, '\\u276f ' + phrase, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'working' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre } = await import('../src/herdr.js');
  const debut = Date.now();
  // ⚠️ CONVERTI PAR D-20260921-0003 : la remise se termine maintenant par le refus nommé, et non par la
  // soumission. La durée mesurée reste celle de l'OBSERVATION — le refus n'arrive qu'après elle.
  await assert.rejects(() => remettre('w5:p8', 'Message du dirigeant.'), (err) => /on ne soumet JAMAIS/i.test(err.message));
  const duree = Date.now() - debut;
  if (fenetreAvant === undefined) delete process.env.LIGNE_IMMOBILITE_MS;
  else process.env.LIGNE_IMMOBILITE_MS = fenetreAvant;

  assert.ok(
    !appels(journal).map((a) => a.slice(0, 2).join(' ')).includes('agent send-keys'),
    'la touche d’envoi ne part pas — la durée mesure l’observation, pas un geste'
  );
  assert.ok(
    duree >= FENETRE_LIGNE_DU_DIRIGEANT_MS,
    `ce chemin doit observer SA fenêtre (${FENETRE_LIGNE_DU_DIRIGEANT_MS} ms) — remise bouclée ` +
      `en ${duree} ms, donc sur une fenêtre plus courte que la sienne`
  );
});

test('LA REMISE OBSERVE VRAIMENT AVANT DE SOUMETTRE — l’attente n’est pas décorative', async () => {
  // ⚠️ L'AUTRE MOITIÉ DU MÊME REJET. Les essais d'ici prouvent qu'un texte QUI BOUGE n'est pas
  // soumis — mais ils règlent eux-mêmes la fenêtre, donc ils ne disent rien de ce qu'un vrai
  // appel observe. Plafonner l'attente réelle à 50 ms dans `delivrerLaBoite` laissait la suite
  // verte : on pouvait DÉSARMER l'observation, donc soumettre le brouillon d'un humain pendant
  // qu'il l'écrit, sans qu'un essai ne rougisse.
  //
  // Une attente ne peut pas être plus COURTE que ce qu'on a demandé : cette borne ne mesure donc
  // pas la charge de la machine, elle mesure que le geste a bien attendu avant d'agir.
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const fenetreAvant = process.env.LIGNE_IMMOBILITE_MS;
  const FENETRE_MS = 1200;
  process.env.LIGNE_IMMOBILITE_MS = String(FENETRE_MS);
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
if (cmd === 'agent read') {
  // Le texte est IMMOBILE, et il le reste : la boîte ne se vide qu'une fois la touche partie.
  const soumis = fs.readFileSync(JOURNAL, 'utf8').includes('send-keys');
  const phrase = soumis ? '' : 'un compte rendu que son auteur n\\u2019a pas soumis';
  process.stdout.write(['~/x', SEP, '\\u276f ' + phrase, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'working' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre } = await import('../src/herdr.js');
  const debut = Date.now();
  // ⚠️ CONVERTI PAR D-20260921-0003 : l'attente précède désormais un REFUS nommé, plus une soumission.
  await assert.rejects(() => remettre('w5:p8', 'Message du dirigeant.'), (err) => /on ne soumet JAMAIS/i.test(err.message));
  const duree = Date.now() - debut;

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(!gestes.includes('agent send-keys'), 'aucune touche d’envoi : l’attente n’aboutit plus à une soumission');
  assert.ok(gestes.filter((g) => g === 'agent read').length >= 2, 'la boîte a été relue après l’attente');
  assert.ok(
    duree >= FENETRE_MS,
    `la fenêtre demandée (${FENETRE_MS} ms) doit avoir été RÉELLEMENT observée — ` +
      `remise bouclée en ${duree} ms, donc sans attendre`
  );
  process.env.LIGNE_IMMOBILITE_MS = fenetreAvant;
});
