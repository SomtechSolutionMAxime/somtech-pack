export const meta = {
  name: 'cycle-amelioration-metier',
  description: "Rassemble ce qu'un métier d'agent a coûté sur le terrain, mesure la recevabilité de chaque amélioration, la fait contredire, et rend un dossier au dirigeant — lecture seule, aucune écriture",
  whenToUse: "Faire tourner le cycle d'évolution d'un métier d'agent : les rondes ont trouvé des défauts, on veut savoir lesquels valent un amendement de l'ABC. Passer le rôle en args, ex: \"orchestrateur\" ou { role: \"gestionnaire-client\", depuis: \"2026-08-01\" }. Ne crée RIEN : la machine propose et refuse, elle n'adopte jamais — l'adoption appartient au dirigeant.",
  phases: [
    { title: 'Récolte' },
    { title: 'Recevabilité' },
    { title: 'Contradiction' },
    { title: 'Dossier' },
  ],
}

// ---------- Entrée ----------
const role = (typeof args === 'string') ? args : (args && (args.role || args.metier)) || 'orchestrateur'
const depuis = (args && args.depuis) || null
if (!['orchestrateur', 'gestionnaire-client'].includes(role)) {
  throw new Error(`cycle-amelioration-metier : rôle « ${role} » inconnu. Attendu : orchestrateur ou gestionnaire-client.`)
}

// ---------- Schémas ----------
const RECOLTE = {
  type: 'object',
  properties: {
    propositions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'un identifiant court et stable, en kebab-case' },
          defaut: { type: 'string', description: "le défaut CONSTATÉ, dans les mots de sa source — jamais reformulé de mémoire" },
          source: { type: 'string', description: "d'où il vient : code de ticket, journal de décisions, fil d'une demande. Un défaut sans source ne se propose pas." },
          cout_mesure: { type: 'string', description: "ce qu'il a coûté, chiffré si la source le chiffre ; « non mesuré » sinon — jamais une estimation" },
          amendement: { type: 'string', description: "ce qu'on ajouterait, retirerait ou fusionnerait dans l'ABC" },
          issue: { type: 'string', enum: ['adopter', 'fusionner', 'retirer'] },
          item_vise: { type: ['string', 'null'], description: "l'identifiant d'ABC concerné, ou null si c'est un item neuf" },
        },
        required: ['id', 'defaut', 'source', 'cout_mesure', 'amendement', 'issue'],
      },
    },
    rien_trouve: { type: 'boolean', description: 'true si la période ne contient aucun défaut à proposer. Un cycle qui ne trouve rien est un résultat.' },
  },
  required: ['propositions', 'rien_trouve'],
}

const RECEVABILITE = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    recevable: { type: 'boolean' },
    motifs: { type: 'array', items: { type: 'string' }, description: "vide si recevable ; sinon ce que le refus MESURE, jamais ce qu'il en conclut" },
    cout_socle_tokens: { type: 'number', description: "ce que l'amendement ajoute au socle permanent, en tokens. Négatif s'il allège." },
    retrait_exige: { type: ['string', 'null'], description: "l'item à retirer en compensation, si le budget de L1 est dépassé" },
    couche_possible: { type: 'string', description: "la couche qui pourrait le garantir, ou « aucune » avec le motif — un garde-fou en persona seule fait échouer le rendu (STD-047 R1)" },
  },
  required: ['id', 'recevable', 'motifs', 'cout_socle_tokens', 'couche_possible'],
}

const VERDICT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    tient: { type: 'boolean' },
    refutation: { type: 'string', description: "ce qui, dans la source elle-même, contredit la proposition — vide si elle tient" },
    deja_couvert_par: { type: ['string', 'null'], description: "l'item d'ABC qui dit déjà ça, s'il existe. Une règle qui redouble une règle ne s'ajoute pas, elle se fusionne." },
    porte_sur_une_fonction: { type: 'boolean', description: "true si l'amendement vaut pour une FONCTION ; false s'il n'est écrit que pour le geste où le défaut est apparu — c'est le motif le plus fréquent de règle qui ne mord pas" },
  },
  required: ['id', 'tient', 'refutation', 'porte_sur_une_fonction'],
}

// ---------- Phase 1 : Récolte ----------
// Ce que le terrain a coûté, lu là où les agents ont le droit d'écrire — le
// ServiceDesk. Un agent ne peut pas écrire son métier ; ce qu'il a appris ne
// vit donc nulle part ailleurs.
phase('Récolte')
const recolte = await agent(
  `Tu récoltes ce que le métier du rôle « ${role} » a coûté sur le terrain, pour en tirer des améliorations de son ABC.

   OÙ CHERCHER, et nulle part ailleurs :
   - les tickets ServiceDesk de l'application « Somtech Pack » qui portent un défaut de métier d'agent
     (mcp__servicedesk__tickets, action list) ;
   - les journaux de décisions des projets qui touchent ce rôle (mcp__servicedesk__project_decisions) ;
   - les fils des demandes correspondantes.
   ${depuis ? `Ne remonte pas avant le ${depuis}.` : 'Remonte au dernier cycle, ou à 30 jours si aucun cycle antérieur.'}

   CE QUE TU RETIENS — et le filtre est sévère :
   - un défaut CONSTATÉ, avec sa source citée. Un défaut sans source ne se propose pas.
   - son coût tel que la source le dit. Si elle ne le chiffre pas, écris « non mesuré » — n'estime JAMAIS.
   - l'amendement qu'il appelle : ajouter, fusionner avec une règle voisine, ou RETIRER une règle devenue inutile.

   ⚠️ DEUX DES TROIS ISSUES ALLÈGENT. Un cycle qui ne propose que des ajouts n'a fait que la moitié
   du travail : cherche activement ce qui peut sortir. Adopter est naturel, retirer ne l'est jamais.

   ⚠️ Si la période ne contient rien, dis-le : rien_trouve = true, propositions vide. Un cycle qui
   ne trouve rien est un résultat, pas un échec — et un cycle qui trouve toujours quelque chose
   cesse d'être lu.`,
  { phase: 'Récolte', schema: RECOLTE, label: `récolte:${role}` })

if (recolte.rien_trouve || recolte.propositions.length === 0) {
  return {
    role,
    depuis,
    rien_trouve: true,
    message: "Le cycle n'a rien trouvé sur cette période. C'est un résultat : rien à porter au dirigeant.",
  }
}

log(`${recolte.propositions.length} proposition(s) récoltée(s) — recevabilité et contradiction en parallèle par proposition`)

// ---------- Phases 2 et 3 : chaque proposition suit son chemin ----------
// Pipeline, pas barrière : une proposition mesurée passe à la contradiction
// pendant que la suivante est encore mesurée.
const jugees = await pipeline(
  recolte.propositions,

  // — Recevabilité : ce que la machine PEUT trancher, et rien d'autre.
  (p) => agent(
    `Tu mesures la recevabilité d'un amendement au métier du rôle « ${role} ». Tu ne juges pas s'il est
     BON — tu mesures s'il est RECEVABLE. Ce sont deux questions différentes.

     Proposition : ${JSON.stringify(p)}

     CE QUE TU MESURES, dans cet ordre :
     1. Lis « metier/${role}/classement.json » du dépôt et le rendu qu'il produit.
     2. Chiffre ce que l'amendement AJOUTE au socle permanent (L0 + L1), en tokens.
        Le budget de L1 est un PLAFOND DUR de 2 500 tokens.
     3. Si l'ajout ferait dépasser, nomme l'item à RETIRER en compensation. Ce n'est pas un
        arbitrage qu'on peut discuter : c'est une condition de recevabilité.
     4. Dis quelle COUCHE pourrait le garantir — capacité absente, refus de permission, hook,
        gate de dépôt. Si aucune ne le peut, écris « aucune » et dis POURQUOI : une règle qui
        porte sur le contenu d'un énoncé n'aura jamais de couche, et le dire vaut mieux que
        de l'espérer. Un garde-fou en persona seule fait échouer le rendu (STD-047 R1).

     ⚠️ Ne conclus d'aucune absence. Si tu ne trouves pas l'item visé, écris « non établi » —
     jamais « il n'existe pas ».`,
    { phase: 'Recevabilité', schema: RECEVABILITE, label: `recevabilité:${p.id}` }),

  // — Contradiction : un agent DISTINCT, qui cherche à refuser.
  //   C'est la garde structurelle du cycle : celui qui propose n'est jamais celui
  //   qui accepte. Une compétence ne peut pas la tenir — une seule session ne se
  //   contredit pas elle-même.
  (rec, p) => agent(
    `Tu es le contradicteur. Ton travail est de REFUSER cette proposition d'amendement, pas de l'améliorer.
     Devant un doute, tu refuses.

     Proposition : ${JSON.stringify(p)}
     Mesure de recevabilité : ${JSON.stringify(rec)}

     CHERCHE, dans cet ordre :
     1. LA SOURCE LA CONTREDIT-ELLE ? Va lire la source citée. Un défaut rapporté de mémoire
        arrive appauvri, et la source dit souvent autre chose que ce qu'on en a retenu.
     2. L'ABC LE DIT-IL DÉJÀ ? Lis l'ABC du rôle (mcp__somcraft__read_document). Une règle qui
        redouble une règle ne s'ajoute pas — elle se FUSIONNE. Deux copies d'un même critère
        divergent en silence.
     3. LA RÈGLE PORTE-T-ELLE SUR UNE FONCTION, ou seulement sur le geste où le défaut est apparu ?
        Une règle écrite à l'endroit où le défaut est apparu, et pas à l'endroit où il peut
        apparaître, se fait enjamber sans que personne ne s'aperçoive de rien. C'est le motif le
        plus fréquent de règle qui ne mord pas.
     4. L'AMENDEMENT EST-IL UN RÉCIT ? Une règle qui raconte l'incident qui l'a produite fait
        retenir l'anecdote, pas la règle. Si l'amendement porte son histoire, il n'est pas prêt.

     ⚠️ Rends « tient: true » seulement si les quatre passent. Ta complaisance ne se sent jamais
     comme de la complaisance : elle se sent comme de la confiance dans un travail bien fait.`,
    { phase: 'Contradiction', schema: VERDICT, effort: 'high', label: `contradiction:${p.id}` })
      .then((v) => ({ proposition: p, recevabilite: rec, verdict: v })),
)

// ---------- Phase 4 : le dossier ----------
const retenues = jugees.filter(Boolean).filter((j) => j.recevabilite?.recevable && j.verdict?.tient)
const ecartees = jugees.filter(Boolean).filter((j) => !(j.recevabilite?.recevable && j.verdict?.tient))

phase('Dossier')
const dossier = await agent(
  `Tu rends au dirigeant un dossier de décision sur le métier du rôle « ${role} ». Il tranche, tu ne tranches pas.

   Retenues (recevables et non réfutées) : ${JSON.stringify(retenues)}
   Écartées, avec leur motif : ${JSON.stringify(ecartees)}

   FORME — c'est un message à un dirigeant qui lit sur son téléphone entre deux choses :
   - des faits, des chiffres, des états. Jamais ton raisonnement.
   - pour chaque retenue : ce qu'elle change, ce qu'elle coûte au socle en tokens, ce qu'il
     faudrait retirer en compensation s'il y a lieu, et la couche qui la garantirait — ou la
     mention qu'aucune ne le peut.
   - les écartées en une ligne chacune, avec le motif. Elles comptent : elles disent ce que le
     cycle a refusé, et un cycle qui ne refuse rien ne garde rien.
   - **ce que le cycle RETIRE** en tête, avant ce qu'il ajoute. Deux des trois issues allègent,
     et c'est la moitié qu'on oublie.

   ⚠️ Termine par la décision attendue, en une ligne. Rien d'autre.
   ⚠️ Tu ne proposes AUCUNE écriture : ni ABC amendé, ni rendu, ni convergence. La machine
   propose et refuse ; elle n'adopte jamais.`,
  { phase: 'Dossier', label: `dossier:${role}` })

return {
  role,
  depuis,
  rien_trouve: false,
  recoltees: recolte.propositions.length,
  retenues: retenues.length,
  ecartees: ecartees.length,
  detail: { retenues, ecartees },
  dossier,
  // ⚠️ Ce que ce workflow N'A PAS fait, et qui reste à faire à la main après
  // l'adoption : amender l'ABC, relancer le rendu, converger, faire renaître.
  // Fusionné n'est pas publié, publié n'est pas installé, installé n'est pas en service.
  reste_a_faire: "adoption par le dirigeant → ABC amendé → pack metier rendre → convergence → renaissance",
}
