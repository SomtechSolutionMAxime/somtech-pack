// espace-herdr.js — L'ESPACE HERDR OÙ L'ONGLET NAÎTRA : l'ouvrir, et savoir le défaire.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 POURQUOI CE MODULE EXISTE, ET POURQUOI IL N'EST PAS DANS LA PORTE D'ENTRÉE
//
// Ce geste vivait dans `cli/src/commands/agent.js`, exécuté AVANT le lancement de la naissance.
// Mesuré sur la ligne exacte que le métier prescrit — `pack agent naitre revue-pr180 --role
// chef-equipe --depot <d> --coordonnateur moi`, sans `--workspace` :
//
//     herdr workspace create --cwd <d> --label revue-pr180 --no-focus     ← la porte
//     « … Rien n'a été créé : ni espace de travail, ni onglet, ni agent. »  ← la naissance, sortie 1
//
// L'espace restait, orphelin, et le message mentait. Et pas seulement sur ce refus-là : TOUS les
// refus du chemin — mandat invalide, `--base` introuvable, espace de travail occupé, nom que
// herdr refuse, session ambiguë — tombaient après cette création. Deux textes opposables
// affirment l'inverse (« avant le moindre appel à herdr », « un refus ne laisse rien derrière
// lui ») : c'était un texte qui promettait ce que le code ne faisait pas.
//
// ⚠️ DÉFAIRE APRÈS COUP N'AURAIT PAS SUFFI, et c'est ce qui a tranché entre les deux options.
// Un `workspace close` après le refus laisse le message « rien n'a été créé » faux à l'instant
// où on le lit, et il dépend d'un second appel herdr qui peut lui-même échouer — auquel cas
// l'orphelin reste ET la promesse est écrite. Faire naître l'espace APRÈS les refus rend la
// promesse vraie par construction, ce qu'aucun défaire ne peut donner.
//
// ⚠️ MAIS LE DÉFAIRE RESTE NÉCESSAIRE, et il est ici aussi. Entre la création et la fin, des
// échecs subsistent (l'onglet que herdr refuse, l'agent qui ne se laisse pas nommer, l'écran
// qui ne cède pas). Le fichier `bin/naitre.js` referme déjà le pane dans ces cas-là ; il referme
// désormais aussi l'espace, quand c'est LUI qui l'a ouvert — jamais celui qu'on lui a donné.

import { execFileSync } from 'node:child_process';

/** La commande qui ouvre un espace — écrite UNE fois, lue par l'essai comme par la naissance. */
export function commandeOuvrirEspace({ cwd, label }) {
  return ['workspace', 'create', '--cwd', cwd, '--label', label, '--no-focus'];
}

/** La commande qui le referme. */
export function commandeFermerEspace(id) {
  return ['workspace', 'close', id];
}

/**
 * L'identifiant que herdr rend d'un espace fraîchement créé.
 *
 * ⚠️ LES DEUX CHEMINS SONT MESURÉS, pas défensifs : le schéma de l'API (protocole 20) déclare
 * `workspace_created` porteur d'un `workspace`, d'un `tab` et d'un `root_pane`, et c'est le
 * `root_pane` qui portait l'identifiant dans le geste d'origine. On lit les deux plutôt que de
 * parier sur celui qui arrivera.
 */
export function identifiantDeLEspace(reponse) {
  return reponse?.result?.root_pane?.workspace_id || reponse?.result?.workspace?.workspace_id || null;
}

/**
 * Ouvre un espace herdr — sur la session VISÉE, jamais sur celle qu'on hérite.
 *
 * ⚠️ LE SOCKET EST PASSÉ, ET C'EST UNE CORRECTION EN SOI. La porte d'entrée appelait `herdr`
 * nu : l'espace naissait dans la session par défaut, c'est-à-dire dans RIEN depuis un terminal
 * ordinaire — puis la naissance résolvait sa session et refusait l'espace pour non-appartenance.
 * Onze sessions tournent sur ce poste ; le cas normal est que ce ne soit pas la même.
 *
 * @returns {Promise<{ok: true, id: string} | {ok: false, message: string}>} — jamais d'exception
 */
export async function ouvrirUnEspaceHerdr({ cwd, label, socket, appeler }) {
  const reponse = await appeler(commandeOuvrirEspace({ cwd, label }), { socket });
  if (!reponse.ok) {
    return {
      ok: false,
      message:
        `herdr n’a pas pu ouvrir d’espace de travail : ${reponse.message}\n` +
        `  Le geste qui lève le blocage : vérifie que herdr tourne (\`herdr status\`), ou vise un ` +
        `espace existant avec \`--workspace\`.`,
    };
  }
  const id = identifiantDeLEspace(reponse.reponse);
  if (!id) {
    return {
      ok: false,
      message:
        `herdr a ouvert un espace sans en dire l’identifiant : ${JSON.stringify(reponse.reponse)} — ` +
        `on ne devine pas où l’agent naîtrait.`,
    };
  }
  return { ok: true, id };
}

/**
 * Referme un espace qu'on a ouvert — SYNCHRONE, et c'est ce qui le rend fiable.
 *
 * ⚠️ IL EST APPELÉ DEPUIS UN GESTIONNAIRE DE SORTIE (`process.on('exit')`), où plus rien
 * d'asynchrone ne s'exécute : un `await` y serait abandonné en silence, et l'orphelin resterait
 * exactement comme avant. C'est aussi ce qui garantit qu'AUCUNE sortie n'est oubliée — y compris
 * celles qu'on ajoutera plus tard, et celles qui viennent d'une exception non rattrapée.
 *
 * @returns {{ok: boolean, message: string}} — jamais d'exception : on est en train de sortir
 */
export function fermerLEspaceHerdr(id, { socket = null, executer = execFileSync } = {}) {
  try {
    executer('herdr', commandeFermerEspace(id), {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(socket ? { env: { ...process.env, HERDR_SOCKET_PATH: socket } } : {}),
    });
    return { ok: true, message: '' };
  } catch (err) {
    return { ok: false, message: String(err?.stderr || err?.stdout || err?.message || err).trim() };
  }
}
