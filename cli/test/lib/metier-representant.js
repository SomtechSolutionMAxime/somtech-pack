// Les contrôles du métier du représentant, et les mutations qui les mettent à l'épreuve.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER N'EST PAS UN TEST
//
// Il est importé par DEUX suites qui ne demandent pas la même chose aux mêmes contrôles :
//
//   • `representant-gabarit.test.js` les exécute sur le gabarit RÉEL — ils doivent passer ;
//   • `representant-mutations.test.js` les exécute sur des versions RETOURNÉES du gabarit —
//     au moins un doit rougir, pour chacune.
//
// Sans cette séparation, un contrôle décoratif reste vert pour toujours et personne ne le
// sait. C'est très exactement le défaut qui a dominé le chantier D-20260805-0005 : six fois
// sur neuf, la garde vérifiait ce que le texte CONTENAIT, pas ce qu'il FAISAIT. Le pire cas
// y a survécu au remplacement de la phrase gardée par son contresens exact — le mot y était
// encore, le test est resté vert, le comportement était inversé.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LA RÈGLE D'ÉCRITURE D'UN CONTRÔLE, ET ELLE A ÉTÉ CORRIGÉE UNE FOIS
//
// Un contrôle ne cherche JAMAIS la présence d'une phrase. Il porte sur :
//
//   • la POLARITÉ  — de quel côté d'une table une affirmation vit, la colonne étant
//     désignée par SON LIBELLÉ D'EN-TÊTE et jamais par son rang ;
//   • la POSITION  — à quel rang d'une suite ordonnée une étape se trouve ;
//   • la MODALITÉ  — l'énoncé est-il impératif, ou s'est-il assoupli en recommandation ;
//   • le COMPTE    — combien d'interdits sont écrits pour combien de gardés.
//
// ⚠️ LE PIÈGE QUI A ÉTÉ TROUVÉ EN REVUE, ET QUI VAUT D'ÊTRE RACONTÉ.
//
// La première version de ces contrôles lisait la polarité à l'INDEX de la colonne : « la
// faisabilité doit être dans la colonne 1 ». `tableDe` jetait l'en-tête, considéré comme du
// décor. Or c'est le libellé d'en-tête qui donne un sens à l'index — et lui seul.
//
// Conséquence : permuter deux libellés d'en-tête, UNE ligne, sans déplacer une seule
// cellule, retournait la frontière de l'engagement ET les réflexes anti-biais. Le gabarit
// muté enseignait que le prix, le délai et « est-ce possible ? » se répondent seul, et que
// « oui, c'est possible » est ce qu'on dit à la place de la complaisance. Zéro contrôle
// rougissait.
//
// C'était le motif dominant du chantier, remonté d'un cran : la garde ne cherchait plus des
// mots, mais elle vérifiait OÙ le texte est sans lire CE QU'IL DIT. Une table markdown dont
// on permute les en-têtes en oubliant de déplacer les cellules est par ailleurs l'édition à
// moitié faite la plus banale qui soit.
//
// D'où `colonneDe`, ci-dessous : aucun index de colonne n'est jamais écrit en dur.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // cli/test/lib
export const REPO = resolve(HERE, '..', '..', '..');

/** Le lieu d'où le pack distribue les gabarits du représentant (module `core`). */
export const GABARIT_DIR = join('.claude', 'templates', 'gestionnaire-client');
export const CHEMIN_METIER = join(GABARIT_DIR, 'CLAUDE.md');
export const CHEMIN_CONTEXTE = join(GABARIT_DIR, 'CONTEXTE.md');

/** Les deux gabarits, lus depuis une racine (le dépôt par défaut, ou un paquet construit). */
/**
 * Le métier ENTIER d'un rôle : son socle permanent, puis ses chapitres.
 *
 * Un contrôle qui ne lirait que le socle jugerait un texte de 850 mots là où le
 * métier en fait 25 000 : il passerait au vert sans rien garder.
 */
export function metierEntier(racine = REPO) {
  const socle = readFileSync(join(racine, CHEMIN_METIER), 'utf8');
  const dossier = join(racine, GABARIT_DIR, 'metier', 'chapitres');
  if (!existsSync(dossier)) return socle;
  const chapitres = readdirSync(dossier).sort()
    .map((f) => readFileSync(join(dossier, f), 'utf8'));
  return [socle, ...chapitres].join('\n\n');
}

export function lireGabarits(racine = REPO) {
  return {
    // ⚠️ Le métier n'est plus UN fichier : depuis que le gabarit est RENDU
    // (P-20260820-0001), il tient dans un socle — `CLAUDE.md`, chargé en
    // permanence — et des chapitres ouverts au moment d'agir. Les contrôles
    // portent sur le métier, pas sur un fichier : ils lisent donc les deux.
    //
    // Sans ça, 423 contrôles cessaient de mordre en silence — le contenu qu'ils
    // gardent avait simplement changé de fichier, et ils lisaient l'ancien.
    // Mesuré le 2026-08-20 : c'est la moitié qui survit pendant que le lieu bouge.
    metier: metierEntier(racine),
    contexte: readFileSync(join(racine, CHEMIN_CONTEXTE), 'utf8'),
  };
}

// ═════════════════════════════════════════ lecture de structure

/**
 * Découpe un markdown en sections { niveau, titre, corps }.
 *
 * ⚠️ LES NIVEAUX 1 À 4, ET LE NIVEAU 1 A COÛTÉ 92 GARDES ROUGES D'UN COUP.
 *
 * La version précédente ne reconnaissait que les niveaux 2 à 4. Tant que les textes gardés
 * n'avaient qu'un seul titre de niveau 1 — leur titre de document —, l'écart ne se voyait
 * pas. Le métier de l'orchestrateur, réorganisé par la fonction, a mis ses sept blocs `R1`
 * à `R7` en niveau 1 : les gardes ont cherché des sections que le lecteur ne rendait plus,
 * et ont rougi en bloc en annonçant « le gabarit doit porter une section … » — alors que le
 * contenu était là. Une garde qui ne trouve pas son terrain dit « la fonction a disparu »
 * quand elle devrait dire « je ne sais pas lire » : c'est un faux témoin, dans le sens qui
 * coûte le plus cher, parce qu'il accuse.
 *
 * Le second effet est moins visible et compte autant : un titre non reconnu ne BORNE pas
 * le corps de la section précédente. Une section de niveau 2 avalait donc tout ce qui suit,
 * blocs de niveau 1 compris, jusqu'au prochain titre de niveau 2 — et une garde pouvait
 * passer sur une phrase qui vit deux sections plus loin. Rendre les niveaux 1 rend aussi
 * les bornes.
 *
 * ⚠️ LES BLOCS DE CODE SONT SAUTÉS, ET CE N'EST PAS UN RAFFINEMENT.
 *
 * Un commentaire shell (`# poser la veille…`) est, à la lettre, un titre de niveau 1. Les
 * reconnaître ferait naître des sections fantômes au milieu d'un bloc de commandes et
 * couperait le corps réel en deux — le lecteur deviendrait permissif là où on l'ouvre.
 * Le métier de l'orchestrateur en porte 36 blocs ; le premier commentaire venu suffisait.
 *
 * ⚠️ `corps` S'ARRÊTE AU PREMIER SOUS-TITRE ; `corpsEtendu` PORTE LES SOUS-SECTIONS.
 *
 * Les deux existent parce que les gardes veulent les deux, et que le défaut n'est pas le
 * même des deux côtés. Un bloc `R1` dont tout le contenu vit dans des sous-sections a un
 * `corps` presque vide : une garde qui cherche une fonction « quelque part sous ce titre »
 * doit lire le corps ÉTENDU, sinon elle rougit en annonçant une section vide — le second
 * visage du faux témoin qui accuse. À l'inverse, une garde qui compte les lignes d'une
 * table écrite juste sous le titre doit lire le `corps` : le corps étendu lui ferait
 * ramasser les tables des sous-sections et rougir sur un décompte qui n'est pas le sien.
 * Mesuré ici même : le corps étendu par défaut faisait lire « 7 refus décrits pour 2 posés »
 * à la garde des droits, qui a raison de n'en vouloir que deux.
 *
 * La règle d'emploi tient en une ligne : le corps ÉTENDU pour ce qui doit vivre QUELQUE
 * PART sous ce titre, le `corps` pour ce qui doit vivre à CE niveau-là. Et c'est la garde
 * qui choisit, explicitement — un choix qui se voit en revue plutôt qu'un défaut de lecteur
 * qui s'applique à toutes en silence.
 */
export function sections(texte) {
  const out = [];
  let prec = null;
  let dansUnBloc = false;
  let offset = 0;

  for (const ligne of texte.split('\n')) {
    const debut = offset;
    offset += ligne.length + 1;

    if (/^\s*(```|~~~)/.test(ligne)) { dansUnBloc = !dansUnBloc; continue; }
    if (dansUnBloc) continue;

    const m = /^(#{1,4})\s+(.+)$/.exec(ligne);
    if (!m) continue;

    if (prec) prec.corps = texte.slice(prec._fin, debut);
    prec = { niveau: m[1].length, titre: m[2].trim(), _fin: debut + m[0].length, _debut: debut };
    out.push(prec);
  }
  if (prec) prec.corps = texte.slice(prec._fin);

  // Le corps ÉTENDU court jusqu'au prochain titre de niveau ÉGAL OU SUPÉRIEUR : les
  // sous-sections appartiennent à leur section, ce qui la suit au même rang ne lui
  // appartient pas.
  for (let i = 0; i < out.length; i++) {
    const suivante = out.slice(i + 1).find((s) => s.niveau <= out[i].niveau);
    out[i].corpsEtendu = suivante ? texte.slice(out[i]._fin, suivante._debut) : texte.slice(out[i]._fin);
  }

  return out;
}

/**
 * La section dont le titre répond à la sonde. Échoue si elle manque — un contrôle qui ne
 * trouve pas son terrain ne doit jamais passer en silence — ET si plusieurs y répondent.
 *
 * ⚠️ L'UNICITÉ EST LA MOITIÉ QUI PROTÈGE, ET ELLE MANQUAIT ICI.
 *
 * La version précédente prenait la PREMIÈRE section dont le titre répondait. Tant que le
 * lecteur ignorait les titres de niveau 1, l'ambiguïté était rare ; en les rendant, on a
 * multiplié les titres qu'une sonde large peut atteindre — et une garde qui lit la section
 * VOISINE de celle qu'elle croit lire est un faux témoin dans l'autre sens : elle passe.
 * Rendre le lecteur plus permissif sans rendre la désignation stricte aurait échangé des
 * gardes qui accusent à tort contre des gardes qui absolvent à tort. Le second est pire :
 * il ne se voit pas.
 *
 * Même contrat que `colonneDe`, et que le lecteur jumeau de la compétence : une désignation
 * ambiguë rend l'assertion ininterprétable, donc inutile.
 */
export function sectionDe(texte, sonde, quoi) {
  const trouvees = sections(texte).filter((x) => sonde.test(x.titre));
  assert.equal(
    trouvees.length, 1,
    `le gabarit doit porter une section ${quoi} — une seule (${trouvees.length} trouvée·s`
      + `${trouvees.length > 1 ? ` : ${trouvees.map((s) => `« ${s.titre} »`).join(', ')}` : ''})`,
  );
  return trouvees[0];
}

/**
 * Une table markdown lue AVEC son en-tête : `{ entetes, lignes }`.
 *
 * L'en-tête n'est pas du décor : c'est la seule chose qui donne un sens aux colonnes.
 * L'avoir jeté est le défaut que la revue de la PR #180 a trouvé — voir l'avertissement en
 * tête de fichier. Il est désormais rendu, et `colonneDe` oblige à s'en servir.
 */
export function tableDe(corps) {
  const rangees = corps
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((c) => !c.every((x) => /^:?-{2,}:?$/.test(x)));
  assert.ok(rangees.length >= 2, 'une table doit porter un en-tête et au moins une ligne');
  return { entetes: rangees[0], lignes: rangees.slice(1) };
}

/**
 * L'index de la colonne dont le LIBELLÉ D'EN-TÊTE répond à la sonde.
 *
 * Échoue si aucune n'y répond, ou si plusieurs y répondent — même contrat que `rangUnique` :
 * une désignation ambiguë rendrait l'assertion de polarité ininterprétable, donc inutile.
 *
 * C'est ce qui rend la permutation de deux en-têtes détectable : le contrôle suit le sens,
 * pas la géométrie. Permuter les libellés déplace l'index que cette fonction renvoie, et
 * les cellules restées en place se retrouvent alors du mauvais côté.
 *
 * ⚠️ LA SONDE DOIT COUVRIR LE LIBELLÉ ENTIER — et cette exigence est le quatrième tour du
 * même motif, trouvé en seconde revue.
 *
 * La version précédente reconnaissait la colonne à un MOT-CLÉ contenu dans son libellé :
 * `/remontes/i` pour « Tu remontes au dirigeant ». Six reformulations gardaient le mot-clé
 * en retournant le sens, et passaient toutes :
 *
 *     « Tu remontes au dirigeant SI TU AS UN DOUTE »   ← l'obligation devient une option
 *     « Ce que tu NE dis JAMAIS à la place »           ← la colonne des réponses s'inverse
 *     « Tu NE remontes RIEN »                          ← l'inverse exact, mot-clé intact
 *
 * On était revenu, un cran plus bas, à garder par la présence d'un mot. Une sonde non
 * ancrée est donc refusée ici même : l'ancrage n'est pas une convention d'écriture, c'est
 * la garantie elle-même. Et le libellé retenu doit ENCORE OBLIGER — un en-tête peut être
 * exact et s'être assoupli (« Ta posture, quand tu as le temps »).
 */
export function colonneDe(table, sonde, quoi) {
  assert.ok(
    sonde.source.startsWith('^') && sonde.source.endsWith('$'),
    `la sonde de la colonne « ${quoi} » n'est pas ancrée (${sonde}) : une sonde qui cherche `
      + `un mot-clé dans le libellé accepte « ${quoi} si tu as un doute » ou sa négation, `
      + `qui gardent le mot et retournent le sens. Ancrer sur le libellé ENTIER (^…$).`,
  );

  const trouves = table.entetes
    .map((libelle, i) => ({ libelle, i }))
    .filter(({ libelle }) => sonde.test(libelle));
  assert.equal(
    trouves.length, 1,
    `la colonne « ${quoi} » doit se reconnaître une fois exactement à son en-tête `
      + `(${trouves.length} trouvée·s parmi : ${table.entetes.map((e) => `« ${e} »`).join(', ')})`,
  );

  exigeImperatif(trouves[0].libelle, `l'en-tête de colonne « ${trouves[0].libelle} »`);
  return trouves[0].i;
}

/** Les cellules d'une colonne désignée par son en-tête. */
export function colonne(table, sonde, quoi) {
  const i = colonneDe(table, sonde, quoi);
  return table.lignes.map((l) => l[i] ?? '');
}

/** Les étapes d'une suite numérotée, avec leur rang et leur libellé en gras. */
export function etapesDe(corps) {
  return [...corps.matchAll(/^(\d+)\.\s+(.+)$/gm)].map((m) => ({
    rang: Number(m[1]),
    enonce: m[2],
    libelle: (m[2].match(/\*\*(.+?)\*\*/) || [])[1] || null,
  }));
}

/** Les puces de premier niveau d'un corps de section. */
export const pucesDe = (corps) => corps.split('\n').filter((l) => /^-\s+\S/.test(l));

/** Le contenu des blocs de commandes. */
export const blocsBash = (texte) => [...texte.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);

/** L'avertissement de tête d'un gabarit : ses lignes de citation, avant la première section. */
export function enteteDe(texte) {
  const avant = texte.split(/^##\s/m)[0];
  return avant.split('\n').filter((l) => l.trim().startsWith('>')).map((l) => l.trim());
}

/**
 * Tournures qui transforment une obligation en suggestion.
 *
 * La MODALITÉ est le troisième axe, après la polarité et la position, et il manquait. Un
 * énoncé peut garder sa place, sa colonne et son rang tout en cessant d'obliger : « ouvre ta
 * ligne » reste l'étape 2, mais devient « tu peux aussi le faire après si ça presse ».
 * Le rang est nécessaire ; il n'est pas suffisant.
 *
 * ⚠️ DEUX FAMILLES, ET LA SECONDE MANQUAIT — relevée en revue de fond du lot T-20260813-0043.
 *
 * La PERMISSION (« tu peux », « facultatif ») dit que l'obligation n'en est pas une. L'EXCEPTION
 * (« sauf si… », « si tu en as le temps ») la laisse debout et lui ouvre une porte — ce qui la
 * vide tout aussi bien, en ayant l'air de la respecter. Trois altérations mesurées passaient
 * la garde : « son propre ticket, **avant** de le faire, SI TU EN AS LE TEMPS », « … n'a pas de
 * ticket propre, SAUF si le dirigeant en demande un », « … jamais le geste — SAUF décision
 * contraire ponctuelle ». Aucune n'est une permission ; toutes rendent la consigne inopérante.
 *
 * Une TROISIÈME famille est arrivée par la contre-vérification du même lot : la NÉCESSITÉ niée
 * (« même si ce n'est pas strictement nécessaire tout de suite »), qui ne demande ni permission
 * ni exception — elle nie simplement que la consigne s'applique maintenant.
 *
 * ⚠️ CE QUE CETTE GARDE NE PEUT PAS FAIRE, ET IL FAUT LE SAVOIR AVANT DE S'Y FIER.
 *
 * C'est une LISTE DE VOCABULAIRE, donc finie par construction : elle attrape les tournures
 * connues, jamais « toute façon d'assouplir une consigne ». Deux idiomes usuels lui ont échappé
 * jusqu'à ce qu'un reviewer les pose (« à moins que », « pas strictement nécessaire ») et il en
 * reste. Elle vaut comme filet sur la MODALITÉ ; elle ne remplace pas la polarité et la position,
 * qui, elles, ne dépendent d'aucun vocabulaire.
 *
 * ⚠️ PAS DE `\b` DEVANT UNE INITIALE ACCENTUÉE. En JavaScript, `à` n'est pas un caractère de mot :
 * `\bà moins que` ne s'apparie JAMAIS, et l'alternative serait morte-née — vraie par construction,
 * donc invisible. Le piège est le jumeau exact de celui documenté sur `privé\b` plus bas, et il
 * a été attrapé ici par une mutation, pas par une relecture.
 *
 * ⚠️ ET LA RÉCIPROQUE, QUI A COÛTÉ TROIS DÉFAUTS D'UN COUP (revue de fond, T-20260814-0033).
 * « Pas de `\b` devant un accent » n'autorise pas à s'en passer PARTOUT : `efforce-toi` commence
 * et finit par des lettres ASCII, il se borne normalement, et sans bornes il s'appariait dans
 * `xefforce-toi`. L'exemption est une exception mesurée, jamais une habitude.
 *
 * ⚠️ ET LA BORNE FINALE TOMBE DANS LE MÊME PIÈGE QUE L'INITIALE — refaite dans le correctif
 * qui venait de le documenter, deux lignes plus haut. `\bveille à\b` ne s'apparie JAMAIS : la
 * borne d'après `à` cherche une frontière que `à` ne peut pas former. On la retire.
 *
 * ⚠️ ET `de` SANS BORNE MORD LE MOT SUIVANT. « évite DEux allers-retours au client » est un
 * impératif parfait, et `évite (?:de)` s'y appariait sur le préfixe de « deux ». Chaque
 * alternative se termine donc par sa borne — sauf celles qui finissent par une apostrophe, où
 * il n'y a rien à borner. Trouvé en cherchant le cas qui départageait DEUX AUTRES formes :
 * un essai qu'on écrit pour prouver une chose en révèle une autre, et c'est la quatrième.
 *
 * ⚠️ ET SEULE LA FORME QUI COMMANDE EST UNE TOURNURE PERMISSIVE — L'INFINITIF EST DU FRANÇAIS
 * ORDINAIRE. `tente(?:r)?` a fait rougir « sans rien tenter d'autre », qui est un impératif
 * PARFAIT et vit dans deux compétences réelles. Ce qui assouplit une consigne, c'est
 * « tente DE le faire » adressé à quelqu'un ; « tenter d'autre » ne s'adresse à personne. On
 * ne garde donc que la seconde personne.
 *
 * ⚠️ ET LA RÈGLE CI-DESSUS A ÉTÉ ENFREINTE DANS LE COMMIT QUI L'ÉCRIVAIT. `essa(?:ie|ye|yer)`
 * rangeait l'infinitif dans le même groupe que les deux impératifs — « tu dois ESSAYER DE
 * comprendre le besoin » aurait rougi. Un principe posé ne se relit pas tout seul sur ses
 * voisins : chaque alternative de la famille a dû être reprise une à une.
 *
 * ⚠️ ET UNE TOURNURE QUE LE VOCABULAIRE DU DÉPÔT REND INDISTINGUABLE N'ENTRE PAS. `veille à` a
 * été essayé puis RETIRÉ : l'impératif adressé et le présent de la troisième personne s'écrivent
 * IDENTIQUEMENT, et « le veilleur veille à… » est une phrase que ce dépôt écrira. Là où
 * `tente`/`tenter` se départageaient par l'orthographe, celle-ci ne se départage pas — même
 * conclusion que `tâche de`, pour une raison différente.
 *
 * ⚠️ ET UNE TOURNURE QUI COLLISIONNE AVEC UN NOM N'ENTRE PAS. `tâche de` a été essayé puis
 * RETIRÉ : « la tâche de fond » est du français parfaitement impératif, et une garde qui rougit
 * sur du texte correct ne survit pas — le premier qui la rencontre la supprime, et emporte
 * avec elle les tournures qu'elle gardait vraiment. Une alternative de moins vaut mieux qu'une
 * garde qu'on apprend à ignorer.
 *
 * ⚠️ ET UN POINT DANS UNE ALTERNATIVE EST UN MÉTACARACTÈRE, PAS UNE APOSTROPHE. `essaie (?:de|d.)`
 * — écrit pour couvrir l'élision `d'` — s'appariait sur « évite DAns ce cas », « essaie DUne
 * façon » : n'importe quelle phrase commençant par la bonne lettre. Une garde de modalité qui
 * rougit sur du texte parfaitement impératif est pire qu'absente : on la « corrige » en la
 * retirant. On écrit donc `d['’]`, les deux apostrophes réelles.
 */
export const PERMISSIF = /\btu peux\b|\bfacultati|\boptionnel|\bpas obligatoire\b|\bsi (?:tu le souhaites|ça presse|celui-ci presse)\b|\bau besoin\b|\bde préférence\b|\bsauf\b|à moins que\b|\bsi tu (?:en )?as le temps\b|\bsi le temps le permet\b|\bsi possible\b|\bdans la mesure du possible\b|à ta discrétion\b|\bpas (?:strictement )?(?:nécessaire|indispensable|essentiel)\b|évite(?:r)? (?:de\b|que\b|d['’])|en évitant|essa(?:ie|ye) (?:de\b|d['’])|\btente (?:de\b|d['’])|fais en sorte (?:de\b|d['’])|\befforce-toi\b/i;

/** Exige qu'un énoncé oblige, plutôt qu'il ne recommande. */
export function exigeImperatif(enonce, quoi) {
  const relache = enonce.match(PERMISSIF);
  assert.ok(
    !relache,
    `« ${quoi} » s'est assoupli en recommandation (« ${relache && relache[0]} ») : `
      + `sa place ne suffit pas, une consigne qui se contente de conseiller se relâche — « ${enonce.trim()} »`,
  );
}

/**
 * Les tournures qui RENVERSENT une garantie sans en retirer un mot.
 *
 * ⚠️ POURQUOI CE MOTIF EXISTE — mesuré le 2026-08-16, sur ce dépôt, par une revue fraîche.
 *
 * Une garde écrite en `assert.match(corps, /tu ne fermes pas/)` cherche une SOUS-CHAÎNE. Elle
 * reste verte devant « **il n'est pas vrai que** tu ne fermes pas : **en réalité tu fermes** » —
 * la phrase gardée est toujours là, enveloppée de sa négation. Quatre gardes neuves sont
 * tombées sur ce trou d'un coup, dont celle qui tenait « la ronde signale et ne ferme JAMAIS ».
 *
 * C'est le même invariant que celui du lot de la naissance, sur une autre surface :
 * **on vérifie le FAIT, jamais l'INDICE.** Une sous-chaîne présente est un indice ; la polarité
 * du paragraphe qui la porte est le fait.
 *
 * ⚠️ CETTE LISTE RESTE COURTE, ET CHAQUE ENTRÉE EST VÉRIFIÉE ABSENTE DU TEXTE LÉGITIME avant
 * d'être ajoutée. C'est la leçon de `PERMISSIF` juste au-dessus : une garde qui rougit sur du
 * texte correct ne survit pas, on la « corrige » en la retirant, et elle emporte ce qu'elle
 * gardait vraiment. « contrairement » a été ÉCARTÉ pour cette raison — le mot figure déjà,
 * légitimement, dans le gabarit et dans la compétence.
 */
export const RENVERSEMENT = /il n['’]est pas vrai que|ce n['’]est pas (?:vrai|le cas|exact)|au contraire|en réalité|n['’]est plus (?:vrai|le cas)|cesse d['’]être vrai|à l['’]opposé|c['’]est faux\s*:|dans les faits/i;

/**
 * ⚠️⚠️ CE QUE `RENVERSEMENT` VAUT, ET CE QU'IL NE VAUT PAS — À LIRE AVANT DE S'Y FIER.
 *
 * **C'est un FILTRE, pas une garantie.** Il attrape les formulations connues ; il ne garde pas
 * la polarité en général. Une tournure qui n'est pas dans la liste passe, et il y en aura
 * toujours une : trois — « à l'opposé », « c'est faux : », « dans les faits » — ont été
 * trouvées par une revue le 2026-08-16 sur une liste qu'on croyait suffisante la veille.
 *
 * **Donc : ne présente jamais une garde qui repose sur ce motif seul comme une preuve que la
 * garantie tient.** Pour les règles dont le renversement coûte cher, passe `inverse` à
 * `exigePolarite` — on y interdit alors la polarité contraire, ce qui garde le FAIT et non la
 * tournure. C'est plus long à écrire, et c'est le prix d'une vraie garantie.
 *
 * ⚠️ ET LA LIMITE DE FOND, qu'aucune des deux voies ne lève : **on garde de la prose avec du
 * texte.** Énumérer les façons de dire le contraire est le même problème dans un miroir. La
 * seule garantie qui ne soit pas un filtre est un test de COMPORTEMENT — voir le ticket
 * ouvert là-dessus, rattaché à `T-20260815-0008`.
 *
 * ⚠️ CHAQUE ENTRÉE EST VÉRIFIÉE ABSENTE DU TEXTE LÉGITIME avant d'être ajoutée. « contrairement »
 * et « c'est faux » nu ont été ÉCARTÉS pour cette raison — les deux figurent déjà, légitimement,
 * dans le gabarit. « c'est faux » n'entre qu'avec ses deux-points.
 */

/**
 * Exige qu'une garantie tienne EN POLARITÉ — présente, et non renversée par son voisinage.
 *
 * À préférer systématiquement à `assert.match(corps, sonde)` pour garder une règle : le coût
 * d'écriture est le même, et la garde attrape ce que la sous-chaîne laisse passer.
 *
 * @param corps  le texte de la section
 * @param sonde  ce qui reconnaît la phrase portant la garantie
 * @param quoi   la garantie, en clair, pour le message d'échec
 */
/**
 * L'ANTÉRIORITÉ DE L'ACCUSÉ SUR LE RELÈVEMENT, écrite en toutes lettres dans l'énoncé.
 *
 * ⚠️ POURQUOI CE MOTIF EXISTE, ET POURQUOI IL NE RESSEMBLE À AUCUN AUTRE ICI.
 *
 * ⚠️ D'OÙ VIENT CETTE RÈGLE — vérifié à la source, parce qu'une première version de ce
 * commentaire l'attribuait de travers, et qu'une attribution dans un commentaire de code se
 * relit comme un fait. L'ABC du gestionnaire client (Somcraft `e4b72bc9-b7a7-43f1-812e-72f58abe50be`) dit ceci :
 *
 *   — la règle `R4.7` elle-même est née d'une MESURE, pas d'une décision. Un lecteur neuf, à
 *     qui l'on n'avait donné que ce texte, a mené un relèvement complet et écrit deux
 *     messages au dirigeant avant que le client n'entende un mot — pendant qu'un employé de
 *     ce client s'apprêtait à relancer une commande destructrice en production (changelog
 *     v1.1.0). Le texte disait QU'il accuse réception ; jamais QUAND.
 *   — ce que le dirigeant a tranché le 2026-08-17, c'est une CONTRADICTION INTERNE :
 *     `CT-GCL-010` et `CT-GCL-022` exigeaient l'inverse l'un de l'autre sur une session qui
 *     naît avec un message du client. Il a tranché en faveur de l'accusé qui passe avant
 *     (`GF-GCL-008`, changelog v1.2.0).
 *
 * L'accusé part donc AVANT le relèvement. Dans le texte livré, le relèvement porte le rang 3
 * et l'accusé le rang 4 : **le rang dit l'inverse de la règle**, et c'est la prose qui le
 * rétablit. Ne pas renuméroter est un arbitrage de COORDINATION de ce chantier — renuméroter
 * ferait DIRE le bon ordre au texte sans rien GARDER : le rang deviendrait juste, et la
 * réécriture suivante pourrait le retourner sans qu'un test rougisse.
 *
 * La garantie tient donc par l'un OU l'autre de ses deux porteurs — le rang, ou l'incise.
 * Ce motif reconnaît le second.
 */
export const ANTERIORITE_SUR_LE_RELEVEMENT = /avant\s+(?:même\s+)?(?:d['’]avoir\s+(?:fini\s+de\s+)?relev|de\s+(?:finir\s+de\s+)?relev|le\s+relèvement|la\s+fin\s+du\s+relèvement)/i;

/**
 * LA POLARITÉ CONTRAIRE : l'accusé subordonné à la FIN du relèvement.
 *
 * ⚠️ LA PRÉSENCE DE L'INCISE NE SUFFIT PAS, et c'est le défaut que ce lot corrige. Avant
 * lui, remplacer « — avant même d'avoir fini de relever. » par « — quand tu auras fini de
 * relever. » — le contresens exact de l'arbitrage, un seul fragment changé — laissait la
 * suite ENTIÈREMENT VERTE (`199 · pass 197 · fail 0`, mesuré en revue indépendante sur
 * `7926463`). L'absence de l'étape était gardée ; sa MODALITÉ ne l'était pas.
 *
 * ⚠️ ET CE MOTIF NE PEUT PAS ÊTRE `PERMISSIF` — l'erreur qu'il serait tentant de faire.
 * « quand tu auras fini de relever » n'est ni une permission, ni une exception, ni une
 * nécessité niée : c'est un RENVERSEMENT DE POSITION en modalité temporelle. `exigeImperatif`
 * y reste muet, et le vérifier tenait de la mesure, pas du raisonnement.
 *
 * ⚠️ ET UNE BRANCHE PEUT ÊTRE MORTE-NÉE — attrapé sur ce motif même, avant de l'écrire ici.
 * Un premier jet groupait `(?:quand|…)` et `(?:tu auras )?` SANS l'espace qui les sépare :
 * « quand tu auras fini de relever » ne s'appariait à rien, la garde était vraie par
 * construction, et la mutation qu'elle existe pour attraper serait restée verte. C'est le
 * jumeau exact du piège de `\bà moins que` documenté sur `PERMISSIF`. Chaque alternative est
 * donc PROUVÉE VIVANTE par une sonde, et chacune prouvée non trop large sur du texte
 * légitime — voir `representant-mutations.test.js`.
 *
 * ⚠️ ET UNE SECONDE EST TOMBÉE À LA MESURE, écrite dans ce fichier avant d'en sortir :
 * `lorsqu['’]` suivi de `\s+` exige un espace APRÈS l'apostrophe, que le français n'écrit
 * jamais. Elle a été RETIRÉE plutôt que rafistolée — le document tutoie, « lorsqu'il aura
 * relevé » n'y a pas de cas d'usage, et une alternative de moins vaut mieux qu'une couverture
 * qu'on croit avoir. Deux branches mortes-nées sur sept dans un motif écrit avec ce piège
 * en tête : c'est la mesure qui les a dites, pas la relecture.
 */
/**
 * LA POLARITÉ CONTRAIRE ELLE-MÊME : le relèvement affirmé PRIORITAIRE.
 *
 * ⚠️ POURQUOI CELUI-CI EXISTE EN PLUS DES DEUX AUTRES — et il a coûté un aller-retour.
 *
 * `RENVERSEMENT` est un filtre de tournures, et il fallait le restreindre à LA PHRASE qui
 * porte l'incise, sans quoi il rougissait sur du français ordinaire écrit juste après
 * (« C'est, EN RÉALITÉ, la toute première chose que tu fais »). Mais cette restriction a
 * ROUVERT ce qu'elle fermait : le contresens écrit dans la phrase SUIVANTE y échappait —
 * « …, dès que sa ligne est ouverte. Ce n'est pas vrai : le relèvement passe en premier. »
 * Une vérification indépendante l'a mesuré sur le commit qui venait de « corriger » le
 * faux positif. Élargir la portée ramenait le faux positif ; la rétrécir ouvrait le trou.
 *
 * ON SORT DU DILEMME EN CHANGEANT D'AXE. Les deux autres gardes cherchent des TOURNURES ;
 * celle-ci cherche le FAIT — que le relèvement soit dit prioritaire, quels que soient les
 * mots qui l'amènent. Elle est ancrée sur le relèvement, donc elle ne peut pas mordre une
 * phrase qui n'en parle pas, et elle traverse tout l'énoncé sans risque. C'est le même
 * geste que le paramètre `inverse` d'`exigePolarite`, plus haut dans ce fichier.
 *
 * ⚠️⚠️ ET VOICI EXACTEMENT CE QU'ELLE NE FERME PAS — mesuré, pas supposé, par une cinquième
 * passe de revue. Les TROIS gardes réunies laissent passer le contresens dès qu'il désigne le
 * relèvement AUTREMENT QUE PAR SON NOM. Ces deux énoncés sont VERTS sur les 25 contrôles :
 *
 *   « …, dès que sa ligne est ouverte. Ce n'est pas vrai : ce qui existe déjà chez nous
 *     passe en premier. »
 *   « …, dès que sa ligne est ouverte. Son passé chez nous vient avant, toujours. »
 *
 * Le premier échappe à `RENVERSEMENT` parce qu'il est dans une autre phrase que la porteuse,
 * et à celle-ci parce qu'il ne dit pas « relèvement ». Le second ne porte aucune marque de
 * renversement du tout. **Aucun filtre de vocabulaire ne fermera cette famille** : il faudrait
 * une garde de FORME — interdire toute phrase non reconnue dans l'énoncé de cette étape —, ce
 * qui ferait rougir aussi toute évolution légitime du texte. C'est un arbitrage de conception,
 * et il est remonté au dirigeant plutôt que tranché ici.
 *
 * ⚠️ ET ELLE RESTE UN FILTRE, comme les autres. Chaque item est éprouvé par une attaque et
 * quatre textes légitimes sont prouvés indemnes ; il existera d'autres formulations. Une
 * alternative de plus — `va`, comme « le relèvement va avant » — a été RETIRÉE parce
 * qu'aucune attaque française plausible ne la rendait vivante : une alternative de moins vaut
 * mieux qu'une couverture qu'on croit avoir. C'est le test de contribution qui l'a dite,
 * pas la relecture, et il l'a dite dans la minute où elle a été écrite. Ce qui garde
 * réellement l'arbitrage, ce sont les TROIS gardes ensemble, jamais une seule.
 */
export const PRIORITE_DU_RELEVEMENT = /(?:le\s+)?relèvement\s+(?:passe|vient|arrive)\s+(?:en\s+premier|d['’]abord|avant)|relèv\w*\s+(?:d['’]abord|en\s+premier)|(?:d['’]abord|en\s+premier)\s*[,:]?\s*(?:tu\s+)?(?:le\s+)?relèv|commence\s+par\s+(?:le\s+)?relev/i;

export const POSTERIORITE_SUR_LE_RELEVEMENT = /(?:quand|lorsque|une\s+fois|après|dès|sitôt)\s+(?:que\s+)?(?:tu\s+(?:auras|as)\s+)?(?:fini\s+de\s+)?(?:relev|le\s+relèvement|ton\s+relèvement)|après\s+(?:avoir\s+)?(?:fini\s+de\s+)?relev|à\s+la\s+fin\s+du\s+relèvement/i;

export function exigePolarite(corps, sonde, quoi, { inverse } = {}) {
  const porteurs = corps.split(/\n\s*\n/).filter((p) => sonde.test(p));
  assert.ok(
    porteurs.length >= 1,
    `« ${quoi} » : la phrase qui porte la garantie est introuvable — la garde ne garde plus rien`,
  );

  for (const p of porteurs) {
    // ⚠️ ON REGARDE LA PHRASE PORTEUSE, PAS TOUT LE PARAGRAPHE — et c'est un correctif, pas un
    // raccourci. Sur le paragraphe entier, un contraste parfaitement légitime écrit deux phrases
    // plus loin (« … ne fait pas foi. Au contraire, c'est la mesure git qui tranche. ») rougissait
    // à tort. Or une garde qui crie sur du texte correct ne survit pas : on la « corrige » en la
    // retirant, et elle emporte ce qu'elle gardait vraiment — c'est écrit noir sur blanc pour
    // `PERMISSIF` un peu plus haut, et ça vaut ici mot pour mot.
    //
    // Le prix : un renversement écrit dans la phrase SUIVANTE n'est pas vu. Assumé et documenté ;
    // les renversements réels rencontrés jusqu'ici tiennent tous dans la phrase porteuse.
    const phrases = p.split(/(?<=[.!?])\s+/).filter((f) => sonde.test(f));
    for (const phrase of phrases) {
      const renverse = phrase.match(RENVERSEMENT);
      assert.ok(
        !renverse,
        `« ${quoi} » est RENVERSÉE sur place (« ${renverse && renverse[0]} ») : la phrase gardée est `
          + `toujours là, et elle dit maintenant le contraire. Une garde qui cherche une sous-chaîne `
          + `ne voit pas ça — « ${phrase.trim().slice(0, 160)}… »`,
      );
    }
  }

  // ── LA MOITIÉ QUI GARDE LE FAIT PLUTÔT QUE LA TOURNURE.
  //
  // `RENVERSEMENT` est un filtre : il ne connaît que les formulations qu'on lui a apprises.
  // `inverse` ne dépend d'aucune formulation de négation — il interdit que la polarité contraire
  // de la garantie soit écrite, quels que soient les mots employés pour l'amener. À réserver aux
  // règles dont le renversement coûte cher, parce qu'il faut écrire l'inverse à la main.
  if (inverse) {
    const contraire = corps.match(inverse);
    assert.ok(
      !contraire,
      `« ${quoi} » : la section énonce la polarité CONTRAIRE (« ${contraire && contraire[0]} »). `
        + `Peu importe la tournure qui l'amène — la garantie ne tient pas si son contraire est écrit ici.`,
    );
  }
}

/**
 * Le rang de l'unique élément qu'une sonde reconnaît.
 * Échoue si la sonde n'en reconnaît aucun, ou plus d'un — une sonde ambiguë rendrait
 * l'assertion de position ininterprétable, donc inutile.
 *
 * ⚠️ `cle` PEUT ÊTRE `null`, ET C'EST UNE MESURE AVEUGLE, PAS UNE ABSENCE — mesuré en
 * revue indépendante sur le commit 7926463 (D-20260817-0006).
 *
 * `etapesDe()` ne pose `libelle` que s'il trouve un `**gras**` dans l'énoncé ; sans lui,
 * `libelle` (et donc `cle`, ici) vaut `null`. L'ancien filtre, `sonde.test(e.cle || '')`,
 * traitait ce `null` comme une chaîne vide — exactement ce que rend un élément qui n'existe
 * PAS DU TOUT. Deux réalités opposées rendaient alors le MÊME message, caractère pour
 * caractère : supprimer l'étape 4 de l'ordre d'ouverture, et se contenter de retirer son
 * gras en la laissant en place, produisaient toutes deux
 * « "accuser réception" doit se reconnaître une fois exactement (0 trouvée·s) ». Un lecteur
 * de ce message ne peut pas savoir s'il doit RÉÉCRIRE l'étape ou seulement la RE-GRASSER.
 *
 * On distingue donc, avant de conclure à une absence : s'il existe des éléments dont `cle`
 * est `null` (aveugles — on ne peut pas leur appliquer la sonde), zéro correspondance ne
 * prouve rien, et on le dit nommément plutôt que de rendre le message de l'absence pure.
 * Un `cle` à chaîne vide (`''`) reste une VALEUR mesurée — une colonne de table vide, par
 * exemple — et ne déclenche pas cette branche : seule l'absence de mesure (`null`/`undefined`)
 * le fait.
 */
function rangUnique(elements, sonde, quoi) {
  const trouves = elements.filter((e) => e.cle != null && sonde.test(e.cle));

  if (trouves.length === 0) {
    const aveugles = elements.filter((e) => e.cle == null);
    assert.equal(
      aveugles.length, 0,
      `« ${quoi} » ne peut pas conclure à une absence : ${aveugles.length} élément(s) sans libellé `
        + `visible pour la sonde (rang·s aveugle·s : ${aveugles.map((e) => e.rang).join(', ') || '?'}) — `
        + `impossible de distinguer « ça n'existe pas » de « je ne peux pas le voir ».`,
    );
  }

  assert.equal(trouves.length, 1, `« ${quoi} » doit se reconnaître une fois exactement (${trouves.length} trouvée·s)`);
  return trouves[0];
}

// ═════════════════════════════════════════ les contrôles

/**
 * Chaque contrôle : { id, quoi, verifier({ metier, contexte }) } — jette si la garantie
 * n'est plus tenue. Ils sont exécutés tels quels sur le gabarit réel ET sur ses mutants.
 */
export const CONTROLES = [
  {
    id: 'ordre-ouverture',
    quoi: 'se rendre joignable vient AVANT de relever, qui vient avant de parler — et chaque étape oblige',
    verifier({ metier }) {
      // T-20260806-0192 : un représentant a relevé l'historique avant d'ouvrir sa ligne.
      // Pendant ce temps on lui a écrit quatre fois, et rien n'est arrivé. L'ordre est le
      // livrable ; une consigne qui le RECOMMANDE sans que rien ne le garde se relâche.
      const s = sectionDe(metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
      const etapes = etapesDe(s.corps).map((e) => ({ ...e, cle: e.libelle }));
      assert.ok(etapes.length >= 4, `l’ordre doit être une suite d’au moins 4 étapes (${etapes.length})`);
      for (const e of etapes) assert.ok(e.libelle, `l’étape ${e.rang} n’a pas de libellé en gras — son rang serait illisible`);

      // ⚠️ LE CHIFFRE ÉCRIT EN PROSE DOIT DIRE LE VRAI. Le lot qui a ajouté deux étapes a
      // laissé « Quatre gestes » au-dessus d'une liste de six — trouvé en revue, invisible à
      // la relecture. Un lecteur qui compte s'arrête avant de poser sa ronde.
      const NOMBRES = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8 };
      const annonce = s.corps.match(/^\s*(deux|trois|quatre|cinq|six|sept|huit)\s+gestes/im);
      assert.ok(annonce, 'l’ordre d’ouverture doit annoncer COMBIEN de gestes il compte');
      assert.equal(
        NOMBRES[annonce[1].toLowerCase()], etapes.length,
        `l’ordre annonce « ${annonce[1]} gestes » et en énumère ${etapes.length}`,
      );

      const contexte = rangUnique(etapes, /CONTEXTE\.md/, 'lire son contexte');
      // T-20260814-0033 : l'étape 2 ouvre désormais LES DEUX lignes. Le libellé le dit, et
      // c'est voulu — le rang seul ne prouverait pas que la seconde y est.
      const ouvrir = rangUnique(etapes, /ouvre tes deux lignes/i, 'ouvrir ses deux lignes');
      const relever = rangUnique(etapes, /relève/i, 'relever');
      const parler = rangUnique(etapes, /parle/i, 'parler');

      assert.ok(contexte.rang < ouvrir.rang, `le contexte (rang ${contexte.rang}) donne le canal : il se lit avant d’ouvrir (rang ${ouvrir.rang})`);
      assert.ok(ouvrir.rang < relever.rang, `ouvrir sa ligne (rang ${ouvrir.rang}) doit précéder le relèvement (rang ${relever.rang})`);
      assert.ok(relever.rang < parler.rang, `relever (rang ${relever.rang}) doit précéder la parole (rang ${parler.rang})`);

      // LE RANG NE SUFFIT PAS. Une étape peut garder sa place et cesser d'obliger — c'est
      // le relâchement que ce document redoute explicitement, et il ne coûte qu'une
      // incise. On garde donc aussi la modalité de chaque étape.
      for (const e of etapes) exigeImperatif(e.enonce, `étape ${e.rang} de l’ordre d’ouverture`);

      // Et la condition d'arrêt : sans ligne installée, le représentant naîtrait muet en
      // croyant parler. Elle vient du métier d'origine (section « Prérequis ») et avait
      // été perdue au déplacement.
      assert.match(
        s.corps, /arrête-toi/i,
        'l’ordre d’ouverture doit dire de s’arrêter quand la ligne de discussion n’est pas installée',
      );
    },
  },

  {
    id: 'anti-complaisance-en-tete',
    quoi: 'l’anti-complaisance ouvre les réflexes, et le « oui c’est possible » vit sous l’en-tête « ce que la pression fait dire »',
    verifier({ metier }) {
      // Le réflexe qui compte le plus pour un agent face à un client : il insiste, l'agent
      // veut plaire, et le « oui c'est possible » sort tout seul.
      const s = sectionDe(metier, /réflexes/i, 'sur les réflexes');
      const table = tableDe(s.corps);
      assert.ok(table.lignes.length >= 4, `les réflexes doivent être énumérés (${table.lignes.length} trouvé·s)`);

      const iRang = colonneDe(table, /^#$/, 'le rang du réflexe');
      const iNom = colonneDe(table, /^Le réflexe$/i, 'le nom du réflexe');
      const rangs = table.lignes.map((l, position) => ({ rang: Number(l[iRang]), position, cle: l[iNom] }));

      const complaisance = rangs.filter((r) => /complaisance/i.test(r.cle));
      assert.equal(complaisance.length, 1, 'un seul réflexe d’anti-complaisance');
      assert.equal(complaisance[0].rang, 1, `l’anti-complaisance porte le rang ${complaisance[0].rang} au lieu de 1`);
      assert.equal(complaisance[0].position, 0, 'et elle ouvre la table — un réflexe listé en dernier se lit en dernier');

      // LA POLARITÉ, RÉSOLUE PAR LES LIBELLÉS D'EN-TÊTE ET JAMAIS PAR L'INDEX.
      // Permuter les deux en-têtes ferait dire au métier que « oui, c'est possible » est ce
      // qu'on répond à la place de la complaisance — le contresens exact. Les cellules
      // n'ayant pas bougé, seul l'appariement en-tête↔contenu le voit.
      const pressions = colonne(table, /^Ce que la pression te fait dire$/i, 'ce que la pression te fait dire').join(' ');
      const reponses = colonne(table, /^Ce que tu dis à la place$/i, 'ce que tu dis à la place');

      const COMPLAISANTES = [/c.est possible/i, /devrait être prêt/i, /\bbientôt\b/i];
      for (const sonde of COMPLAISANTES) {
        assert.match(pressions, sonde, `${sonde} doit figurer sous l’en-tête « ce que la pression te fait dire »`);
      }
      for (const reponse of reponses) {
        for (const sonde of COMPLAISANTES) {
          assert.ok(
            !sonde.test(reponse),
            `« ${reponse} » est donné comme la réponse à faire alors qu’il porte ${sonde} — la polarité est inversée`,
          );
        }
      }
    },
  },

  {
    id: 'posture-fondatrice',
    quoi: 'le renversement de posture tient : chercher le besoin est la posture, pas le réflexe de guichet',
    verifier({ metier }) {
      // Le principe qui gouverne tout le reste — « tu es le représentant du client dans
      // notre équipe, pas un guichet ». Cette table n'était gardée par rien, et permuter
      // ses deux en-têtes faisait de « ce n'est pas prévu au contrat » la posture à tenir.
      const table = tableDe(metier.split(/^##\s/m)[0]);
      const guichet = colonne(table, /^Le réflexe de guichet$/i, 'le réflexe de guichet').join(' ');
      const posture = colonne(table, /^Ta posture$/i, 'ta posture').join(' ');

      for (const [sonde, quoi] of [
        [/pas prévu au contrat/i, 'opposer le contrat'],
        [/vocabulaire/i, 'traduire dans notre vocabulaire'],
        [/question posée/i, 'répondre à la question posée'],
      ]) {
        assert.match(guichet, sonde, `« ${quoi} » est un réflexe de guichet, il doit figurer de ce côté`);
        assert.ok(!sonde.test(posture), `« ${quoi} » est donné comme ta posture — le renversement est inversé`);
      }
      for (const [sonde, quoi] of [
        [/débloquerait/i, 'chercher ce que ça débloque'],
        [/ses mots/i, 'garder ses mots'],
        [/défendre/i, 'défendre son besoin'],
      ]) {
        assert.match(posture, sonde, `« ${quoi} » est ta posture, il doit figurer de ce côté`);
        assert.ok(!sonde.test(guichet), `« ${quoi} » est donné comme un réflexe de guichet — le renversement est inversé`);
      }

      // Et le principe lui-même, hors table : la demande s'écrit dans les mots du client.
      const ouverture = metier.split(/^##\s/m)[0];
      assert.match(ouverture, /dans ses mots/i, 'le métier doit dire que la demande s’écrit dans les mots du client');
      assert.ok(
        !/\*\*Tu (?:la )?tradui[st]/i.test(ouverture),
        'le métier enseigne de traduire la demande dans notre vocabulaire — c’est le principe fondateur inversé',
      );
    },
  },

  {
    id: 'faisabilite-remonte',
    quoi: '« est-ce possible ? » vit sous l’en-tête qui REMONTE au dirigeant',
    verifier({ metier }) {
      // Le seul cas qu'un agent tranchera de travers de bonne foi : la réponse paraît
      // factuelle et engage en réalité. Résolu par en-tête : permuter les deux libellés
      // de cette table faisait répondre seul sur le prix, le délai et la faisabilité.
      const s = sectionDe(metier, /frontière de l.engagement/i, 'sur la frontière de l’engagement');
      const table = tableDe(s.corps);
      const seul = colonne(table, /^Tu réponds seul$/i, 'ce à quoi tu réponds seul').join(' ');
      const remonte = colonne(table, /^Tu remontes au dirigeant$/i, 'ce qui remonte au dirigeant').join(' ');

      assert.match(remonte, /est-ce possible/i, 'la faisabilité remonte au dirigeant');
      assert.ok(!/est-ce possible/i.test(seul), 'la faisabilité ne se répond pas seul');
    },
  },

  {
    id: 'engagements-remontent',
    quoi: 'tout ce qui engage l’organisation remonte — présent d’un côté ET absent de l’autre',
    verifier({ metier }) {
      // DEUX PORTES, PAS UNE. La première version n'exigeait que la PRÉSENCE à droite :
      // ajouter « un prix approximatif, si tu le connais » à gauche passait sans rougir,
      // puisque « prix » figurait toujours à droite, apporté par la ligne d'origine.
      // C'est le motif « un correctif ne couvre qu'une porte sur deux », que le commentaire
      // d'origine annonçait pourtant garder.
      const s = sectionDe(metier, /frontière de l.engagement/i, 'sur la frontière de l’engagement');
      const table = tableDe(s.corps);
      const seul = colonne(table, /^Tu réponds seul$/i, 'ce à quoi tu réponds seul').join(' ').toLowerCase();
      const remonte = colonne(table, /^Tu remontes au dirigeant$/i, 'ce qui remonte au dirigeant').join(' ').toLowerCase();

      for (const engage of ['délai', 'prix', 'priorité', 'engagement']) {
        assert.ok(remonte.includes(engage), `« ${engage} » doit figurer du côté qui remonte`);
        assert.ok(!seul.includes(engage), `« ${engage} » figure du côté où l’on répond seul : c’est un engagement pris sans le dirigeant`);
      }
    },
  },

  {
    id: 'cloisonnement',
    quoi: 'le cloisonnement énumère ses interdits, et leur nombre est gardé',
    verifier({ metier }) {
      // RA-REL-001. Sur le chantier précédent, la section a été supprimée EN ENTIER et
      // 346 tests sont restés verts ; puis une version qui cherchait trois motifs sur
      // quatre a laissé retirer le quatrième sans une rougeur. On garde donc la STRUCTURE
      // en plus des mots : autant de puces que d'interdits, chacune reconnue une fois.
      const s = sectionDe(metier, /un seul client, un seul canal/i, 'de cloisonnement');
      const INTERDITS = [
        { quoi: 'un second client se refuse', sonde: /second client/i },
        { quoi: 'un second canal se refuse', sonde: /second canal/i },
        { quoi: 'une session ne change pas de client en route', sonde: /ne change pas de client/i },
        { quoi: 'le travail d’un autre client ne se cite jamais', sonde: /autre client/i },
      ];
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, INTERDITS.length, `${puces.length} interdit(s) écrit(s) pour ${INTERDITS.length} gardé(s)`);
      for (const { quoi, sonde } of INTERDITS) {
        const trouvees = puces.filter((p) => sonde.test(p));
        assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement`);
        // La MODALITÉ manquait ici : un interdit peut garder sa puce, son compte et son
        // vocabulaire tout en cessant d'obliger — « tu peux refuser » n'est pas « tu refuses ».
        exigeImperatif(trouvees[0], quoi);
      }
      assert.match(s.corps, /refuse/i, 'le verbe doit être le refus, pas la préférence');
      assert.match(s.corps, /structurel/i, 'le cloisonnement est structurel, pas déclaratif');
      assert.match(s.corps, /fuite/i, 'et la section doit dire ce qu’une violation coûte');
    },
  },

  {
    id: 'interdits-du-metier',
    quoi: 'la liste des « jamais » est complète, et chaque interdit oblige encore',
    verifier({ metier }) {
      // Même garde que le cloisonnement, appliquée à l'autre liste d'interdits. Elle porte
      // notamment l'interdit d'inviter quelqu'un dans le canal du client — une règle du
      // métier d'origine qui avait été perdue au déplacement, et que rien n'aurait
      // rattrapée. Le compte est gardé pour que retirer une puce fasse rougir.
      const s = sectionDe(metier, /ce que tu ne fais pas/i, 'des interdits du métier');
      const INTERDITS = [
        { quoi: 'il n’écrit pas de code', sonde: /n.écris pas de code/i },
        { quoi: 'il ne tranche aucun arbitrage', sonde: /aucun arbitrage/i },
        { quoi: 'il ne s’engage sur aucune condition', sonde: /ne t.engages sur aucun/i },
        { quoi: 'l’orchestrateur ne parle pas au client', sonde: /orchestrateur parler au client/i },
        { quoi: 'aucun mécanisme de file', sonde: /mécanisme de file/i },
        { quoi: 'il n’invite personne dans le canal', sonde: /n.invites personne/i },
        { quoi: 'il ne renvoie aucune pièce au client', sonde: /ne renvoies aucune pièce/i },
        // T-20260814-0033 — CE QUI REMPLACE L'ANCIEN INTERDIT. « Tu n'ouvres jamais une
        // seconde ligne » est tombé parce qu'il est devenu faux ; le risque qu'il protégeait,
        // lui, n'a pas bougé d'un pouce. Il est désormais tenu par le nommage obligatoire, et
        // c'est donc CE nommage qui doit figurer parmi les « jamais » — sans quoi on aurait
        // retiré une garde en croyant retirer une erreur.
        { quoi: 'il n’écrit jamais sans nommer la ligne visée', sonde: /sans nommer la ligne/i },
      ];
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, INTERDITS.length, `${puces.length} interdit(s) écrit(s) pour ${INTERDITS.length} gardé(s)`);
      for (const { quoi, sonde } of INTERDITS) {
        const trouvees = puces.filter((p) => sonde.test(p));
        assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement (${trouvees.length} trouvée·s)`);
        exigeImperatif(trouvees[0], quoi);
      }
    },
  },

  {
    id: 'validation-avant-lancement',
    quoi: 'faire valider la formulation précède le lancement du travail',
    verifier({ metier }) {
      // RA-REL-004. Un besoin mal formulé transformé en travail coûte un chantier ; la
      // validation coûtait une question. Gardé par le RANG des étapes, pas par une phrase.
      const etapes = sections(metier)
        .filter((s) => s.niveau === 3 && /^\d+\./.test(s.titre))
        .map((s) => ({ rang: Number(s.titre.match(/^(\d+)\./)[1]), cle: s.titre }));
      assert.ok(etapes.length >= 5, `le cycle doit être une suite ordonnée (${etapes.length} étape·s)`);

      const valider = rangUnique(etapes, /faire valider/i, 'faire valider la formulation');
      const lancer = rangUnique(etapes, /lancer l.exécution/i, 'lancer l’exécution');
      assert.ok(valider.rang < lancer.rang, `la validation (rang ${valider.rang}) doit précéder le lancement (rang ${lancer.rang})`);

      // LE RANG NE SUFFIT PAS, ICI NON PLUS. L'étape peut rester à sa place et cesser
      // d'obliger : « tu peux lancer sans attendre si le besoin est clair » laisse l'ordre
      // intact et supprime la garantie. C'est RA-REL-004 qui tombe — un besoin mal formulé
      // parti en travail coûte un chantier, quand la validation coûtait une question.
      const corps = sectionDe(metier, /faire valider/i, 'de la validation de la formulation').corps;
      exigeImperatif(corps, 'l’étape « faire valider la formulation »');
    },
  },

  {
    id: 'verite-au-client',
    quoi: 'dire « ça attend son tour » est la bonne réponse, dire « c’est en cours » est la mauvaise',
    verifier({ metier }) {
      // EF-REL-011. Le cas qu'on rate presque toujours : un chantier terminé qui attend la
      // mise en ligne. Les deux formulations sont données côte à côte, marquées ✅ et ❌ ;
      // permuter les deux marques ferait recommander le mensonge. On apparie donc chaque
      // marque à ce qu'elle qualifie, plutôt que de constater que les deux existent.
      const s = sectionDe(metier, /tenir le client informé/i, 'sur ce qu’on dit au client');
      const citations = s.corps.split('\n').filter((l) => /^>\s*[✅❌]/.test(l));
      assert.equal(citations.length, 2, `les deux formulations doivent être données côte à côte (${citations.length} trouvée·s)`);

      const bonne = citations.filter((l) => l.includes('✅'));
      const mauvaise = citations.filter((l) => l.includes('❌'));
      assert.equal(bonne.length, 1, 'une seule formulation recommandée');
      assert.equal(mauvaise.length, 1, 'une seule formulation proscrite');

      assert.match(bonne[0], /attend son tour/i, 'la formulation recommandée doit dire que ça attend son tour');
      assert.match(mauvaise[0], /en cours/i, 'la formulation proscrite est « c’est en cours »');
      assert.ok(!/attend son tour/i.test(mauvaise[0]), 'dire qu’on attend son tour ne peut pas être la formulation proscrite');
    },
  },

  {
    id: 'relevement-avant-de-parler',
    quoi: 'le relèvement se lit avant de parler, et ses trois règles obligent encore',
    verifier({ metier }) {
      // EF-REL-012. Une consigne allusive sera lue par un agent, pas par une personne : le
      // chemin doit être une suite de lectures numérotées, pas une intention. Et les trois
      // règles qui l'accompagnent sont des interdits — les retourner ferait saluer avant
      // d'avoir lu et annoncer qu'on est la session neuve.
      const s = sectionDe(metier, /^Le relèvement/, 'de relèvement');
      const etapes = [...s.corps.matchAll(/^\s*\d+\.\s+\S/gm)];
      assert.ok(etapes.length >= 4, `le relèvement doit être une suite de lectures ordonnées (${etapes.length} trouvée·s)`);
      assert.match(s.corps, /action get/, 'il doit relire les demandes une à une, pas seulement leur liste');
      assert.match(s.corps, /commentaires/i, 'c’est le fil de commentaires qui porte ce qui a été compris et promis');

      const REGLES = [
        { quoi: 'ne rien dire du fond avant d’avoir lu', sonde: /ne dis rien (?:du fond )?avant/i },
        { quoi: 'ne pas annoncer qu’on est nouveau', sonde: /n.annonces pas que tu es nouveau/i },
        { quoi: 'ne pas inventer ce qu’on n’a pas lu', sonde: /n.inventes pas/i },
      ];
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, REGLES.length, `${puces.length} règle(s) écrite(s) pour ${REGLES.length} gardée(s)`);
      for (const { quoi, sonde } of REGLES) {
        const trouvees = puces.filter((p) => sonde.test(p));
        assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement (${trouvees.length} trouvée·s)`);
        exigeImperatif(trouvees[0], quoi);
      }
    },
  },

  {
    id: 'ronde-tient-par-un-mecanisme',
    quoi: 'la ronde est un MÉCANISME qu’on pose, pas une discipline — et elle laisse une trace horaire',
    verifier({ metier }) {
      // T-20260816-0100 : un client a eu sa production morte cinq jours sans que son
      // représentant le sache. Écrire « fais des rondes » ne répare rien : un devoir
      // périodique sans réveil se tient tant que quelqu'un y pense, puis cesse SANS QUE
      // RIEN NE LE SIGNALE. C'est le seul manquement de ce métier qui ne produit aucun
      // symptôme — donc le seul qui exige d'être gardé sur son mécanisme, pas sur son
      // intention.
      const s = sectionDe(metier, /^Ta ronde/, 'sur la ronde');

      // (a) LE MÉCANISME. Une ronde qui repose sur la bonne volonté n'existe pas.
      assert.match(s.corps, /boucle/i, 'la ronde doit nommer le mécanisme qui la réveille, pas seulement le devoir');
      assert.match(
        s.corps, /pose[s]?\b[^.]{0,40}\ben naissant\b|\ben naissant\b[^.]{0,40}\bpose/i,
        'la boucle se pose À LA NAISSANCE — une cadence laissée au jugement en cours de route est le défaut, pas le remède',
      );

      // (b) ELLE NE SURVIT PAS À LA MORT. Sans ce rappel, un représentant renaît muet.
      assert.match(
        s.corps, /repose[s]?\b[^.]{0,60}renaissance|renaissance[^.]{0,60}repose/i,
        'la ronde doit dire qu’elle se REPOSE à chaque renaissance — elle ne survit pas à la session',
      );

      // (c) UNE CADENCE CHIFFRÉE. « régulièrement » ne se vérifie pas.
      assert.match(s.corps, /\b(?:un tour par heure|toutes les \d+|\d+\s*(?:min|heure))/i,
        'la ronde doit porter une cadence chiffrée — « régulièrement » ne se mesure pas');

      // (d) LA PREUVE. Une ronde éteinte ne produit AUCUNE erreur : la seule trace
      // possible est l'heure de chaque tour, et son absence est le seul signal.
      assert.match(s.corps, /heure de chaque tour|l.heure de son tour|laisse son heure/i,
        'la ronde doit exiger que chaque tour laisse son heure — c’est la seule preuve qu’elle tourne');

      // (e) ET ELLE NE RÉPARE RIEN. Le réflexe de redémarrer ce qui paraît mort détruit
      // la capacité d'attribuer, en plus de ne rien réparer.
      // ⚠️ LA LIGNE DOIT EXISTER AVANT QU'ON JUGE SA MODALITÉ. `find()` rend `undefined`
      // quand rien ne matche, et `exigeImperatif('')` passe en silence — la garde laissait
      // donc SUPPRIMER l'interdit le plus dangereux de cette section sans rougir. Trouvé en
      // revue indépendante, éprouvé : le contrôle restait vert phrase entièrement retirée.
      const interdit = s.corps.split('\n').find((l) => /ne répare jamais|jamais réparer/i.test(l));
      assert.ok(interdit, 'l’interdit de RÉPARER pendant une ronde doit être écrit — une ronde qui répare est plus dangereuse que le défaut qu’elle cherche');
      exigeImperatif(interdit, 'l’interdit de réparer pendant une ronde');
    },
  },

  {
    id: 'etat-de-reprise-vit-dehors',
    quoi: 'l’état s’écrit à chaque tour, dans un lieu nommé, et ne parle jamais au client',
    verifier({ metier }) {
      // Ce rôle a un interlocuteur qui SE SOUVIENT DE TOUT. Perdre le fil ne coûte pas une
      // mesure à refaire : ça fait redire au client ce qu'il a déjà dit, et ça lui apprend
      // en une phrase que personne ne l'écoutait.
      // `sectionDe` s'arrête au premier sous-titre : chaque sous-section se garde donc
      // chez elle, ce qui est de toute façon la bonne maille — une règle vaut là où l'acte
      // se pose, pas dans un préambule qui la mentionne.
      const ecrire = sectionDe(metier, /^Écris ton état de reprise/, 'sur l’écriture de l’état');
      const relire = sectionDe(metier, /^Reprends par la lecture/, 'sur la reprise par la lecture');
      const attente = sectionDe(metier, /^N.oblige jamais un client/, 'sur l’attente du client');

      // (a) LE MOMENT. Un relais écrit à la dernière minute est écrit par un agent déjà
      // appauvri — c'est le moment où il en est le moins capable.
      assert.match(ecrire.titre + ecrire.corps, /à chaque tour/i,
        'l’état de reprise doit s’écrire À CHAQUE TOUR, pas à l’approche de la panne');
      assert.match(ecrire.corps, /dernière minute|déjà appauvri/i,
        'le métier doit dire POURQUOI l’écrire tard ne vaut rien, sinon la règle se relâche');

      // (b) LE LIEU. Un état sans lieu nommé est un état que personne ne relira.
      assert.match(ecrire.corps, /demands? action comment|fil de la demande/i,
        'l’état doit nommer le lieu où il s’écrit — un lieu allusif ne se retrouve pas');

      // (c) IL NE DESCEND PAS. C'est du travail en cours, pas un engagement.
      // ⚠️ Deux interdits distincts, donc DEUX assertions. Une alternative « A ou B » ici
      // laissait survivre la mutation qui supprime A : B suffisait à la satisfaire.
      // ⚠️ POLARITÉ, PAS PRÉSENCE. `assert.match` reste vert devant « on pourrait croire
      // qu'il ne parle jamais au client — en réalité, un état bien résumé peut lui être
      // recopié » : la sonde y est, la règle est retournée. Éprouvé en revue.
      exigePolarite(ecrire.corps, /ne parle jamais au client/i,
        'l’interdit de faire descendre l’état dans le canal du client');
      assert.match(ecrire.corps, /ne quitte jamais son fil/i,
        'l’état ne doit jamais quitter le fil où il s’écrit');

      // (d) ON REPREND PAR LA LECTURE. Un agent qui agit sur un souvenir contredit ce qui
      // est inscrit sans le savoir.
      assert.match(relire.titre + relire.corps, /jamais par la mémoire/i,
        'la reprise se fait par la LECTURE, jamais par la mémoire');

      // (e) ET LE CLIENT N'ATTEND PAS PENDANT UNE REPRISE. Le compact est bon marché pour
      // l'agent, pas pour l'humain au bout du fil.
      assert.match(attente.corps, /ensuite tu reprends|avant de reprendre/i,
        'le métier doit interdire de reprendre pendant qu’un client attend');
    },
  },

  {
    id: 'accuse-precede-le-relevement',
    quoi: 'l’accusé de réception passe AVANT le relèvement — par le rang OU en toutes lettres —, il précède la parole de fond, et seul l’accusé passe avant',
    verifier({ metier }) {
      // Chantier `D-20260817-0008` ; le fait lui-même est consigné au changelog v1.1.0 de
      // l'ABC (Somcraft `e4b72bc9-b7a7-43f1-812e-72f58abe50be`), pas dans la Demande —
      // pointeur corrigé en revue. Un représentant a mené un relèvement complet et écrit deux
      // messages au dirigeant avant que le client n'entende un mot — pendant qu'un employé
      // de ce client s'apprêtait à relancer une commande destructrice en production. Le
      // texte disait QU'il accuse réception. Il ne disait pas QUAND.
      const s = sectionDe(metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
      const etapes = etapesDe(s.corps).map((e) => ({ ...e, cle: e.libelle }));

      const accuse = rangUnique(etapes, /accuse/i, 'accuser réception');
      const ronde = rangUnique(etapes, /pose ta ronde/i, 'poser sa ronde');
      const parler = rangUnique(etapes, /parle/i, 'parler du fond');
      // ⚠️ LE RELÈVEMENT SE RÉSOUT ICI, ET IL NE SE RÉSOLVAIT PAS. Ce contrôle ANNONÇAIT
      // dans son `quoi` que l'accusé passe avant le relèvement, et ne le nommait nulle part :
      // il comparait l'accusé à la PAROLE DE FOND, qui est une autre garantie. Un faux témoin
      // poli — le nom rassurait sur une garde que le code ne posait pas. Relevé en revue
      // indépendante de la PR #299.
      const relever = rangUnique(etapes, /relève|relever/i, 'relever');

      assert.ok(accuse.rang < parler.rang,
        `l’accusé (rang ${accuse.rang}) doit précéder la parole de fond (rang ${parler.rang})`);
      assert.ok(ronde.rang < parler.rang,
        `la ronde (rang ${ronde.rang}) se pose avant de parler (rang ${parler.rang}) — après, on l’oublie`);

      // ══ L'ANTÉRIORITÉ SUR LE RELÈVEMENT, ET ELLE NE TIENT PAS PAR LE RANG.
      //
      // Le relèvement porte le rang 3 et l'accusé le rang 4 : le rang dit l'INVERSE de
      // l'arbitrage du 2026-08-17. Ne pas renuméroter est un arbitrage de COORDINATION de ce
      // chantier — un ordre qui a l'air juste ne garde rien. La garantie a donc DEUX porteurs, et il suffit qu'un
      // tienne : le RANG, ou l'INCISE en toutes lettres dans l'énoncé de l'accusé. Aujourd'hui
      // c'est l'incise ; si un jour la liste est renumérotée, le rang prendra le relais sans
      // que cette garde ait à changer.
      const parLIncise = ANTERIORITE_SUR_LE_RELEVEMENT.exec(accuse.enonce);
      assert.ok(
        accuse.rang < relever.rang || parLIncise,
        `l’accusé (rang ${accuse.rang}) ne précède pas le relèvement (rang ${relever.rang}), et son `
          + `énoncé ne porte plus l’antériorité en toutes lettres — « ${accuse.enonce.trim()} ». `
          + `L’arbitrage du 2026-08-17 (ABC R4.7 / GF-GCL-008 / CT-GCL-010) n’est alors porté par RIEN.`,
      );

      // ⚠️ ET LA PRÉSENCE N'EST PAS L'ABSENCE DU CONTRAIRE. Un énoncé peut porter l'incise ET
      // la subordination inverse ; et surtout, remplacer l'incise par son contresens exact
      // laissait tout vert avant ce lot. On interdit donc la POSTÉRIORITÉ dans cet énoncé.
      //
      // ⚠️ CE QUE CETTE LIGNE VAUT, ET CE QU'ELLE NE VAUT PAS. C'est un FILTRE DE VOCABULAIRE,
      // comme `PERMISSIF` : elle attrape les tournures qu'on lui a apprises, jamais « toute
      // façon de dire après ». Le premier jet de ce lot affirmait « quelle que soit la tournure
      // qui l'amène » — c'était FAUX, et une revue indépendante l'a démontré en une mutation.
      // La ligne suivante ferme la famille qu'elle laissait passer ; d'autres resteront.
      const subordonne = POSTERIORITE_SUR_LE_RELEVEMENT.exec(accuse.enonce);
      assert.ok(
        !subordonne,
        `l’énoncé de l’accusé subordonne le geste à la FIN du relèvement (« ${subordonne && subordonne[0]} ») `
          + `— c’est le contresens exact de l’arbitrage du 2026-08-17, et il ne coûte qu’une incise : `
          + `« ${accuse.enonce.trim()} »`,
      );

      // ⚠️ ET L'INCISE PEUT ÊTRE LÀ, INTACTE, DANS UNE PHRASE QUI LA NIE. Trouvé par la revue
      // indépendante de ce lot, en une mutation restée VERTE : « ce n'est pas vrai que tu
      // accuses **avant même d'avoir fini de relever** : en réalité tu accuses ensuite ».
      // L'antériorité s'y reconnaît — c'est une sous-chaîne —, la postériorité ne s'y reconnaît
      // pas, et le sens est exactement inversé. C'est le motif que ce fichier documente depuis
      // le 2026-08-16 sous `RENVERSEMENT`, et que ce contrôle n'appliquait pas : la garde
      // existait déjà, à trois cents lignes d'ici, et personne ne l'avait branchée ici.
      //
      // ⚠️ ET ON REGARDE LA PHRASE QUI PORTE L'INCISE, PAS L'ÉNONCÉ ENTIER — c'est un
      // correctif, pas un raccourci, et il reprend celui d'`exigePolarite` trois cents lignes
      // plus haut, jusqu'à son découpage sur `[.!?]` (le premier jet coupait sur `.` seul —
      // « jumeau exact » était écrit, ça n'en était pas un ; relevé en vérification). Sur l'énoncé entier, une phrase parfaitement légitime
      // écrite APRÈS l'incise rougissait à tort : « …, dès que sa ligne est ouverte. C'est,
      // EN RÉALITÉ, la toute première chose que tu fais. » Mesuré par une contre-vérification
      // indépendante. Une garde qui crie sur du texte correct ne survit pas : le premier qui
      // la rencontre la retire, et emporte ce qu'elle gardait vraiment.
      const porteuse = parLIncise
        ? accuse.enonce.split(/(?<=[.!?])\s+/).find((p) => ANTERIORITE_SUR_LE_RELEVEMENT.test(p))
        : null;
      const enveloppe = porteuse && RENVERSEMENT.exec(porteuse);
      assert.ok(
        !enveloppe,
        `la phrase qui porte l’antériorité l’enveloppe d’un renversement (« ${enveloppe && enveloppe[0]} ») : `
          + `l’incise y est encore écrite, et la phrase dit le contraire — « ${porteuse && porteuse.trim()} »`,
      );

      // ⚠️ ET LA PHRASE D'À CÔTÉ. Restreindre la garde ci-dessus à la phrase porteuse a
      // rouvert ce qu'elle fermait : « …, dès que sa ligne est ouverte. Ce n'est pas vrai :
      // le relèvement passe en premier. » passait. Celle-ci traverse TOUT l'énoncé — elle
      // le peut, parce qu'elle est ancrée sur le relèvement et non sur des tournures de
      // français ordinaire. Les trois gardes ne se remplacent pas : chacune ferme ce que
      // les autres laissent ouvert, et aucune ne suffit seule.
      const prioritaire = PRIORITE_DU_RELEVEMENT.exec(accuse.enonce);
      assert.ok(
        !prioritaire,
        `l’énoncé de l’accusé affirme la PRIORITÉ du relèvement (« ${prioritaire && prioritaire[0]} ») : `
          + `c’est la polarité contraire de l’arbitrage du 2026-08-17, peu importe la tournure qui `
          + `l’amène — « ${accuse.enonce.trim()} »`,
      );

      // LE RANG NE SUFFIT PAS : une étape peut garder sa place et cesser d'obliger.
      exigeImperatif(accuse.enonce, 'l’étape d’accusé de réception');
      exigeImperatif(ronde.enonce, 'l’étape de pose de la ronde');
      // ⚠️ ET LA MODALITÉ DE L'INCISE ELLE-MÊME, pas seulement celle de l'énoncé qui la porte :
      // « — avant même d'avoir fini de relever, si tu en as le temps » garde l'antériorité et
      // la vide. ⚠️ Ce filet ne peut PAS attraper le renversement gardé juste au-dessus —
      // « quand tu auras fini de relever » n'est pas une tournure permissive, et le vérifier
      // tenait de la mesure, pas du raisonnement.
      if (parLIncise) exigeImperatif(accuse.enonce.slice(accuse.enonce.indexOf(parLIncise[0])), 'l’incise d’antériorité de l’accusé');

      // ET LA BORNE. Un accusé qui laisse entendre une réponse en route rouvre exactement
      // ce que la frontière de l'engagement ferme.
      const c = sectionDe(metier, /^Accuse réception avant de travailler/, 'sur l’accusé de réception');
      assert.match(c.corps, /n.est pas une promesse|jamais\s*«?\s*une réponse est en route/i,
        'le métier doit dire qu’un accusé n’est PAS une promesse — sinon il engage');
      // ⚠️ Même piège : la borne se garde sur sa POLARITÉ, pas sur sa présence.
      exigePolarite(c.corps, /seul l.accusé passe avant/i,
        'la borne de l’exception : SEUL l’accusé passe avant le relèvement');
    },
  },

  {
    id: 'anti-patterns-couverts',
    quoi: 'les fautes déjà commises sont toutes nommées comme des fautes, du côté de ce qu’on ne fait pas',
    verifier({ metier }) {
      // Chacune de ces lignes a été payée une fois. Une table d'anti-patterns dont on
      // retire discrètement une ligne est le mode de régression le plus silencieux d'un
      // document : rien ne casse, et la faute redevient tentante. La colonne est résolue
      // par son en-tête — sans quoi permuter les deux libellés ferait de chaque faute une
      // raison de la commettre.
      const s = sectionDe(metier, /anti-patterns/i, 'd’anti-patterns');
      const table = tableDe(s.corps);
      const fautes = colonne(table, /^Ce qu'on est tenté de faire$/i, 'ce qu’on est tenté de faire');
      const raisons = colonne(table, /^Pourquoi ça casse$/i, 'pourquoi ça casse').join(' ');

      const FAUTES = [
        { quoi: 'relever avant d’être joignable', sonde: /avant d.avoir ouvert sa ligne/i },
        { quoi: 'répondre « oui c’est possible »', sonde: /c.est possible/i },
        { quoi: 'tout inscrire à la fin', sonde: /à la fin/i },
        { quoi: 'lancer avant validation', sonde: /avant que le client ait validé/i },
        { quoi: 'prendre un second client', sonde: /second client/i },
        { quoi: 'écrire ce qu’on sait du client dans le fichier généré', sonde: /CLAUDE\.md/ },
        { quoi: 'renvoyer une pièce au client', sonde: /renvoyer au client/i },
        { quoi: 'inviter quelqu’un dans le canal', sonde: /inviter soi-même/i },
        { quoi: 'trancher un arbitrage « simple »', sonde: /trancher un arbitrage/i },
        { quoi: 'saluer avant d’avoir relevé', sonde: /saluer avant/i },
      ];
      for (const { quoi, sonde } of FAUTES) {
        assert.equal(fautes.filter((c) => sonde.test(c)).length, 1, `« ${quoi} » doit être nommée une fois exactement comme une faute`);
      }
      // Et la colonne des raisons ne doit pas porter les fautes : si les deux en-têtes sont
      // permutés, ce qui était « ce qu'on est tenté de faire » devient « pourquoi ça casse ».
      assert.ok(
        !/renvoyer au client/i.test(raisons),
        'les fautes figurent du côté des raisons — les deux colonnes de la table sont inversées',
      );
    },
  },

  {
    id: 'reception-seulement',
    quoi: 'la pièce se reçoit et ne se renvoie jamais — et l’interdit n’est pas devenu une permission',
    verifier({ metier }) {
      // HS-REL-003. La première version gardait cet interdit par ABSENCE DE JETONS
      // techniques (`files.upload`, …) que le gabarit n'a jamais contenus : l'assertion
      // était vraie par construction, pas par garde. Remplacer la phrase par son contraire
      // — « tu peux lui renvoyer les pièces qu'il demande » — ne faisait rougir personne.
      // On garde donc la MODALITÉ de l'énoncé, là où il vit.
      const s = sectionDe(metier, /ce que le client dépose/i, 'sur les pièces déposées par le client');

      // On ne retient que les énoncés MIS EN AVANT (en gras) dont le sujet est l'envoi vers
      // le client : la prose de la section parle aussi de ce que le client, lui, envoie —
      // et confondre les deux sens ferait rougir le gabarit intact.
      const enonces = s.corps
        .split('\n')
        .map((l) => ({ ligne: l, gras: [...l.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]).join(' ') }))
        .filter(({ gras }) => /\b(?:envoies|renvoies|renvoyer|envoyer)\b/i.test(gras));
      assert.equal(enonces.length, 1, `la section doit dire une fois exactement ce qu’il advient de l’envoi vers le client (${enonces.length} trouvée·s)`);

      const { ligne, gras } = enonces[0];
      exigeImperatif(ligne, 'l’interdit d’envoyer une pièce au client');
      assert.match(
        gras, /jamais|aucune|ne\s+lui\s+envoies/i,
        `« ${ligne.trim()} » ne nie plus l’envoi : la réception seule entre dans le périmètre (HS-REL-003)`,
      );
      // Les jetons techniques restent proscrits — mais comme filet, jamais comme garde
      // principale : ils ne prouvent rien tant qu'aucun d'eux ne pourrait apparaître.
      for (const envoi of ['files.upload', 'files_upload', 'chat.postMessage']) {
        assert.ok(!metier.includes(envoi), `le métier enseigne « ${envoi} » : il ne renvoie rien au client`);
      }
    },
  },


  {
    id: 'crochet-pose-par-le-dispositif',
    quoi: 'le crochet est posé par le dispositif, il n’est pas l’accusé de réception de l’agent',
    verifier({ metier }) {
      // T-20260815-0011. Le dirigeant écrivait « allo » pour savoir s'il avait été entendu.
      // Le crochet répond à ça — mais il ne vaut que si le métier dit ce qu'il EST.
      //
      // ⚠️ LES DEUX SENS SE RETOURNENT FACILEMENT, et c'est ce que ce contrôle garde. Un métier
      // qui enseignerait « pose un crochet quand tu as lu » redonnerait à la discipline de
      // l'agent ce que le dispositif venait de lui retirer — or un agent occupé est exactement
      // celui qui n'y pense pas. C'est le motif que le ticket écarte dès sa première ligne.
      const enonces = metier.split('\n').filter((l) => /crochet/i.test(l));
      assert.ok(enonces.length >= 1, 'le métier ne dit rien du crochet — un agent ne saura pas ce qu’il vaut');

      const dit = enonces.join('\n');

      // ⚠️ CE CONTRÔLE CHERCHAIT DES SOUS-CHAÎNES, ET UN CONTRESENS Y PASSAIT — relevé en revue
      // de fond, prouvé en exécutant le contrôle contre le texte suivant, qui passait :
      //
      //   « Ne crois pas que le dispositif le pose seul, tu n'as rien à faire : en réalité
      //     c'est TOI qui dois poser le crochet dès que tu as lu le message. »
      //
      // Les mots-clés y sont tous, et le sens est inversé. On regarde donc ce qui PRÉCÈDE
      // l'énoncé sur SA ligne — une négation qui l'enveloppe le retourne sans toucher à un
      // seul de ses mots. C'est le motif dominant de ce harnais : une garde qui lit des mots
      // sans lire ce qu'ils disent.
      //
      // ⚠️ Et la garde porte sur la ligne PORTEUSE, pas sur tout ce qui parle de crochet : la
      // première écriture attrapait « ce n'est pas ta mémoire qui flanche », phrase parfaitement
      // saine d'un paragraphe voisin. Une garde qui crie sur le texte juste ne sera pas gardée.
      const porteuse = enonces.find((l) => /le dispositif le pose seul/i.test(l)) || '';
      const avantLEnonce = porteuse.slice(0, porteuse.toLowerCase().indexOf('le dispositif le pose seul'));
      assert.ok(
        !/\b(?:ne crois pas|contrairement|au contraire|n['’]est pas vrai|est faux)\b/i.test(avantLEnonce),
        `« ${porteuse.trim().slice(0, 90)}… » : l'énoncé est enveloppé d'une négation — les ` +
          'mots-clés survivent à leur propre contresens',
      );
      // Ce n'est PAS l'agent qui le pose : la garde porte sur la polarité de l'énoncé, pas sur
      // la présence du mot « crochet », qu'un contresens conserverait tel quel.
      assert.match(
        dit, /le dispositif le pose seul|tu n['’]as rien à faire/i,
        'le métier doit dire que le crochet est posé SANS l’agent — sinon il redevient une discipline',
      );
      assert.ok(
        !/\bpose(-le|s)?\s+(un\s+)?crochet\b/i.test(dit),
        'le métier enseigne à l’agent de poser un crochet : c’est exactement ce que ce dispositif remplace',
      );
      // Et il ne remplace pas la parole : les deux signaux ne disent pas la même chose.
      assert.match(
        dit, /ne le remplace pas|reste utile/i,
        'le métier doit dire que « je m’en occupe » garde sa valeur — le crochet dit seulement que c’est arrivé',
      );
      // L'ABSENCE est la moitié qui a de la valeur ; un métier qui n'en parle pas laisse
      // l'agent conclure d'un silence qu'il n'a rien reçu.
      assert.match(dit, /absence/i, 'le métier doit dire ce que l’absence de crochet signifie');
    },
  },

  {
    id: 'contexte-necessaire',
    quoi: 'le canal n’est nommé nulle part ailleurs que dans CONTEXTE.md — le métier ne peut pas s’exécuter sans le lire',
    verifier({ metier }) {
      // RA-REL-014. La frontière entre les deux fichiers n'existe sur le papier que si le
      // métier RENVOIE réellement au contexte. Un titre écrit en dur dans le gabarit le
      // rendrait décoratif — et ferait signer tous les représentants du même nom.
      // T-20260814-0033 : DEUX ouvertures, et on les distingue par ce qu'elles PORTENT, pas
      // par leur rang dans le texte. Les compter sans les apparier laisserait passer deux
      // lignes clientes, ou deux lignes internes — c'est-à-dire un gestionnaire muet d'un côté
      // ou l'autre, avec le bon nombre de commandes.
      const ouvertures = [...metier.matchAll(/\$LD ouvrir[^\n]*/g)].map((m) => m[0]);
      assert.equal(ouvertures.length, 2, `un gestionnaire ouvre DEUX lignes — celle du client et celle du dirigeant (${ouvertures.length} trouvée·s)`);

      const clientes = ouvertures.filter((o) => /--nature client/.test(o));
      assert.equal(clientes.length, 1, 'une seule ligne CLIENTE — un client, un canal privé');
      assert.match(clientes[0], /--titre/, 'sans titre, la commande refuse d’ouvrir une ligne cliente');

      const titre = clientes[0].match(/--titre\s+"([^"]*)"/);
      assert.ok(titre, 'le titre doit être passé entre guillemets');
      assert.match(titre[1], /CONTEXTE\.md/, `le titre « ${titre[1]} » est écrit en dur : il doit venir du contexte du client`);

      // ═══ LA LIGNE DU DIRIGEANT — et chacune de ces trois choses a une conséquence propre.
      const internes = ouvertures.filter((o) => !/--nature client/.test(o));
      assert.equal(internes.length, 1, 'une seule ligne vers le DIRIGEANT');
      assert.ok(
        !/--nature/.test(internes[0]),
        `« ${internes[0]} » nomme une nature : sa ligne interne n’en porte aucune, et le garde du lieu la refuserait`,
      );
      // Le CHANTIER est ce que `--a` visera (T-20260813-0078) : s'il change ici, « --a
      // dirigeant » ne désigne plus rien et chaque remontée est refusée.
      assert.match(
        internes[0], /\$LD ouvrir dirigeant(?=\s|$)/,
        `« ${internes[0]} » n’ouvre pas le chantier « dirigeant » — « --a dirigeant » ne désignerait plus sa ligne`,
      );
      // Sans ce drapeau, la ligne s'ouvre avec une liste d'autorisés VIDE : elle a l'air
      // ouverte et refuse la parole à tout le monde, au dirigeant le premier.
      assert.match(
        internes[0], /--au-dirigeant(?=\s|$)/,
        `« ${internes[0]} » n’autorise personne : la ligne naîtrait muette`,
      );
    },
  },

  {
    id: 'deux-lignes-et-ce-qui-ne-traverse-pas',
    quoi: 'les deux lignes sont distinguées par leur DESTINATAIRE, le nommage oblige, et l’étanchéité est un interdit — pas un conseil',
    verifier({ metier }) {
      // T-20260814-0033. L'ancien métier interdisait la seconde ligne ; elle existe désormais
      // (T-20260813-0076) et le garde du lieu l'EXIGE. Ce qui a disparu, c'est l'interdit —
      // pas le risque : ce qui transite vers le dirigeant est précisément ce qu'on ne dit pas
      // au client, et une inversion lui livre la chose exacte qu'on lui cachait.
      //
      // ⚠️ CE CONTRÔLE NE CHERCHE PAS DE PHRASE. Il porte sur la POLARITÉ (quelle ligne porte
      // quel destinataire, résolue par les libellés d'en-tête et jamais par l'index), sur la
      // MODALITÉ (l'étanchéité est-elle un interdit ou une recommandation), et sur le COMPTE
      // des gestes qui exigent d'être nommés. C'est la seule forme qui survive à une
      // reformulation légitime tout en rougissant sur un affaiblissement.
      const s = sectionDe(metier, /tes deux lignes/i, 'sur les deux lignes');
      const table = tableDe(s.corps);

      // LA POLARITÉ. Permuter les deux en-têtes ferait viser le client par « --a dirigeant »
      // sans déplacer une seule cellule — l'inversion, écrite dans le métier lui-même.
      const versClient = colonne(table, /^ta ligne avec le client$/i, 'la ligne du client').join(' ');
      const versDirigeant = colonne(table, /^ta ligne avec le dirigeant$/i, 'la ligne du dirigeant').join(' ');
      assert.match(versDirigeant, /--a dirigeant/, 'la ligne du dirigeant se vise par « --a dirigeant »');
      assert.ok(
        !/--a dirigeant/.test(versClient),
        'le client se viserait par « --a dirigeant » : les deux colonnes sont inversées',
      );
      // Et ce qui y passe : le client reçoit ce qu'on lui dit, le dirigeant ce qu'on ne lui
      // dit PAS. Une table dont les deux moitiés diraient la même chose n'enseignerait rien.
      assert.notEqual(
        versClient, versDirigeant,
        'les deux lignes portent le même contenu : rien ne les distingue plus',
      );

      // LE NOMMAGE OBLIGE — et le compte des gestes est gardé, parce qu'en oublier un dans
      // l'énumération est exactement la façon dont une garde se perd sans qu'on la retire.
      const nommage = s.corps.split('\n').filter((l) => /--a\b/.test(l) && /\bexige|\btoujours\b/i.test(l));
      assert.ok(nommage.length >= 1, 'le métier doit dire que la ligne visée se nomme TOUJOURS');
      exigeImperatif(nommage.join(' '), 'le nommage de la ligne visée');
      for (const geste of ['dire', 'demander', 'fermer', 'renommer']) {
        assert.match(
          s.corps, new RegExp(`\`${geste}\``),
          `« ${geste} » exige d’être nommé lui aussi — l’oublier ici le laisse deviner sa ligne`,
        );
      }
      // Sans nom, le geste est REFUSÉ. Si le métier annonçait qu'il part quand même « sur la
      // ligne la plus probable », il enseignerait le contraire de ce que la commande fait.
      assert.match(s.corps, /refus/i, 'le métier doit dire qu’un geste sans nom est REFUSÉ, pas deviné');

      // L'ÉTANCHÉITÉ EST UN INTERDIT, PAS UN CONSEIL. C'est la mutation qui compte : « évite
      // de faire descendre… » garde tous les mots et ne garde plus rien.
      const etanche = s.corps
        .split('\n')
        .filter((l) => /ne\s+(?:descend|traverse)|ne\s+descend|traverse jamais/i.test(l) || /rien de ce qui monte/i.test(l));
      assert.ok(etanche.length >= 1, 'le métier doit dire ce qui ne traverse JAMAIS d’une ligne à l’autre');
      exigeImperatif(etanche.join(' '), 'l’étanchéité entre les deux lignes');
      // ⚠️ CE CONTRÔLE N'A PLUS DE SONDE À LUI, ET C'EST LE CORRECTIF — relevé en revue de fond.
      //
      // Il en portait une (« évite », « essaie »…), écrite ici parce que `PERMISSIF` ne les
      // connaissait pas : `\bévite` ne s'apparie JAMAIS (`é` n'est pas un caractère de mot),
      // le piège que ce fichier documente déjà pour « privé\b », rejoué par l'autre bout.
      // Corriger LOCALEMENT laissait la même famille ouverte sur la dizaine d'autres appels
      // d'`exigeImperatif` — dont celui qui garde le nommage, c'est-à-dire la garde qui
      // REMPLACE l'ancien interdit. « Une porte sur deux », dans le correctif d'une porte sur
      // deux. La famille est donc entrée dans `PERMISSIF`, et `exigeImperatif` ci-dessus la
      // porte pour tout le monde.
      //
      // Sa forme y est PRÉCISE — « évite de », « en évitant » — jamais « évite » nu : le
      // gabarit dit légitimement « l'aveu qu'on cherche à éviter », dans une puce elle-même
      // gardée. Une sonde plus large aurait fait rougir ce qui marche.
      // Et elle doit dire ce qu'une inversion COÛTE — sans quoi elle se lit comme une règle
      // d'hygiène qu'on relâche le jour où elle gêne.
      assert.match(s.corps, /ne se reprend pas|irrattrapable|lu avant d.être effacé/i, 'et ce qu’une inversion coûte');
    },
  },

  {
    id: 'remontee-par-la-ligne',
    quoi: 'la remontée passe par la ligne du dirigeant — le registre garde la trace, il ne prévient personne',
    verifier({ metier }) {
      // T-20260814-0033. L'ancien texte disait que la remontée était « un pis-aller » et
      // envoyait vers un orchestrateur tiers, ou vers une note qui « ne prévient personne ».
      // Les deux obligations du métier — remonter ce qui engage, remonter un danger AVANT
      // d'en parler au client — n'avaient donc aucun chemin qui atteigne quelqu'un.
      const s = sectionDe(metier, /comment tu remontes/i, 'sur la remontée au dirigeant');

      // LE GESTE, ET SA LIGNE. Un `demander` qui ne nomme pas sa ligne serait refusé ; un
      // `demander` nommé vers le client poserait AU CLIENT la question qui appartient au
      // dirigeant. C'est l'appariement des deux qui compte, pas leur présence séparée.
      const blocs = blocsBash(s.corps).join('\n');
      assert.match(blocs, /demander[^\n]*--a dirigeant/, 'la remontée se fait par « demander … --a dirigeant »');
      assert.ok(
        !/--a\s+<le client>/.test(blocs),
        'la section de remontée enseigne un geste vers le CLIENT : l’arbitrage lui serait posé à lui',
      );

      // LA DISTINCTION QUI PORTE TOUT : la ligne fait ARRIVER, le registre fait DURER. Les
      // confondre ramène le défaut d'origine — une question inscrite quelque part et jamais lue.
      assert.match(s.corps, /\bSD\b|registre|demands/i, 'ce qui doit survivre à la session va aussi au SD');
      assert.match(
        s.corps, /n.est pas une notification|ne prévient personne/i,
        'le métier doit dire qu’une note au registre ne prévient personne',
      );
      // Et le pis-aller ne doit plus être présenté comme le chemin : un métier qui dit encore
      // « ce n'est pas le mécanisme prévu » enseigne de ne pas s'en servir.
      // ⚠️ LE TITRE COMPTE AUTANT QUE LE CORPS, et c'est une mutation SURVIVANTE qui l'a
      // imposé : elle remettait « et pourquoi c'est aujourd'hui un pis-aller » dans le TITRE
      // seul, que `sectionDe` ne rend pas avec le corps. Un agent lit le titre en premier —
      // « ce n'est pas le mécanisme prévu » lui dit de ne pas s'en servir, quoi que dise la suite.
      const entier = `${s.titre}\n${s.corps}`;
      assert.ok(
        !/pis-aller|n.est pas le mécanisme prévu|en attendant/i.test(entier),
        'la remontée est encore présentée comme un pis-aller — elle est le mécanisme, désormais',
      );
    },
  },

  {
    id: 'canal-prive',
    quoi: 'le canal du client naît PRIVÉ, et le métier dit pourquoi ça n’est pas négociable',
    verifier({ metier }) {
      // RA-REL-001 au niveau du transport. Un canal client public expose le portefeuille à
      // quiconque a un compte chez nous. Changer « privé » en « public » dans l'explication
      // de `--nature client` ne faisait rougir personne, alors que c'est une fuite.
      const s = sectionDe(metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
      const puces = pucesDe(s.corps).filter((p) => /--nature client/.test(p));
      assert.equal(puces.length, 1, 'la nature cliente de la ligne doit être expliquée une fois exactement');
      // Note : pas de `\b` après « privé ». En JavaScript, `é` n'est pas un caractère de
      // mot, donc `privé\b` ne s'apparie jamais en fin de mot — le contrôle serait rouge
      // sur un gabarit correct. Le piège est classique dès qu'on garde du texte français.
      assert.match(puces[0], /\bprivé/i, 'la ligne cliente fait naître un canal PRIVÉ — c’est ce qui cloisonne le portefeuille');
      assert.ok(
        !/\bcanal public\b/i.test(puces[0]),
        `« ${puces[0].trim()} » annonce un canal public : le portefeuille client serait exposé`,
      );

      // Et le refus de s'installer sur un canal public, s'il porte le bon nom, doit tenir.
      const refus = pucesDe(s.corps).filter((p) => /confidentialité/i.test(p));
      assert.equal(refus.length, 1, 'le métier doit dire quoi faire quand la ligne refuse pour confidentialité');
      exigeImperatif(refus[0], 'le refus de s’installer sur un canal public');
      assert.match(refus[0], /n.insiste pas|ne contourne pas/i, 'et ce refus ne se contourne pas');
    },
  },

  {
    id: 'aucune-substitution',
    quoi: 'le gabarit du métier est identique pour tous les clients — donc comparable octet pour octet',
    verifier({ metier }) {
      // Ce qui rendra la mise à jour (E4) capable de détecter une divergence sans deviner.
      // Un seul emplacement à substituer, et il faudrait re-rendre le gabarit pour comparer.
      for (const moteur of [/\{\{[^}]+\}\}/, /%%[^%]+%%/, /<%[^%]*%>/]) {
        const trouve = metier.match(moteur);
        assert.ok(!trouve, `le gabarit porte un emplacement à substituer (« ${trouve && trouve[0]} ») : il cesse d’être comparable tel quel`);
      }
    },
  },

  {
    id: 'il-represente-il-ne-code-pas',
    quoi: 'aucun geste enseigné n’exécute le travail ni ne prend la mise en ligne',
    verifier({ metier }) {
      // HS-REL-001, HS-REL-005 et RA-REL-015. La tentation arrive toujours par la même
      // porte : « ce petit bout, c'est plus rapide ». Ici les jetons SONT la bonne garde —
      // ce sont réellement des commandes dans le texte, et l'une d'elles pourrait y entrer.
      // (L'interdit d'ENVOI de pièce, lui, est une phrase : il est gardé par
      // `reception-seulement`, pas par des jetons qui n'apparaîtraient jamais.)
      for (const bloc of blocsBash(metier)) {
        for (const geste of ['git commit', 'git push', 'git checkout', 'npm publish', '/pousse', '/merge', 'supabase db']) {
          assert.ok(!bloc.includes(geste), `le métier enseigne « ${geste} » : un représentant ne réalise pas`);
        }
      }
      assert.match(metier, /lock_status/, 'il doit savoir LIRE l’état de la mise en ligne pour dire la vérité au client');
      for (const pris of ['lock_acquire', 'lock_release']) {
        assert.ok(!metier.includes(pris), `il ne prend ni ne rend le droit d’accès à la mise en ligne (« ${pris} »)`);
      }
    },
  },

  {
    id: 'frontiere-des-deux-fichiers',
    quoi: 'chaque gabarit dit lequel des deux est remplacé et lequel n’est jamais touché',
    verifier({ metier, contexte }) {
      // RA-REL-014, et c'est la garantie dont E4 dépendra entièrement. Si les deux
      // avertissements s'inversent, le représentant écrit ce qu'il sait de son client dans
      // le fichier que la prochaine mise à jour remplace : perte silencieuse, et le client
      // s'entend redemander ce qu'il a déjà expliqué.
      //
      // ATTENTION — LA PREMIÈRE VERSION DE CE CONTRÔLE ÉTAIT DÉCORATIVE, et c'est le harnais
      // de mutation qui l'a dit, pas une relecture. Elle vérifiait que « la ligne qui parle
      // de remplacement ne nomme pas l'autre fichier » : trivialement vrai, puisque cette
      // ligne disait « ce fichier » sans nommer personne. Deux mutations lui ont survécu.
      //
      // La garde tient désormais parce que chaque ligne d'en-tête NOMME le fichier dont elle
      // parle : on peut alors apparier la POLARITÉ (remplacé / jamais touché) au SUJET
      // qu'elle gouverne. Croiser les deux noms fait rougir, dans les deux fichiers.
      const REMPLACE = /remplac/i;
      const PRESERVE = /jamais/i;

      for (const [nom, texte] of [['CLAUDE.md', metier], ['CONTEXTE.md', contexte]]) {
        const entete = enteteDe(texte);
        assert.ok(entete.length >= 2, `${nom} doit s’ouvrir sur un avertissement qui dit à qui appartient chacun des deux fichiers`);

        /** Le fichier que nomme l'unique ligne d'en-tête portant cette polarité. */
        const sujetDe = (sonde, polarite) => {
          const lignes = entete.filter((l) => sonde.test(l));
          assert.equal(lignes.length, 1, `${nom} : une seule ligne doit porter « ${polarite} » (${lignes.length} trouvée·s)`);
          const nommes = ['CLAUDE.md', 'CONTEXTE.md'].filter((f) => lignes[0].includes(`\`${f}\``));
          assert.equal(
            nommes.length, 1,
            `${nom} : « ${lignes[0]} » doit nommer exactement un fichier — sans nom, l’affirmation n’est apparentable à rien`
          );
          return nommes[0];
        };

        assert.equal(
          sujetDe(REMPLACE, 'remplacé'), 'CLAUDE.md',
          `${nom} : c’est CLAUDE.md qui est remplacé à chaque mise à jour — la frontière est inversée`
        );
        assert.equal(
          sujetDe(PRESERVE, 'jamais touché'), 'CONTEXTE.md',
          `${nom} : c’est CONTEXTE.md qu’aucune mise à jour ne touche — la frontière est inversée`
        );
      }
    },
  },

  {
    id: 'gestes-de-ligne-existants',
    quoi: 'chaque geste et chaque option de ligne enseignés existent dans la commande',
    verifier({ metier }) {
      // EF-AGT-002. Le pack s'est déjà fait avoir : une compétence enseignait un geste qui
      // n'existe pas, et chaque agent qui la suivait perdait du temps sur une erreur qui
      // n'était pas la sienne. Ici la source est lue, jamais recopiée.
      const src = readFileSync(join(REPO, 'ligne-directe', 'bin', 'ligne-directe.js'), 'utf8');
      const gestes = new Set([...src.matchAll(/geste === '([a-zà-ÿ-]+)'/g)].map((m) => m[1]));
      const options = new Set([...src.matchAll(/'(--[a-zà-ÿ-]+)'/g)].map((m) => m[1]));
      assert.ok(gestes.size >= 5, 'les gestes de la commande n’ont pas été relevés — le contrôle ne prouverait rien');

      const gestesCites = [...metier.matchAll(/\$LD\s+([a-zà-ÿ-]+)/g)].map((m) => m[1]);
      assert.ok(gestesCites.length > 0, 'le métier doit montrer au moins un geste de ligne');
      for (const g of gestesCites) assert.ok(gestes.has(g), `le métier enseigne « ${g} », que la commande ne connaît pas`);

      const optionsCitees = [...metier.matchAll(/\$LD\s+[a-zà-ÿ-]+[^\n`]*?(--[a-zà-ÿ-]+)/g)].map((m) => m[1]);
      assert.ok(optionsCitees.length > 0, 'le métier doit montrer au moins une option');
      for (const o of optionsCitees) assert.ok(options.has(o), `le métier enseigne « ${o} », que la commande ne connaît pas`);
    },
  },

  {
    id: 'gestes-de-session-existants',
    quoi: 'chaque commande de session enseignée s’adresse à un objet connu et est employée ailleurs dans le pack',
    verifier({ metier }) {
      // L'outil de session n'est pas versionné ici : on n'admet que des formes déjà employées
      // AILLEURS DANS LE PACK, et le contrôle doit donc relever ce que le pack emploie vraiment.
      //
      // ⚠️ POURQUOI LA RÉFÉRENCE A CHANGÉ (D-20260825-0002). Elle ne lisait qu'UN fichier d'un
      // autre rôle — `orchestrer-chantier/SKILL.md` — et concluait « employé dans le pack ».
      // Deux objets différents : le contrôle mesurait « présent dans les blocs bash de ce
      // SKILL.md » et prononçait un verdict sur le pack entier. Le jour où ce SKILL.md a cessé
      // de citer `herdr tab create` — la naissance d'un chef d'équipe étant devenue un geste
      // outillé —, le contrôle a accusé le métier du représentant d'enseigner une commande
      // inventée. Or elle ne l'est pas : mesuré, `naissance-representant/src/naissance.js:566`
      // appelle `'tab', 'create'`. Le CODE du pack l'emploie. C'était un faux refus, produit
      // par l'écart entre ce que le contrôle annonçait et ce qu'il regardait.
      //
      // La référence est donc l'UNION de deux relevés, chacun lu à sa source :
      //   • le TEXTE d'une compétence éprouvée — ses BLOCS DE COMMANDES et jamais sa prose,
      //     celle-ci citant nommément un contre-exemple ;
      //   • le CODE du pack, où l'appel au binaire s'écrit en TABLEAU D'ARGUMENTS
      //     (`['tab', 'create', …]`, `['agent', 'get', pane]`) et jamais en ligne de shell.
      //
      // ⚠️ AUCUNE SOURCE N'EST UN DOUBLE DE TEST NI LE GABARIT LUI-MÊME, et c'est vérifié plus
      // bas. Un faux `herdr` de banc porte des formes que la production n'emploie pas ; et une
      // référence qui engloberait le gabarit rendrait toute forme « connue » par construction —
      // le contrôle serait désarmé sans qu'une seule assertion disparaisse.

      /** Les objets que herdr expose — relevés dans le code, et servant AUX DEUX relevés. */
      const OBJETS = ['pane', 'agent', 'tab', 'workspace'];

      /** Les formes telles qu'un texte les écrit : `herdr <objet> <verbe>`. */
      const formes = (t) => new Set([...t.matchAll(/\bherdr ([a-z-]+ [a-z-]+)/g)].map((m) => m[1]));

      /** Les formes telles que le CODE les écrit : en tête d'un tableau d'arguments. */
      const formesDuCode = (t) => new Set(
        [...t.matchAll(new RegExp(`\\[\\s*'(${OBJETS.join('|')})',\\s*'([a-z-]+)'`, 'g'))]
          .map((m) => `${m[1]} ${m[2]}`)
      );

      /** Tous les `.js` sous une racine, chemins relatifs au dépôt. */
      const jsSous = (rel) => {
        const racine = join(REPO, rel);
        if (!existsSync(racine)) return [];
        return readdirSync(racine, { recursive: true })
          .filter((f) => String(f).endsWith('.js'))
          .map((f) => join(rel, String(f)));
      };

      const SOURCES = [
        {
          quoi: 'le texte d’une compétence éprouvée',
          fichiers: [join('.claude', 'skills', 'orchestrer-chantier', 'SKILL.md')],
          relever: (t) => formes(blocsBash(t).join('\n')),
        },
        // Les quatre lieux où le pack parle au binaire `herdr`, mesurés le 2026-08-25 :
        // 14 formes dans naissance-representant/src, 13 dans ligne-directe/src,
        // 7 dans naissance-representant/bin, 1 dans cli/src.
        ...['cli/src', 'ligne-directe/src', 'naissance-representant/bin', 'naissance-representant/src']
          .map((rel) => ({ quoi: `le code de ${rel}`, fichiers: jsSous(rel), relever: formesDuCode })),
      ];

      const connues = new Set();
      for (const source of SOURCES) {
        for (const f of source.fichiers) {
          // ⚠️ Ce qui rend ce contrôle désarmable, ce n'est pas de retirer une assertion :
          // c'est d'ÉLARGIR la référence jusqu'à ce qu'elle avale ce qu'elle juge.
          assert.ok(
            !/(^|[\\/])tests?[\\/]/.test(f),
            `« ${f} » est un double de banc : une forme qu'un faux herdr porte ne prouve pas que le pack l'emploie`
          );
          assert.ok(
            !f.startsWith(GABARIT_DIR),
            `« ${f} » est le gabarit jugé : une référence qui l'englobe rend toute forme « connue » par construction`
          );
          for (const forme of source.relever(readFileSync(join(REPO, f), 'utf8'))) connues.add(forme);
        }
        // Une source muette est une source qu'on a cessé de mesurer — répertoire déplacé,
        // vidé, ou relevé qui ne mord plus. Sans ceci, elle disparaît en silence.
        const apport = source.fichiers.some((f) => source.relever(readFileSync(join(REPO, f), 'utf8')).size > 0);
        assert.ok(apport, `${source.quoi} n’apporte aucune forme — cette source de référence ne mesure plus rien`);
      }
      assert.ok(connues.size >= 5, 'les formes de référence n’ont pas été relevées — le contrôle ne prouverait rien');

      for (const forme of formes(metier)) {
        assert.ok(OBJETS.includes(forme.split(' ')[0]), `« herdr ${forme} » ne s’adresse à aucun objet connu — inventé ?`);
        assert.ok(connues.has(forme), `« herdr ${forme} » n’est employé nulle part ailleurs dans le pack — inventé ?`);
      }
    },
  },
];

// ═════════════════════════════════════════ les mutations

/** Applique une mutation au seul en-tête (tout ce qui précède la première section). */
function dansEntete(texte, muter) {
  const coupe = texte.search(/^##\s/m);
  assert.ok(coupe > 0, 'le gabarit doit avoir un en-tête avant sa première section');
  return muter(texte.slice(0, coupe)) + texte.slice(coupe);
}

/** Remplace `a` par `b` et `b` par `a`, en une passe. Jette si l'un des deux manque. */
export function permuter(texte, a, b) {
  assert.ok(texte.includes(a) && texte.includes(b), `permutation inapplicable : « ${a} » ou « ${b} » est absent`);
  const jeton = ' JETON ';
  return texte.split(a).join(jeton).split(b).join(a).split(jeton).join(b);
}

/**
 * Chaque mutation : { id, quoi, cible, muter(texte) }.
 *
 * `cible` nomme le contrôle qui DOIT la voir. Le harnais ne s'en sert pas pour décider —
 * il exige seulement qu'AU MOINS UN contrôle rougisse — mais il l'affiche quand la
 * mutation survit, pour dire ce qui n'était pas gardé.
 *
 * Chaque mutation est vérifiée OPÉRANTE avant d'être jugée : une mutation dont le motif ne
 * s'applique plus au texte ne change rien, tous les contrôles restent verts, et on la
 * compterait comme « attrapée » alors qu'elle n'a jamais été posée. C'est le faux témoin
 * de cette famille de harnais, et il est fatal ici.
 *
 * Les mutations préfixées `revue-` viennent de la revue indépendante de la PR #180 : ce
 * sont celles qui ont SURVÉCU à la première version des contrôles. Elles restent ici pour
 * que le défaut qu'elles ont révélé ne puisse pas revenir.
 */
export const MUTATIONS = [
  {
    id: 'crochet-retourne-par-une-negation',
    quoi: 'l’énoncé du crochet est retourné par une négation, en gardant tous ses mots-clés',
    cible: 'crochet-pose-par-le-dispositif',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Un crochet apparaît sur le message qu'on t'écrit dès que tu l'as pris** — le dispositif le pose seul, tu n'as rien à faire.",
      "**Ne crois pas qu'un crochet apparaisse seul** — contrairement à ce qu'on dit, le dispositif le pose seul, tu n'as rien à faire est faux : c'est toi qui le poses.",
    ),
  },

  {
    id: 'crochet-devenu-une-discipline',
    quoi: 'le métier enseigne à l’agent de poser lui-même le crochet — la garantie redevient une discipline',
    cible: 'crochet-pose-par-le-dispositif',
    fichier: 'metier',
    muter: (t) => t.replace(
      'le dispositif le pose seul, tu n\'as rien à faire',
      'pose un crochet sur son message dès que tu l\'as lu',
    ),
  },

  // ── l'ordre d'ouverture
  {
    id: 'relever-avant-d-etre-joignable',
    quoi: 'on relève l’historique avant d’ouvrir sa ligne — le défaut exact de T-20260806-0192',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Ouvre tes deux lignes**', '**Relève ce qui existe déjà**'),
  },
  {
    id: 'parler-avant-de-relever',
    quoi: 'on parle au client avant d’avoir relevé son histoire',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Relève ce qui existe déjà**', '**Alors seulement, parle du fond.**'),
  },
  {
    id: 'revue-R5-l-ordre-devient-facultatif',
    quoi: 'l’étape 2 garde son rang mais cesse d’obliger — « tu peux aussi le faire après si ça presse »',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => t.replace(
      "2. **Ouvre tes deux lignes** — celle du client, puis celle du dirigeant. C'est ce qui te rend **joignable** des deux côtés.",
      "2. **Ouvre tes deux lignes** — celle du client, puis celle du dirigeant. C'est utile, mais tu peux aussi le faire après le relèvement si celui-ci presse. C'est ce qui te rend **joignable** des deux côtés.",
    ),
  },
  {
    id: 'la-condition-d-arret-disparait',
    quoi: 'plus rien ne dit de s’arrêter quand la ligne n’est pas installée — le représentant naît muet',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => t.replace(/^\*\*Si la ligne de discussion n'est pas installée.*\n/m, ''),
  },

  // ── les réflexes anti-biais
  {
    id: 'complaisance-devient-la-reponse',
    quoi: 'le « oui c’est possible » passe du côté de ce qu’on dit — le contresens exact',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      '« Oui, c\'est possible » — parce qu\'il insiste et que refuser est inconfortable',
      '« Je ne peux pas te répondre là-dessus moi-même — je fais remonter la question »',
    ),
  },
  {
    id: 'complaisance-reléguée-en-dernier',
    quoi: 'l’anti-complaisance cesse d’ouvrir les réflexes',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Anti-complaisance**', '**Anti-ancrage**'),
  },
  {
    id: 'revue-R2-en-tete-des-reflexes-permute',
    quoi: 'les en-têtes de la table des réflexes sont permutés — « oui c’est possible » devient ce qu’on dit à la place, sans qu’une cellule bouge',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| # | Le réflexe | Ce que la pression te fait dire | Ce que tu dis à la place |',
      '| # | Le réflexe | Ce que tu dis à la place | Ce que la pression te fait dire |',
    ),
  },

  // ── la posture fondatrice
  {
    id: 'revue-R3-en-tete-de-la-posture-permute',
    quoi: 'les en-têtes de la table de posture sont permutés — « ce n’est pas prévu au contrat » devient la posture à tenir',
    cible: 'posture-fondatrice',
    fichier: 'metier',
    muter: (t) => t.replace('| Le réflexe de guichet | Ta posture |', '| Ta posture | Le réflexe de guichet |'),
  },
  {
    id: 'revue-R10-la-demande-se-traduit',
    quoi: 'la demande se traduit dans notre vocabulaire au lieu de garder les mots du client',
    cible: 'posture-fondatrice',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Tu écris sa demande dans ses mots.**',
      '**Tu traduis sa demande dans notre vocabulaire.**',
    ),
  },

  // ── la frontière de l'engagement
  {
    id: 'faisabilite-se-repond-seul',
    quoi: '« est-ce possible ? » passe du côté où l’on répond seul',
    cible: 'faisabilite-remonte',
    fichier: 'metier',
    muter: (t) => permuter(t, 'Reformulation du besoin, pour qu\'il la valide', '**Une faisabilité — « est-ce possible ? »**'),
  },
  {
    id: 'le-prix-se-repond-seul',
    quoi: 'le prix quitte le côté qui remonte',
    cible: 'engagements-remontent',
    fichier: 'metier',
    muter: (t) => t.replace('| Un prix, un budget, une portée facturable |', '| Une question de vocabulaire |'),
  },
  {
    id: 'revue-R1-en-tete-de-la-frontiere-permute',
    quoi: 'les en-têtes de la frontière sont permutés — le prix, le délai et la faisabilité se répondent seul',
    cible: 'faisabilite-remonte',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| Tu réponds seul | Tu remontes au dirigeant |',
      '| Tu remontes au dirigeant | Tu réponds seul |',
    ),
  },
  {
    id: 'revue-R4-le-prix-ajoute-a-gauche',
    quoi: 'le prix approximatif est ajouté du côté où l’on répond seul, sans être retiré de l’autre',
    cible: 'engagements-remontent',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| Accusé de réception | Un délai, une échéance |',
      '| Accusé de réception | Un délai, une échéance |\n| Un prix approximatif, si tu le connais | Une question de vocabulaire |',
    ),
  },

  // ── les interdits
  {
    id: 'un-interdit-de-cloisonnement-retire',
    quoi: 'la puce « une session ne change pas de client » disparaît',
    cible: 'cloisonnement',
    fichier: 'metier',
    muter: (t) => t.replace(/^- Si ta session porte déjà un client.*\n/m, ''),
  },
  {
    id: 'le-refus-devient-une-preference',
    quoi: 'le cloisonnement cesse de refuser et se contente de déconseiller',
    cible: 'cloisonnement',
    fichier: 'metier',
    muter: (t) => t.replaceAll('**tu refuses**', '**c\'est déconseillé**'),
  },
  {
    id: 'revue-R8-il-tranche-les-arbitrages-simples',
    quoi: 'le représentant se met à trancher les arbitrages qu’il juge simples',
    cible: 'interdits-du-metier',
    fichier: 'metier',
    muter: (t) => t.replace(
      '- **Tu ne tranches aucun arbitrage** — ni technique, ni de priorité entre clients.',
      '- **Tu tranches les arbitrages simples toi-même** — techniques comme de priorité entre clients.',
    ),
  },
  {
    id: 'l-interdit-d-invitation-disparait',
    quoi: 'plus rien n’empêche le représentant d’inviter qui il veut dans le canal du client',
    cible: 'interdits-du-metier',
    fichier: 'metier',
    muter: (t) => t.replace(/^- \*\*Tu n'invites personne dans le canal du client\.\*\*.*\n/m, ''),
  },

  // ── le cycle et la vérité dite au client
  {
    id: 'on-lance-avant-de-faire-valider',
    quoi: 'le travail part avant que le client ait validé sa formulation',
    cible: 'validation-avant-lancement',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      'Faire valider la formulation — le point de bascule',
      'Lancer l\'exécution — c\'est toi qui appuies',
    ),
  },
  {
    id: 'revue-R7-le-mensonge-devient-la-bonne-reponse',
    quoi: 'les marques ✅ et ❌ sont permutées — dire « c’est en cours » quand ça attend devient recommandé',
    cible: 'verite-au-client',
    fichier: 'metier',
    muter: (t) => permuter(t, '> ✅ « C\'est prêt.', '> ❌ « C\'est en cours. »'),
  },

  // ── le relèvement
  {
    id: 'revue-R9-il-salue-avant-d-avoir-lu',
    quoi: 'les règles du relèvement sont retournées — il salue avant d’avoir lu et annonce qu’il est nouveau',
    cible: 'relevement-avant-de-parler',
    fichier: 'metier',
    muter: (t) => t.replace(
      '- **Tu ne dis rien DU FOND avant d\'avoir lu.**',
      '- **Tu peux saluer et r\u00e9pondre avant d\'avoir lu.**',
    ),
  },

  // ── les pièces
  {
    id: 'revue-R6-l-envoi-devient-permis',
    quoi: '« tu ne lui envoies jamais rien en retour » devient « tu peux lui renvoyer les pièces qu’il demande »',
    cible: 'reception-seulement',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Tu ne lui envoies jamais rien en retour.** La réception entre dans ton périmètre, l'envoi non.",
      "**Tu peux lui renvoyer les pièces qu'il demande.** La réception et l'envoi entrent tous deux dans ton périmètre.",
    ),
  },

  // ── les anti-patterns
  {
    id: 'la-faute-de-l-ordre-n-est-plus-nommee',
    quoi: 'l’anti-pattern « relever avant d’être joignable » disparaît de la table',
    cible: 'anti-patterns-couverts',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| Relever l'historique avant d'avoir ouvert sa ligne \|.*\n/m, ''),
  },
  {
    id: 'en-tete-des-anti-patterns-permute',
    quoi: 'les en-têtes des anti-patterns sont permutés — chaque faute se lit comme la raison de la commettre',
    cible: 'anti-patterns-couverts',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| Ce qu\'on est tenté de faire | Pourquoi ça casse |',
      '| Pourquoi ça casse | Ce qu\'on est tenté de faire |',
    ),
  },

  // ── les deux lignes du gestionnaire (T-20260814-0033)
  //
  // Les trois premières sont celles que le lot demandait nommément : elles rejouent la
  // régression exacte que ce lot existe pour rendre impossible.
  {
    id: 'l-interdit-de-la-seconde-ligne-revient',
    quoi: '« tu n’ouvres jamais une seconde ligne » est réintroduit — le métier redit le contraire de ce que le garde exige',
    cible: 'contexte-necessaire',
    fichier: 'metier',
    // C'EST LA RÉGRESSION QUE CE LOT FERME. Le garde du lieu tient le pane fermé tant que les
    // deux lignes ne sont pas là ; un métier qui interdit la seconde fait naître un agent qui
    // ne peut RIEN faire — muet, en croyant pouvoir parler.
    muter: (t) =>
      t.replace(
        '$LD ouvrir dirigeant --titre "ligne dirigeant <le client>" --au-dirigeant\n',
        '',
      ).replace(
        '- **Tu ouvres les DEUX, et la seconde n\'est pas facultative.**',
        '- **Tu n\'ouvres jamais une seconde ligne depuis ce pane.**',
      ),
  },
  {
    id: 'revue-l-ordre-s-assouplit-par-l-evitement',
    quoi: 'l’étape 2 garde son rang et son verbe, et s’assouplit par « en évitant de trop tarder »',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    // ⚠️ POSÉE PAR LA REVUE DE FOND, ET ELLE PASSAIT. La famille de l'évitement manquait à
    // `PERMISSIF` ; sa première correction avait été écrite dans un seul contrôle, laissant
    // tous les autres appels d'`exigeImperatif` ouverts — dont celui-ci, qui garde l'ordre
    // même où un représentant s'est déjà fait écrire quatre fois sans que rien n'arrive.
    muter: (t) => t.replace(
      "C'est ce qui te rend **joignable** des deux côtés.",
      "C'est ce qui te rend **joignable** des deux côtés, en évitant de trop tarder.",
    ),
  },
  {
    id: 'le-nommage-de-la-ligne-devient-facultatif',
    quoi: 'le nommage obligatoire tombe — le geste « choisit » sa ligne, et l’autre est le canal du client',
    cible: 'deux-lignes-et-ce-qui-ne-traverse-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Tu nommes toujours la ligne que tu vises.** Chaque geste qui écrit — `dire`, `demander`, `fermer`, `renommer` — exige `--a`.',
      '**Tu peux nommer la ligne que tu vises.** Chaque geste qui écrit — `dire`, `demander`, `fermer`, `renommer` — accepte `--a`.',
    ),
  },
  {
    id: 'l-etancheite-devient-un-conseil',
    quoi: '« ce qui ne traverse jamais » se change en recommandation — les mots restent, la garde part',
    cible: 'deux-lignes-et-ce-qui-ne-traverse-pas',
    fichier: 'metier',
    // Le motif dominant de ce dépôt, appliqué à la règle la plus coûteuse du lot : une
    // interdiction qui garde tout son vocabulaire et cesse d'obliger.
    muter: (t) => t.replace(
      '**Rien de ce qui monte vers le dirigeant ne descend chez le client.**',
      '**Évite que ce qui monte vers le dirigeant ne descende chez le client.**',
    ),
  },
  {
    id: 'les-deux-lignes-sont-permutees',
    quoi: 'les en-têtes des deux lignes sont permutés — « --a dirigeant » désigne le client, sans qu’une cellule bouge',
    cible: 'deux-lignes-et-ce-qui-ne-traverse-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| | ta ligne avec le client | ta ligne avec le dirigeant |',
      '| | ta ligne avec le dirigeant | ta ligne avec le client |',
    ),
  },
  {
    id: 'la-ligne-du-dirigeant-n-autorise-personne',
    quoi: '`--au-dirigeant` disparaît de l’ouverture — la ligne naît muette et refuse sa parole au dirigeant',
    cible: 'contexte-necessaire',
    fichier: 'metier',
    muter: (t) => t.replace(
      '$LD ouvrir dirigeant --titre "ligne dirigeant <le client>" --au-dirigeant',
      '$LD ouvrir dirigeant --titre "ligne dirigeant <le client>"',
    ),
  },
  {
    id: 'la-remontee-redevient-un-pis-aller',
    quoi: 'la remontée repasse par un tiers et par une note — les deux chemins qui n’atteignent personne',
    cible: 'remontee-par-la-ligne',
    fichier: 'metier',
    muter: (t) => t.replace(
      "### Comment tu remontes — par ta ligne, et elle atteint quelqu'un",
      "### Comment tu remontes — et pourquoi c'est aujourd'hui un pis-aller",
    ),
  },
  {
    id: 'l-arbitrage-est-pose-au-client',
    quoi: 'la remontée nomme la ligne du CLIENT — l’arbitrage qui appartient au dirigeant lui est posé à lui',
    cible: 'remontee-par-la-ligne',
    fichier: 'metier',
    muter: (t) => t.replace('ta recommandation>" --a dirigeant', 'ta recommandation>" --a <le client>'),
  },

  // ── le transport et la frontière des fichiers
  {
    id: 'revue-R12-le-canal-naît-public',
    quoi: 'le canal du client naît public — le portefeuille est exposé à quiconque a un compte chez nous',
    cible: 'canal-prive',
    fichier: 'metier',
    muter: (t) => t.replace('Il fait naître le canal privé,', 'Il fait naître le canal public,'),
  },
  {
    id: 'le-titre-est-ecrit-en-dur',
    quoi: 'le titre de la ligne cesse de venir du contexte du client',
    cible: 'contexte-necessaire',
    fichier: 'metier',
    muter: (t) => t.replace('"<le titre donné par CONTEXTE.md>"', '"Support client"'),
  },
  {
    id: 'un-emplacement-a-substituer',
    quoi: 'le gabarit cesse d’être identique pour tous les clients',
    cible: 'aucune-substitution',
    fichier: 'metier',
    muter: (t) => t.replace('# Tu es le représentant de ce client', '# Tu es le représentant de {{client}}'),
  },
  {
    id: 'il-se-met-a-coder',
    quoi: 'un geste qui écrit dans le dépôt du client entre dans le métier',
    cible: 'il-represente-il-ne-code-pas',
    fichier: 'metier',
    muter: (t) => t.replace('herdr pane current', 'git commit -am "petit ajustement"\nherdr pane current'),
  },
  {
    id: 'il-prend-la-mise-en-ligne',
    quoi: 'le représentant acquiert le droit d’accès à la mise en ligne au lieu de le lire',
    cible: 'il-represente-il-ne-code-pas',
    fichier: 'metier',
    muter: (t) => t.replace('action lock_status        → la mise en ligne', 'action lock_acquire       → la mise en ligne'),
  },
  {
    id: 'la-frontiere-des-fichiers-inversee',
    quoi: 'le métier annonce que c’est le contexte du client qui sera remplacé',
    cible: 'frontiere-des-deux-fichiers',
    fichier: 'metier',
    muter: (t) => dansEntete(t, (e) => permuter(e, '`CLAUDE.md`', '`CONTEXTE.md`')),
  },
  {
    id: 'la-frontiere-inversee-cote-contexte',
    quoi: 'le contexte du client s’annonce lui-même comme remplaçable',
    cible: 'frontiere-des-deux-fichiers',
    fichier: 'contexte',
    muter: (t) => dansEntete(t, (e) => permuter(e, '`CLAUDE.md`', '`CONTEXTE.md`')),
  },
  {
    id: 'revue-R11-le-contexte-se-dit-remplacable',
    quoi: 'l’en-tête du contexte est RÉÉCRIT (et non permuté) pour s’annoncer remplaçable comme les autres',
    cible: 'frontiere-des-deux-fichiers',
    fichier: 'contexte',
    muter: (t) => t.replace(
      "il t'appartient, et aucune mise à jour du pack n'y touchera jamais.",
      "les mises à jour du pack le remplacent comme les autres.",
    ),
  },

  // ── les libellés d'en-tête reformulés : le mot-clé reste, le sens s'inverse
  //
  // Ces six-là viennent de la SECONDE revue. Elles survivaient toutes tant que `colonneDe`
  // reconnaissait une colonne à un mot-clé contenu dans son libellé. Elles sont la raison
  // pour laquelle la sonde doit désormais couvrir le libellé ENTIER.
  {
    id: 'revue2-R13-la-remontee-devient-conditionnelle',
    quoi: 'l’en-tête devient « Tu remontes au dirigeant si tu as un doute » — l’obligation se change en option, mot-clé intact',
    cible: 'faisabilite-remonte',
    fichier: 'metier',
    muter: (t) => t.replace('| Tu réponds seul | Tu remontes au dirigeant |', '| Tu réponds seul | Tu remontes au dirigeant si tu as un doute |'),
  },
  {
    id: 'revue2-R14-on-ne-remonte-plus-rien',
    quoi: 'l’en-tête devient « Tu ne remontes rien » — l’inverse exact, et le mot-clé y est encore',
    cible: 'faisabilite-remonte',
    fichier: 'metier',
    muter: (t) => t.replace('| Tu réponds seul | Tu remontes au dirigeant |', '| Tu réponds seul | Tu ne remontes rien |'),
  },
  {
    id: 'revue2-R15-la-colonne-des-reponses-se-nie',
    quoi: 'l’en-tête devient « Ce que tu ne dis jamais à la place » — la colonne des bonnes réponses devient celle des interdits',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => t.replace('| Ce que tu dis à la place |', '| Ce que tu ne dis jamais à la place |'),
  },
  {
    id: 'revue2-R16-la-posture-devient-optionnelle',
    quoi: 'l’en-tête devient « Ta posture, quand tu as le temps »',
    cible: 'posture-fondatrice',
    fichier: 'metier',
    muter: (t) => t.replace('| Le réflexe de guichet | Ta posture |', '| Le réflexe de guichet | Ta posture, quand tu as le temps |'),
  },
  {
    id: 'revue2-R17-les-anti-patterns-deviennent-des-conseils',
    quoi: 'l’en-tête « Pourquoi ça casse » devient « Pourquoi ça peut aider »',
    cible: 'anti-patterns-couverts',
    fichier: 'metier',
    muter: (t) => t.replace("| Ce qu'on est tenté de faire | Pourquoi ça casse |", "| Ce qu'on est tenté de faire | Pourquoi ça peut aider |"),
  },
  {
    id: 'revue2-R18-la-pression-devient-conditionnelle',
    quoi: 'l’en-tête devient « Ce que la pression te fait dire, parfois » — la colonne cesse de désigner une faute',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => t.replace('| Ce que la pression te fait dire |', '| Ce que la pression te fait dire, si tu le souhaites |'),
  },

  // ── la modalité, là où seul le rang ou le compte était gardé
  {
    id: 'revue2-le-cloisonnement-devient-optionnel',
    quoi: 'le refus d’un second canal garde sa puce et son verbe, mais cesse d’obliger',
    cible: 'cloisonnement',
    fichier: 'metier',
    muter: (t) => t.replace(
      'ou vers un autre : **tu refuses** de la même façon',
      'ou vers un autre : **tu peux refuser** de la même façon',
    ),
  },
  {
    id: 'revue2-on-lance-sans-attendre-si-c-est-clair',
    quoi: 'l’étape de validation garde son rang mais devient facultative — « tu peux lancer sans attendre »',
    cible: 'validation-avant-lancement',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Rien ne part avant qu\'il ait dit « oui, c\'est ça ».**',
      '**Tu peux lancer sans attendre si le besoin te paraît clair.**',
    ),
  },

  // ── les gestes enseignés
  {
    id: 'un-geste-de-ligne-invente',
    quoi: 'le métier enseigne un geste de ligne qui n’existe pas',
    cible: 'gestes-de-ligne-existants',
    fichier: 'metier',
    muter: (t) => t.replace('$LD ouvrir', '$LD demarrer'),
  },
  {
    id: 'une-option-de-ligne-inventee',
    quoi: 'le métier enseigne une option que la commande ne connaît pas',
    cible: 'gestes-de-ligne-existants',
    fichier: 'metier',
    muter: (t) => t.replace('--nature client --titre', '--type client --titre'),
  },
  {
    id: 'ronde-devient-une-discipline',
    quoi: 'la ronde cesse d’être un mécanisme posé et redevient une bonne intention',
    cible: 'ronde-tient-par-un-mecanisme',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Ta ronde est une boucle `/loop`, que tu poses en naissant.**',
      '**Pense à faire tes rondes régulièrement.**',
    ),
  },
  {
    id: 'ronde-ne-se-repose-plus',
    quoi: 'la ronde n’est plus reposée à la renaissance — un représentant renaît muet',
    cible: 'ronde-tient-par-un-mecanisme',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Tu la reposes à chaque renaissance** — elle ne survit pas à ta mort.',
      '**Elle te suit d’une session à l’autre.**',
    ),
  },
  {
    id: 'ronde-sans-trace-horaire',
    quoi: 'la ronde ne laisse plus l’heure de ses tours — son extinction devient indétectable',
    cible: 'ronde-tient-par-un-mecanisme',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Ce qui prouve que ta ronde tourne : l\'heure de chaque tour, inscrite.**',
      '**Tu sauras bien si ta ronde tourne.**',
    ),
  },
  {
    id: 'etat-ecrit-a-la-derniere-minute',
    quoi: 'l’état de reprise s’écrit quand la panne approche — donc par un agent déjà appauvri',
    cible: 'etat-de-reprise-vit-dehors',
    fichier: 'metier',
    muter: (t) => t.replace(
      '### Écris ton état de reprise à chaque tour de ronde',
      '### Écris ton état de reprise quand ta marge s\'épuise',
    ),
  },
  {
    id: 'etat-descend-chez-le-client',
    quoi: 'l’état de reprise cesse d’être interdit dans le canal du client',
    cible: 'etat-de-reprise-vit-dehors',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Ton état n\'est pas une preuve, et il ne parle jamais au client.**',
      '**Ton état peut être partagé avec le client si ça l\'aide.**',
    ),
  },
  {
    id: 'le-client-attend-la-reprise',
    quoi: 'l’agent reprend pendant qu’un client attend — le silence redevient permis',
    cible: 'etat-de-reprise-vit-dehors',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Tu termines l\'échange, tu accuses, ensuite tu reprends.**',
      '**Reprends dès que tu en as besoin.**',
    ),
  },
  {
    id: 'accuse-passe-apres-le-relevement',
    quoi: 'l’accusé retombe après la parole de fond — le client retrouve son silence',
    cible: 'accuse-precede-le-relevement',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Accuse réception, si un message t\'attend**', '**Alors seulement, parle du fond.**'),
  },
  {
    // ⚠️ LA MUTATION QUI RESTAIT VERTE — c'est elle qui a démasqué D2, et elle est le seul
    // critère d'acceptation de ce lot. Posée par la revue indépendante de la PR #299 sur
    // `7926463`, elle laissait la suite ENTIÈREMENT VERTE : le texte prescrivait alors le
    // contresens exact de la règle `R4.7`, et rien ne s'en apercevait. Elle ne
    // retire aucun mot-clé, ne déplace aucun rang, ne supprime aucune étape — elle retourne
    // une incise de six mots. La contre-épreuve du reviewer dit le reste : supprimer l'étape
    // 4 entière faisait rougir quatre tests. L'absence était gardée ; la modalité, non.
    id: 'accuse-attend-la-fin-du-relevement',
    quoi: 'l’accusé attend la fin du relèvement — la règle du 2026-08-17 retournée par une seule incise',
    cible: 'accuse-precede-le-relevement',
    fichier: 'metier',
    muter: (t) => t.replace(
      "— **avant même d'avoir fini de relever**, dès que sa ligne est ouverte.",
      "— **quand tu auras fini de relever**, dès que sa ligne est ouverte.",
    ),
  },

  {
    // ⚠️ LA MUTATION QUI MANQUAIT À LA GARDE DE RENVERSEMENT — et son absence a été mesurée :
    // retirer cette garde du contrôle ne faisait rougir AUCUN test. Une garde qu'on peut
    // désarmer sans qu'un test s'en aperçoive n'est pas gardée, elle est seulement écrite.
    // La mutation elle-même vient de la revue indépendante de ce lot : elle laisse l'incise
    // d'antériorité INTACTE — c'est une sous-chaîne, elle se reconnaît toujours — et la nie
    // dans la phrase qui la porte. Ni la garde d'antériorité ni celle de postériorité ne la
    // voient : seul `RENVERSEMENT` la voit.
    id: 'accuse-antériorité-enveloppée-d-une-négation',
    quoi: 'l’antériorité de l’accusé est écrite ET niée dans la même phrase — le sens est inversé, les mots sont là',
    cible: 'accuse-precede-le-relevement',
    fichier: 'metier',
    muter: (t) => t.replace(
      "— **avant même d'avoir fini de relever**, dès que sa ligne est ouverte.",
      "— ce n'est pas vrai que tu accuses **avant même d'avoir fini de relever** : en réalité tu accuses ensuite, dès que sa ligne est ouverte.",
    ),
  },

  {
    // ⚠️ LE CAS QUI A ÉCHAPPÉ À LA GARDE PRÉCÉDENTE, et qui lui a coûté un aller-retour :
    // le contresens n'est pas dans la phrase qui porte l'incise, il est dans la SUIVANTE.
    // Trouvé par une vérification indépendante sur le commit qui venait de restreindre la
    // portée de `RENVERSEMENT` pour supprimer un faux positif — la correction d'un défaut
    // en avait ouvert un autre, sur le mécanisme même qu'elle réparait.
    id: 'accuse-contredit-dans-la-phrase-suivante',
    quoi: 'l’antériorité est écrite, puis contredite par la phrase d’à côté — la garde de la phrase porteuse ne la voit pas',
    cible: 'accuse-precede-le-relevement',
    fichier: 'metier',
    muter: (t) => t.replace(
      "dès que sa ligne est ouverte. Voir « Ta continuité ».",
      "dès que sa ligne est ouverte. Ce n'est pas vrai : le relèvement passe en premier. Voir « Ta continuité ».",
    ),
  },

  {
    id: 'accuse-devient-une-promesse',
    quoi: 'l’accusé cesse d’être borné — il laisse entendre qu’une réponse est en route',
    cible: 'accuse-precede-le-relevement',
    fichier: 'metier',
    muter: (t) => t.replace(
      '⚠️ **Mais un accusé n\'est pas une promesse.**',
      '⚠️ **Et ton accusé annonce une réponse prochaine.**',
    ),
  },
  {
    id: 'le-decompte-de-l-ordre-ment',
    quoi: 'l’ordre d’ouverture annonce moins de gestes qu’il n’en énumère — on s’arrête avant de poser sa ronde',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => t.replace('Six gestes, dans cet ordre exact', 'Quatre gestes, dans cet ordre exact'),
  },
  {
    id: 'la-ronde-repare-ce-qu-elle-voit',
    quoi: 'l’interdit de réparer pendant une ronde disparaît — le réflexe de redémarrer redevient permis',
    cible: 'ronde-tient-par-un-mecanisme',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Regarde, inscris, alerte — ne répare jamais.**',
      '**Regarde, inscris, alerte — et répare ce qui est simple.**',
    ),
  },
  {
    id: 'l-etat-descend-par-un-renversement',
    quoi: 'l’interdit de recopier l’état au client est retourné par une incise, sans que la sonde disparaisse',
    cible: 'etat-de-reprise-vit-dehors',
    fichier: 'metier',
    muter: (t) => t.replace(
      '⚠️ **Ton état n\'est pas une preuve, et il ne parle jamais au client.**',
      '⚠️ **On pourrait croire que ton état ne parle jamais au client — en réalité, un état bien résumé peut lui être recopié.**',
    ),
  },
  {
    id: 'la-borne-de-l-accuse-est-retournee',
    quoi: 'la borne « seul l’accusé passe avant » est renversée par une incise — une réponse de fond repasse devant',
    cible: 'accuse-precede-le-relevement',
    fichier: 'metier',
    muter: (t) => t.replace(
      'Et **seul l\'accusé passe avant**',
      'On pourrait croire que **seul l\'accusé passe avant** ; dans les faits, une brève réponse peut partir avec lui',
    ),
  },
  {
    id: 'une-commande-de-session-inventee',
    quoi: 'le métier enseigne un verbe de session qui n’existe pas — la famille de « herdr wait output »',
    cible: 'gestes-de-session-existants',
    fichier: 'metier',
    muter: (t) => t.replaceAll('herdr pane run', 'herdr wait output'),
  },
];
