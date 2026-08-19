// Une garde de surface garde SA PHRASE, jamais sa section.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE FICHIER FERME, ET POURQUOI IL NE SE VOIT PAS EN RELISANT
//
// `la-formule-jai-besoin-de-toi` déclare cinq surfaces où un message se fabrique, et exige
// que chacune rappelle la formule. Elle désignait chaque surface par la SECTION qui la
// porte, et cherchait la formule n'importe où dans cette section.
//
// Le 2026-08-19, le lot F a ajouté sous « Clore » un encadré sur la renaissance — une
// SECONDE surface de message, parfaitement légitime — qui portait la chaîne littérale.
// À partir de cet instant, la mutation qui retire le paragraphe du bilan de clôture a
// cessé de faire rougir la garde : la section gardait la chaîne, apportée par l'autre
// surface. La garde restait verte, la suite restait verte, et rien ne le signalait.
//
// ⚠️ **UNE MUTATION QUI DEVIENT MUETTE EST LE SEUL SIGNAL D'UNE GARDE DÉSARMÉE.** Elle ne
// rougit pas, elle ne crie pas : elle cesse simplement de prouver quelque chose. Le harnais
// de mutations attrape le cas — c'est lui qui a levé le lièvre (`not ok 554`) — mais il ne
// l'attrape QUE si une mutation vise déjà cette phrase-là. Rien n'empêchait la prochaine
// phrase portant « besoin de toi » de redésarmer la garde de la même façon.
//
// C'était la TROISIÈME occurrence du même motif sur ce fichier : deux mutations avaient
// déjà été rendues inopérantes de la même famille et ré-ancrées à la main après coup, sans
// que personne ne cherche combien d'autres gardes avaient le même travers.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE MOTIF, ÉNONCÉ POUR LA FAMILLE ENTIÈRE
//
// **Une garde qui cherche un motif dans un PÉRIMÈTRE plus large que ce qu'elle prétend
// garder est satisfaite par n'importe quoi d'autre dans ce périmètre.** Elle ne peut plus
// distinguer « la chose est là » de « quelque chose d'autre est là ».
//
// Ce qui suit l'éprouve mécaniquement, dans les deux sens : la garde doit rougir quand
// la phrase gardée s'en va MÊME SI la section porte encore la formule ailleurs, et elle
// doit rester silencieuse devant une reformulation légitime de cette phrase.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as ORIGINAUX from './lib/metier-orchestrateur.js';
import { CONTROLES, MUTATIONS, lireGabarits } from './lib/metier-orchestrateur.js';
import { sections } from './lib/metier-representant.js';

const ORIGINAL = lireGabarits();
const GARDE = CONTROLES.find((c) => c.id === 'la-formule-jai-besoin-de-toi');

/** La garde rougit-elle sur ces gabarits ? Rend son message, ou `null`. */
function rougeur(metier) {
  try {
    GARDE.verifier({ ...ORIGINAL, metier });
    return null;
  } catch (e) {
    return e.message;
  }
}

/**
 * Ajoute une SECONDE surface de message à la fin d'une section — un ajout parfaitement
 * légitime, du genre exact de celui qui a désarmé la garde. Elle porte la chaîne
 * littérale, comme n'importe quel encadré qui rappelle la forme d'un message.
 */
function secondeSurfaceDans(metier, sondeDeTitre) {
  const S = sections(metier);
  const sec = S.filter((s) => sondeDeTitre.test(s.titre));
  assert.equal(sec.length, 1, `la section visée doit être unique (${sec.length} trouvée·s)`);
  const fin = sec[0]._fin + sec[0].corpsEtendu.length;
  const AJOUT = "\n> **Si tu passes la main**, ton relais écrit un dernier message et le termine"
    + " comme tout autre : `J'ai besoin de toi : rien.`\n";
  return metier.slice(0, fin) + AJOUT + metier.slice(fin);
}

test('une seconde surface légitime dans la même section NE désarme PAS la garde du bilan', () => {
  // ⚠️ C'EST LE TEST QUI ÉTAIT ROUGE AVANT LE CORRECTIF, ET IL EST LA PREUVE DU LOT.
  //
  // Sur le gabarit intact, la mutation mord : elle retire le paragraphe du bilan et la garde
  // le voit. On ajoute alors ailleurs sous « Clore » une phrase qui porte la formule — un
  // ajout qu'aucune revue ne refuserait — et on rejoue exactement la même mutation.
  //
  // Avec la garde ancrée sur la SECTION, elle redevenait verte : mutation muette.
  // Avec la garde ancrée sur SA PHRASE, elle rougit dans les deux cas.
  const mutation = MUTATIONS.find((m) => m.id === 'la-formule-nest-plus-rappelee-au-bilan');
  assert.ok(mutation, 'la mutation du bilan de clôture doit exister — c’est elle qui prouve');

  // Référence : sans l'ajout, la mutation mord déjà.
  const muteSeul = mutation.muter(ORIGINAL.metier);
  assert.notEqual(muteSeul, ORIGINAL.metier, 'la mutation doit MORDRE — sinon elle ne prouve rien');
  assert.ok(rougeur(muteSeul), 'sur le gabarit intact, retirer le rappel du bilan doit faire rougir la garde');

  // Le cas mesuré : la section porte une seconde surface, et le bilan perd son rappel.
  const avecSeconde = secondeSurfaceDans(ORIGINAL.metier, /^Clore$/i);
  assert.notEqual(avecSeconde, ORIGINAL.metier, 'l’ajout doit s’appliquer');
  assert.equal(rougeur(avecSeconde), null, 'l’ajout seul est LÉGITIME : il ne doit faire rougir personne');

  const mute = mutation.muter(avecSeconde);
  assert.notEqual(mute, avecSeconde, 'la mutation doit mordre aussi sur le texte enrichi');

  const message = rougeur(mute);
  assert.ok(
    message,
    'GARDE DÉSARMÉE — le bilan de clôture a perdu son rappel et la garde est restée VERTE, '
      + 'parce qu’une AUTRE phrase de la même section porte la formule. Elle ne garde pas le '
      + 'bilan : elle garde la section « Clore », et n’importe quel ajout légitime la satisfait. '
      + 'Ancre chaque surface sur SA phrase.',
  );
  assert.match(
    message, /bilan/i,
    `la garde doit nommer la surface qui a perdu son rappel — « ${String(message).slice(0, 120)} »`,
  );
});

/**
 * Les cinq phrases porteuses, telles qu'elles vivent aujourd'hui dans le gabarit. Elles ne
 * sont PAS recopiées ici pour être comparées — elles servent de terrain aux deux bancs qui
 * suivent : on les remplace par des reformulations légitimes, puis par des désarmements.
 */
function phrasePorteuse(metier, sonde, porteuse) {
  const S = sections(metier);
  const sec = S.filter((s) => sonde.test(s.titre));
  assert.equal(sec.length, 1, 'la section visée doit être unique');
  const l = sec[0].corpsEtendu.split('\n').filter((x) => porteuse.test(x));
  assert.equal(l.length, 1, `la phrase porteuse doit être unique dans sa section (${l.length})`);
  return l[0];
}

test('chacune des CINQ surfaces est gardée SÉPARÉMENT — un rouge groupé ne prouverait rien', () => {
  // ⚠️ POURQUOI CE TEST N'EST PAS REDONDANT AVEC LES MUTATIONS.
  //
  // Les mutations du harnais retirent le rappel d'une surface à la fois — c'est ce qu'il faut —
  // mais elles sont écrites une par une, à la main, et rien n'oblige à en écrire une par
  // surface : la couverture a vécu longtemps avec TROIS mutations pour CINQ surfaces déclarées.
  // Ce test-ci suit la liste : ajouter une sixième surface sans la prouver rougit ici.
  const { ENDROITS_OU_UN_MESSAGE_SE_FABRIQUE: ENDROITS } = ORIGINAUX;
  assert.ok(ENDROITS.length >= 5, 'la liste des surfaces doit porter au moins les cinq mesurées');

  for (const { quoi, sonde, porteuse } of ENDROITS) {
    const phrase = phrasePorteuse(ORIGINAL.metier, sonde, porteuse);
    // On retire la formule de CETTE phrase, et d'elle seule. Les quatre autres la gardent.
    const amputee = phrase.replace(/`?J'ai besoin de toi\s*:[^`]*`?/i, 'en une ligne');
    assert.notEqual(amputee, phrase, `la phrase porteuse de « ${quoi} » doit porter la formule`);
    const message = rougeur(ORIGINAL.metier.replace(phrase, amputee));
    assert.ok(
      message,
      `SURFACE NON GARDÉE — « ${quoi} » a perdu son rappel et la garde est restée VERTE. `
        + `Les quatre autres surfaces la satisfont à sa place : c'est le motif exact que ce lot ferme.`,
    );
    assert.ok(
      message.includes(quoi),
      `la garde rougit mais ne NOMME pas « ${quoi} » — un rejet qui n'apprend pas où regarder `
        + `renvoie au mauvais correctif. Message : « ${message.slice(0, 140)} »`,
    );
  }
});

test('le bruit de la garde, mesuré — ce qu’elle refuse à raison ET ce qu’elle refuse à tort', () => {
  // ⚠️ UNE GARDE SE JUGE SUR DEUX CHIFFRES, ET LE SECOND EST CELUI QU'ON OUBLIE.
  //
  // Une garde qui crie sur du texte CORRECT ne survit pas : le premier qui la rencontre la
  // « corrige » en la retirant, et elle emporte tout ce qu'elle gardait vraiment. Ce fichier-ci
  // n'a de valeur que si l'ancrage sur la phrase n'a pas échangé un faux négatif contre un
  // faux positif.
  //
  // ⚠️ PORTÉE, ÉCRITE PLUTÔT QUE TUE : ce banc ne juge QUE `la-formule-jai-besoin-de-toi`.
  // Une reformulation peut légitimement faire rougir une AUTRE garde (celle du topo, celle de
  // la parole au dirigeant) — ce n'est pas le bruit qu'on mesure ici.
  const REFORMULATIONS_LEGITIMES = [
    ['ta ligne avec le CTO',
      "**Ce que tu y écris suit la façon de lui parler** — des faits, pas ton raisonnement, et `J'ai besoin de toi : ` en dernière ligne de **chaque** message, `rien.` compris."],
    ['le topo du matin',
      "**Le topo obéit à la forme de tout message** : des faits, et `J'ai besoin de toi : …` en dernière ligne — `rien.` compris."],
    ['ce que tu lui renvoies quand tu ne tranches pas',
      "**Et ça part sur ta ligne, à sa forme** — `J'ai besoin de toi : <la décision attendue>` en dernière ligne."],
    ['le compte rendu d’avancement sur le chantier',
      "**Le compte rendu d'avancement vit sur le chantier lui-même**, pas dans les tickets : c'est là que le CTO regarde. **C'est donc une surface de sa parole comme la ligne** — des faits, et `J'ai besoin de toi : …` en dernière ligne, `rien.` compris."],
    ['le bilan de clôture',
      "**Le bilan obéit à la forme de tout message** : des faits, et `J'ai besoin de toi : …` en dernière ligne — `rien.` s'il ne reste rien qui lui appartienne."],
  ];

  const { ENDROITS_OU_UN_MESSAGE_SE_FABRIQUE: ENDROITS } = ORIGINAUX;
  let aTort = 0;
  const coupables = [];
  for (const [quoi, reformulee] of REFORMULATIONS_LEGITIMES) {
    const e = ENDROITS.find((x) => x.quoi === quoi);
    assert.ok(e, `« ${quoi} » n'est plus une surface déclarée — le banc est périmé, mets-le à jour`);
    const phrase = phrasePorteuse(ORIGINAL.metier, e.sonde, e.porteuse);
    const message = rougeur(ORIGINAL.metier.replace(phrase, reformulee));
    if (message) { aTort++; coupables.push(`${quoi} — ${message.slice(0, 110)}`); }
  }

  // Et la contre-épreuve, sans laquelle la précédente ne prouverait rien : les désarmements
  // RÉELS doivent tous être vus. Sinon on aurait « corrigé » le bruit en désarmant la garde.
  const DESARMEMENTS = ENDROITS.map(({ quoi, sonde, porteuse }) => {
    const phrase = phrasePorteuse(ORIGINAL.metier, sonde, porteuse);
    return [quoi, ORIGINAL.metier.replace(phrase, phrase.replace(/`?J'ai besoin de toi\s*:[^`]*`?/i, 'en une ligne'))];
  });
  // …plus le cas mesuré du 2026-08-19 : une seconde surface légitime, et le bilan amputé.
  {
    const e = ENDROITS.find((x) => x.quoi === 'le bilan de clôture');
    const enrichi = secondeSurfaceDans(ORIGINAL.metier, e.sonde);
    const phrase = phrasePorteuse(enrichi, e.sonde, e.porteuse);
    DESARMEMENTS.push(['le bilan, sous une seconde surface légitime',
      enrichi.replace(phrase, phrase.replace(/`?J'ai besoin de toi\s*:[^`]*`?/i, 'en une ligne'))]);
  }
  let manques = 0;
  const rates = [];
  for (const [quoi, texte] of DESARMEMENTS) {
    if (!rougeur(texte)) { manques++; rates.push(quoi); }
  }

  console.log(`\n  ▸ bruit de « la-formule-jai-besoin-de-toi » :`
    + `\n      refusés à raison  : ${DESARMEMENTS.length - manques} / ${DESARMEMENTS.length} désarmements réels`
    + `\n      refusés à tort    : ${aTort} / ${REFORMULATIONS_LEGITIMES.length} reformulations légitimes\n`);

  assert.deepEqual(rates, [], `${manques} désarmement(s) RÉEL(s) non vus — la garde est décorative sur : ${rates.join(' · ')}`);
  assert.deepEqual(
    coupables, [],
    `${aTort} reformulation(s) LÉGITIME(s) refusée(s) à tort. Une garde qui crie sur du texte `
      + `correct se fait retirer par le premier qui la rencontre, et emporte ce qu'elle gardait `
      + `vraiment. ${coupables.join(' · ')}`,
  );
});

test('les garanties de la RÈGLE sont ancrées aussi — pas seulement la couverture des surfaces', () => {
  // ⚠️ CE TEST VIENT D'UNE PASSE DE REVUE QUI A REJETÉ LA PREMIÈRE VERSION DE CE LOT, ET
  // ELLE AVAIT RAISON — c'est le défaut le plus difficile à se voir à soi-même.
  //
  // Le lot énonçait le motif pour la FAMILLE — « une garde satisfaite par autre chose que ce
  // qu'elle garde » — et ne l'appliquait qu'à MOITIÉ de sa propre garde : la couverture des
  // cinq surfaces était ancrée sur leur phrase, mais les garanties de la RÈGLE elle-même
  // (le `rien` s'écrit, la formule est littérale, la portée) lisaient toujours le CORPS de
  // leur section. Mesuré : trois mots réinjectés n'importe où dans cette section suffisaient.
  //
  // **Une garde qui énonce un motif et l'applique à moitié enseigne le contraire de ce
  // qu'elle dit.**
  //
  // ⚠️ CE QUE CE TEST NE COUVRE PAS, ÉCRIT PLUTÔT QUE TU :
  //   • il n'éprouve que les lignes de PROSE de la section de la règle — les titres et les
  //     blocs de code sont écartés : les retirer casse la structure que le lecteur de
  //     sections utilise, et la garde rougirait pour une raison qui n'est pas la sienne ;
  //   • il ne prouve rien des 36 AUTRES gardes du fichier. Celles-là sont comptées, pas
  //     corrigées — `T-20260819-0030` les porte, avec la mesure et sa méthode.
  const lignes = ORIGINAL.metier.split('\n');
  const S = sections(ORIGINAL.metier);
  const sec = S.filter((s) => /Tout message se termine par/i.test(s.titre));
  assert.equal(sec.length, 1, 'la section de la règle doit être unique');

  // Les bornes de la section, en index de ligne, et les lignes de bloc de code.
  let pos = 0; const debutDe = [];
  for (const l of lignes) { debutDe.push(pos); pos += l.length + 1; }
  const finPos = sec[0]._fin + sec[0].corpsEtendu.length;
  const premiere = debutDe.findIndex((d) => d >= sec[0]._debut);
  let derniere = lignes.length;
  for (let k = 0; k < debutDe.length; k++) if (debutDe[k] >= finPos) { derniere = k; break; }

  const dansBloc = new Array(lignes.length).fill(false);
  let dedans = false;
  for (let i = 0; i < lignes.length; i++) {
    if (/^\s*(```|~~~)/.test(lignes[i])) { dansBloc[i] = true; dedans = !dedans; continue; }
    dansBloc[i] = dedans;
  }

  const survivants = [];
  const eprouvees = [];
  for (let i = premiere; i < derniere; i++) {
    const L = lignes[i];
    if (!L.trim() || dansBloc[i] || /^\s*#{1,4}\s/.test(L)) continue;

    // La garde dépend-elle de cette ligne ? Sinon il n'y a rien à ancrer.
    const sansL = lignes.filter((_, k) => k !== i);
    if (!rougeur(sansL.join('\n'))) continue;
    eprouvees.push(i + 1);

    // ⚠️ ON RETIRE D'ABORD, ON RÉINJECTE ENSUITE — l'ordre inverse fait retirer par `replace`
    // la copie qu'on vient d'insérer quand elle précède l'originale, et le test rend alors
    // « satisfaite » sur un texte identique à l'original. C'est le défaut que ce fichier
    // combat, commis en l'éprouvant : la première version de ce test l'a fait.
    // ⚠️ LA RÉDUCTION SE FAIT PAR LES DEUX BOUTS, ET LA PREMIÈRE VERSION NE PRENAIT QUE LES
    // PRÉFIXES. Elle rendait VERT sur une garantie que l'outil de mesure, lui, voyait tomber :
    // le fragment qui la satisfaisait était un SUFFIXE (« dernière ligne de tout message »).
    // **Un banc qui n'éprouve qu'une moitié des fragments rend un vert qui ne prouve rien** —
    // c'est le motif de ce fichier, commis en l'éprouvant, pour la seconde fois.
    const essayer = (frag) => {
      const avec = [...sansL];
      avec.splice(Math.min(derniere - 1, avec.length), 0, '', frag, '');
      return !rougeur(avec.join('\n'));
    };
    let mots = L.trim().split(/\s+/);
    const total = mots.length;
    let progres = true;
    while (progres && mots.length > 1) {
      progres = false;
      const sansPremier = mots.slice(1);
      if (essayer(sansPremier.join(' '))) { mots = sansPremier; progres = true; continue; }
      const sansDernier = mots.slice(0, -1);
      if (essayer(sansDernier.join(' '))) { mots = sansDernier; progres = true; }
    }
    // ⚠️ LE CURSEUR EST LA MOITIÉ, ET C'EST UN CHOIX QU'ON ÉCRIT. Retirer un mot au bout d'une
    // phrase n'en change pas la fonction : une garde a raison d'y rester verte. Mais si la
    // MOITIÉ de la phrase suffit, la garde ne garde plus qu'un début ou qu'une fin — elle a
    // laissé partir l'autre moitié, et c'est celle-là qui porte d'habitude le motif.
    if (mots.length <= Math.floor(total / 2)) {
      survivants.push(`l.${i + 1} satisfaite par ${mots.length} mot(s) sur ${total} : « ${mots.join(' ').slice(0, 60)} »`);
    }
  }

  assert.ok(eprouvees.length >= 3, `trop peu de garanties éprouvées (${eprouvees.length}) — le test ne mesure plus rien`);
  assert.deepEqual(
    survivants, [],
    `${survivants.length} garantie(s) de cette garde sont satisfaites par un FRAGMENT réinjecté `
      + `ailleurs dans leur section : la garde ne distingue plus « la chose est là » de « quelque `
      + `chose d'autre est là ». C'est le motif que ce lot énonce ; l'appliquer à moitié enseigne `
      + `le contraire. ${survivants.join(' · ')}`,
  );
});
