// demarrer-veilleur.js — point d'entrée du processus permanent.
//
// Lancé détaché par la commande locale (démarrage paresseux), ou au premier plan pour
// l'observer : `node ligne-directe/src/demarrer-veilleur.js`.

import { Veilleur, journaliser } from './veilleur.js';

const veilleur = await Veilleur.demarrer({ surArret: () => process.exit(0) }).catch((err) => {
  if (err.code === 'DEJA_VIVANT') {
    // Ce n'est pas un échec : le service du poste et le démarrage paresseux peuvent viser
    // la même place. Le second se retire en silence, et surtout SANS code d'erreur — sinon
    // le gestionnaire de services le relancerait en boucle en croyant qu'il a planté.
    journaliser('un veilleur tourne déjà — ce démarrage se retire');
    process.exit(0);
  }
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
