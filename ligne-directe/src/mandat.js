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
export function accesServiceDesk({
  url = 'https://vdpuktsqrecdxbmweate.supabase.co/functions/v1/servicedesk-mcp',
  cle = process.env.SOMTECH_DESK_API_KEY || process.env.SERVICEDESK_MCP_TOKEN,
  fetcher = globalThis.fetch,
  delaiMs = 8000,
  parPage = 200,
} = {}) {
  if (!cle || typeof fetcher !== 'function') return null;

  const appelerMcp = async (nom, args) => {
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
  const indexer = async (famille) => {
    if (index.has(famille)) return index.get(famille);
    const corps = await appelerMcp(famille, { action: 'list', limit: parPage });
    const liste = Object.values(corps || {}).find((v) => Array.isArray(v)) || [];
    const par = new Map();
    for (const item of liste) {
      for (const [champ, valeur] of Object.entries(item || {})) {
        if (champ.endsWith('_id') && typeof valeur === 'string' && /^[A-Z]-\d{8}-\d{4}$/.test(valeur)) {
          par.set(valeur, item);
        }
      }
    }
    index.set(famille, par);
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
    if (!trouve) throw new Error(`${code} ne figure pas dans les ${par.size} ${famille} lus`);
    if (!statutDe(trouve)) throw new Error(`${code} est là, mais sans statut`);
    return trouve;
  };
}
