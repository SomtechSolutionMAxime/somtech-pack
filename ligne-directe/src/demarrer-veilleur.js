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
    // ⚠️ LE MOTIF PART AU JOURNAL, pas seulement le fait. Il y a deux façons de trouver la
    // place prise — « il m'a répondu » et « il ne répond pas mais il la tient » — et la
    // seconde est le signe d'un veilleur occupé au-delà de 2 s. Écraser les deux sous une
    // phrase unique, c'est effacer la seule trace qui distingue un poste sain d'un poste
    // dont le veilleur pend (T-20260825-0101).
    journaliser(`un veilleur tourne déjà — ce démarrage se retire : ${err.message}`);
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
