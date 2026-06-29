export const meta = {
  name: 'analyse-decoupage-demande',
  description: "Analyse une demande ServiceDesk Somtech et propose un découpage Epic/Story tracé au BRD — lecture seule, aucune écriture",
  whenToUse: "Décomposer une demande ServiceDesk (D-xxxx) en epics/stories G/W/T tracées aux EF du BRD, via analyse multi-angles (valeur user, traçabilité EF, technique, risques) + synthèse + critique adversariale. Passer le code de la demande en args, ex: \"D-20260601-0005\". Ne crée RIEN dans ServiceDesk : sortie = proposition à valider.",
  phases: [
    { title: 'Contexte' },
    { title: 'Analyse' },
    { title: 'Synthèse' },
    { title: 'Critique' },
  ],
}

// ---------- Entrée : code de la demande (souple sur le format d'args) ----------
const demandeCode = (typeof args === 'string')
  ? args
  : (args && (args.demande_code || args.code || args.demande))
if (!demandeCode) {
  throw new Error("analyse-decoupage-demande : passer le code de la demande en args, ex: \"D-20260601-0005\" ou { demande_code: \"D-20260601-0005\" }.")
}

// ---------- Schémas ----------
const CTX_SCHEMA = { type: 'object', properties: {
  demande_titre: { type: 'string' },
  demande_description: { type: 'string' },
  application_id: { type: 'string' },
  module_id: { type: ['string', 'null'], description: 'UUID du module de la demande source (NULL si demande app-level)' },
  brd_grain: { type: 'string', enum: ['application', 'module'], description: 'Grain effectivement résolu pour le BRD (cohérent avec ADR-031, STD-033 §2.11)' },
  brd_resolved_from: { type: ['string', 'null'], enum: ['module', 'application', null], description: "Origine effective du BRD résolu : 'module' = pointer module-level direct, 'application' = fallback vers app-level (warning à afficher dans la décomposition), null = champ absent côté serveur (grain app pur, rétro-compat). Le prompt Phase 1 force 'application' pour le grain app pur ; ce null reste un filet de sécurité si le LLM suit littéralement la réponse MCP." },
  brd_version: { type: ['string', 'null'], description: 'Version SemVer du BRD résolu (du pointer ServiceDesk)' },
  brd_yaml_publie_mcp: { type: 'boolean' },
  brd_md_lu: { type: 'boolean' },
  ef_pertinentes: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, enonce: { type: 'string' }, statut: { type: 'string' } }, required: ['id'] } },
  ra_pertinentes: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, enonce: { type: 'string' } }, required: ['id'] } },
  hs_pertinents: { type: 'array', items: { type: 'string' } },
  drift_referentiel: { type: 'string' },
  note_limite: { type: 'string' },
}, required: ['demande_titre', 'application_id', 'brd_grain', 'brd_yaml_publie_mcp', 'note_limite'] }

const ANALYSE_SCHEMA = { type: 'object', properties: {
  angle: { type: 'string' },
  points_cles: { type: 'array', items: { type: 'string' } },
  decoupage_suggere: { type: 'array', items: { type: 'string' } },
  ef_manquantes_ou_a_amender: { type: 'array', items: { type: 'string' } },
  risques: { type: 'array', items: { type: 'string' } },
  faits_non_verifies: { type: 'array', items: { type: 'string' } },
}, required: ['angle', 'points_cles'] }

const DECOUPAGE_SCHEMA = { type: 'object', properties: {
  spike_brainstorming: { type: 'string' },
  epics: { type: 'array', items: { type: 'object', properties: {
    titre: { type: 'string' }, problem: { type: 'string' }, outcome: { type: 'string' },
    out_of_scope: { type: 'string' },
    stories: { type: 'array', items: { type: 'object', properties: {
      titre: { type: 'string' },
      ef_tracee: { type: 'string' },
      niveau_test: { type: 'string' },
      gherkin: { type: 'object', properties: {
        given: { type: 'string' }, when: { type: 'string' }, then: { type: 'string' } } },
    }, required: ['titre', 'ef_tracee', 'gherkin'] } },
  }, required: ['titre', 'problem', 'outcome', 'stories'] } },
  ordre_recommande: { type: 'array', items: { type: 'string' } },
  notes: { type: 'string' },
}, required: ['epics', 'ordre_recommande'] }

const CRITIQUE_SCHEMA = { type: 'object', properties: {
  defauts: { type: 'array', items: { type: 'object', properties: {
    severite: { type: 'string', enum: ['bloquant', 'majeur', 'mineur'] },
    cible: { type: 'string' }, probleme: { type: 'string' }, correction: { type: 'string' } },
    required: ['severite', 'cible', 'probleme'] } },
  verdict_global: { type: 'string' },
  pret_a_creer: { type: 'boolean' },
}, required: ['defauts', 'verdict_global', 'pret_a_creer'] }

// ---------- Phase 1 : Contexte (résout la demande + le BRD au bon grain) ----------
phase('Contexte')
const ctx = await agent(
  `Tu prépares le contexte pour découper une demande ServiceDesk Somtech dont le code est ${demandeCode}.

   ÉTAPE 1 — Récupère la demande : via ToolSearch charge "select:mcp__servicedesk__demands", appelle action=list
   (filtre created_after large si besoin) pour trouver l'entrée dont demand_id === "${demandeCode}", récupère son
   UUID, puis action=get avec cet UUID. Extrais titre, description complète, application_id ET module_id (peut
   être NULL si la demande est au grain application).

   ÉTAPE 2 — Résous le BRD au bon grain (cadre ADR-031, STD-033 §2.11 amendé 2026-06-08) :
   - Via ToolSearch charge "select:mcp__servicedesk__applications".
   - Si module_id est non-NULL → appelle action=get_brd_pointer avec {application_id, module_id, fallback_to_app: true}.
     Toujours passer application_id ET module_id ensemble pour bénéficier du garde-fou serveur de scoping cross-app.
     La réponse contient resolved_from: 'module' ou 'application' (si fallback déclenché).
     - resolved_from='module' → brd_grain='module', brd_resolved_from='module'
     - resolved_from='application' → brd_grain='application', brd_resolved_from='application' (signale dans note_limite :
       "⚠️ BRD module-level non défini pour ce module, fallback sur BRD portail de l'app. Le découpage devrait
       inclure une story 'Initialiser BRD module' OU rattacher cette demande au grain app." — règle d'or n°10 amendée)
   - Si module_id est NULL → appelle action=get_brd_pointer avec {application_id} (grain app pur, rétro-compat stricte).
     brd_grain='application'. Pour brd_resolved_from : tu DOIS écrire 'application' MÊME SI la réponse MCP n'inclut pas
     ce champ (rétro-compat serveur : champ omis pour grain app pur). Ne laisse jamais null si module_id est NULL.
   - Mets brd_yaml_publie_mcp=true si brd_yaml_document_id est non-NULL dans la réponse. Capture brd_version.
   - Si tu as un brd_yaml_document_id, lis le contenu via ToolSearch "select:mcp__claude_ai_Somcraft__read_document"
     puis read_document avec ce document_id pour extraire les EF/RA/HS.
   ATTENTION (calibration de confiance) : "brd_document_id:null" via MCP ne veut PAS dire que le BRD n'existe pas —
   il peut exister dans Somcraft sans pointer SD posé. Ne confonds pas les deux.

   ÉTAPE 3 — Extrais UNIQUEMENT les EF/RA/HS du/des domaine(s) cité(s) par la demande, au grain résolu (un BRD module
   ne contient pas toutes les EF de l'app, et vice-versa). Confronte les codes d'exigences cités par la demande à ceux
   réellement présents dans la source. Si un code cité est INTROUVABLE (ex: domaine renommé, EF dans un autre grain),
   documente-le dans drift_referentiel (règle d'or n°1/n°10 : signaler le drift AVANT tout découpage). Une story
   rattachée à un module ne peut PAS citer une EF d'un BRD d'un autre module ou d'une autre app — violation de
   traçabilité au grain (anti-pattern ADR-031).

   RÈGLES : aucune écriture. Tu es probablement hors du repo projet (cwd ≠ repo applicatif) : tout fait tiré
   du CODE applicatif ou du BRD.md source que tu n'as pas pu lire directement doit être marqué comme NON VÉRIFIÉ
   dans note_limite (règle d'or n°7).`,
  { phase: 'Contexte', schema: CTX_SCHEMA, label: 'contexte:demande+brd' })

const DEM = `Demande ${demandeCode}\nTitre: ${ctx.demande_titre}\nDescription: ${ctx.demande_description || '(voir contexte)'}`

// ---------- Phase 2 : Analyse multi-angles ----------
phase('Analyse')
const ANGLES = [
  { k: 'valeur-user', p: "Découpe la demande par VALEUR USER livrable (test décisif STD-030 : chaque story = un incrément testable de bout en bout que l'utilisateur perçoit). Si la demande implique des choix non tranchés (provider, archi, coût), place un SPIKE timeboxé au bon endroit. Liste les tranches de valeur de la plus petite livrable à la plus large." },
  { k: 'tracabilite-ef', p: "Mappe chaque besoin à une EF du BRD AU GRAIN RÉSOLU (Réalisé par). Si le grain est 'module', toutes les EF tracées doivent venir du BRD module (pas du BRD app). Si une EF citée par la demande est introuvable ou si le référentiel a drifté, ÉTABLIS le mapping réel et signale les EF à créer/amender AVANT d'écrire les stories (règle d'or n°10 amendée 2026-06-08, STD-033 §2.8 Protocole de pré-décomposition). Une story sans EF tracée vérifiée OU citant une EF d'un autre grain est une violation (anti-pattern ADR-031)." },
  { k: 'technique', p: "Analyse l'impact technique (API externes, schéma/migrations, cache, fallback, composants UI, niveaux de test L1-L5). IMPORTANT : tout détail de code (chemins de fichiers, numéros de ligne, noms de migration) que tu n'as pas lu directement dans le repo courant doit être listé dans faits_non_verifies — ne l'affirme pas comme certain (règle d'or n°7 + calibration de confiance STD-011)." },
  { k: 'risques', p: "Identifie risques et dépendances : faisabilité/limites des API, coût et quotas, dépendances entre stories, zones de flou nécessitant un arbitrage, respect du hors-scope du BRD, impacts Loi 25 éventuels (PII envoyée à un tiers)." },
]
const analyses = await parallel(ANGLES.map(a => () =>
  agent(`Contexte: ${JSON.stringify(ctx)}\n\n${DEM}\n\nAngle d'analyse = ${a.k}. ${a.p}`,
    { phase: 'Analyse', schema: ANALYSE_SCHEMA, label: `analyse:${a.k}` })))

// ---------- Phase 3 : Synthèse ----------
phase('Synthèse')
const decoupage = await agent(
  `À partir des 4 analyses, propose le découpage selon STD-030 (Demande → Epics → Stories).
   RÈGLES STRICTES :
   - Chaque story DOIT tracer à une EF (ef_tracee). EF inexistante → "À CRÉER" ; EF existante impactée → "à amender".
   - G/W/T concret et TESTABLE par story. N'injecte JAMAIS de nombre magique non sourcé dans un Then
     (ex: "≥15%") : exprime une relation qualitative paramétrée par une RA ou la mesure d'un spike, sinon le test
     est décoratif (CLAUDE.md "chercher des bugs pas des PASS").
   - Si des inconnues changent l'architecture des stories, place un SPIKE timeboxé (livrable REF/ADR) AVANT tout code.
   - Le travail de gouvernance (créer/amender EF, publier brd.yaml) se fait depuis le repo Architecture (règle d'or n°7),
     jamais depuis le repo applicatif → epic de gouvernance dédié en tête si drift.
   - **Si ctx.brd_resolved_from === 'application' ET ctx.module_id est non-NULL** (fallback module → app déclenché) :
     la PREMIÈRE story de l'epic de gouvernance DOIT être « Initialiser BRD module <module> » avec acceptance criteria
     pour la création du BRD module-level via /brd new <app>/<module> + premier extract, OU le découpage DOIT explicitement
     déclasser au grain app avec une justification claire dans la description de l'epic. Ne JAMAIS livrer un découpage qui
     ignore silencieusement le fallback — c'est une dette de gouvernance qui fragmente la traçabilité (ADR-031, règle d'or n°10 amendée).
   - Un epic à la fois jusqu'en prod, pas de bundle (règle d'or n°4). Le fallback/résilience d'une API critique se livre
     DÈS la 1re story qui l'utilise (règle d'or n°2), pas en story tardive.
   - Couvre la feature de façon SYMÉTRIQUE (ex: aller ET retour, création ET édition) — pas de demi-périmètre implicite.
   - Indique un niveau de test (L1-L5/unit/N-A) par story.

   Contexte: ${JSON.stringify(ctx)}
   Analyses: ${JSON.stringify(analyses.filter(Boolean))}`,
  { phase: 'Synthèse', schema: DECOUPAGE_SCHEMA, label: 'synthese:decoupage' })

// ---------- Phase 4 : Critique adversariale ----------
phase('Critique')
const critique = await agent(
  `Tu es un analyste senior sceptique. Challenge ce découpage SANS complaisance (anti-sycophantie STD-011).
   Cherche notamment : story sans EF tracée, story non découpée par valeur user, G/W/T flou/non testable ou
   contenant un nombre magique non sourcé, hors-scope du BRD violé, story trop grosse (>1 PR), dépendance non
   explicitée, spike manquant ou mal placé, périmètre asymétrique (ex: aller traité mais pas retour), fallback
   d'API critique relégué en story tardive, référence de fichier/migration imprécise, citation de source opposable
   inexacte (calibration de confiance). Pour chaque défaut : severite (bloquant|majeur|mineur) + correction.
   Conclus par pret_a_creer (true seulement si AUCUN défaut bloquant).

   Découpage proposé: ${JSON.stringify(decoupage)}`,
  { phase: 'Critique', schema: CRITIQUE_SCHEMA, label: 'critique:decoupage' })

return {
  demande: demandeCode,
  application_id: ctx.application_id,
  module_id: ctx.module_id || null,
  brd_grain: ctx.brd_grain,
  brd_resolved_from: ctx.brd_resolved_from,
  brd_version: ctx.brd_version || null,
  brd_yaml_publie_mcp: ctx.brd_yaml_publie_mcp,
  drift_referentiel: ctx.drift_referentiel || '(aucun signalé)',
  note_limite: ctx.note_limite,
  decoupage,
  critique,
}
