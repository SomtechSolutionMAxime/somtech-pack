// mandat.js — LE CHANTIER D'UN ORCHESTRATEUR EST-IL ENCORE OUVERT ? (T-20260819-0056)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE FICHIER FERME, ET IL A ÉTÉ COMMIS AVANT D'ÊTRE ÉCRIT
//
// Le 2026-08-19, un orchestrateur a proposé une mise à jour à cinq de ses pairs. L'un d'eux
// avait son **mandat clos depuis 08h35** : il ne travaillait plus et ne travaillerait plus. La
// mesure disait `idle` ; la conclusion tirée était « au repos, donc actif ».
//
//   ⚠️ **UN MANDAT TERMINÉ ET UNE SESSION AU REPOS RENDENT TOUS LES DEUX LE MOT `idle`.**
//   Rien dans herdr ne les distingue, parce que herdr ne connaît pas les chantiers.
//
// Et le risque n'est pas le gaspillage : c'est que **deux orchestrateurs agissent en parallèle
// sur les mêmes panes, chacun croyant l'autre parti.**
//
// L'état du mandat ne vit pas dans herdr — il vit au ServiceDesk, où un chantier clos est
// fermé. C'est un croisement de plus, et il est indispensable.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ TOUT CE QUI N'EST PAS PROUVÉ OUVERT EST « NON MESURÉ », JAMAIS « OUVERT ».
//
// Un statut qu'on ne connaît pas, une entité qu'on n'a pas su joindre, un code qu'on ne sait pas
// lire : aucun de ces cas ne rend `ouvert`. C'est le sens de la conduite du registre — il ne
// propose rien sur ce qu'il n'a pas mesuré. Se rabattre sur « ouvert » referait, à l'échelle et
// automatiquement, l'écart d'un humain pressé.

import { enEssais, transportRemplace, refuser } from './cloison.js';

/**
 * LE TRANSPORT NATIF, CAPTURÉ AU CHARGEMENT — c'est lui qui distingue « ce banc a monté son
 * double » de « cet appel part vers la production ». Même dispositif que `slack.js`, et pour la
 * même raison : ce dépôt a déjà laissé une suite d'essais tenir une connexion de production
 * pendant des heures.
 */
const TRANSPORT_NATIF = globalThis.fetch;

/**
 * LES STATUTS QUI FERMENT UN CHANTIER, par famille — et rien d'autre n'en ferme un.
 *
 * ⚠️ RELEVÉS DU SERVICE, PAS IMAGINÉS (2026-08-19, `tools/list` du ServiceDesk). Un statut
 * absent de ces listes ne se déduit pas : il rend `inconnu`, donc `non mesuré`. Le jour où le
 * ServiceDesk ajoute un statut, ce module se TAIT au lieu de deviner — c'est bien ce qu'on veut.
 */
export const STATUTS_CLOS = {
  demands: ['delivered', 'declined'],
  projects: ['completed', 'cancelled'],
  deliveries: ['deployed', 'cancelled'],
  epics: ['completed', 'cancelled'],
  tickets: ['completed'],
};

/**
 * LE CHAMP QUI PORTE LE CODE, PAR FAMILLE — et on ne cherche que celui-là.
 *
 * ⚠️ RELEVÉ EN PASSE DE REVUE DE FOND, et le rejet était juste. La première version balayait
 * TOUS les champs `*_id` d'un enregistrement et retenait ceux dont la valeur ressemblait à un
 * code. Un enregistrement qui en RÉFÉRENCE un autre de la même famille — un ticket qui pointe un
 * ticket, un epic rattaché à une demande — aurait alors indexé le code du VOISIN sur lui-même,
 * et rendu le statut du mauvais chantier. Ce statut décide de `remiseAJour.aProposer` : se
 * tromper d'enregistrement, c'est proposer un réveil sur la foi de l'état de quelqu'un d'autre.
 *
 * On nomme donc le champ, famille par famille. Un enregistrement qui ne le porte pas n'est pas
 * indexé — il vaut mieux « non mesuré » qu'un statut emprunté.
 */
export const CHAMP_DU_CODE = {
  demands: 'demand_id',
  projects: 'project_id',
  deliveries: 'delivery_id',
  epics: 'epic_id',
  tickets: 'ticket_id',
};

/** Les statuts qu'on sait lire — hors de ces listes, on ne conclut rien. */
export const STATUTS_CONNUS = {
  demands: ['received', 'in_analysis', 'in_progress', 'delivered', 'declined'],
  projects: ['proposed', 'planned', 'in_progress', 'on_hold', 'completed', 'cancelled'],
  deliveries: ['draft', 'planned', 'in_progress', 'qa', 'deployed', 'cancelled'],
  epics: ['draft', 'ready_for_analysis', 'in_analysis', 'decomposed', 'in_execution', 'completed', 'cancelled'],
  tickets: ['proposed', 'new', 'in_review', 'ready_to_deploy', 'in_progress', 'qa', 'completed', 'failed'],
};

/**
 * QUELLE FAMILLE UN MANDAT DÉSIGNE — d'après son code, et `null` quand il n'en porte pas.
 *
 * ⚠️ TOUS LES MANDATS NE SONT PAS DES CODES. Un orchestrateur peut s'appeler `matapedia` ou
 * `general` : son lieu est parfaitement valide, et son chantier n'est traçable nulle part. Ce
 * n'est PAS une erreur — c'est un mandat dont l'état ne se mesure pas, et il se dira comme tel.
 */
/** La forme d'un code de chantier, écrite une fois. */
export const CODE_LISIBLE = /^[A-Z]-\d{8}-\d{4}$/;

export function familleDuMandat(mandat) {
  const m = /^([dpjet])-(\d{8})-(\d{4})$/i.exec(String(mandat ?? '').trim());
  if (!m) return null;
  return {
    d: 'demands',
    p: 'projects',
    j: 'deliveries',
    e: 'epics',
    t: 'tickets',
  }[m[1].toLowerCase()];
}

/** Le code tel que le ServiceDesk l'écrit — en MAJUSCULES, quel que soit le nom du dossier. */
export function codeDuMandat(mandat) {
  return String(mandat ?? '').trim().toUpperCase();
}

/**
 * L'ÉTAT D'UN MANDAT, lu au ServiceDesk — la seule source qui le connaisse.
 *
 * @param mandat   le mandat porté par le lieu (`d-20260819-0001`, `matapedia`, …).
 * @param appeler  `(famille, code) → { status }|null` — le transport, INJECTÉ. Aucun appel
 *                 réseau n'est écrit ici : c'est ce qui rend ce module éprouvable sans clé et
 *                 sans service.
 *
 * @returns `{ mesure: 'lue', clos, statut }` ou `{ mesure: 'non mesurée', raison, clos: null }`.
 *          **`clos` n'est jamais `false` par défaut** — voir l'en-tête.
 */
export async function etatDuMandat(mandat, { appeler } = {}) {
  const famille = familleDuMandat(mandat);
  if (!famille) {
    return {
      mesure: 'non mesurée',
      clos: null,
      raison: `« ${mandat} » n’est pas un code de chantier : son état ne se lit nulle part`,
    };
  }
  if (typeof appeler !== 'function') {
    return { mesure: 'non mesurée', clos: null, raison: 'aucun accès au ServiceDesk ne m’a été donné' };
  }
  let vu;
  try {
    vu = await appeler(famille, codeDuMandat(mandat));
  } catch (err) {
    return {
      mesure: 'non mesurée',
      clos: null,
      raison: `le ServiceDesk n’a pas répondu sur ${codeDuMandat(mandat)} (${err?.message || err})`,
    };
  }
  const statut = vu?.status ?? null;
  if (!statut) {
    return { mesure: 'non mesurée', clos: null, raison: `le ServiceDesk ne rend aucun statut pour ${codeDuMandat(mandat)}` };
  }
  if (!STATUTS_CONNUS[famille].includes(statut)) {
    // ⚠️ UN STATUT INCONNU NE SE DEVINE PAS. « Ce n'est pas dans ma liste des statuts clos, donc
    // c'est ouvert » est exactement le raisonnement qui rouvrirait ce défaut le jour où le
    // ServiceDesk ajoute un statut terminal.
    return {
      mesure: 'non mesurée',
      clos: null,
      statut,
      raison: `le statut « ${statut} » ne m’est pas connu pour un ${famille} — je n’en conclus rien`,
    };
  }
  return { mesure: 'lue', clos: STATUTS_CLOS[famille].includes(statut), statut, code: codeDuMandat(mandat) };
}

/**
 * Le transport réel — un appel MCP au ServiceDesk, et rien de plus.
 *
 * ⚠️ LA CLÉ N'EST PAS INVENTÉE, ET SON ABSENCE SE DIT. Sans elle, on ne se rabat sur rien : la
 * fonction n'est simplement pas construite, et `etatDuMandat` rend « aucun accès ».
 */
/**
 * LE TRANSPORT NU vers le ServiceDesk — `(nom, args) → corps`, ou `null` sans clé.
 *
 * ⚠️ EXTRAIT DE `accesServiceDesk` POUR ÊTRE PARTAGÉ, PAS RECOPIÉ. La vue du parc
 * (`vue-du-parc.js`) a besoin d'appels que le résolveur de mandat ne fait pas — lister les
 * epics d'un projet, puis les tickets d'un epic. Réécrire un second transport à côté aurait
 * dupliqué la CLOISON D'ESSAIS ci-dessous, et une cloison dupliquée est une cloison qu'on
 * oublie d'un côté : c'est le motif « une porte sur deux » qui a déjà coûté à ce module. Il y
 * a donc UN transport, et deux usages.
 *
 * @returns `(nom, args) → corps JSON` — jette sur refus HTTP ou réponse sans contenu.
 */
export function transportServiceDesk({
  url = 'https://vdpuktsqrecdxbmweate.supabase.co/functions/v1/servicedesk-mcp',
  cle = process.env.SOMTECH_DESK_API_KEY || process.env.SERVICEDESK_MCP_TOKEN,
  fetcher = globalThis.fetch,
  delaiMs = 8000,
} = {}) {
  if (!cle || typeof fetcher !== 'function') return null;
  return async (nom, args) => {
    // ⚠️ LA CLOISON D'ESSAIS, ET ELLE MANQUAIT — relevée en passe de revue de fond, et le rejet
    // était juste. Sur un poste de développement, `SOMTECH_DESK_API_KEY` est exportée : c'est le
    // cas NORMAL de quiconque travaille dans un lieu d'agent. Un simple `npm test` faisait donc
    // partir des POST réels vers le ServiceDesk de production, avec la vraie clé, pour lire le
    // statut de la demande qui porte ce lot — et rien ne distinguait une exécution propre d'une
    // exécution qui venait de parler à la prod.
    //
    // La discipline existait déjà à côté (`slack.js`), avec son incident à l'appui : une suite
    // d'essais a tenu une connexion Slack de production pendant des heures. Le transport neuf
    // n'en héritait pas — c'est le motif « une porte sur deux », appliqué à une cloison.
    //
    // ⚠️ ON COMPARE LE TRANSPORT RÉELLEMENT UTILISÉ, pas la variable globale. Ici le transport
    // entre par paramètre (`fetcher`) : juger sur `globalThis.fetch` refuserait un banc qui a
    // proprement injecté son double, et laisserait passer un appel natif fait par un appelant
    // qui a, par ailleurs, remplacé le global. Ce qui compte est : est-ce que CET appel-ci part
    // dehors ?
    if (enEssais() && !transportRemplace(TRANSPORT_NATIF, fetcher)) {
      refuser(
        `un appel au ServiceDesk (${nom}/${args?.action})`,
        `Il serait parti vers « ${url} » avec la clé de ce poste.`
      );
    }
    const reponse = await fetcher(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: nom, arguments: args } }),
      signal: AbortSignal.timeout(delaiMs),
    });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const enveloppe = await reponse.json();
    const texte = enveloppe?.result?.content?.[0]?.text;
    if (!texte) throw new Error('réponse sans contenu');
    return JSON.parse(texte);
  };
}

export function accesServiceDesk({ parPage = 200, ...transport } = {}) {
  const appelerMcp = transportServiceDesk(transport);
  // ⚠️ L'ABSENCE DE CLÉ SE DIT PAR `null`, ET ELLE NE SE DEVINE PAS. C'est ce `null` qui fait
  // rendre « aucun accès au ServiceDesk ne m'a été donné » à `etatDuMandat`, plutôt qu'un état
  // inventé. Le contrat n'a pas bougé en extrayant le transport.
  if (!appelerMcp) return null;

  /**
   * ⚠️ LA LECTURE PAR CODE PASSE PAR UNE LISTE, ET CE N'EST PAS UN CONTOURNEMENT — c'est mesuré.
   * Le 2026-08-19, `action: 'get'` avec un code lisible rend « not found » sur les epics, et
   * ne rend aucun statut sur les livraisons ni les projets : seuls les tickets acceptent leur
   * code. Un croisement bâti sur `get` échouait donc sur trois mandats codés sur cinq — et il
   * l'aurait fait EN SILENCE, en rendant « non mesuré » pour un chantier parfaitement lisible.
   * On garde `get` d'abord (il est direct quand il marche) et on retombe sur la liste sinon.
   *
   * L'index est construit UNE FOIS par famille et par accès : un recensement de sept
   * orchestrateurs ne paiera pas sept listes.
   */
  const index = new Map();
  const lus = new Map();
  const annonces = new Map();
  // ⚠️ « LA LECTURE S'EST ARRÊTÉE SUR UNE PAGE PLEINE QUI N'APPORTAIT RIEN » — la signature d'une
  // source qui PLAFONNE sans l'annoncer, ou qui ignore `offset`. Cette marque existait avant la
  // pagination et elle a failli disparaître avec : un essai du dépôt la gardait, il a rougi, et
  // c'est lui qui a montré que la retirer était une amputation, pas un remplacement.
  const plafonne = new Map();
  /**
   * ⚠️ ON PAGINE, ON NE LIT PLUS UNE SEULE PAGE (T-20260819-0056).
   *
   * MESURÉ SUR LE SERVICE RÉEL le 2026-09-20, cinq limites demandées :
   *     list                →  total 252, limit 50   (défaut)
   *     list, limit 100     →  total 252, limit 100
   *     list, limit 252     →  total 252, limit 100  ← LE PLAFOND ÉCRASE
   *     list, limit 1000    →  total 252, limit 100  ← EN SILENCE
   *     list, limit 3, offset 250  →  2 éléments      ← LA PAGINATION EXISTE
   *
   * La version précédente lisait UNE page et marquait « tronqué » — utile, mais elle laissait
   * le doute là où le service offrait de quoi le fermer. Coût mesuré : deux des treize
   * orchestrateurs vivants du poste rendaient « non mesurée » alors que leurs projets sont
   * `in_progress`, simplement parce qu'ils étaient au-delà de la page.
   *
   * ⚠️ ET LE SERVICE ÉTAIT HONNÊTE : chaque réponse porte `total` À CÔTÉ de ses données. Le
   * lecteur avait, DANS LA MÊME RÉPONSE, de quoi savoir qu'il lui manquait 152 — et il ne le
   * savait pas. **Comparer la taille ANNONCÉE au nombre RÉELLEMENT rendu** est le geste qui
   * tranche, et il vaut pour toute réponse qui porte les deux.
   *
   * 🔴 LA BORNE DE LA BOUCLE A ÉTÉ ÉCRITE FAUSSE, PUIS PAYÉE. La première rédaction affirmait
   * ici « bornée par ce qu'elle lit » sur trois conditions : page vide, total atteint, offset qui
   * avance. Aucune ne tient devant une source qui IGNORE `offset` — elle rend éternellement la
   * même page pleine, sans jamais annoncer de total. Un essai préexistant du dépôt monte
   * exactement ce double : la suite a consommé 4 Go et est morte sur `heap out of memory` en
   * 73 s. **Le commentaire affirmait une propriété que son auteur n'avait pas éprouvée**, ce qui
   * est le défaut dominant de ce dépôt, commis dans le lot qui le cite.
   *
   * 🔴 ET LA PREMIÈRE BORNE ÉTAIT INCOMPLÈTE — REJET D'UNE PASSE PORTAIL, fondé. Elle reposait
   * sur deux conditions de CONTENU : une page vide, et une page qui n'apporte aucun code nouveau.
   * Elles ferment le cas d'une source qui RESERT la même page. Elles ne ferment PAS celui d'une
   * source qui ignore `offset` **en rendant des codes inédits à chaque tour** — le reviewer l'a
   * reproduit : `heap out of memory`, process tué.
   *
   * ⚠️ ET L'AUTEUR AVAIT ÉCARTÉ LA BORNE DURE PAR UN RAISONNEMENT QUI SONNAIT JUSTE : « un compte
   * de pages maximal aurait été un nombre choisi par celui-là même dont on éprouve les angles
   * morts ». C'est vrai d'une borne INVENTÉE. Ça ne justifiait pas de n'en poser AUCUNE — et cette
   * phrase a servi à ne pas poser celle qui manquait. Une objection juste peut protéger un trou.
   *
   * ✅ LA BORNE QUI N'EST PAS INVENTÉE : **ON NE PAGINE QUE VERS UNE DESTINATION CONNUE.** Sans
   * `total` annoncé, on ne sait pas où s'arrêter — alors on ne fait pas semblant de paginer : on
   * lit UNE page, et on DIT que la lecture est peut-être plafonnée. C'est exactement ce que
   * faisait la version d'avant la pagination, et cette moitié-là avait raison. Le service mesuré,
   * lui, annonce son total dans chaque réponse : le cas nominal n'est pas bridé.
   *
   * Les deux conditions de contenu RESTENT, en plus, pour le cas où un total annoncé ne serait
   * jamais atteignable :
   *   • une page plus courte que ce que le SERVICE dit avoir servi est la dernière ;
   *   • une page qui n'apporte aucun code nouveau met fin à la lecture.
   */
  const indexer = async (famille) => {
    if (index.has(famille)) return index.get(famille);
    const champ = CHAMP_DU_CODE[famille];
    const par = new Map();
    let offset = 0;
    // ⚠️ ON COMPTE DES ENREGISTREMENTS UNIQUES, PAS DES ÉLÉMENTS REÇUS (trouvé par une passe de
    // fond, sur une entrée adverse). Le premier jet comparait un compteur BRUT au total annoncé
    // d'enregistrements uniques : deux pages qui se CHEVAUCHENT atteignaient donc le total sans
    // que tout ait été lu, et le refus se déclarait exhaustif. Le chevauchement n'est pas
    // théorique ici — ce lecteur tourne pendant que treize orchestrateurs écrivent sur le même
    // service, et un tri instable entre deux appels suffit.
    const identites = new Set();
    let annonce = null;
    for (;;) {
      const corps = await appelerMcp(famille, { action: 'list', limit: parPage, offset });
      const liste = Object.values(corps || {}).find((v) => Array.isArray(v)) || [];
      const total = Number.isFinite(corps?.total) ? corps.total : null;
      if (total !== null) annonce = total;
      if (!liste.length) break;
      const avant = identites.size;
      for (const item of liste) {
        // L'identité d'un enregistrement : son `id` s'il en a un, sinon son code. Deux pages qui
        // resservent le même enregistrement ne le comptent alors qu'une fois.
        const code = item?.[champ];
        const identite = item?.id ?? code ?? JSON.stringify(item);
        if (identite !== undefined && identite !== null) identites.add(identite);
        if (typeof code === 'string' && CODE_LISIBLE.test(code)) par.set(code, item);
      }
      const vus = identites.size;
      // Une page qui n'apporte aucun code nouveau ne peut pas faire avancer la lecture : soit la
      // source ignore `offset` et nous resert la même, soit il n'y a plus rien de neuf derrière.
      // ⚠️ ET LES DEUX CAUSES NE SE VALENT PAS. Si la page était PLEINE, on ne s'est pas arrêté
      // parce qu'on avait tout lu — on s'est arrêté parce que la source ne nous donne pas la
      // suite. C'est un doute, et il se dit.
      if (identites.size === avant) {
        const pleine = Number.isFinite(corps?.limit) && corps.limit > 0 ? corps.limit : parPage;
        if (liste.length >= pleine) plafonne.set(famille, true);
        break;
      }
      if (annonce !== null && vus >= annonce) break;
      // ⚠️ SANS DESTINATION, PAS DE SECOND TOUR. Une source qui n'annonce aucun total ne nous dit
      // pas où s'arrêter : continuer reviendrait à parier que `offset` est respecté, et c'est ce
      // pari qui a fait tomber la boucle. On s'arrête ici, et le refus le dira.
      if (annonce === null) {
        if (liste.length >= (Number.isFinite(corps?.limit) && corps.limit > 0 ? corps.limit : parPage)) {
          plafonne.set(famille, true);
        }
        break;
      }
      // ⚠️ « PLUS COURTE QUE DEMANDÉE » N'EST PAS LE BON CRITÈRE, et le croire coupait la lecture
      // au premier tour. Le service ÉCRASE la limite demandée : on demande 200, il sert 100 et
      // il le DIT dans `limit`. Comparer à ce qu'on a demandé faisait donc paraître courte
      // chaque page pleine, et la pagination s'arrêtait après la première — en ayant l'air de
      // paginer. On compare à la taille que le SERVICE dit avoir servie.
      const taillePage = Number.isFinite(corps?.limit) && corps.limit > 0 ? corps.limit : parPage;
      if (liste.length < taillePage) break;
      offset += liste.length;
    }
    index.set(famille, par);
    lus.set(famille, identites.size);
    annonces.set(famille, annonce);
    return par;
  };

  const statutDe = (objet) => (objet && typeof objet === 'object' && 'status' in objet ? objet : null);

  return async (famille, code) => {
    try {
      const corps = await appelerMcp(famille, { action: 'get', id: code });
      for (const valeur of Object.values(corps || {})) {
        if (valeur && typeof valeur === 'object' && !Array.isArray(valeur) && statutDe(valeur)) return valeur;
      }
    } catch {
      /* `get` par code n'est pas servi partout — la liste tranche. */
    }
    const par = await indexer(famille);
    const trouve = par.get(code);
    if (!trouve) {
      // ⚠️ « IL N'Y EST PAS » ET « JE N'AI PAS PU TOUT LIRE » APPELLENT DES CONDUITES OPPOSÉES :
      // la première ferme la question, la seconde envoie chercher pourquoi la lecture s'est
      // arrêtée. Les confondre est ce qui faisait rendre « non mesuré » sur des chantiers
      // parfaitement lisibles, avec une raison qui n'évoquait jamais la vraie cause.
      const vus = lus.get(famille) ?? par.size;
      const annonce = annonces.get(famille);
      const incomplete = Number.isFinite(annonce) && vus < annonce;
      throw new Error(
        `${code} ne figure pas dans les ${vus} ${famille} lus` +
          (Number.isFinite(annonce) ? ` sur ${annonce} annoncés` : '') +
          (incomplete
            ? ` — LECTURE INCOMPLÈTE : le service en annonce ${annonce} et n’en a rendu que ${vus}, ` +
              'donc on ne peut pas conclure qu’il n’y est pas'
            : '') +
          (plafonne.get(famille)
            ? ` — et cette liste est PLAFONNÉE à ${parPage} : la page suivante n’a rien rendu de ` +
              'neuf alors que la précédente était pleine, donc le mandat est peut-être juste derrière'
            : '')
      );
    }
    if (!statutDe(trouve)) throw new Error(`${code} est là, mais sans statut`);
    return trouve;
  };
}
