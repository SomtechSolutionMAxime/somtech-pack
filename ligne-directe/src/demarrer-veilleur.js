// demarrer-veilleur.js — point d'entrée du processus permanent.
//
// Lancé détaché par la commande locale (démarrage paresseux), ou au premier plan pour
// l'observer : `node ligne-directe/src/demarrer-veilleur.js`.

import { Veilleur, journaliser } from './veilleur.js';

const veilleur = await Veilleur.demarrer().catch((err) => {
  journaliser(`DÉMARRAGE IMPOSSIBLE — ${err.name || 'Erreur'} : ${err.message}`);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await veilleur.arreter();
    process.exit(0);
  });
}

// Sans cela, un processus qui n'a plus rien à faire dans l'immédiat rendrait la main.
setInterval(() => {}, 1 << 30);
