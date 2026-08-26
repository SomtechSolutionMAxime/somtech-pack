// terminal.js — la garde qui ferme la brèche du terminal (P-20260820-0001, STD-047).
//
// Le classement par couche a nommé cette brèche noir sur blanc : `GF-ORC-001`
// interdit d'écrire un fichier, `permissions.deny` le garantit pour les outils
// d'édition — et pas pour le terminal. Une redirection écrit un fichier sans
// passer par eux, et le métier le reconnaissait lui-même : « c'est à toi de ne
// pas le faire », c'est-à-dire persona seule, c'est-à-dire rien.
//
// ⚠️ Ce module est PUR : il ne lit rien, n'écrit rien, ne connaît pas le monde.
// C'est ce qui le rend testable, et c'est le patron du seul hook déjà en service
// (STD-047 R3bis) : fil mince dans `settings.json`, décision pure dans un module,
// et REFUS PAR DÉFAUT quand on ne comprend pas — un garde absent ne vaut jamais
// un garde permissif.

import { ROLES_CONNUS } from './roles-connus.js';

// ⚠️ `ROLES_GARDES` A DISPARU D'ICI, ET SON NOM AVEC — T-20260826-0079.
//
// Il valait `{orchestrateur, gestionnaire-client}` et se lisait « les rôles à qui cette
// garde s'applique ; elle ne décide pas pour les autres ». Ce n'était pas une réserve de
// compétence, c'était un TROU : tout rôle absent de ces deux entrées repartait avec un
// `allow()` sans qu'une seule ligne de sa commande soit examinée. L'en-tête ci-dessus
// prescrit littéralement l'inverse, et les deux autres gardes du dispositif l'appliquent
// déjà — `ecriture.js` refuse un rôle inconnu, `ligne-cliente.js` aussi. Le rôle était le
// seul point où celle-ci disait « d'accord » à ce qu'elle n'avait pas compris.
//
// Le nom n'a pas été conservé parce qu'il ne veut plus dire la même chose : la garde ne
// choisit plus à qui elle s'applique, elle s'applique à tout ce qu'elle sait lire et
// refuse le reste. Garder l'ancien mot sur le nouveau sens est précisément ce qui avait
// fait diverger cette table de celle de `ligne-cliente.js`.
//
// Ce qu'elle sait lire vit désormais dans `roles-connus.js`, en un seul exemplaire.

/** Chemins toujours ouverts : sans eux la garde empêche de travailler. */
const HORS_PORTEE = [/^\/private\/tmp\/claude-/, /^\/tmp\/claude-/, /^\/dev\/(null|stdout|stderr)$/];

/** Une redirection qui crée ou remplace un fichier — `2>/dev/null` n'en est pas une. */
const REDIRECTION = /(^|[\s;&|(])\d?>{1,2}\|?\s*("[^"]+"|'[^']+'|[^\s;&|)]+)/g;

/** Commandes qui écrivent, même sans redirection. Une porte sur deux ne ferme rien. */
const ECRIVENT = [
  /(^|[\s;&|(])tee\b/, /(^|[\s;&|(])sed\b[^;|&]*\s-i\b/, /(^|[\s;&|(])cp\b/, /(^|[\s;&|(])mv\b/,
  /(^|[\s;&|(])rm\b/, /(^|[\s;&|(])truncate\b/, /(^|[\s;&|(])dd\b/, /(^|[\s;&|(])install\b/,
  /(^|[\s;&|(])ln\b/, /(^|[\s;&|(])mkdir\b/, /(^|[\s;&|(])touch\b/, /(^|[\s;&|(])chmod\b/,
  /(^|[\s;&|(])chown\b/, 
  // ⚠️ un interpréteur n'est refusé que s'il ÉCRIT. Le refuser sur « -c » seul
  // refusait aussi les lectures : mesuré sur le trafic que le métier prescrit,
  // c'était l'un de ses deux faux refus (RA-ORC-029, la règle des deux chiffres).
  /(^|[\s;&|(])(python3?|node|perl|ruby)\b.*?(open\s*\([^)]*['"]w|write_text|writeFile|writeFileSync|\.write\s*\()/,
];

/** Un chemin absolu cité dans la commande. */
const CHEMINS_ABSOLUS = /(^|[\s"'=(])(\/[^\s"';&|)]+)/g;

/**
 * Racines réelles du système. Sans elles, `/goal` et `/model` — des commandes
 * qu'un orchestrateur envoie à ses agents — étaient pris pour des chemins hors
 * du dépôt : le second des deux faux refus mesurés sur du trafic réel.
 */
const RACINES = new Set(['Users', 'tmp', 'private', 'var', 'opt', 'etc', 'usr', 'bin',
  'sbin', 'Applications', 'Volumes', 'home', 'mnt', 'data', 'srv', 'root', 'dev']);
const estUnChemin = (p) => RACINES.has(p.split('/')[1] || '');

const deny = (raison) => ({ decision: 'deny', raison });
const allow = () => ({ decision: 'allow', raison: '' });

/**
 * Juge une commande de terminal.
 *
 * @param {{commande?:string, depot?:string, role?:string}} req
 * @returns {{decision:'allow'|'deny', raison:string}}
 */
export function juger(req = {}) {
  // Le défaut reste `orchestrateur`, et il n'est PAS le trou : un appelant muet se fait
  // alors juger au plus dur, ce qui est le bon côté de l'erreur. Le trou était un rôle
  // AUTRE — celui qu'aucune des deux entrées ne nommait.
  const { commande, depot, role = 'orchestrateur' } = req;

  if (!ROLES_CONNUS.has(role)) {
    return deny(
      `La garde n'a pas su établir à quel rôle elle avait affaire (« ${role} »). Elle ne sait ` +
      `donc pas ce que ce rôle a le droit de faire au terminal, et elle refuse plutôt que de le ` +
      `supposer : un garde absent ne vaut jamais un garde permissif. Le geste qui lève ce blocage ` +
      `n'est pas de contourner la garde, c'est de déclarer ce rôle dans « roles-connus.js » — puis ` +
      `de rejouer « npx @somtech-solutions/pack setup » pour que le poste reçoive la table à jour.`,
    );
  }

  if (typeof commande !== 'string' || commande.trim() === '') {
    return deny(
      "La garde n'a reçu aucune commande à juger. Elle refuse plutôt que de laisser passer " +
      "ce qu'elle n'a pas vu : un garde absent ne vaut jamais un garde permissif.",
    );
  }
  if (typeof depot !== 'string' || depot === '') {
    return deny(
      "La garde ne sait pas quel est le dépôt de ce chantier, donc elle ne peut pas dire si " +
      "cette commande en sort. Elle refuse plutôt que de le supposer.",
    );
  }

  const horsPortee = (p) => HORS_PORTEE.some((r) => r.test(p));

  // ① une redirection qui écrit un fichier
  for (const m of commande.matchAll(REDIRECTION)) {
    const cible = m[2].replace(/^["']|["']$/g, '');
    if (cible === '&1' || cible === '&2' || horsPortee(cible)) continue;
    return deny(
      `Cette commande écrit un fichier par redirection vers « ${cible} ». Écrire un fichier ne ` +
      `t'appartient pas : le refus de tes droits porte sur les outils d'édition, et le terminal ` +
      `est la porte qu'ils laissent ouverte. Si ce geste doit être posé, il appartient à quelqu'un ` +
      `d'autre — et la question n'est pas « puis-je ? » mais « pourquoi est-ce tombé chez moi ? ».`,
    );
  }

  // ② une commande qui écrit sans redirection
  for (const r of ECRIVENT) {
    if (r.test(commande)) {
      return deny(
        `Cette commande écrit sur le disque sans passer par un outil d'édition. Fermer la ` +
        `redirection sans fermer celle-ci ne fermerait rien — une porte sur deux ne ferme pas ` +
        `la pièce. Le geste appartient à ton chef d'équipe.`,
      );
    }
  }

  // ③ un chemin absolu hors du dépôt du chantier (GF-ORC-007)
  for (const m of commande.matchAll(CHEMINS_ABSOLUS)) {
    const p = m[2];
    if (!estUnChemin(p) || horsPortee(p) || p.startsWith(depot)) continue;
    return deny(
      `Cette commande vise « ${p} », qui est hors du dépôt de ton chantier (${depot}). ` +
      `Tu ne travailles que dans le dépôt de ton chantier et dans ta portée écrite. Si le travail ` +
      `y est vraiment, il faut le signaler, pas le faire depuis ici.`,
    );
  }

  return allow();
}
