// rendu.js — le métier d'un rôle est RENDU depuis son ABC, jamais écrit à la main.
//
// Cadre : STD-047 (construction d'un agent Claude Code), projet P-20260820-0001.
// Ce module est la seule chose qui transforme un classement en artefacts de métier.
// Il est PUR : il ne lit ni n'écrit aucun fichier, ne touche à aucun lieu d'agent
// (I5), et rend ses refus plutôt que de les lever — c'est ce qui le rend testable.

/**
 * Budgets par étage, en tokens. Arbitrage du dirigeant du 2026-08-20.
 * L0 et L1 sont des PLAFONDS DURS : le rendu échoue. L2 est souple — un
 * chapitre trop gros est une information (il couvre deux sujets), pas une faute.
 */
export const BUDGETS = { L0: 150, L1: 2500, L2: 6000 };

/**
 * Les six couches de STD-047 §2.1, de la plus forte à la plus faible.
 * Les quatre premières GARANTISSENT une incapacité ; les deux dernières ne font
 * qu'incliner une propension.
 */
export const COUCHES = [
  'capacite-absente',
  'refus-de-permission',
  'hook',
  'gate-de-depot',
  'competence',
  'persona',
];
const GARANTISSENT = new Set(['capacite-absente', 'refus-de-permission', 'hook', 'gate-de-depot']);

/**
 * Coût en tokens d'un texte.
 *
 * ⚠️ MÉTHODE DÉCLARÉE, et elle MAJORE délibérément. Le coût réel d'un texte
 * français dense en markdown a été mesuré à ~4,2 caractères par token sur le
 * métier de l'orchestrateur (146 349 octets ≈ 33 000 tokens). Ce compteur
 * emploie 3,5 : il rend donc ~20 % de plus que le coût réel.
 *
 * C'est délibéré et ça ne se « corrige » pas : une garde qui SOUS-compte laisse
 * passer un dépassement sans rien dire, et son silence ressemble à un succès.
 * Mieux vaut mordre trop tôt que jamais.
 */
export function compterTokens(texte) {
  if (!texte) return 0;
  return Math.max(1, Math.ceil(String(texte).length / 3.5));
}

/**
 * La commande d'un hook, qui REFUSE d'elle-même si la garde manque sur le poste
 * OU si elle tombe en panne.
 *
 * ⚠️ DEUX MODES DE PANNE, ET ILS ONT ÉTÉ MESURÉS SÉPARÉMENT.
 *
 * ① **La garde est absente.** `node <fichier absent>` sort en code 1 — pour
 * Claude Code, une erreur NON BLOQUANTE : le geste passerait pendant que le
 * classement déclare l'item « porté par un hook ». C'est la garantie fausse que
 * R1 existe pour empêcher, déplacée d'un cran.
 *
 * ② **La garde est là et elle CASSE.** C'est le mode qui manquait, et il est
 * pire. Mesuré le 2026-08-24 sur Claude Code 2.1.241 : une garde qui sort en
 * erreur sans rien écrire dégrade le geste en DEMANDE de permission — et sous
 * `--permission-mode acceptEdits`, une demande est un oui. **Le fichier a été
 * écrit pendant que la garde était morte.** Un `deny` déclaratif, lui, est
 * inerte : il ne peut pas tomber en panne. Depuis T-20260824-0002, une garde
 * porte à elle seule un refus qui vivait dans `permissions.deny` — elle doit
 * donc se défendre contre sa propre panne, pas seulement contre son absence.
 *
 * La commande n'appelle donc plus la garde par `exec` : elle CAPTURE sa sortie,
 * et n'émet ce verdict que si la garde a réussi ET rendu quelque chose. Sinon,
 * elle refuse à sa place. Patron de STD-047 R3bis, un cran plus bas.
 *
 * ⚠️ Ce qu'elle ne ferme PAS, et qui est écrit plutôt qu'espéré : une garde qui
 * PEND. Le shell l'attendrait avec elle, et `timeout` n'existe pas sur macOS.
 */
function commandeDeHook(garde, chemin) {
  const refuser = (raison) => JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: raison,
    },
  }).replace(/'/g, "'\\''");
  const absente = refuser(
    `la garde « ${garde} » est introuvable sur ce poste — ` +
    'installe-la avec `npx @somtech-solutions/pack setup`. Refus par defaut : ' +
    'un garde absent ne vaut jamais un garde permissif.');
  const cassee = refuser(
    `la garde « ${garde} » est presente mais elle n a rendu aucun verdict — elle a echoue. ` +
    'Refus par defaut : une garde qui casse ne vaut jamais une garde permissive, et une ' +
    'demande de permission est un oui des que la session accepte les editions.');
  // ⚠️ TROISIÈME MODE, TROUVÉ PAR LA REVUE DE FOND ET MESURÉ : « code 0 » et « non
  // vide » ne font pas un verdict. Une ligne de bruit sur stdout AVANT le JSON — un
  // `npm notice`, un `console.log` oublié, un avertissement de Node — et la sortie
  // transmise ne parse plus. Claude Code n'a alors aucun verdict, et retombe sur la
  // demande de permission : un oui sous `acceptEdits`. La commande VALIDE donc ce
  // qu'elle transmet, et ré-émet un verdict canonique — ce qui écarte le bruit du
  // même geste. Sortie vide = pas de verdict = refus, sans avoir à lire `$?` (qu'un
  // tube rendrait de toute façon celui du dernier maillon).
  const filtre = 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{'
    + 'var v=JSON.parse(s).hookSpecificOutput;'
    + 'if(v&&(v.permissionDecision==="allow"||v.permissionDecision==="deny"))'
    + 'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",'
    + 'permissionDecision:v.permissionDecision,'
    + 'permissionDecisionReason:String(v.permissionDecisionReason||"")}}))}catch(e){}})';
  return `G="${chemin || `$HOME/.somtech/gardes/${garde}.js`}"; if [ -f "$G" ]; then ` +
    `S=$(node "$G" 2>/dev/null | node -e '${filtre}' 2>/dev/null); if [ -n "$S" ]; then printf '%s\\n' "$S"; ` +
    `else printf '%s\\n' '${cassee}'; fi; ` +
    `else cat >/dev/null 2>&1; printf '%s\\n' '${absente}'; fi`;
}

/** La forme courte d'un énoncé : sa première phrase, sans le gras. */
const abreger = (t) => {
  const plat = String(t || '').replace(/\*\*/g, '');
  const p = plat.split(/(?<=\.)\s/)[0];
  return p.length > 180 ? p.slice(0, 177) + '…' : p;
};

/**
 * Une puce du socle : ce que l'agent LIT, suivi de sa traçabilité en commentaire.
 *
 * ⚠️ L'identifiant d'ABC et la couche ne sont PAS de l'information pour agir —
 * ce sont la traçabilité (I7) et la matière du cycle d'évolution. Les afficher
 * fait lire à l'agent la mécanique de son propre métier au lieu de son métier.
 * *(Arbitrage du dirigeant, 2026-08-21 : « l'ABC a été utilisé pour créer le
 * métier, il n'est pas une référence de son opération ».)*
 */
const puce = (i, note) =>
  `- ${i.enonce_socle || i.enonce}` +
  `\n  <!-- ${i.id} · ${note || i.couche} -->`;

const cheminSur = (c) =>
  !c.startsWith('/') && !c.includes('..') && !c.includes('.orchestrateur') &&
  !c.includes('.gestionnaire') && !c.includes('CONTEXTE.md');

/**
 * Rend le métier d'un rôle depuis son classement.
 *
 * @param {object} classement  items[] (id, nature, couche, enonce, chapitre?),
 *                             chapitres[] (nom, abrege, version_pack), identite?
 * @returns {{ok:boolean, erreurs:string[], artefacts:Record<string,string>, mesures:object}}
 */
export function rendre(classement) {
  const erreurs = [];
  const items = Array.isArray(classement?.items) ? classement.items : [];
  const chapitres = Array.isArray(classement?.chapitres) ? classement.chapitres : [];
  const role = classement?.role || 'agent';
  const nomsChapitres = new Set(chapitres.map((c) => c?.nom));

  // — ce qui rend le classement irrecevable, avant même de rendre quoi que ce soit
  const gardeFous = items.filter((i) => i.nature === 'garde-fou');
  const deroges = [];
  if (gardeFous.length === 0) {
    erreurs.push('classement irrecevable : aucun garde-fou — un rôle sans garde-fou est un rôle mal décrit');
  }

  // Une couche déclarée doit être RÉELLEMENT posée par le rendu. Classer un item
  // en « hook » sans qu'aucun hook n'existe, ou en « refus-de-permission » sans
  // que le refus soit déclaré, produit exactement ce que STD-047 interdit : une
  // garantie fausse. Le classement dirait « garanti » et rien ne le garantirait.
  const hooks = Array.isArray(classement?.hooks) ? classement.hooks : [];
  // ⚠️ Un chemin de garde est interpolé dans une commande de shell qui s'exécute
  // à CHAQUE geste de l'agent. Un `$(…)`, un accent grave ou un guillemet y
  // exécuterait n'importe quoi, dans chaque lieu posé. Le classement est un
  // fichier versionné, mais c'est justement l'artefact dont tout le rôle est
  // d'être une garantie : il ne s'exempte pas de sa propre discipline.
  const CHEMIN_SUR = /^[$A-Za-z0-9_{}./-]+$/;
  for (const h of hooks) {
    if (h?.chemin && !CHEMIN_SUR.test(h.chemin)) {
      erreurs.push(`le chemin de garde « ${h.chemin} » porte un caractère que le shell interprète — refusé.`);
    }
  }
  const refus = new Set(Array.isArray(classement?.refus) ? classement.refus : []);

  for (const i of items) {
    if (i.couche === 'hook' && hooks.length === 0) {
      erreurs.push(`${i.id} est classé « hook », mais le classement n'en déclare aucun — la couche serait un mot.`);
    }
    if (i.couche === 'refus-de-permission') {
      const exiges = Array.isArray(i.refus) ? i.refus : [];
      const manquants = exiges.filter((x) => !refus.has(x));
      if (exiges.length === 0) {
        erreurs.push(`${i.id} est classé « refus-de-permission » sans nommer ce qui est refusé.`);
      } else if (manquants.length) {
        erreurs.push(`${i.id} s'appuie sur le refus de ${manquants.join(', ')}, que le classement ne déclare pas.`);
      }
    }
    if (!COUCHES.includes(i.couche)) {
      erreurs.push(`${i.id} : couche inconnue « ${i.couche} » — les couches sont ${COUCHES.join(', ')}`);
      continue;
    }
    // R1 + R2 — un garde-fou porté par une couche qui ne fait qu'incliner
    if (i.nature === 'garde-fou' && !GARANTISSENT.has(i.couche)) {
      // ⚠️ La dérogation existe parce que R1 pris à la lettre rend TOUT rendu
      // impossible : certaines règles — « ne cache jamais une erreur » — portent
      // sur le contenu d'un énoncé, et aucune couche ne les garantira jamais.
      // Elle n'efface pas le défaut, elle l'EXPOSE : un item dérogé doit porter
      // un motif ET un nom qui l'assume, et il est listé en tête du socle rendu.
      // Sans les deux, le refus de R1 tient entier.
      const sg = i.sans_garantie;
      if (sg?.motif && sg?.assume_par && (sg.definitif || sg.echeance)) {
        deroges.push(i);
      } else if (sg?.motif && sg?.assume_par && !sg.definitif && !sg.echeance) {
        // Une dérogation temporaire sans date est une dette qui n'a pas de fin.
        erreurs.push(
          `R1 — ${i.id} est dérogé sans être définitif et sans échéance. ` +
          `Une dérogation temporaire porte la date à laquelle sa couche arrive, ` +
          `ou se déclare définitive. Sans date, elle est une permission de se taire.`,
        );
      } else {
        erreurs.push(
          `R1 — ${i.id} n'atterrit qu'en « ${i.couche} », qui incline sans garantir. ` +
          `Un garde-fou exige une couche qui garantit : ${[...GARANTISSENT].join(', ')}. ` +
          `Pour l'assumer sans couche, il lui faut « sans_garantie » avec un motif ET un nom qui l'assume.`,
        );
      }
    }
    // Ce qui monte au socle doit porter un énoncé COURT. Sans lui, le socle
    // recopierait l'ABC entier et le budget sauterait — ce qui est arrivé au
    // premier rendu réel : 4 306 tokens pour un plafond de 2 500.
    if ((i.nature === 'garde-fou' || i.cardinale || !i.chapitre) && !i.enonce_socle) {
      erreurs.push(`${i.id} monte au socle : il lui faut un « enonce_socle » court, l'énoncé d'ABC entier n'y tient pas`);
    }
    if (i.chapitre && !nomsChapitres.has(i.chapitre)) {
      erreurs.push(`${i.id} renvoie au chapitre « ${i.chapitre} », qui n'existe pas dans le classement`);
    }
  }

  // ⚠️ Le français de ce dispositif s'écrit avec ses accents. Un mot dépouillé
  // se lit comme une faute d'inattention dans le PREMIER fichier qu'un agent
  // ouvre — et il est d'autant plus difficile à voir qu'il se glisse dans un
  // texte par ailleurs accentué. Mesuré le 2026-08-21 sur le socle livré :
  // « ait a en tenir », « ce metier sans le posseder », « couche a construire ».
  // ⚠️ « a » employé comme préposition est le cas qu'une liste de mots ne peut
  // pas couvrir — et c'est celui qui a survécu à ma première passe de correction.
  // ⚠️ « a » employé comme préposition est le cas qu'une liste de mots ne peut
  // pas couvrir. Mais le VERBE avoir prend les mêmes compléments : « un client
  // qui a une question » est correct, et une première version le refusait.
  // La garde n'attrape donc que les tournures où un sujet ne peut pas précéder :
  // après un verbe d'action, ou dans « couche a construire ».
  const SANS_ACCENT = /\b(metier|posseder|possede|invente|declare|apres|deja|etat|etats|reponse|controle|derogation|defaut|verifie|mesure(?=r\b)|ait a|Refus par defaut)\b|\b(parle|parler|parles|monte|monter|remonte|remonter|rend|rendre|dit|dire|ecrit|ecrire|passe|passer|sert|servir|pense|penser|repond|repondre|va|aller|jamais|toujours) a (?=un |une |la |le |les |ce |cet |cette |son |sa |ses |toi\b|lui\b|moi\b)|\bcouche a construire\b/g;
  for (const [ou, texte] of [['identité', classement?.identite], ['préambule', classement?.preambule],
                             ...items.map((i) => [`l'énoncé de socle de ${i.id}`, i.enonce_socle]),
                             ...items.map((i) => [`le motif de dérogation de ${i.id}`, i.sans_garantie?.motif])]) {
    const trouves = [...new Set(String(texte || '').match(SANS_ACCENT) || [])];
    if (trouves.length) {
      erreurs.push(`${ou} porte des mots dépouillés de leurs accents : ${trouves.join(', ')}. ` +
        `Le rendu les porterait jusque dans le premier fichier qu'un agent lit.`);
    }
  }

  const nomsVus = new Set();
  for (const c of chapitres) {
    if (!c?.nom) {
      erreurs.push("un chapitre n'a pas de nom — il rendrait « chapitres/undefined.md »");
    } else if (nomsVus.has(c.nom)) {
      erreurs.push(`deux chapitres portent le nom « ${c.nom} » — le second écraserait le premier en silence`);
    } else {
      nomsVus.add(c.nom);
    }
    if (!c?.abrege) erreurs.push(`I4 — le chapitre « ${c?.nom} » n'a pas d'abrégé`);
    if (!c?.version_pack) erreurs.push(`I4 — le chapitre « ${c?.nom} » ne dit pas de quelle version du pack il provient`);
  }

  // — les artefacts
  const artefacts = {};

  const identite = classement?.identite ||
    `# Tu es l'${role} de ce chantier\n\nTu portes ce métier sans le posséder : il est rendu depuis ton ABC.\n`;
  artefacts['L0.md'] = identite.endsWith('\n') ? identite : identite + '\n';

  // Les trois sections de L1 partitionnent : un item n'y paraît qu'une fois.
  // Sans ça le socle se paie en double sur un budget qui est un plafond DUR —
  // trouvé par la revue indépendante du 2026-08-20, visible dans le rendu livré.
  const cardinales = items.filter((i) => i.cardinale).sort((a, b) => a.cardinale - b.cardinale);
  const dejaEnL1 = new Set(cardinales.map((i) => i.id));
  const sansChapitre = items.filter((i) => !i.chapitre && !dejaEnL1.has(i.id));
  const l1 = [
    '',
    ...(classement?.preambule ? [classement.preambule, ''] : []),
    '# Ce qui prime',
    '',
    ...(cardinales.length
      ? ['## Les règles cardinales', '', ...cardinales.map((i) => puce(i, deroges.includes(i) ? `aucune couche — ${i.sans_garantie.motif}` : i.couche)), '']
      : []),
    ...(deroges.length
      ? ['## ⚠️ Ce que rien ne garantit — et qui ne tient donc qu\'à toi', '',
         ...deroges.filter((i) => !dejaEnL1.has(i.id)).map((i) => puce(i, `aucune couche — ${i.sans_garantie.motif} · assumé par ${i.sans_garantie.assume_par}`)), '']
      : []),
    '## Ce qui t\'est refusé',
    '',
    ...gardeFous.filter((i) => !deroges.includes(i) && !dejaEnL1.has(i.id)).map((i) => puce(i)),
    '',
    ...(sansChapitre.filter((i) => i.nature !== 'garde-fou').length
      ? ['## Règles du socle', '',
         ...sansChapitre.filter((i) => i.nature !== 'garde-fou').map((i) => puce(i)), '']
      : []),
    '## Où trouver le reste',
    '',
    ...chapitres.map((c) => `- **${c.nom}** — ${c.abrege} → \`metier/chapitres/${c.nom}.md\``),
    '',
  ].join('\n');
  artefacts['L1.md'] = l1;

  for (const c of chapitres) {
    const regles = items.filter((i) => i.chapitre === c.nom);
    artefacts[`chapitres/${c.nom}.md`] = [
      `# ${c.nom}`,
      '',
      `> **En un mot** — ${c.abrege || '[abrégé manquant]'}`,
      `> **Rendu depuis la version du pack** \`${c.version_pack || '[version manquante]'}\` · ABC \`${classement?.version_abc || '[non établi]'}\``,
      '',
      // I7 — le chapitre CITE les items dont il répond ; il ne recopie pas leur
      // texte. L'ABC est leur source, et le socle porte les cardinales. Recopier
      // ici pesait 19 949 octets, la duplication même que ce modèle combat.
      ...(regles.length ? [`> **Répond de** ${regles.map((i) => i.id).join(' · ')}`, ''] : []),
      ...(c.contenu ? [c.contenu, ''] : []),
    ].join('\n');
  }

  // Le fichier de droits : ce qui GARANTIT. `allow` n'y figure pas — un bloc
  // `allow` déclenche un écran de confiance que la pré-approbation ne fait pas
  // taire, et l'agent naît alors injoignable (STD-047 R3). `deny` est la moitié
  // qui garantit, et elle tient dès la naissance.
  if (refus.size || hooks.length || classement?.droits) {
    const st = { permissions: { deny: [...refus] } };
    if (classement?.droits) st.somtech = { droitsAccordes: classement.droits };
    if (hooks.length) {
      st.hooks = {};
      for (const h of hooks) {
        (st.hooks[h.evenement] ||= []).push({
          // `matcher` seulement s'il y a un outil à viser : un hook qui vaut pour
          // tous n'en porte pas, et la convergence compare la forme mot pour mot.
          ...(h.outil ? { matcher: h.outil } : {}),
          // ⚠️ La commande se DÉFEND elle-même. `node <fichier absent>` sort en
          // code 1, qui est pour Claude Code une erreur NON BLOQUANTE : le geste
          // passerait pendant que le classement déclare l'item « porté par un
          // hook ». C'est le patron du seul hook déjà en service (STD-047 R3bis),
          // et sa polarité : un garde absent ne vaut jamais un garde permissif.
          hooks: [{ type: 'command', // Une commande DÉCLARÉE est reprise mot pour mot : deux copies d'un même
          // critère divergent en silence, et celle-ci est comparée à l'identique
          // par la convergence.
          command: h.commande || commandeDeHook(h.garde, h.chemin) }],
        });
      }
    }
    artefacts['.claude/settings.json'] = JSON.stringify(st, null, 2) + '\n';
  }

  // — les budgets, mesurés sur ce qui a été rendu (jamais sur une intention)
  const mesures = {
    L0: compterTokens(artefacts['L0.md']),
    L1: compterTokens(artefacts['L1.md']),  // le fichier de droits n'est pas chargé en contexte
    L2: Object.fromEntries(chapitres.map((c) => [c.nom, compterTokens(artefacts[`chapitres/${c.nom}.md`])])),
  };
  for (const etage of ['L0', 'L1']) {
    if (mesures[etage] > BUDGETS[etage]) {
      erreurs.push(
        `I2 — ${etage} pèse ${mesures[etage]} tokens pour un plafond de ${BUDGETS[etage]} : ` +
        `${mesures[etage] - BUDGETS[etage]} tokens de trop. Un ajout au socle exige un retrait en compensation.`,
      );
    }
  }
  // I3 — le métier rendu ne doit pas être plus volumineux que son ABC (STD-047 §2.5).
  // ⚠️ C'est un invariant à MESURER, pas un gate de rendu : R4 ne fait échouer que
  // sur L0 et L1. Sans le volume de l'ABC, on le dit non mesuré plutôt que de
  // rendre un rapport inventé.
  const motsRendus = Object.values(artefacts).reduce((n, t) => n + t.split(/\s+/).filter(Boolean).length, 0);
  const motsAbc = Number.isFinite(classement?.mots_abc) ? classement.mots_abc : null;
  mesures.R1 = {
    garde_fous: gardeFous.length,
    deroges: deroges.length,
    refuses: erreurs.filter((e) => e.startsWith('R1 —')).length,
  };
  mesures.I3 = {
    mots_rendus: motsRendus,
    mots_abc: motsAbc,
    rapport: motsAbc ? Number((motsRendus / motsAbc).toFixed(2)) : null,
  };

  const avertissements = Object.entries(mesures.L2)
    .filter(([, t]) => t > BUDGETS.L2)
    .map(([n, t]) => `le chapitre « ${n} » pèse ${t} tokens (souple : ${BUDGETS.L2}) — il couvre probablement deux sujets`);
  if (mesures.I3.rapport !== null && mesures.I3.rapport >= 1) {
    avertissements.push(
      `I3 non satisfait — le métier rendu pèse ${mesures.I3.mots_rendus} mots contre ${mesures.I3.mots_abc} pour l'ABC ` +
      `(${mesures.I3.rapport}×). L'invariant demande < 1 : soit l'ABC absorbe encore, soit le métier retire encore.`,
    );
  }

  // — I5/I6 : aucun artefact ne vise un lieu d'agent
  for (const chemin of Object.keys(artefacts)) {
    if (!cheminSur(chemin)) erreurs.push(`I5 — le rendu ne doit écrire dans aucun lieu : « ${chemin} » est refusé`);
  }

  return { ok: erreurs.length === 0, erreurs, avertissements, deroges: deroges.map((i) => i.id), artefacts, mesures };
}
