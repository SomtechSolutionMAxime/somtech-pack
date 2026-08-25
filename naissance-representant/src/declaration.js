// declaration.js — LA DÉCLARATION DE NAISSANCE D'UN AGENT. (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE MODULE INSCRIT, ET OÙ — DEUX LIEUX, DEUX RÔLES
//
// Quand l'outillage fait naître un agent, deux choses doivent survivre à la session :
//
//   1. **un FAIT horodaté, hors dépôt** — dans `~/.somtech/naissances`. Il dit qui est né,
//      quand, pour quel mandat, sur quel pane. Il est HORS DÉPÔT parce qu'il décrit le POSTE,
//      pas le chantier : le versionner ferait naître un conflit à chaque naissance, et
//      remonterait dans un dépôt client des noms d'agents qui ne le regardent pas.
//   2. **le NOM sur le ticket du mandat** — `assigned_agent` au ServiceDesk, pour que
//      quelqu'un qui lit le ticket sache qui le tient.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ CE QUE VAUT `assigned_agent` REMPLI ICI — ET LA RÈGLE A CHANGÉ SOUS LES COMMENTAIRES.
//
// Les commentaires voisins de `vue-du-parc.js` disent que `assigned_agent` est du texte libre
// que rien ne relit. **C'était vrai, ça ne l'est plus** : RA-VUE-005 a été amendée (BRD v0.11.0,
// statut `accepted`) et reconnaît désormais DEUX sources — le code du mandat tenu du lieu, qui
// est le lien PROUVÉ, et `assigned_agent` REMPLI À LA NAISSANCE PAR L'OUTILLAGE, qui est le lien
// DÉCLARÉ. Ce que la règle continue d'exclure est le libellé saisi à la main HORS de la
// naissance : « il diverge et vieillit, quand une déclaration de naissance a un auteur et un
// moment ».
//
// 🔴 CE MODULE ÉCRIT DONC UNE SOURCE, PAS UNE COURTOISIE. C'est le second membre d'EF-AGT-006
// (« le champ `assigned_agent` du mandat est rempli DANS LE MÊME GESTE »), et le mot compte : un
// lecteur qui croit écrire une décoration ne défend pas ce champ quand il coûte.
//
// ⚠️ Et il ne se présente JAMAIS comme un lien prouvé (RA-VUE-006) : qui le lit dit sa source —
// *déclarée*. Quand les deux sources existent et se contredisent, l'écart SE MONTRE.
//
// ⚠️ Les bancs et commentaires écrits AVANT l'amendement gardent l'ancienne règle. Les lire
// comme la règle courante fait conclure l'inverse de ce que le BRD dit aujourd'hui — c'est
// arrivé en écrivant ce module.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ LE NOM DE L'AGENT COMPOSE LE NOM DU FICHIER — C'EST UNE ÉCRITURE PILOTÉE PAR L'ENTRÉE.
//
// C'est le motif exact que `lieu-nom.js` existe pour fermer : « ../../evil » y écrivait hors du
// dépôt tant qu'aucune garde ne se posait des DEUX côtés. On ne réécrit donc PAS une liste
// noire ici — une garde qui cherche des tournures interdites se défait en ajoutant une
// tournure. On importe la LISTE BLANCHE du dépôt (`nomDeLieuValide`), qui est le seul jugement
// et le même partout : le jour où elle bouge, elle bouge pour tout le monde d'un coup.

import { mkdirSync, writeFileSync, renameSync, readdirSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { nomDeLieuValide, NomDeLieuInvalide } from '../../ligne-directe/src/lieu-nom.js';
import { transportServiceDesk, familleDuMandat, codeDuMandat, STATUTS_CLOS } from '../../ligne-directe/src/mandat.js';

/**
 * OÙ VIVENT LES DÉCLARATIONS — même forme que `ligne-directe/src/registre.js`, et pour la même
 * raison : la surcharge par l'environnement est ce qui permet à une suite d'essais de mettre le
 * registre du poste hors de portée sans avoir à toucher au code.
 */
export const RACINE = process.env.SOMTECH_NAISSANCES_RACINE || join(homedir(), '.somtech', 'naissances');

const VERSION = 1;

/** Ce qu'on refuse d'inventer : sans l'un de ces quatre, la déclaration ne dit plus rien. */
const CHAMPS_OBLIGATOIRES = ['nom', 'role', 'mandat', 'espace'];

/** Ce que `pose_par` porte — le geste qui a inscrit, pour qu'un fait ait toujours un auteur. */
export const POSE_PAR = 'pack agent naitre';

/**
 * Le suffixe des voisins provisoires — employé À L'ÉCRITURE seulement (une seule fois, plus bas).
 *
 * ⚠️ LA LECTURE NE LE CONNAÎT PAS, et le commentaire qui vivait ici affirmait l'inverse (« nommé
 * ici parce que la LECTURE doit le reconnaître »). `lireLesDeclarations` ne le cherche nulle
 * part : elle ne retient QUE ce qui finit par `.json`. Ce qui rend le provisoire invisible n'est
 * donc pas ce suffixe-ci, c'est qu'il s'ajoute APRÈS le `.json` du nom final — `…json.somtech-<pid>.tmp`
 * ne finit plus par `.json`. Le suffixe reste utile (il dit à un humain ce qu'est ce résidu), il
 * n'est simplement pas un contrat entre les deux moitiés.
 */
const SUFFIXE_PROVISOIRE = '.tmp';

/**
 * La forme d'un identifiant que `update` accepte.
 *
 * ⚠️ ELLE EST VÉRIFIÉE, ET CE N'EST PAS DU ZÈLE. `action: 'update'` exige un UUID STRICT et
 * REJETTE un code lisible « T-… ». Un `get` qui rendrait un enregistrement dont l'`id` porte le
 * code — ou pas d'`id` du tout — nous ferait envoyer à `update` quelque chose qu'il refuse : on
 * rangerait son refus en « le ServiceDesk n'a pas répondu », et le ticket resterait sans agent
 * sans que la vraie cause apparaisse nulle part.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Levée quand un champ sans lequel la déclaration ne veut rien dire n'a pas été fourni. */
export class ChampManquant extends Error {
  constructor(champ) {
    super(
      `déclaration de naissance : le champ « ${champ} » manque, et il est obligatoire. ` +
        `Sont attendus : ${CHAMPS_OBLIGATOIRES.join(', ')}.`
    );
    this.name = 'ChampManquant';
    this.champ = champ;
  }
}

/**
 * Levée quand le fichier cible existe déjà.
 *
 * ⚠️ C'EST UNE ERREUR, PAS UN ÉCRASEMENT. Une déclaration est un FAIT : la réécrire
 * effacerait une naissance réelle et la remplacerait par une autre, en silence. Deux
 * naissances qui se disputent le même fichier signalent un vrai problème — deux naissances du
 * même agent dans la même milliseconde — et ce problème doit se voir.
 */
export class DeclarationDejaInscrite extends Error {
  constructor(chemin) {
    super(
      `déclaration de naissance : « ${chemin} » existe déjà. Un fait inscrit ne se réécrit ` +
        `pas — si cette naissance est bien nouvelle, elle porte le même nom ET la même ` +
        `milliseconde qu'une autre, et c'est cela qu'il faut regarder.`
    );
    this.name = 'DeclarationDejaInscrite';
    this.chemin = chemin;
  }
}

/**
 * Levée quand le répertoire est LÀ mais qu'on n'a pas pu le lire.
 *
 * ⚠️ TROIS ÉTATS, JAMAIS DEUX — c'est la règle de `nom-de-riviere.js` (`nomInscritDansLeLieu`)
 * appliquée un cran plus haut. « Absent » (ENOENT) est le cas NORMAL d'un poste où personne
 * n'est encore né : il rend un parc vide. « Présent mais illisible » — permissions, montage
 * réseau qui décroche — est une mesure MANQUÉE, et une mesure manquée ne conclut rien. Les
 * confondre ferait dire « aucun agent n'est né sur ce poste » à un répertoire plein.
 */
export class RegistreDeNaissancesIllisible extends Error {
  constructor(racine, cause) {
    super(
      `déclarations de naissance : « ${racine} » existe mais n'a pas pu être lu ` +
        `(${String(cause?.message ?? cause).trim()}). Je n'en conclus RIEN — surtout pas ` +
        `qu'aucun agent n'y est né.`
    );
    this.name = 'RegistreDeNaissancesIllisible';
    this.racine = racine;
    this.cause = cause;
  }
}

/**
 * L'horodatage tel qu'il nomme un fichier — ISO, sans ses séparateurs.
 *
 * Il garde l'ordre lexicographique de l'ISO (`20260825T124500123Z`), ce qui rend le répertoire
 * lisible à l'œil dans l'ordre du temps sans qu'aucun outil n'ait à parser quoi que ce soit.
 */
function horodatageCompact(quand) {
  return quand.toISOString().replace(/[-:.]/g, '');
}

/**
 * CE QUE `session_herdr` NOMME — l'identité DURABLE d'une session herdr, et rien d'autre.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CETTE FONCTION EXISTE PARCE QUE DEUX ÉTAGES N'Y METTAIENT PAS LA MÊME CHOSE.
 *
 * `session_herdr` est ÉCRIT ici (via `bin/naitre.js`) et LU par `garde-des-naissances.js`. Le
 * producteur y inscrivait le NOM de la session (« somtech ») ; le consommateur le comparait au
 * `herdr_socket` du pane, qui est un CHEMIN
 * (« /Users/…/.config/herdr/sessions/somtech/herdr.sock »). La comparaison était donc TOUJOURS
 * fausse, et la clé d'appariement « pane-dans-sa-session » n'a jamais pu mordre : la garde ne
 * tenait que par sa clé de repli, le nom. Chaque module avait son banc, chacun passait — la
 * jointure n'appartenait à personne.
 *
 * 🔴 C'EST LE CONSOMMATEUR QUI CÈDE, ET LA RAISON EST MESURÉE.
 *
 *   ① **Une déclaration est un FAIT DURABLE, pas une adresse d'exécution.** Elle survit au
 *      pane, à la session et au redémarrage du poste. Un chemin de socket y grave un `$HOME` et
 *      la disposition de la config d'une version de herdr ; le jour où l'une des deux bouge, un
 *      fait déjà écrit cesse d'apparier — et rien ne le signale.
 *   ② **Le nom est l'identité que le dispositif emploie DÉJÀ partout ailleurs** : c'est ce que
 *      l'humain tape (`--session <nom>`), et ce que TOUS les refus de `session.js` nomment.
 *   ③ **Le nom se dérive du socket, l'inverse est faux.** Le socket porte le nom dans son
 *      chemin (`sessionsDuPoste` ne trouve les sessions que sous `…/sessions/<nom>/herdr.sock`,
 *      mesuré sur les 5 sessions qui répondent parmi les 15 du poste le 2026-08-25). Faire
 *      céder le producteur aurait donc perdu de l'information ET rendu inappariable la
 *      déclaration DÉJÀ inscrite sur le poste, qui porte « somtech ».
 *
 * ⚠️ ELLE N'INVENTE AUCUN NOM. Un socket hors de la forme `…/sessions/<nom>/…` — ce que
 * `HERDR_SOCKET_PATH` autorise — rend `null`, exactement comme `nomDeSession`. « Je ne sais pas
 * de quelle session il s'agit » ne doit jamais se replier sur une chaîne qui se comparera
 * ensuite comme une identité.
 *
 * ⚠️ ET ELLE EST IDEMPOTENTE : appliquée à un nom, elle le rend inchangé. C'est ce qui la rend
 * posable des DEUX côtés de la jointure — un seul endroit à lire pour savoir ce que ce champ
 * veut dire, donc un seul endroit où une divergence future doit passer.
 */
export function identiteDeSession(session) {
  if (!renseigne(session)) return null;
  const brut = String(session).trim();
  // Pas de séparateur ⇒ c'est déjà un nom de session, tel que `--session` l'accepte.
  if (!/[/\\]/.test(brut)) return brut;
  const nomme = brut.match(SESSION_DANS_LE_SOCKET);
  return nomme ? nomme[1] : null;
}

/**
 * Là où herdr pose le nom d'une session : `…/sessions/<nom>/herdr.sock`.
 *
 * ⚠️ UNE SEULE FOIS DANS LE DÉPÔT. `session.js` s'en sert par `identiteDeSession` plutôt que
 * d'en garder une copie : deux expressions du même format, c'est deux endroits qui peuvent
 * diverger — et la divergence de deux lectures du même champ est très exactement le défaut que
 * cette fonction ferme.
 */
const SESSION_DANS_LE_SOCKET = /[/\\]sessions[/\\]([^/\\]+)[/\\][^/\\]+$/;

/** Une valeur fournie, non blanche — `0` ou `false` n'ont pas de sens pour ces champs-ci. */
function renseigne(valeur) {
  return typeof valeur === 'string' ? valeur.trim().length > 0 : valeur !== undefined && valeur !== null;
}

/**
 * Inscrit la naissance d'un agent — un fichier, un fait, et rien d'autre.
 *
 * @param {object}  entree
 * @param {string}  entree.nom           le nom de l'agent (compose le nom du fichier — validé)
 * @param {string}  entree.role          `orchestrateur`, `representant`, …
 * @param {string}  entree.mandat        le chantier qu'il tient (`D-…`, `T-…`, ou un nom libre)
 * @param {string}  entree.coordonnateur qui l'a fait naître
 * @param {string}  entree.espace        l'espace de travail herdr
 * @param {string}  entree.pane          le pane qui le porte
 * @param {string}  entree.session       la session herdr
 * @param {string} [entree.racine]       où inscrire — `RACINE` par défaut
 * @param {Date}   [entree.quand]        l'instant de la naissance — maintenant par défaut
 * @param {Function} [entree.renommer]   LE POINT DE SUBSTITUTION, et il n'y en a qu'un.
 *   ⚠️ Il existe parce qu'une garde a SURVÉCU à sa mutation : le nettoyage du voisin après un
 *   renommage raté n'était atteignable par aucun essai — un répertoire en lecture seule fait
 *   échouer l'écriture AVANT que le voisin existe, donc il n'y a jamais rien à nettoyer.
 *   Substituer ce seul appel nommé reproduit la CAUSE (le renommage échoue alors que le voisin
 *   est là), et laisse tout le reste de la chaîne réelle en place — ce qui vaut mieux qu'un
 *   double du module entier, qui pourrait n'être pas conforme.
 *
 * @returns {{chemin: string, declaration: object}}
 * @throws  {ChampManquant} un obligatoire manque — et le refus DIT lequel
 * @throws  {NomDeLieuInvalide} le nom ne peut pas nommer un fichier sans risque
 * @throws  {DeclarationDejaInscrite} le fait est déjà là — on ne l'écrase pas
 */
export function inscrireLaDeclaration({
  nom,
  role,
  mandat,
  coordonnateur,
  espace,
  pane,
  session,
  racine = RACINE,
  quand = new Date(),
  renommer = renameSync,
} = {}) {
  // ⚠️ TOUT SE JUGE AVANT LA MOINDRE ÉCRITURE — `mkdirSync` compris. Un refus qui aurait déjà
  // créé le répertoire laisserait derrière lui la trace d'un geste qui n'a pas eu lieu, et les
  // essais qui exigent « un refus n'écrit RIEN » ne sont pas décoratifs : c'est cette propriété
  // qui rend un refus rejouable sans nettoyage.
  for (const champ of CHAMPS_OBLIGATOIRES) {
    if (!renseigne({ nom, role, mandat, espace }[champ])) throw new ChampManquant(champ);
  }
  if (!nomDeLieuValide(nom)) throw new NomDeLieuInvalide(nom, 'nom');

  const declaration = {
    version: VERSION,
    nom,
    role,
    mandat,
    coordonnateur: coordonnateur ?? null,
    espace,
    pane: pane ?? null,
    session_herdr: session ?? null,
    ne_le: quand.toISOString(),
    pose_par: POSE_PAR,
  };

  const chemin = join(racine, `${horodatageCompact(quand)}-${nom}.json`);
  mkdirSync(racine, { recursive: true });
  if (existsSync(chemin)) throw new DeclarationDejaInscrite(chemin);

  // Écriture atomique : un voisin, puis un renommage — la forme éprouvée de `registre.js` et
  // d'`approbation.js`. Le voisin vit dans le MÊME répertoire, sans quoi le renommage
  // traverserait les systèmes de fichiers et cesserait d'être atomique. Un processus tué en
  // plein vol laisse alors un `.tmp` de plus, jamais une déclaration tronquée qu'un lecteur
  // compterait comme un fait.
  const provisoire = `${chemin}.somtech-${process.pid}${SUFFIXE_PROVISOIRE}`;
  try {
    writeFileSync(provisoire, `${JSON.stringify(declaration, null, 2)}\n`, { mode: 0o600 });
    renommer(provisoire, chemin);
  } catch (err) {
    try {
      if (existsSync(provisoire)) unlinkSync(provisoire);
    } catch {
      // Le provisoire reste : c'est un fichier de plus, jamais une déclaration cassée — et la
      // lecture sait déjà l'ignorer.
    }
    throw err;
  }

  return { chemin, declaration };
}

/**
 * Lit toutes les déclarations d'un poste — du plus récent au plus ancien.
 *
 * ⚠️ UN FICHIER ABÎMÉ NE FAIT PAS TOMBER LA LECTURE. Le parc entier deviendrait invisible à
 * cause d'un seul octet, et le geste qui aurait pu le signaler serait précisément celui qui
 * refuse de rendre quoi que ce soit. Les abîmés sortent donc À PART, avec leur cause — deux
 * champs SÉPARÉS, jamais mêlés : `declarations` porte des faits, `illisibles` porte des
 * raisons. Le motif inverse a déjà rendu, sur ce dépôt, un résultat qui changeait selon la
 * machine, parce qu'une raison s'était glissée dans une liste que des contrôles comptaient.
 *
 * @returns {{declarations: object[], illisibles: {fichier: string, cause: string}[]}}
 * @throws  {RegistreDeNaissancesIllisible} le répertoire est là, mais on n'a pas pu le lire
 */
export function lireLesDeclarations({ racine = RACINE } = {}) {
  let entrees;
  try {
    entrees = readdirSync(racine);
  } catch (err) {
    // `ENOENT` est la seule absence, et elle est NORMALE : personne n'est encore né ici.
    if (err?.code === 'ENOENT') return { declarations: [], illisibles: [] };
    throw new RegistreDeNaissancesIllisible(racine, err);
  }

  const declarations = [];
  const illisibles = [];
  for (const fichier of entrees) {
    // Un voisin provisoire abandonné n'est pas un fait abîmé : c'est le résidu normal d'une
    // écriture interrompue. Le signaler ferait chercher un défaut qui n'existe pas.
    if (!fichier.endsWith('.json')) continue;
    try {
      const lu = JSON.parse(readFileSync(join(racine, fichier), 'utf8'));
      // Un tableau ou un scalaire passe `JSON.parse` sans être une déclaration. Le laisser
      // entrer ferait tomber le premier lecteur qui ferait `d.nom` — c'est-à-dire loin d'ici,
      // sur une cause qui n'évoquerait plus jamais ce fichier.
      if (!lu || typeof lu !== 'object' || Array.isArray(lu)) {
        illisibles.push({ fichier, cause: 'le contenu n’est pas un objet' });
        continue;
      }
      declarations.push(lu);
    } catch (err) {
      illisibles.push({ fichier, cause: String(err?.message ?? err).trim() });
    }
  }

  // ⚠️ LE TRI DÉPARTAGE LES ÉGALITÉS, ET C'EST NÉCESSAIRE. Deux naissances dans la même
  // milliseconde ont le même `ne_le` ; sans second critère, l'ordre rendu serait celui du
  // système de fichiers, et le même parc se lirait autrement d'une machine à l'autre. C'est le
  // motif « vert chez l'auteur, rouge en CI » déjà payé ici.
  declarations.sort((a, b) => {
    const parLeTemps = String(b?.ne_le ?? '').localeCompare(String(a?.ne_le ?? ''));
    return parLeTemps !== 0 ? parLeTemps : String(b?.nom ?? '').localeCompare(String(a?.nom ?? ''));
  });

  return { declarations, illisibles };
}

/**
 * Extrait de la réponse du ServiceDesk l'enregistrement qui porte un UUID exploitable.
 *
 * L'enveloppe varie selon l'outil (`{ticket: {...}}`, `{data: {...}}`, l'enregistrement nu…),
 * alors on cherche la FORME plutôt que la clé — même geste que `accesServiceDesk`, qui cherche
 * l'objet portant `status` sans présumer sous quel nom il arrive.
 */
/**
 * L'ENREGISTREMENT que porte une réponse de ticket — celui dont l'`id` est l'UUID qu'on vient d'y
 * trouver. On ne câble pas `ticket` en dur : l'enveloppe varie d'un outil à l'autre, exactement
 * comme pour `uuidDansLaReponse`, dont ceci est la moitié qui manquait.
 */
function enregistrementDuTicket(corps, id) {
  const candidats = [corps, ...Object.values(corps || {})];
  for (const valeur of candidats) {
    if (valeur && typeof valeur === 'object' && !Array.isArray(valeur) && String(valeur.id ?? '') === String(id)) {
      return valeur;
    }
  }
  return null;
}

function uuidDansLaReponse(corps) {
  const candidats = [corps, ...Object.values(corps || {})];
  for (const valeur of candidats) {
    if (valeur && typeof valeur === 'object' && !Array.isArray(valeur) && UUID.test(String(valeur.id ?? ''))) {
      return valeur.id;
    }
  }
  return null;
}

/**
 * Remplit `assigned_agent` sur le ticket du mandat.
 *
 * ⚠️ RIEN NE JETTE ICI, ET C'EST LE CONTRAT — mais pas parce que le champ serait accessoire.
 * Il est une SOURCE au sens de RA-VUE-005 (voir l'en-tête). On ne fait pas tomber la naissance
 * sur son échec parce qu'un agent vivant et déclaré localement vaut mieux qu'un agent perdu :
 * l'inscription hors dépôt, elle, a déjà eu lieu. Tout échec se dit donc dans la valeur rendue,
 * avec sa cause — et « rempli: false » n'est JAMAIS silencieux, précisément parce que ce qui
 * manque alors est une source, pas un ornement.
 *
 * ⚠️ DEUX APPELS, ET L'ORDRE COMPTE. `action: 'get'` accepte le CODE lisible (« T-… ») ;
 * `action: 'update'` exige un UUID STRICT et rejette ce même code. On lit donc l'UUID par le
 * code, puis on met à jour par l'UUID. Envoyer le code à `update` rendrait un refus qu'on
 * rangerait en « pas d'accès », et le ticket resterait sans agent.
 *
 * @param {object}   entree
 * @param {string}   entree.mandat      le mandat du lieu — seul un `T-…` est adressable ici
 * @param {string}   entree.nom         le nom à inscrire
 * @param {Function|null} [entree.appelerMcp] le transport `(outil, args) → corps`. `null` =
 *   aucun accès. Par défaut, le transport PARTAGÉ de `mandat.js` — qui porte la cloison
 *   d'essais et rend `null` sans clé. Il est IMPORTÉ, jamais recopié : une cloison dupliquée
 *   est une cloison qu'on oublie d'un côté.
 *
 * @returns {Promise<{rempli: true, id: string, nom: string}|{rempli: false, cause: string}>}
 */
/**
 * Combien d'epics on lit d'un coup quand il faut retrouver un code dans la liste.
 *
 * Même valeur que le `parPage` d'`accesServiceDesk` : ces deux lectures interrogent le même
 * service pour la même raison, et deux plafonds différents feraient diverger deux diagnostics
 * du même « introuvable ».
 */
const PAGE_EPICS = 200;

/** La cause d'une erreur, réduite à ce qu'un humain peut lire. */
function motifDe(err) {
  return String(err?.message ?? err).trim();
}

/**
 * L'objet d'une réponse qui porte un tableau `stories` — la FORME, jamais la clé.
 *
 * Mesuré le 2026-08-25 contre le service réel : `epics` action `get` rend `{epic: {…,
 * stories: [...]}}`. On ne câble pas `epic` en dur pour autant — l'enveloppe varie d'un outil à
 * l'autre, et `uuidDansLaReponse` juste au-dessus cherche déjà la forme pour la même raison.
 *
 * ⚠️ `null` DIT « JE N'AI PAS TROUVÉ DE LISTE DE STORIES », JAMAIS « IL N'Y EN A PAS ». Les
 * deux se rendent séparément plus bas : `vue-du-parc.js` a déjà payé ce mélange — une liste
 * vide rendue pour une lecture manquée y faisait disparaître le travail d'agents entiers.
 */
function epicDansLaReponse(corps) {
  for (const valeur of [corps, ...Object.values(corps || {})]) {
    if (valeur && typeof valeur === 'object' && !Array.isArray(valeur) && Array.isArray(valeur.stories)) {
      return valeur;
    }
  }
  return null;
}

/**
 * Retrouve l'epic d'un code, avec ses stories.
 *
 * ⚠️ `epics` action `get` N'ACCEPTE PAS LE CODE LISIBLE, ET C'EST MESURÉ — deux fois. Le
 * 2026-08-19 (`mandat.js`) puis le 2026-08-25 contre le service réel : `{action:'get',
 * id:'E-20260825-0002'}` rend « Epic not found ». Le schéma de l'outil dit la même chose sans
 * l'écrire — `epics.get` documente son `id` comme « UUID de l'epic », là où `tickets.get`
 * documente EXPLICITEMENT qu'il accepte aussi le code `T-…`. Un module qui s'arrêterait au
 * premier `get` ne trouverait donc JAMAIS un epic réel.
 *
 * On garde tout de même `get` en premier — il est direct le jour où le service le sert, et
 * c'est la forme d'`accesServiceDesk`, qui a tranché pareil sur la même mesure. La liste ne
 * part que s'il n'a rien rendu d'exploitable.
 *
 * @returns `{epic}` quand il est lu, `{cause}` sinon — jamais les deux, jamais rien.
 */
async function lireLEpic(code, appelerMcp) {
  try {
    const direct = epicDansLaReponse(await appelerMcp('epics', { action: 'get', id: code }));
    if (direct) return { epic: direct };
  } catch {
    /* `get` par code n'est pas servi sur les epics — la liste tranche. */
  }

  let liste;
  try {
    const corps = await appelerMcp('epics', { action: 'list', limit: PAGE_EPICS });
    liste = Object.values(corps || {}).find((v) => Array.isArray(v)) || [];
  } catch (err) {
    return { cause: `lecture des epics pour ${code} : ${motifDe(err)}` };
  }

  // ⚠️ LA COMPARAISON IGNORE LA CASSE, ET CE N'EST PAS DU ZÈLE (RA-AGT-004). Dans ce lot même,
  // le code s'écrit « E-20260825-0002 » et le nom de l'agent « e-20260825-0002 » : un mandat lu
  // depuis un nom de dossier arrive en minuscules. `codeDuMandat` a déjà majusculé le nôtre ;
  // on ne présume rien de celui que le service rend.
  const trouve = liste.find((e) => String(e?.epic_id ?? '').trim().toUpperCase() === code);
  if (!trouve) {
    return {
      cause:
        `${code} ne figure pas dans les ${liste.length} epics lus` +
        // La troncature SE DIT : une liste qui rend exactement son plafond a très probablement
        // été coupée, et l'epic cherché peut être juste derrière. Sans cette marque, un
        // « introuvable » parfaitement exact enverrait chercher au mauvais endroit.
        (liste.length >= PAGE_EPICS ? ` — et cette liste est PLAFONNÉE à ${PAGE_EPICS} : il est peut-être juste derrière` : ''),
    };
  }
  if (!UUID.test(String(trouve.id ?? ''))) {
    return { cause: `${code} est là, mais sans identifiant exploitable : je ne peux pas lire ses stories` };
  }

  try {
    const parUuid = epicDansLaReponse(await appelerMcp('epics', { action: 'get', id: trouve.id }));
    if (!parUuid) {
      return { cause: `${code} : le ServiceDesk n’a rendu aucune liste de stories — je n’en conclus PAS qu’il n’en a aucune` };
    }
    return { epic: parUuid };
  } catch (err) {
    return { cause: `lecture de ${code} : ${motifDe(err)}` };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * CE QU'ON N'ÉCRASE PAS — et pourquoi la règle n'est PAS « ne jamais écraser » (défaut ②)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 LE DÉFAUT MESURÉ. Un epic à deux stories, `T-1` `completed` et attribuée à « bonaventure ».
 * La boucle écrivait « matapedia » sur les DEUX et rendait `rempli: true`, `remplies: [T-1, T-2]`.
 * Le nom d'un autre agent effacé sur un travail FINI, et rien dans le rendu ne le disait.
 *
 * ⚠️ ET LE MODULE GARDAIT DÉJÀ LE CAS SYMÉTRIQUE, avec son motif écrit : « écrire un
 * `assigned_agent` vide effacerait celui d'un autre » (voir `declarerAuServiceDesk`). Le même
 * risque, sur le chemin que ce lot ouvre, et sur le champ que ce lot élève au rang de SOURCE
 * (RA-VUE-005), n'était pas gardé.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * LA RÈGLE, ET LE CAS QU'ELLE NE DOIT PAS FERMER
 *
 *   • une story TERMINALE n'est jamais touchée. Son `assigned_agent` n'est plus une affectation :
 *     c'est le registre de QUI L'A FAITE. Le nouveau chef n'y travaillera pas — la réécrire ne
 *     lui sert à rien et détruit un fait que rien d'autre ne porte.
 *
 *   • une story VIVANTE portant le nom d'un autre est REPRISE. ⚠️ Refuser ici serait le
 *     correctif qui ouvre son symétrique : un chef qui hérite légitimement d'un epic dont
 *     l'agent est mort ne pourrait plus s'y inscrire, c'est-à-dire que le geste cesserait de
 *     servir là où il sert le plus. On écrit — mais on le DIT, nommément, avec le nom remplacé.
 *
 *   • et `rempli: true` ne survit ni à une reprise ni à une story sautée. Un succès plein annoncé
 *     sur un nom remplacé est exactement le rendu que le défaut produisait.
 *
 * ⚠️ CE QU'ON NE PEUT PAS MESURER SE DIT, ET NE SE DEVINE PAS. La charge mesurée des stories
 * sous un epic (`id`, `ticket_id`, `status`, `epic_id`) NE PORTE PAS `assigned_agent`. Quand la
 * clé est absente, on n'en conclut PAS « personne dessus » : on écrit, et `non_mesure` nomme ce
 * qu'on n'a pas pu voir. Le taire ferait lire « rien n'a été pris » à une mesure qui n'a jamais
 * eu lieu.
 */

/**
 * Ce ticket est-il dans un état TERMINAL ?
 *
 * ⚠️ LA TABLE VIENT DE `mandat.js`, RELEVÉE DU SERVICE (2026-08-19), jamais réécrite ici. Une
 * seconde liste d'états divergerait au premier statut que le ServiceDesk ajoute, et celle qui
 * divergerait serait celle-ci — dont aucune garde ne relit la population.
 *
 * ⚠️ ET UN STATUT ABSENT OU INCONNU N'EST PAS « TERMINAL ». C'est un état NON LU : le traduire
 * en « fermé » ferait sauter des stories vivantes en silence, ce qui est le défaut inverse.
 */
function estTerminal(statut) {
  return STATUTS_CLOS.tickets.includes(String(statut ?? '').trim());
}

/** Le nom que porte DÉJÀ un enregistrement — `undefined` quand la charge ne le porte pas du tout. */
function nomDejaPorte(enregistrement) {
  if (!enregistrement || typeof enregistrement !== 'object' || !('assigned_agent' in enregistrement)) return undefined;
  const brut = enregistrement.assigned_agent;
  return typeof brut === 'string' && brut.trim() ? brut.trim() : null;
}

/** Ce que `non_mesure` dit quand la charge ne porte pas le champ — écrit UNE fois, employé deux. */
const ASSIGNED_AGENT_NON_LU =
  'assigned_agent : la charge rendue ne le porte pas — je ne peux pas dire si un nom a été remplacé';

/**
 * Remplit `assigned_agent` sur TOUTES les stories d'un epic — et rend compte du PLURIEL.
 *
 * ⚠️ UN NOMBRE NU MENT. « 3 » ne dit ni 3 quoi, ni sur combien, ni lesquelles : qui le lit doit
 * tout remesurer. Le rendu porte donc `total` (combien l'epic en PORTAIT), `remplies` et
 * `refusees` — nommées par leur CODE, avec leur cause. Ce dépôt a déjà rendu deux fois un
 * compte juste dans une phrase fausse ; on donne de quoi vérifier, pas de quoi croire.
 *
 * 🔴 UN SUCCÈS PARTIEL N'EST PAS UN SUCCÈS. 2 stories sur 3 ne rend jamais `rempli: true` — et
 * ne jette pas non plus, ce qui perdrait les 2 réussies avec la 3ᵉ.
 *
 * ⚠️ ET `total` A TROIS ÉTATS, PAS DEUX. `0` = comptées, aucune (un epic pas encore découpé,
 * qui est un état NORMAL et se dit tel) ; `null` = pas comptées (epic introuvable, lecture
 * manquée). Les confondre ferait lire « cet epic n'a pas de story » à un epic qu'on n'a pas su
 * joindre — le motif exact que `lireLesDeclarations` sépare un étage plus haut.
 */
async function remplirLesStoriesDeLEpic({ code, nom, appelerMcp }) {
  const { epic, cause } = await lireLEpic(code, appelerMcp);
  if (!epic) return { rempli: false, epic: code, nom, total: null, remplies: [], refusees: [], cause };

  const stories = epic.stories;
  const remplies = [];
  const refusees = [];
  const reprises = [];
  const ignorees = [];
  let uneChargeMuette = false;
  for (const story of stories) {
    // On NOMME la story par son code : « une a refusé » enverrait chercher parmi toutes.
    const sonCode =
      typeof story?.ticket_id === 'string' && story.ticket_id.trim() ? story.ticket_id.trim() : '(story sans code)';
    // ⚠️ MÊME GARDE QUE POUR UN TICKET DIRECT : `update` exige un UUID STRICT et rejette un
    // code. Lui envoyer autre chose rendrait un refus qu'on rangerait en « le ServiceDesk n'a
    // pas répondu », et la story resterait sans agent sans que la vraie cause apparaisse.
    if (!UUID.test(String(story?.id ?? ''))) {
      refusees.push({ code: sonCode, cause: 'le ServiceDesk n’a rendu aucun identifiant exploitable' });
      continue;
    }
    // ═══ CE QU'ON NE RÉÉCRIT PAS — voir le pavé au-dessus de `estTerminal`.
    if (estTerminal(story?.status)) {
      ignorees.push({
        code: sonCode,
        cause:
          `elle est « ${String(story?.status ?? '').trim()} » — sur une story terminée, ` +
          `\`assigned_agent\` dit QUI L'A FAITE${nomDejaPorte(story) ? ` (${nomDejaPorte(story)})` : ''}, ` +
          `et le réécrire effacerait ce fait`,
      });
      continue;
    }
    const porte = nomDejaPorte(story);
    if (porte === undefined) uneChargeMuette = true;
    try {
      await appelerMcp('tickets', { action: 'update', id: story.id, assigned_agent: nom });
      // ⚠️ APRÈS L'ÉCRITURE, ET C'EST VOULU : une reprise qui aurait échoué n'est pas une reprise.
      // La ranger avant ferait annoncer un nom pris à quelqu'un qui le porte toujours.
      if (porte && porte !== nom) reprises.push({ code: sonCode, de: porte });
      else remplies.push(sonCode);
    } catch (err) {
      // Une story qui refuse n'interrompt PAS les suivantes : le mandat en porte d'autres, et
      // les remplir vaut mieux que de tout abandonner sur le premier refus.
      refusees.push({ code: sonCode, cause: motifDe(err) });
    }
  }

  const compte = {
    epic: code,
    nom,
    total: stories.length,
    remplies,
    reprises,
    ignorees,
    refusees,
    // On relève ce qu'on atteint, on NOMME ce qu'on n'atteint pas, et on ne conclut rien du second.
    non_mesure: uneChargeMuette ? [ASSIGNED_AGENT_NON_LU] : [],
  };
  if (stories.length === 0) {
    // Un epic pas encore découpé est un état NORMAL du chantier, pas une panne — et la phrase
    // le dit, pour que personne n'aille chercher un défaut qui n'existe pas.
    return {
      rempli: false,
      ...compte,
      cause: `${code} ne porte encore aucune story : il n’est pas découpé — rien à remplir, et ce n’est pas une panne`,
    };
  }
  // 🔴 `rempli: true` NE SURVIT NI À UNE REPRISE NI À UNE STORY SAUTÉE. Un succès plein annoncé
  // sur un nom remplacé est très exactement le rendu que le défaut ② produisait : le lecteur y
  // lisait « tout est en ordre » là où un agent venait d'en effacer un autre.
  if (refusees.length === 0 && reprises.length === 0 && ignorees.length === 0) return { rempli: true, ...compte };
  // Le compte porte son DÉNOMINATEUR et son UNITÉ, et chaque cas est nommé par son CODE.
  const dits = [
    ...refusees.map((r) => `${r.code} a refusé (${r.cause})`),
    ...reprises.map((r) => `${r.code} portait « ${r.de} » — REPRISE au nom de « ${nom} »`),
    ...ignorees.map((r) => `${r.code} n’a PAS été touchée : ${r.cause}`),
  ];
  return {
    rempli: false,
    ...compte,
    cause:
      `${code} : ${remplies.length} story(s) remplie(s) sur ${stories.length} — ` + dits.join(' ; '),
  };
}

/**
 * CE QU'ON DIT À L'ÉCRAN QUAND `rempli` EST FAUX — et pourquoi ce n'est pas une seule phrase.
 *
 * 🔴 « le mandat n'a pas reçu le nom de son agent » SERAIT FAUX SUR UNE REPRISE : le nom est bel
 * et bien parti, il a même remplacé celui d'un autre. `rempli: false` recouvre trois états qui
 * n'appellent pas le même geste — rien n'a abouti, un nom a été REMPLACÉ, une story a été
 * SAUTÉE — et une formule qui les recouvre tous fait chercher au mauvais endroit.
 *
 * ⚠️ ELLE VIT ICI, PAS DANS LA COMMANDE, pour être éprouvable : une phrase écrite au fil d'un
 * `process.stderr.write` n'a pour garde que la relecture, et c'est ce qui a laissé passer les
 * quatre vérifications affirmées d'un chef d'équipe (défaut ③).
 */
export function phraseDuMandatIncomplet(mandat, resultat) {
  const aEcrit = (resultat?.reprises?.length ?? 0) > 0 || (resultat?.remplies?.length ?? 0) > 0;
  const tete = aEcrit
    ? `le mandat ${mandat} n’a pas été rempli entièrement`
    : `le mandat ${mandat} n’a pas reçu le nom de son agent`;
  return `${tete} : ${resultat?.cause ?? '(aucune cause rendue)'}`;
}

export async function declarerAuServiceDesk({ mandat, nom, appelerMcp = transportServiceDesk() } = {}) {
  if (!renseigne(nom)) {
    // Écrire un `assigned_agent` vide EFFACERAIT celui qui s'y trouve. On ne lit même pas le
    // ticket : il n'y avait rien à y mettre.
    return { rempli: false, cause: 'aucun nom à inscrire — le ticket n’est pas touché' };
  }

  const famille = familleDuMandat(mandat);
  const code = codeDuMandat(mandat);
  if (!famille) {
    // ⚠️ ON REND LE CODE NORMALISÉ, JAMAIS LA VALEUR BRUTE. Un `mandat` absent rendrait
    // « null » ou « undefined » dans une phrase destinée à un humain : ça a l'air d'un
    // diagnostic et ce n'en est pas. `(vide)` dit la même chose sans faire fuiter l'interne.
    return { rempli: false, cause: `« ${code || '(vide)'} » n’est pas un code de chantier : aucun ticket à remplir` };
  }
  if (famille !== 'tickets' && famille !== 'epics') {
    // ⚠️ ON NE DEVINE PAS. Une demande, un projet ou une livraison ne portent pas de tickets
    // qu'on saurait désigner sans choisir : leurs epics ont chacun leurs stories, et remplir
    // « tout ce qui pend dessous » poserait un nom sur le travail d'autres agents. Un refus
    // qui se dit vaut mieux qu'un nom posé sur le mauvais ticket.
    return {
      rempli: false,
      cause: `« ${code} » désigne un ${famille}, pas un ticket ni un epic : je ne choisis pas de story à sa place`,
    };
  }

  if (typeof appelerMcp !== 'function') return { rempli: false, cause: 'aucun accès au ServiceDesk' };

  // ═══ UN CHEF D'ÉQUIPE MÈNE UN EPIC — c'est le cas CANONIQUE, pas un cas limite, et il était
  // refusé. Les tickets de son mandat sont LES STORIES DE SON EPIC, toutes : les remplir n'est
  // pas « choisir une story à sa place », c'est remplir le mandat entier.
  if (famille === 'epics') return remplirLesStoriesDeLEpic({ code, nom, appelerMcp });

  let lu;
  try {
    lu = await appelerMcp('tickets', { action: 'get', id: code });
  } catch (err) {
    return { rempli: false, cause: `lecture de ${code} : ${String(err?.message ?? err).trim()}` };
  }
  const id = uuidDansLaReponse(lu);
  if (!id) {
    return { rempli: false, cause: `${code} : le ServiceDesk n’a rendu aucun identifiant exploitable` };
  }

  // ═══ LA MÊME RÈGLE QUE SUR LES STORIES — et la SYMÉTRIE n'est pas du zèle (défaut ②).
  //
  // Corriger le fan-out d'un epic et laisser le chemin direct réécrire un ticket fini rouvrirait
  // le même défaut par l'autre porte, sur le même champ, élevé au rang de SOURCE par ce lot.
  // La charge d'un `tickets get` PORTE `status` — c'est mesuré, et c'est ce que le double rend.
  const enregistrement = enregistrementDuTicket(lu, id);
  if (estTerminal(enregistrement?.status)) {
    const porte = nomDejaPorte(enregistrement);
    return {
      rempli: false,
      id,
      nom,
      cause:
        `${code} est « ${String(enregistrement?.status ?? '').trim()} » : je ne le réattribue pas — ` +
        `sur un ticket terminé, \`assigned_agent\` dit QUI L'A FAIT` +
        `${porte ? ` (${porte})` : ''}, et le réécrire effacerait ce fait`,
    };
  }
  const porteDeja = nomDejaPorte(enregistrement);

  try {
    await appelerMcp('tickets', { action: 'update', id, assigned_agent: nom });
  } catch (err) {
    return { rempli: false, cause: `mise à jour de ${code} : ${String(err?.message ?? err).trim()}` };
  }
  // Une REPRISE aboutit, mais elle ne se rend pas « rempli » : un nom a été remplacé, et le
  // lecteur doit le savoir sans avoir à comparer deux états du ServiceDesk.
  if (porteDeja && porteDeja !== nom) {
    return {
      rempli: false,
      id,
      nom,
      reprises: [{ code, de: porteDeja }],
      cause: `${code} portait « ${porteDeja} » — REPRIS au nom de « ${nom} »`,
    };
  }
  return {
    rempli: true,
    id,
    nom,
    non_mesure: porteDeja === undefined ? [ASSIGNED_AGENT_NON_LU] : [],
  };
}
