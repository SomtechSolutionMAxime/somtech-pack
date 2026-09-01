// metier.js — sous-commandes du métier rendu (STD-047, P-20260820-0001).
//
// `pack metier rendre --role <r>`   produit L0/L1/L2 depuis le classement
// `pack metier verifier --role <r>` ne rend rien : mesure, compare au rendu
//                                   committé, et sort non nul si ça ne va pas
//
// ⚠️ R6 — le rendu n'écrit JAMAIS dans le lieu d'un agent. Il produit les
// artefacts du pack ; la distribution est l'affaire de la convergence.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { rendre, BUDGETS } from '../metier/rendu.js';

const SOUS_COMMANDES = new Set(['rendre', 'verifier']);
export const isMetierCommand = (cmd) => cmd === 'metier';

/** Un rôle est un segment de chemin, jamais une traversée. */
function roleValide(role) {
  return typeof role === 'string' && role.length > 0 && !role.startsWith('-') &&
    /^[a-z0-9][a-z0-9_-]*$/.test(role);
}

/**
 * Charge le classement ET injecte le contenu des chapitres depuis leurs fichiers.
 *
 * ⚠️ Le contenu d'un chapitre a UNE seule source : `metier/<role>/chapitres/<nom>.md`.
 * Il a été un temps recopié dans le JSON, et seule la copie JSON était lue —
 * éditer le fichier lisible était alors un no-op silencieux. C'est le motif
 * « deux copies d'un critère divergent en silence », trouvé par la revue
 * indépendante du 2026-08-20.
 */
export function lireClassement(racine, role) {
  const base = join(racine, 'metier', role);
  const p = join(base, 'classement.json');
  if (!existsSync(p)) {
    throw new Error(`aucun classement pour le rôle « ${role} » — attendu : ${p}\n` +
      `Le classement est un artefact versionné, pas une inférence (STD-047 §2.1).`);
  }
  const cl = JSON.parse(readFileSync(p, 'utf8'));
  for (const c of cl.chapitres || []) {
    if (!c?.nom) continue;
    const f = join(base, 'chapitres', `${c.nom}.md`);
    if (existsSync(f)) c.contenu = readFileSync(f, 'utf8');
    else delete c.contenu;
  }
  return cl;
}

/** Ce que le rendu committé porte aujourd'hui, pour le comparer à ce qu'il devrait porter. */
function lireRenduCommitte(base) {
  const out = {};
  const marche = (rel) => {
    const abs = join(base, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs)) {
      const r = rel ? `${rel}/${e}` : e;
      if (statSync(join(base, r)).isDirectory()) marche(r);
      else out[r] = readFileSync(join(base, r), 'utf8');
    }
  };
  marche('');
  return out;
}

function rapport(r, role) {
  const l = [`métier « ${role} » — L0 ${r.mesures.L0}/${BUDGETS.L0} · L1 ${r.mesures.L1}/${BUDGETS.L1} tokens`];
  for (const [n, t] of Object.entries(r.mesures.L2)) l.push(`  chapitre ${n} : ${t}/${BUDGETS.L2}`);
  const { garde_fous, deroges, refuses } = r.mesures.R1 || {};
  if (garde_fous !== undefined) {
    l.push(`R1 : ${garde_fous} garde-fous · ${deroges} dérogés · ${refuses} refusés` +
      (deroges === garde_fous && garde_fous > 0 ? '  ⚠️ R1 ne refuse plus RIEN sur ce rôle' : ''));
  }
  for (const id of r.deroges || []) l.push(`     dérogé : ${id}`);
  for (const a of r.avertissements || []) l.push(`⚠️  ${a}`);
  for (const e of r.erreurs) l.push(`⛔ ${e}`);
  return l.join('\n');
}

export function runMetier(argv, { cwd = process.cwd() } = {}) {
  const sous = argv[1];
  if (!SOUS_COMMANDES.has(sous)) {
    process.stderr.write(`usage : pack metier <${[...SOUS_COMMANDES].join('|')}> --role <rôle>\n`);
    return 2;
  }
  const i = argv.indexOf('--role');
  const role = i > -1 ? argv[i + 1] : 'orchestrateur';
  if (!roleValide(role)) {
    process.stderr.write(
      `⛔ rôle invalide : ${role === undefined ? '(aucune valeur après --role)' : `« ${role} »`}\n` +
      `   Un rôle est un seul segment : lettres minuscules, chiffres, « - » ou « _ ».\n` +
      `   usage : pack metier ${sous} --role <rôle>\n`);
    return 2;
  }

  let classement;
  try { classement = lireClassement(cwd, role); }
  catch (e) { process.stderr.write(`⛔ ${e.message}\n`); return 1; }

  const r = rendre(classement);
  process.stdout.write(rapport(r, role) + '\n');
  if (!r.ok) { process.stderr.write("⛔ rendu refusé — rien n'a été écrit.\n"); return 1; }

  /**
   * LE DOSSIER DE GABARITS DU RÔLE — et son absence est un REFUS, plus une réussite muette.
   *
   * ⚠️ CE QUE ÇA FERME (T-20260826-0076). `distribuerAuGabarit` rendait 0 en silence quand
   * `.claude/templates/<rôle>/` n'existait pas, et cette fonction rendait 0 par-dessus :
   * `pack metier rendre` sur un rôle NEUF annonçait « ✅ N artefacts écrits » sans avoir rien
   * distribué. Le rendu existait sans atteindre personne — le défaut même que la distribution
   * a été écrite pour fermer, revenu par la porte du rôle qui n'a pas encore de gabarit.
   *
   * C'est le cas de CHACUN des rôles arbitrés à son premier rendu, pas une hypothèse.
   *
   * ⚠️ ON REFUSE PLUTÔT QUE DE CRÉER LE DOSSIER, et la distinction est mesurée. Un gabarit
   * porte quatre fichiers (`GABARITS`, ligne-directe/src/lieu-agent.js) : `CLAUDE.md`,
   * `CONTEXTE.md`, `.mcp.json` et `.claude/settings.json`. Le rendu n'en produit que deux — il
   * ne produit JAMAIS de `CONTEXTE.md` (I6), qui appartient au dépôt. Créer le dossier ici
   * fabriquerait donc un gabarit INCOMPLET, que la pose refuserait plus tard pour
   * « gabarits_absents », loin d'ici et sans lien visible avec ce geste. Refuser tôt en NOMMANT
   * ce qui manque coûte une commande à relancer ; créer à moitié coûte une enquête.
   *
   * ⚠️ ET LE REFUS VAUT AUSSI POUR `verifier`, dans le même geste. Il portait le même
   * `if (existsSync(gabarit))` : sans ça, il annoncerait « ✅ conforme » sur un rôle dont
   * `rendre` refuse de s'occuper — alors que le contrat écrit de ce gate est « verifier vert
   * doit impliquer que rendre ne changerait rien ». Corriger un seul des deux côtés briserait
   * ce contrat dans le sens le plus trompeur.
   */
  const gabarit = join(cwd, '.claude', 'templates', role);
  if (!existsSync(gabarit)) {
    process.stderr.write(
      `⛔ le rôle « ${role} » n'a pas de dossier de gabarits : ${gabarit}\n` +
      `   Le rendu n'atteindrait personne — il serait écrit et distribué à rien.\n` +
      `   Geste : créer ${join('.claude', 'templates', role)}/ avec les quatre fichiers d'un\n` +
      `   gabarit (CLAUDE.md, CONTEXTE.md, .mcp.json, .claude/settings.json), puis relancer.\n` +
      `   CLAUDE.md et .claude/settings.json seront REMPLACÉS par ce rendu ; CONTEXTE.md ne\n` +
      `   sera jamais touché (I6).\n`);
    return 1;
  }

  const base = join(cwd, 'metier', role, 'rendu');

  if (sous === 'verifier') {
    // Un rendu committé qui ne correspond plus à sa source est un métier périmé
    // que rien ne signale. C'est ce que cette comparaison rend visible.
    const actuel = lireRenduCommitte(base);
    const attendu = r.artefacts;
    const ecarts = [
      ...Object.keys(attendu).filter((k) => actuel[k] !== attendu[k]).map((k) => `${k} : périmé ou absent`),
      ...Object.keys(actuel).filter((k) => !(k in attendu)).map((k) => `${k} : orphelin, plus produit par le classement`),
    ];
    // Le gabarit distribué doit lui aussi correspondre au rendu. Plus de
    // « if (existsSync(gabarit)) » ici : son absence est déjà un refus, plus haut. Le garder
    // rendrait tout ce bloc conditionnel à une condition qui ne peut plus être fausse — une
    // branche que le réel n'emprunte jamais, donc une garde qu'on croit avoir.
    {
      const socle = (attendu['L0.md'] || '') + (attendu['L1.md'] || '');
      const lu = (f) => (existsSync(join(gabarit, f)) ? readFileSync(join(gabarit, f), 'utf8') : null);
      if (lu('CLAUDE.md') !== socle) ecarts.push('.claude/templates/' + role + '/CLAUDE.md : périmé face au rendu');
      for (const [chemin, contenu] of Object.entries(attendu)) {
        if (!chemin.startsWith('chapitres/')) continue;
        if (lu(`metier/${chemin}`) !== contenu) ecarts.push(`.claude/templates/${role}/metier/${chemin} : périmé`);
      }
      // Le fichier de DROITS distribué — le seul artefact qui garantisse quelque
      // chose. Sans ce contrôle, vider `permissions.deny` du gabarit passait le
      // gate en silence, et tout agent posé ensuite pouvait écrire.
      if (lu('.claude/settings.json') !== (attendu['.claude/settings.json'] ?? null)) {
        ecarts.push(`.claude/templates/${role}/.claude/settings.json : périmé ou absent`);
      }
      // Les chapitres ORPHELINS : `rendre` les retire, donc « verifier vert »
      // doit impliquer « rendre ne changerait rien ». C'est le contrat du gate.
      const dossierG = join(gabarit, 'metier', 'chapitres');
      if (existsSync(dossierG)) {
        for (const f of readdirSync(dossierG)) {
          if (!(`chapitres/${f}` in attendu)) {
            ecarts.push(`.claude/templates/${role}/metier/chapitres/${f} : orphelin, plus produit`);
          }
        }
      }
    }
    if (ecarts.length) {
      process.stderr.write(`⛔ le rendu committé ne correspond plus à sa source :\n` +
        ecarts.map((e) => `   ${e}`).join('\n') + `\n   Relance : pack metier rendre --role ${role}\n`);
      return 1;
    }
    process.stdout.write('✅ le rendu committé est conforme à sa source.\n');
    return 0;
  }

  // On écrit, puis on retire ce que le classement ne produit plus : un fichier
  // orphelin reste suivi par git et livré, et « git status » ne montre rien.
  for (const [chemin, contenu] of Object.entries(r.artefacts)) {
    const cible = join(base, chemin);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, contenu);
  }
  let retires = 0;
  for (const chemin of Object.keys(lireRenduCommitte(base))) {
    if (!(chemin in r.artefacts)) { rmSync(join(base, chemin.split('/').join(sep)), { recursive: true, force: true }); retires++; }
  }
  // Le GABARIT que le pack distribue EST le rendu. Sans ce maillon, `pack metier
  // rendre` produit des artefacts à côté et `/orchestrateur` continue de poser un
  // métier écrit à la main : le rendu existerait sans atteindre personne.
  //
  // ⚠️ `CONTEXTE.md` n'est jamais touché (I6) — il appartient au dépôt, pas au pack.
  const distribues = distribuerAuGabarit(cwd, role, r.artefacts);

  process.stdout.write(
    `✅ ${Object.keys(r.artefacts).length} artefacts écrits dans metier/${role}/rendu/` +
    (retires ? ` · ${retires} orphelin(s) retiré(s)` : '') +
    (distribues ? ` · ${distribues} distribué(s) vers .claude/templates/${role}/` : '') + '\n');
  return 0;
}

/**
 * Recopie le rendu dans le gabarit que le pack distribue.
 *
 * Le socle (L0 + L1) devient le `CLAUDE.md` du rôle ; les chapitres et le fichier
 * de droits suivent. Ce qui n'est plus produit est retiré du gabarit aussi —
 * un chapitre orphelin resterait distribué à jamais.
 *
 * ⚠️ LÈVE SUR UN DOSSIER ABSENT, ET NE REND PLUS 0 EN SILENCE (T-20260826-0076). C'est une
 * garde de PROFONDEUR : `runMetier` refuse déjà bien avant d'arriver ici, donc le chemin normal
 * ne l'atteint pas. Elle existe pour le jour où quelqu'un appellera cette fonction sans ce
 * contrôle — sans elle, le `mkdirSync(dirname(cible), { recursive: true })` juste dessous
 * CRÉERAIT le dossier et y déposerait deux fichiers sur quatre. Un gabarit à moitié posé se lit
 * comme un gabarit, et ne se découvre qu'à la pose d'un lieu, ailleurs, plus tard.
 *
 * Exportée POUR ÊTRE ÉPROUVÉE : une garde qu'aucun essai ne peut atteindre n'est pas une garde.
 */
export function distribuerAuGabarit(cwd, role, artefacts) {
  const gabarit = join(cwd, '.claude', 'templates', role);
  if (!existsSync(gabarit)) {
    throw new Error(
      `distribuerAuGabarit : « ${gabarit} » n'existe pas. Le contrôle de runMetier a été ` +
      'contourné — distribuer ici créerait un gabarit incomplet (deux fichiers sur quatre).');
  }

  const socle = (artefacts['L0.md'] || '') + (artefacts['L1.md'] || '');
  const aPoser = { 'CLAUDE.md': socle };
  for (const [chemin, contenu] of Object.entries(artefacts)) {
    if (chemin.startsWith('chapitres/')) aPoser[`metier/${chemin}`] = contenu;
    else if (chemin === '.claude/settings.json') aPoser[chemin] = contenu;
  }

  for (const [chemin, contenu] of Object.entries(aPoser)) {
    const cible = join(gabarit, chemin);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, contenu);
  }
  // Ce que le classement ne produit plus est RETIRÉ — un artefact périmé
  // continuerait d'être posé à chaque naissance sans que rien ne le signale.
  const dossier = join(gabarit, 'metier', 'chapitres');
  if (existsSync(dossier)) {
    for (const f of readdirSync(dossier)) {
      // ⚠️ `recursive` : `readdirSync` rend aussi les dossiers, et `rmSync` sur
      // un dossier lève — la distribution resterait à moitié appliquée.
      if (!(`metier/chapitres/${f}` in aPoser)) rmSync(join(dossier, f), { recursive: true, force: true });
    }
  }
  const droitsG = join(gabarit, '.claude', 'settings.json');
  if (!('.claude/settings.json' in aPoser) && existsSync(droitsG)) rmSync(droitsG, { force: true });
  return Object.keys(aPoser).length;
}
