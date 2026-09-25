// scribe-taches.js — le hook `Stop` comme scribe des tâches au ServiceDesk (T-20260925-0080).
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS
//
// L'orchestrateur rend, dans son dernier message, un bloc structuré (```taches```)
// qui dit ce qu'il ouvre, ce qu'il a fait, ce qu'il attend. Ce module DÉCIDE de ce
// qu'il faut écrire au ServiceDesk et de la suite à rendre — le fil mince
// (`gardes/scribe-taches.js`) ne fait que lire stdin, lire le transcript, lire le
// fichier `.demande` du lieu, appeler ce module, et écrire la sortie.
//
// ⚠️ « PUR » ICI VEUT DIRE : aucune dépendance implicite. Ce module ne touche ni
// `process.env`, ni le système de fichiers, ni l'horloge murale — tout entre par
// paramètre (`appeler`, `maintenant`, les contenus déjà lus). Il appelle bien le
// ServiceDesk, mais UNIQUEMENT via le transport injecté : un test qui lui passe un
// `appeler` qui jette n'atteint jamais un réseau réel. C'est le même sens de « pur »
// que `sous-agent.js` (aucune I/O propre), étendu à l'async.
//
// ⚠️ LE SILENCE EST LE DÉFAUT QUE CE LOT FERME. Un scribe qui n'écrit pas ne
// produit aucune erreur — il produit un silence, et un silence ressemble à « rien
// à signaler » (D-20260925-0003, commentaire du 25 sept.). Donc : pas de bloc →
// silence total (aucun appel, c'est la SEULE sortie muette) ; tout le reste — bloc
// malformé, ServiceDesk injoignable, ticket d'un autre chantier, comptes
// divergents — est NOMMÉ, jamais avalé.
//
// ⚠️ POLARITÉ DES ÉCRITURES : TOUT est validé AVANT la première écriture. Un échec
// APRÈS la première écriture ne peut pas être défait — le fil mince le dit dans son
// refus (ce qui a été écrit, ce qui ne l'a pas été). Ce module ne fait aucune
// tentative de rollback : le ServiceDesk n'offre pas d'écriture transactionnelle
// multi-appels, et prétendre le contraire serait une garantie fausse.
//
// 🔴 REJEU = DOUBLONS, ET C'EST UN DÉFAUT RÉEL trouvé en revue de fond
// (T-20260925-0080) : un hook `Stop` peut être redéclenché sur le MÊME dernier
// message (retry de l'hôte, relance manuelle) — sans garde, deux appels créent
// deux tickets identiques. La garde est un JOURNAL PAR ÉTAPE — l'empreinte
// (sha256) du bloc COURANT, plus l'ensemble des étapes du PLAN déjà réussies
// pour cette empreinte — gardé dans l'état du plafond (même fichier, par lieu).
//
// 🔴 UNE EMPREINTE DE FIN DE PLAN NE SUFFIT PAS, ET C'EST UN DÉFAUT RÉEL, REPRODUIT
// (passe 2 bis) : si `ouvrir` réussit puis `en-cours` tombe en panne, le refus
// nommé qui en résulte pousse l'agent à réémettre le MÊME bloc au tour suivant —
// c'est la réaction normale à « ServiceDesk en panne ». Sans mémoire PAR ÉTAPE,
// le rejeu recrée `ouvrir` une seconde fois. Le journal retient donc CHAQUE
// étape réussie individuellement (pas seulement « tout a réussi ») : un rejeu
// sur la même empreinte saute ce qui est déjà fait et ne rejoue que le reste.
// Un bloc d'empreinte DIFFÉRENTE ignore le journal précédent (bloc neuf, plan
// neuf). Le journal reflète TOUJOURS l'état réellement atteint — y compris sur
// un chemin de refus (échec partiel) — jamais seulement sur un succès complet.

import { createHash } from 'node:crypto';

/** Empreinte (sha256, hex) du contenu BRUT d'un bloc — sert l'idempotence du rejeu (D2). */
export function empreinteBloc(contenuBrut) {
  return createHash('sha256').update(String(contenuBrut)).digest('hex');
}

/** Les quatre verbes que le bloc `taches` reconnaît — et rien d'autre. */
export const VERBES_CONNUS = new Set(['ouvrir', 'en-cours', 'fait', 'attend']);

/** La forme d'un code de ticket — celle que le ServiceDesk résout (STD-030). */
export const CODE_TICKET = /^T-\d{8}-\d{4}$/;

/** La forme d'un code de demande — celle que `.demande` porte. */
export const CODE_DEMANDE = /^D-\d{8}-\d{4}$/;

/** Une heure glissante, en millisecondes — la fenêtre du plafond de relances. */
const UNE_HEURE_MS = 60 * 60 * 1000;

/**
 * LA FONCTION QUE `deciderStop` UTILISE POUR CHAQUE PAGE — un plafond dur, MESURÉ
 * sur la même base que `ligne-directe/src/mandat.js` (`PLAFOND_DE_PAGES`) : deux
 * ordres de grandeur au-dessus de la plus grosse famille mesurée. À 100 tickets par
 * page, 500 pages bornent la lecture à 50 000 tickets — hors d'atteinte de tout
 * chantier légitime, tout en bornant une source qui mentirait sur son total.
 */
export const PLAFOND_PAGES_LISTE = 500;
const TAILLE_PAGE_LISTE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// LE BLOC — extraction puis analyse, en deux passes distinctes.
//
// ⚠️ POURQUOI DEUX FONCTIONS ET NON UNE : `extraireBloc` répond à « y a-t-il un
// bloc, et est-il syntaxiquement clos ? » (silence si non). `analyserBloc` répond
// à « ce que le bloc CONTIENT est-il valide ? » (refus nommé si non). Le fil mince
// n'a besoin d'appeler `analyserBloc` (donc de risquer un réseau) qu'après avoir
// vu un bloc présent — jamais avant.
//
// 🔴 SEUL LE BLOC QUI TERMINE LE MESSAGE COMPTE — défaut réel trouvé en revue de
// fond (T-20260925-0080) : la première version balayait TOUT le message, donc un
// exemple CITÉ (« voici la syntaxe : ```taches ouvrir: X ``` — j'attends ta
// réponse ») créait un vrai ticket. Un bloc `taches` qui n'est pas suivi
// UNIQUEMENT de blancs jusqu'à la fin du message n'est JAMAIS une directive — il
// est ignoré, silencieusement, comme s'il n'existait pas. Ce n'est pas une erreur
// (« refus nommé ») : une citation n'est pas une tentative ratée d'écrire, elle
// n'en est pas une du tout.
//
// Conséquence mécanique : deux blocs `taches` dans le même message ne peuvent
// JAMAIS être tous les deux terminaux (un seul peut être suivi de rien) — le
// refus « deux blocs » qui existait ici a donc été RETIRÉ, pas contourné : sous
// cette règle, il ne peut plus jamais se déclencher. Un bloc cité, suivi plus
// loin d'un second bloc qui lui termine le message, se résout simplement au
// second : le premier est une citation comme une autre, ignorée.

/**
 * Cherche le bloc ```taches``` qui TERMINE un texte (le dernier caractère non
 * blanc du texte appartient à sa clôture) — jamais un bloc cité plus tôt.
 *
 * @param {string|null|undefined} texte
 * @returns {{presence:false}|{presence:true, ok:true, contenu:string}|{presence:true, ok:false, erreur:string}}
 */
export function extraireBloc(texte) {
  if (typeof texte !== 'string' || texte.length === 0) return { presence: false };
  const ouvertures = [...texte.matchAll(/```taches[ \t]*\r?\n/g)];
  if (ouvertures.length === 0) return { presence: false };
  // On ne juge que la DERNIÈRE ouverture : toute ouverture antérieure — citée,
  // expliquée, redonnée en exemple — est hors-jeu par construction dès que ce
  // bloc-ci se referme correctement en fin de message.
  const derniere = ouvertures[ouvertures.length - 1];
  const debut = derniere.index + derniere[0].length;
  const fermeture = texte.indexOf('```', debut);
  if (fermeture === -1) {
    // Rien ne referme le DERNIER bloc ouvert : par construction, il n'y a plus
    // rien après lui dans le texte — c'est une clôture manquante, jamais une
    // citation (une citation, elle, se refermerait avant la fin du message).
    return { presence: true, ok: false, erreur: "le bloc `taches` n'est jamais refermé (clôture ``` manquante)." };
  }
  if (texte.slice(fermeture + 3).trim() !== '') {
    // Le dernier bloc trouvé EST refermé, mais autre chose le suit dans le
    // message (au-delà des blancs) : il n'est donc pas le bloc terminal — une
    // citation ou un exemple. Silence, jamais une erreur : aucune directive n'a
    // été vue passer.
    return { presence: false };
  }
  return { presence: true, ok: true, contenu: texte.slice(debut, fermeture) };
}

/**
 * Analyse le CONTENU d'un bloc `taches` déjà extrait.
 *
 * @param {string} contenu
 * @returns {{ok:true, taches:{ouvrir:string[], enCours:string[], fait:{code:string,commentaire:string}[], attend:string|null}}|{ok:false, erreur:string}}
 */
export function analyserBloc(contenu) {
  const lignes = String(contenu ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lignes.length === 0) return { ok: false, erreur: 'le bloc `taches` est vide.' };

  const taches = { ouvrir: [], enCours: [], fait: [], attend: null };
  let nbAttend = 0;

  for (const ligne of lignes) {
    const m = ligne.match(/^([a-z-]+):\s*(.*)$/);
    if (!m) return { ok: false, erreur: `ligne du bloc \`taches\` non reconnue : « ${ligne} ».` };
    const [, verbe, reste] = m;
    if (!VERBES_CONNUS.has(verbe)) {
      return { ok: false, erreur: `verbe inconnu dans le bloc \`taches\` : « ${verbe} » (connus : ${[...VERBES_CONNUS].join(', ')}).` };
    }
    const valeur = reste.trim();

    if (verbe === 'ouvrir') {
      if (!valeur) return { ok: false, erreur: 'ligne `ouvrir:` sans titre.' };
      taches.ouvrir.push(valeur);
      continue;
    }

    if (verbe === 'en-cours') {
      if (!CODE_TICKET.test(valeur)) {
        return { ok: false, erreur: `ligne \`en-cours:\` — code invalide : « ${valeur} » (forme attendue T-YYYYMMDD-NNNN).` };
      }
      taches.enCours.push(valeur);
      continue;
    }

    if (verbe === 'fait') {
      const sep = valeur.indexOf(' — ');
      if (sep === -1) return { ok: false, erreur: 'ligne `fait:` sans commentaire de fermeture (séparateur « — » manquant).' };
      const code = valeur.slice(0, sep).trim();
      const commentaire = valeur.slice(sep + ' — '.length).trim();
      if (!CODE_TICKET.test(code)) {
        return { ok: false, erreur: `ligne \`fait:\` — code invalide : « ${code} » (forme attendue T-YYYYMMDD-NNNN).` };
      }
      if (!commentaire) return { ok: false, erreur: 'ligne `fait:` sans commentaire de fermeture.' };
      taches.fait.push({ code, commentaire });
      continue;
    }

    // verbe === 'attend'
    nbAttend += 1;
    if (nbAttend > 1) return { ok: false, erreur: 'plusieurs lignes `attend:` dans le même bloc — une seule est acceptée.' };
    if (valeur !== 'dirigeant') {
      return { ok: false, erreur: `ligne \`attend:\` — valeur inconnue : « ${valeur} » (seule « dirigeant » est acceptée).` };
    }
    taches.attend = 'dirigeant';
  }

  return { ok: true, taches };
}

/**
 * Lit le code de demande depuis le contenu brut du fichier `.demande`.
 *
 * @param {string|null|undefined} contenu  `null` si le fichier est absent ou illisible.
 * @returns {{ok:true, code:string}|{ok:false, erreur:string}}
 */
export function lireCodeDemande(contenu) {
  if (contenu == null || typeof contenu !== 'string') {
    return { ok: false, erreur: "le fichier `.demande` du lieu est absent ou illisible — aucune demande n'est déclarée." };
  }
  const t = contenu.trim();
  if (!CODE_DEMANDE.test(t)) {
    return { ok: false, erreur: `le fichier \`.demande\` est mal formé — attendu un code D-YYYYMMDD-NNNN seul, lu : « ${t.slice(0, 120)} ».` };
  }
  return { ok: true, code: t };
}

// ─────────────────────────────────────────────────────────────────────────────
// LE PLAFOND — garde ①. Compte les relances (`decision:block`) dans l'heure
// glissante, jamais les tours de l'agent : un tour sans bloc, ou un bloc qui
// n'émet aucun block, ne mord pas dessus.

/** Ne garde que les horodatages dans l'heure glissante qui se termine à `maintenant`. */
export function purgerHorodatages(horodatages, maintenant) {
  return (Array.isArray(horodatages) ? horodatages : [])
    .filter((t) => typeof t === 'number' && Number.isFinite(t) && maintenant - t < UNE_HEURE_MS && maintenant - t >= 0);
}

/**
 * Juge si une relance (`decision:block`) est autorisée par le plafond horaire.
 *
 * 🔴 `plafondParHeure` N'A AUCUN DÉFAUT NUMÉRIQUE ICI — c'est un arbitrage
 * (ADR-022, `proposed`), pas un oubli. Absent ou invalide → refuse toujours,
 * et le dit : mieux vaut une agent qui s'arrête à tort qu'une boucle qui ne
 * s'arrête jamais parce qu'un défaut de configuration s'est lu comme « illimité ».
 *
 * @param {{horodatages:number[], maintenant:number, plafondParHeure:number|null|undefined}} args
 * @returns {{autorise:boolean, raison?:string, compte:number}}
 */
export function jugerPlafond({ horodatages, maintenant, plafondParHeure }) {
  const purges = purgerHorodatages(horodatages, maintenant);
  if (!Number.isFinite(plafondParHeure) || plafondParHeure <= 0) {
    return {
      autorise: false, compte: purges.length,
      raison: "aucune relance : SOMTECH_SCRIBE_RELANCES_PAR_HEURE est absente ou invalide (le code n'a aucun "
        + 'défaut numérique) — un message entrant relance normalement l\'agent, ce plafond ne bâillonne pas '
        + "l'agent, il n'arrête que l'auto-relance.",
    };
  }
  if (purges.length >= plafondParHeure) {
    return {
      autorise: false, compte: purges.length,
      raison: `plafond de ${plafondParHeure} relance(s)/heure atteint (${purges.length} dans l'heure glissante) `
        + "— un message entrant relance normalement l'agent, ce plafond ne bâillonne pas l'agent, il n'arrête "
        + "que l'auto-relance.",
    };
  }
  return { autorise: true, compte: purges.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// LES APPELS AU SERVICEDESK — chacun nomme son échec plutôt que de le laisser
// remonter tel quel : un `throw` de fetch et un `success:false` applicatif sont
// TOUS DEUX un échec, et le fil mince n'a besoin de connaître qu'une forme.

/** `success:false` explicite dans un corps par ailleurs valide — l'AUTRE forme d'échec. */
function estEchecApplicatif(resultat) {
  return !!(resultat && typeof resultat === 'object' && resultat.success === false);
}

/**
 * Le pré-vol en lecture : la demande existe-t-elle, et sous quel UUID ?
 *
 * @param {{code:string, appeler:Function}} args
 * @returns {Promise<{ok:true, id:string, createdAt:string, directTicketCount:number}|{ok:false, erreur:string}>}
 */
export async function preverifierDemande({ code, appeler }) {
  let resultat;
  try {
    resultat = await appeler('demands', { action: 'get', id: code, header: true });
  } catch (e) {
    return { ok: false, erreur: `la demande « ${code} » est injoignable au ServiceDesk (${e?.message ?? 'cause inconnue'}).` };
  }
  if (estEchecApplicatif(resultat)) {
    return { ok: false, erreur: `le ServiceDesk refuse la lecture de la demande « ${code} » (${resultat.error ?? 'échec applicatif'}).` };
  }
  const d = resultat?.demand;
  if (!d?.id || typeof d.direct_ticket_count !== 'number') {
    return { ok: false, erreur: `la demande « ${code} » a rendu une réponse sans les champs attendus (id, direct_ticket_count).` };
  }
  return { ok: true, id: d.id, createdAt: d.created_at, directTicketCount: d.direct_ticket_count };
}

/**
 * Vérifie qu'un ticket appartient bien à la demande — AVANT toute écriture dessus.
 *
 * @param {{code:string, demandeId:string, appeler:Function}} args
 * @returns {Promise<{ok:true, id:string}|{ok:false, erreur:string}>}
 */
export async function verifierTicketAppartient({ code, demandeId, appeler }) {
  let resultat;
  try {
    resultat = await appeler('tickets', { action: 'get', id: code, header: true });
  } catch (e) {
    return { ok: false, erreur: `le ticket « ${code} » est injoignable au ServiceDesk (${e?.message ?? 'cause inconnue'}).` };
  }
  if (estEchecApplicatif(resultat)) {
    return { ok: false, erreur: `le ServiceDesk refuse la lecture du ticket « ${code} » (${resultat.error ?? 'échec applicatif'}).` };
  }
  const t = resultat?.ticket;
  if (!t?.id) return { ok: false, erreur: `le ticket « ${code} » n'a pas rendu de réponse lisible.` };
  if (t.demand_id !== demandeId) {
    return {
      ok: false,
      erreur: `le ticket « ${code} » n'appartient pas à la demande déclarée dans \`.demande\` `
        + `(demand_id « ${t.demand_id ?? 'aucun'} » ≠ « ${demandeId} ») — on ne ferme pas le ticket d'un autre chantier.`,
    };
  }
  return { ok: true, id: t.id };
}

/**
 * Exécute le plan d'écritures, EN ORDRE : tous les `ouvrir`, puis tous les
 * `en-cours`, puis tous les `fait` (commentaire puis fermeture).
 *
 * 🔴 REJEU APRÈS ÉCHEC PARTIEL = DOUBLON, ET C'EST UN DÉFAUT RÉEL, REPRODUIT
 * (T-20260925-0080, revue de fond, passe 2 bis). `ouvrir` réussit, `en-cours`
 * tombe en panne → refus nommé → l'agent réémet le MÊME bloc au tour suivant
 * (c'est la réaction attendue à un refus « ServiceDesk en panne ») → sans
 * mémoire PAR ÉTAPE, tout le plan rejoue, et `ouvrir` crée un second ticket
 * identique. La granularité D2 (une empreinte de FIN de plan) ne protégeait que
 * le cas « tout a réussi » — jamais un rejeu après échec partiel.
 *
 * `etapesDejaFaites` (un `Set` de clés, voir `clesDuPlan`) fait sauter les
 * étapes déjà réussies lors d'un tour précédent SUR LE MÊME BLOC — elles sont
 * comptées à part (`sautees`), jamais réexécutées. `noterEtapeReussie(cle)` est
 * appelé SYNCHRONE, immédiatement après CHAQUE écriture réussie — c'est ce qui
 * permet à l'appelant de savoir ce qui a réellement réussi même si une étape
 * suivante échoue : le module reste pur (aucune I/O propre), c'est l'appelant
 * qui décide quoi faire de ce rappel.
 *
 * ⚠️ CE QU'ELLE NE PEUT TOUJOURS PAS FAIRE : défaire une écriture déjà partie si
 * une suivante échoue. Elle s'arrête au premier échec et rend, séparément, ce qui
 * a été écrit CE TOUR, ce qui a été SAUTÉ (déjà fait), et ce qui ne l'a pas été.
 *
 * @param {{taches:object, demandeId:string, ticketsVerifies:Map<string,string>,
 *   appeler:Function, etapesDejaFaites?:Set<string>, noterEtapeReussie?:(cle:string)=>void}} args
 * @returns {Promise<{toutesReussies:boolean, ecrits:string[], sautees:string[], nonEcrits:string[], erreur?:string}>}
 */
export async function executerEcritures({ taches, demandeId, ticketsVerifies, appeler, etapesDejaFaites, noterEtapeReussie }) {
  const dejaFaites = etapesDejaFaites instanceof Set ? etapesDejaFaites : new Set(etapesDejaFaites || []);
  const plan = [];
  taches.ouvrir.forEach((titre, i) => {
    plan.push({ cle: `ouvrir#${i}`, etape: `ouvrir « ${titre} »`, run: () => appeler('tickets', { action: 'create', title: titre, demand_id: demandeId, type: 'improvement' }) });
  });
  for (const code of taches.enCours) {
    const id = ticketsVerifies.get(code);
    plan.push({ cle: `en-cours:${code}`, etape: `en-cours ${code}`, run: () => appeler('tickets', { action: 'update', id, status: 'in_progress' }) });
  }
  for (const { code, commentaire } of taches.fait) {
    const id = ticketsVerifies.get(code);
    plan.push({ cle: `fait:${code}:commentaire`, etape: `fait ${code} — commentaire`, run: () => appeler('tickets', { action: 'add_comment', id, content: commentaire }) });
    plan.push({ cle: `fait:${code}:fermeture`, etape: `fait ${code} — fermeture`, run: () => appeler('tickets', { action: 'update', id, status: 'completed' }) });
  }

  const ecrits = [];
  const sautees = [];
  for (let i = 0; i < plan.length; i += 1) {
    const { cle, etape, run } = plan[i];
    if (dejaFaites.has(cle)) { sautees.push(etape); continue; }
    let resultat;
    try {
      resultat = await run();
    } catch (e) {
      return {
        toutesReussies: false, ecrits, sautees,
        nonEcrits: plan.slice(i).filter((p) => !dejaFaites.has(p.cle)).map((p) => p.etape),
        erreur: `l'écriture « ${etape} » a échoué (${e?.message ?? 'cause inconnue'}).`,
      };
    }
    if (estEchecApplicatif(resultat)) {
      return {
        toutesReussies: false, ecrits, sautees,
        nonEcrits: plan.slice(i).filter((p) => !dejaFaites.has(p.cle)).map((p) => p.etape),
        erreur: `l'écriture « ${etape} » a été refusée par le ServiceDesk (${resultat.error ?? 'échec applicatif'}).`,
      };
    }
    ecrits.push(etape);
    try { noterEtapeReussie?.(cle); } catch { /* best-effort — un rappel cassé ne doit jamais casser l'écriture elle-même */ }
  }
  return { toutesReussies: true, ecrits, sautees, nonEcrits: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA SUITE — « lit ce qu'il a à faire ». Paginer, filtrer côté client, recouper.

/**
 * Liste, paginée, les tickets d'une demande — `demand_id` en filtre serveur est
 * IGNORÉ EN SILENCE par le ServiceDesk (mesuré T-20260925-0088, 25 sept. 2026) :
 * on pagine donc `tickets list` sans filtre, on filtre `demand_id` CÔTÉ CLIENT, et
 * on s'arrête dès qu'une page atteint un `created_at` antérieur à celui de la
 * demande (les tickets d'une demande naissent forcément après elle) ou rend une
 * page vide — sous un plafond dur de pages.
 *
 * @param {{demandeId:string, demandeCreatedAt:string, appeler:Function}} args
 * @returns {Promise<{ok:true, taches:object[]}|{ok:false, erreur:string}>}
 */
async function listerTachesDeLaDemande({ demandeId, demandeCreatedAt, appeler }) {
  const bornée = Date.parse(demandeCreatedAt);
  if (!Number.isFinite(bornée)) return { ok: false, erreur: `\`created_at\` de la demande illisible : « ${demandeCreatedAt} ».` };

  const taches = [];
  for (let page = 0; page < PLAFOND_PAGES_LISTE; page += 1) {
    let resultat;
    try {
      resultat = await appeler('tickets', {
        action: 'list', sortBy: 'created_at', sortOrder: 'desc',
        limit: TAILLE_PAGE_LISTE, offset: page * TAILLE_PAGE_LISTE,
        fields: 'id,ticket_id,title,status,demand_id,created_at,sequence_order',
      });
    } catch (e) {
      return { ok: false, erreur: `la liste des tickets est injoignable au ServiceDesk (${e?.message ?? 'cause inconnue'}).` };
    }
    if (estEchecApplicatif(resultat)) {
      return { ok: false, erreur: `le ServiceDesk refuse la liste des tickets (${resultat.error ?? 'échec applicatif'}).` };
    }
    const page_ = Array.isArray(resultat?.tickets) ? resultat.tickets : null;
    if (!page_) return { ok: false, erreur: 'la liste des tickets a rendu une réponse sans tableau `tickets`.' };
    if (page_.length === 0) break;

    for (const t of page_) if (t?.demand_id === demandeId) taches.push(t);

    const dernier = page_[page_.length - 1];
    const dernierTs = dernier?.created_at ? Date.parse(dernier.created_at) : NaN;
    if (Number.isFinite(dernierTs) && dernierTs < bornée) break;
    if (page_.length < TAILLE_PAGE_LISTE) break;
  }
  return { ok: true, taches };
}

/**
 * La suite : la prochaine tâche ouverte de la demande, ou l'absence de suite
 * mesurée — JAMAIS une fausse suite. Des comptes qui divergent rendent
 * `mesureCoherente:false` : aucune tâche n'est alors nommée.
 *
 * @param {{demandeId:string, demandeCreatedAt:string, directTicketCountAjuste:number, appeler:Function}} args
 * @returns {Promise<{ok:true, mesureCoherente:true, tache:{code:string,titre:string}|null}
 *   |{ok:true, mesureCoherente:false, trouve:number, annonce:number}
 *   |{ok:false, erreur:string}>}
 */
export async function trouverProchaineTache({ demandeId, demandeCreatedAt, directTicketCountAjuste, appeler }) {
  const r = await listerTachesDeLaDemande({ demandeId, demandeCreatedAt, appeler });
  if (!r.ok) return r;

  if (r.taches.length !== directTicketCountAjuste) {
    return { ok: true, mesureCoherente: false, trouve: r.taches.length, annonce: directTicketCountAjuste };
  }

  const candidats = r.taches.filter((t) => t.status === 'new' || t.status === 'in_progress');
  candidats.sort((a, b) => {
    const sa = a.sequence_order, sb = b.sequence_order;
    if (sa == null && sb == null) { /* départage par created_at plus bas */ }
    else if (sa == null) return 1;
    else if (sb == null) return -1;
    else if (sa !== sb) return sa - sb;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });

  const t = candidats[0];
  return { ok: true, mesureCoherente: true, tache: t ? { code: t.ticket_id, titre: t.title } : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// L'ORCHESTRATION — ce que le fil mince appelle. Un seul point d'entrée, pour
// que « quel appel se fait, dans quel ordre, sous quelle condition » n'existe
// qu'à un seul endroit.

/**
 * @param {object} entree
 * @param {string|null} entree.texteAssistant
 * @param {string|null} entree.contenuDemande  contenu brut de `.demande`, `null` si absent/illisible
 * @param {Function|null} entree.appeler  transport ServiceDesk déjà construit, ou `null` si aucune clé
 * @param {number[]} entree.horodatagesRelances  timestamps (ms) des relances déjà connues
 * @param {number|null|undefined} entree.plafondParHeure
 * @param {number} entree.maintenant  `Date.now()` injecté
 * @param {{empreinte:string, etapes:string[]}|null|undefined} entree.journalPrecedent  le
 *   journal (D2/D3) lu de l'état du lieu — les étapes déjà réussies pour la DERNIÈRE
 *   empreinte connue. `null`/absent si aucun journal encore connu. Un bloc d'empreinte
 *   DIFFÉRENTE ignore ce journal (repart d'un plan vide) : c'est un bloc neuf.
 * @param {((journal:{empreinte:string, etapes:string[]})=>void)|undefined} entree.onEtapeReussie
 *   rappel SYNCHRONE, appelé après CHAQUE étape réussie, avec le journal À JOUR à cet
 *   instant précis — c'est ce qui permet au fil mince de persister sur disque avant même
 *   que ce module ait fini de décider. SANS lui, un process tué en cours de plan (le délai
 *   interne du fil mince, un `SIGKILL`) perdrait une écriture pourtant déjà réussie : le
 *   `journalAEnregistrer` rendu à la FIN de cette fonction n'est jamais atteint si le
 *   process meurt avant. Optionnel — ce module reste pur (aucune I/O propre), c'est
 *   l'appelant qui décide ce que ce rappel fait.
 * @param {boolean|undefined} entree.etatCorrompu  le fil mince n'a pas pu PARSER le
 *   fichier d'état du lieu (JSON illisible — à distinguer d'une forme inattendue,
 *   tolérée). Fait refuser IMMÉDIATEMENT, avant toute autre validation : repartir
 *   d'un journal vide risquerait de rejouer une écriture déjà faite (Z3).
 * @param {boolean|undefined} entree.stopHookActive  L'HÔTE dit-il « j'ai déjà
 *   relancé sur ce tour » ? (revue de fond, T-20260925-0080, R1-R3). Un REFUS
 *   (bloc malformé, ServiceDesk injoignable, état corrompu, etc.) rendu sous
 *   `stopHookActive:true` ne bloque JAMAIS — la raison a déjà été dite comme
 *   `decision:block` au tour précédent ; la répéter ne fait que boucler, surtout
 *   quand le refus lui-même empêche le plafond de compter (état corrompu : les
 *   horodatages ne peuvent pas être lus). Seule une RELANCE légitime
 *   (« prochaine tâche ») reste un `decision:block` sous `stopHookActive`,
 *   bornée par le plafond comme toujours — c'est la chaîne voulue.
 * @returns {Promise<{
 *   silence:boolean,
 *   sortie:{decision?:'block', reason?:string, systemMessage?:string},
 *   blocEmis:boolean,
 *   journalAEnregistrer?:{empreinte:string, etapes:string[]}
 * }>}
 */
export async function deciderStop(entree) {
  const {
    texteAssistant, contenuDemande, appeler, horodatagesRelances, plafondParHeure, maintenant,
    journalPrecedent, onEtapeReussie, etatCorrompu, stopHookActive,
  } = entree;

  // ── Pas de bloc (ou un bloc cité, pas terminal) : silence total, zéro appel —
  // la SEULE sortie muette.
  const extrait = extraireBloc(texteAssistant);
  if (!extrait.presence) return { silence: true, sortie: {}, blocEmis: false };

  // Petit relais commun : un « candidat » de REFUS passe par le plafond ET par
  // R2 (stop_hook_active désarme un refus, jamais une relance légitime) ; un
  // « candidat » de RELANCE (la suite trouvée) passe par le plafond SEUL —
  // c'est la chaîne voulue, même sous stop_hook_active. Un « arrêt » sort
  // directement (jamais compté dans le plafond, puisqu'il n'aurait jamais bloqué).
  const gate = (raison) => gaterEtEmettre({ raison, horodatagesRelances, plafondParHeure, maintenant, estRefus: true, stopHookActive });
  const gateRelance = (raison) => gaterEtEmettre({ raison, horodatagesRelances, plafondParHeure, maintenant, estRefus: false, stopHookActive });
  const arret = (systemMessage) => ({ silence: false, sortie: systemMessage ? { systemMessage } : {}, blocEmis: false });

  // ── Z3 — ÉTAT DU LIEU CORROMPU (revue de fond, T-20260925-0080). PRIORITAIRE
  // sur toute autre validation : un bloc présent (valide ou non) pourrait
  // porter des écritures, et sans un état lisible on ne sait pas ce qui a
  // DÉJÀ été fait. Repartir d'un journal vide RISQUERAIT UN DOUBLON — exactement
  // le défaut D3 par une autre porte. On refuse plutôt que de deviner ; le
  // fichier corrompu n'est pas réécrit (voir le fil mince) — un humain le
  // répare ou le supprime.
  if (etatCorrompu) {
    return gate(
      "l'état du lieu est corrompu (fichier illisible) — refus par prudence : repartir d'un état vide "
      + "pourrait cacher un journal déjà écrit et faire rejouer une écriture déjà faite. Répare ou "
      + 'supprime le fichier d\'état, puis relance.',
    );
  }

  if (!extrait.ok) return gate(extrait.erreur);

  const analyse = analyserBloc(extrait.contenu);
  if (!analyse.ok) return gate(analyse.erreur);
  const { taches } = analyse;

  const demandeLue = lireCodeDemande(contenuDemande);
  if (!demandeLue.ok) return gate(demandeLue.erreur);

  if (!appeler) {
    return gate('aucun accès au ServiceDesk (clé absente sur ce poste) — rien n\'a été écrit.');
  }

  const preflight = await preverifierDemande({ code: demandeLue.code, appeler });
  if (!preflight.ok) return gate(preflight.erreur);

  // ── D2/D3 — REJEU = DOUBLONS, À LA GRANULARITÉ DE L'ÉTAPE. Un bloc d'empreinte
  // différente repart d'un journal vide (bloc neuf) ; un bloc IDENTIQUE reprend
  // là où il s'était arrêté — y compris après un ÉCHEC PARTIEL (D3 : le refus
  // nommé d'un échec partiel ne doit pas effacer ce qui a réellement réussi
  // avant lui, sinon le rejeu — la réaction normale à « ServiceDesk en panne »
  // — recrée un `ouvrir` déjà créé).
  const empreinte = empreinteBloc(extrait.contenu);
  const etapesDejaFaites = (journalPrecedent && journalPrecedent.empreinte === empreinte)
    ? new Set(journalPrecedent.etapes || [])
    : new Set();

  // Vérifie CHAQUE ticket cité (en-cours ET fait) AVANT toute écriture — même sur
  // un rejeu : un ticket peut avoir changé de demande entre deux tours.
  const codesACiter = [...new Set([...taches.enCours, ...taches.fait.map((f) => f.code)])];
  const ticketsVerifies = new Map();
  for (const code of codesACiter) {
    const v = await verifierTicketAppartient({ code, demandeId: preflight.id, appeler });
    // Rien n'a encore été tenté CE TOUR : le journal à réenregistrer est celui
    // qu'on avait déjà (inchangé), pas absent — un refus ici ne doit pas faire
    // « oublier » un journal légitime déjà connu.
    if (!v.ok) return { ...gate(v.erreur), journalAEnregistrer: journalPrecedent ?? undefined };
    ticketsVerifies.set(code, v.id);
  }

  const etapesAJour = new Set(etapesDejaFaites);
  const ecriture = await executerEcritures({
    taches, demandeId: preflight.id, ticketsVerifies, appeler,
    etapesDejaFaites,
    noterEtapeReussie: (cle) => {
      etapesAJour.add(cle);
      // Persistance IMMÉDIATE, PAR ÉTAPE — voir la doc de `onEtapeReussie` ci-dessus :
      // un `try/catch` best-effort, le rappel est celui de l'appelant, jamais un
      // motif pour faire échouer une écriture par ailleurs réussie.
      try { onEtapeReussie?.({ empreinte, etapes: [...etapesAJour] }); } catch { /* best-effort */ }
    },
  });

  // Le journal à enregistrer reflète TOUJOURS l'état réellement atteint — succès
  // complet, échec partiel, ou rien de neuf (rejeu entièrement déjà fait) : c'est
  // précisément ce qui ferme D3.
  const journalAEnregistrer = { empreinte, etapes: [...etapesAJour] };

  if (!ecriture.toutesReussies) {
    const noteSautees = ecriture.sautees.length
      ? ` Déjà fait (sauté) : ${ecriture.sautees.join(' · ')}.`
      : '';
    return {
      ...gate(
        `${ecriture.erreur} Écrit : ${ecriture.ecrits.length ? ecriture.ecrits.join(' · ') : 'rien'}. `
        + `Non écrit : ${ecriture.nonEcrits.join(' · ')}.${noteSautees}`,
      ),
      journalAEnregistrer,
    };
  }

  const resumeEcriture = (() => {
    if (ecriture.sautees.length && ecriture.ecrits.length) {
      return `repris (déjà fait, sauté : ${ecriture.sautees.join(' · ')}) — écrit maintenant (${ecriture.ecrits.join(' · ')})`;
    }
    if (ecriture.sautees.length) {
      return `déjà écrit (${ecriture.sautees.length} étape(s), même bloc) — aucune réécriture`;
    }
    return `écrit (${ecriture.ecrits.join(' · ') || 'rien'})`;
  })();

  if (taches.attend === 'dirigeant') {
    return {
      ...arret(`scribe des tâches : ${resumeEcriture} — \`attend: dirigeant\` posé, pas de relance.`),
      journalAEnregistrer,
    };
  }

  // Un `ouvrir` compte pour la demande SEULEMENT s'il vient d'être créé CE TOUR
  // (une étape « ouvrir#… » neuve, pas sautée) — un `ouvrir` déjà fait lors d'un
  // tour précédent est déjà reflété dans `preflight.directTicketCount`.
  const etapesFraiches = [...etapesAJour].filter((c) => !etapesDejaFaites.has(c));
  const nbOuvrirCrees = etapesFraiches.filter((c) => c.startsWith('ouvrir#')).length;

  const suite = await trouverProchaineTache({
    demandeId: preflight.id,
    demandeCreatedAt: preflight.createdAt,
    directTicketCountAjuste: preflight.directTicketCount + nbOuvrirCrees,
    appeler,
  });

  if (!suite.ok) {
    return { ...arret(`scribe des tâches : ${resumeEcriture} — suite non lue (${suite.erreur}).`), journalAEnregistrer };
  }
  if (!suite.mesureCoherente) {
    return {
      ...arret(
        `scribe des tâches : ${resumeEcriture} — comptes divergents à la lecture de la `
        + `suite (${suite.trouve} trouvé(s) pour ${suite.annonce} annoncé(s)) : non mesuré, aucune tâche nommée.`,
      ),
      journalAEnregistrer,
    };
  }
  if (!suite.tache) {
    return { ...arret(`scribe des tâches : ${resumeEcriture} — aucune tâche ouverte restante.`), journalAEnregistrer };
  }

  // ⚠️ OBSERVABILITÉ (D3) : un rejeu qui a SAUTÉ des étapes ET trouve une suite
  // le dit dans le `reason` — pas seulement sur le chemin d'arrêt. Sinon la
  // reprise reste invisible dès qu'elle réussit.
  const noteReprise = ecriture.sautees.length
    ? `(reprise : ${ecriture.sautees.length} étape(s) déjà faite(s) sautée(s) — ${ecriture.sautees.join(' · ')}) `
    : '';
  // R2 : une RELANCE légitime, jamais un refus — reste `decision:block` même
  // sous `stopHookActive`, seulement bornée par le plafond.
  return { ...gateRelance(`${noteReprise}prochaine tâche : ${suite.tache.code} — ${suite.tache.titre}`), journalAEnregistrer };
}

/**
 * Applique R2 (`stopHookActive`) PUIS le plafond ① à un candidat de sortie
 * `decision:block`.
 *
 * 🔴 R2, ET C'EST UNE RÈGLE GÉNÉRALE, PAS UN CORRECTIF AU CAS PAR CAS (revue
 * de fond, T-20260925-0080, passe reproduite par exécution du vrai fil mince) :
 * un état corrompu combiné à `stopHookActive:true` produisait encore
 * `decision:block` — et un état corrompu ne peut PAS faire compter le plafond
 * (les horodatages ne se lisent pas d'un fichier illisible), donc RIEN ne
 * bornait la boucle. Le correctif ne vise pas « l'état corrompu » seul : TOUT
 * REFUS (`estRefus:true`) rendu sous `stopHookActive:true` désarme, avant même
 * de consulter le plafond — la raison a déjà été dite comme block au tour
 * précédent ; la répéter n'apprend rien à l'agent et ne sert qu'à boucler.
 * Une RELANCE légitime (`estRefus:false`, « prochaine tâche ») ignore
 * `stopHookActive` et reste bornée par le plafond SEUL — c'est la chaîne
 * voulue : le hook peut continuer à pousser du travail réel même après un
 * premier blocage sur ce tour, jusqu'à ce que le plafond, lui, morde.
 *
 * @param {{raison:string, horodatagesRelances:number[], plafondParHeure:number|null|undefined,
 *   maintenant:number, estRefus:boolean, stopHookActive?:boolean}} args
 */
function gaterEtEmettre({ raison, horodatagesRelances, plafondParHeure, maintenant, estRefus, stopHookActive }) {
  if (estRefus && stopHookActive === true) {
    return {
      silence: false,
      sortie: { systemMessage: `scribe des tâches : arrêt permis (stop_hook_active) — ${raison}` },
      blocEmis: false,
    };
  }
  const verdict = jugerPlafond({ horodatages: horodatagesRelances, maintenant, plafondParHeure });
  if (verdict.autorise) {
    return { silence: false, sortie: { decision: 'block', reason: raison }, blocEmis: true };
  }
  return {
    silence: false,
    sortie: { systemMessage: `scribe des tâches : arrêt permis — ${verdict.raison} (ce qui aurait été dit : ${raison})` },
    blocEmis: false,
  };
}
