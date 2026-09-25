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
// deux tickets identiques. La garde est une EMPREINTE (sha256 du bloc), gardée
// dans l'état du plafond (même fichier, par lieu) : une empreinte qui rejoue
// celle du DERNIER bloc écrit AVEC SUCCÈS n'écrit rien de nouveau — mais elle
// peut toujours relire la suite (la prochaine tâche), ce n'est QUE l'écriture qui
// est sautée. Enregistrée seulement APRÈS un succès complet — jamais avant.

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
 * ⚠️ CE QU'ELLE NE PEUT PAS FAIRE : défaire une écriture déjà partie si une
 * suivante échoue. Elle s'arrête au premier échec et rend, séparément, ce qui a
 * été écrit et ce qui ne l'a pas été — c'est au fil mince (et à l'humain) de
 * décider la suite.
 *
 * @param {{taches:object, demandeId:string, ticketsVerifies:Map<string,string>, appeler:Function}} args
 * @returns {Promise<{toutesReussies:boolean, ecrits:string[], nonEcrits:string[], erreur?:string}>}
 */
export async function executerEcritures({ taches, demandeId, ticketsVerifies, appeler }) {
  const plan = [];
  for (const titre of taches.ouvrir) {
    plan.push({ etape: `ouvrir « ${titre} »`, run: () => appeler('tickets', { action: 'create', title: titre, demand_id: demandeId, type: 'improvement' }) });
  }
  for (const code of taches.enCours) {
    const id = ticketsVerifies.get(code);
    plan.push({ etape: `en-cours ${code}`, run: () => appeler('tickets', { action: 'update', id, status: 'in_progress' }) });
  }
  for (const { code, commentaire } of taches.fait) {
    const id = ticketsVerifies.get(code);
    plan.push({ etape: `fait ${code} — commentaire`, run: () => appeler('tickets', { action: 'add_comment', id, content: commentaire }) });
    plan.push({ etape: `fait ${code} — fermeture`, run: () => appeler('tickets', { action: 'update', id, status: 'completed' }) });
  }

  const ecrits = [];
  for (let i = 0; i < plan.length; i += 1) {
    const { etape, run } = plan[i];
    let resultat;
    try {
      resultat = await run();
    } catch (e) {
      return {
        toutesReussies: false, ecrits, nonEcrits: plan.slice(i).map((p) => p.etape),
        erreur: `l'écriture « ${etape} » a échoué (${e?.message ?? 'cause inconnue'}).`,
      };
    }
    if (estEchecApplicatif(resultat)) {
      return {
        toutesReussies: false, ecrits, nonEcrits: plan.slice(i).map((p) => p.etape),
        erreur: `l'écriture « ${etape} » a été refusée par le ServiceDesk (${resultat.error ?? 'échec applicatif'}).`,
      };
    }
    ecrits.push(etape);
  }
  return { toutesReussies: true, ecrits, nonEcrits: [] };
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
 * @param {string|null|undefined} entree.empreinteDernierBloc  empreinte (D2) du dernier
 *   bloc écrit AVEC SUCCÈS, lue de l'état du lieu — `null`/absent si aucune encore connue.
 * @returns {Promise<{
 *   silence:boolean,
 *   sortie:{decision?:'block', reason?:string, systemMessage?:string},
 *   blocEmis:boolean,
 *   empreinteAEnregistrer?:string
 * }>}
 */
export async function deciderStop(entree) {
  const { texteAssistant, contenuDemande, appeler, horodatagesRelances, plafondParHeure, maintenant, empreinteDernierBloc } = entree;

  // ── Pas de bloc (ou un bloc cité, pas terminal) : silence total, zéro appel —
  // la SEULE sortie muette.
  const extrait = extraireBloc(texteAssistant);
  if (!extrait.presence) return { silence: true, sortie: {}, blocEmis: false };

  // Petit relais commun : un « candidat » de refus/relance passe par le plafond ;
  // un « arrêt » sort directement (jamais compté dans le plafond, puisqu'il
  // n'aurait jamais bloqué).
  const gate = (raison) => gaterEtEmettre({ raison, horodatagesRelances, plafondParHeure, maintenant });
  const arret = (systemMessage) => ({ silence: false, sortie: systemMessage ? { systemMessage } : {}, blocEmis: false });

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

  // ── D2 — REJEU = DOUBLONS. Le même bloc, déjà écrit avec succès (empreinte
  // identique) : on ne réécrit rien, mais on peut toujours relire la suite.
  const empreinte = empreinteBloc(extrait.contenu);
  const dejaEcrit = !!empreinteDernierBloc && empreinteDernierBloc === empreinte;

  let ecriture;
  if (dejaEcrit) {
    ecriture = { toutesReussies: true, ecrits: [], nonEcrits: [], dejaEcrit: true };
  } else {
    // Vérifie CHAQUE ticket cité (en-cours ET fait) AVANT la première écriture.
    const codesACiter = [...new Set([...taches.enCours, ...taches.fait.map((f) => f.code)])];
    const ticketsVerifies = new Map();
    for (const code of codesACiter) {
      const v = await verifierTicketAppartient({ code, demandeId: preflight.id, appeler });
      if (!v.ok) return gate(v.erreur);
      ticketsVerifies.set(code, v.id);
    }

    ecriture = await executerEcritures({ taches, demandeId: preflight.id, ticketsVerifies, appeler });
    if (!ecriture.toutesReussies) {
      return gate(
        `${ecriture.erreur} Écrit : ${ecriture.ecrits.length ? ecriture.ecrits.join(' · ') : 'rien'}. `
        + `Non écrit : ${ecriture.nonEcrits.join(' · ')}.`,
      );
    }
  }
  // Enregistrée SEULEMENT après un succès complet (frais ou déjà connu) — jamais
  // avant, et jamais sur un chemin de refus.
  const empreinteAEnregistrer = dejaEcrit ? undefined : empreinte;

  const resumeEcriture = dejaEcrit
    ? 'déjà écrit (empreinte identique à la dernière écriture réussie) — aucune réécriture'
    : `écrit (${ecriture.ecrits.join(' · ') || 'rien'})`;

  if (taches.attend === 'dirigeant') {
    return {
      ...arret(`scribe des tâches : ${resumeEcriture} — \`attend: dirigeant\` posé, pas de relance.`),
      empreinteAEnregistrer,
    };
  }

  // Un `ouvrir` FRAIS ajoute au compte de la demande ; un `ouvrir` déjà écrit
  // (rejeu) a déjà été compté par le pré-vol de CE tour — pas une seconde fois.
  const nbOuvrirCrees = dejaEcrit ? 0 : taches.ouvrir.length;
  const suite = await trouverProchaineTache({
    demandeId: preflight.id,
    demandeCreatedAt: preflight.createdAt,
    directTicketCountAjuste: preflight.directTicketCount + nbOuvrirCrees,
    appeler,
  });

  if (!suite.ok) {
    return { ...arret(`scribe des tâches : ${resumeEcriture} — suite non lue (${suite.erreur}).`), empreinteAEnregistrer };
  }
  if (!suite.mesureCoherente) {
    return {
      ...arret(
        `scribe des tâches : ${resumeEcriture} — comptes divergents à la lecture de la `
        + `suite (${suite.trouve} trouvé(s) pour ${suite.annonce} annoncé(s)) : non mesuré, aucune tâche nommée.`,
      ),
      empreinteAEnregistrer,
    };
  }
  if (!suite.tache) {
    return { ...arret(`scribe des tâches : ${resumeEcriture} — aucune tâche ouverte restante.`), empreinteAEnregistrer };
  }

  return { ...gate(`prochaine tâche : ${suite.tache.code} — ${suite.tache.titre}`), empreinteAEnregistrer };
}

/**
 * Applique le plafond ① à un candidat de sortie `decision:block`.
 *
 * @param {{raison:string, horodatagesRelances:number[], plafondParHeure:number|null|undefined, maintenant:number}} args
 */
function gaterEtEmettre({ raison, horodatagesRelances, plafondParHeure, maintenant }) {
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
