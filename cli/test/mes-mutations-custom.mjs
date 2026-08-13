// Trois mutations custom pour chercher des faux témoins
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMPETENCES,
  REPO,
  CONTROLES_COMMUNS,
  CONTROLES_ORCHESTRATEUR,
  controlesQuiRougissent,
  lireCompetences,
} from './lib/competences-de-pose.js';

const remplacer = (texte, quoi, par) => texte.replace(quoi, par);

const MUTATIONS_CUSTOM = [
  {
    id: 'motif-1-contenu-vs-fait-reformulation-cachee',
    quoi: 'on laisse « recopie-le » mais on ajoute « ou si tu préfères, résume-le » — contenu présent mais fait violé',
    competence: 'orchestrateur',
    cible: 'le-refus-se-relaie-tel-quel@orchestrateur',
    muter: (t) => remplacer(
      t,
      '**Recopie-le. Ne le reformule pas en',
      '**Recopie-le, ou si tu préfères résume-le dans tes mots. Ne pas le reformuler en'
    ),
  },
  {
    id: 'motif-3-une-seule-porte-couverte-obligatoire-conditionnelle',
    quoi: 'on laisse « obligatoire » mais on le rend conditionnel : « la ligne devient obligatoire si le poste en a besoin »',
    competence: 'orchestrateur',
    cible: 'la-ligne-est-obligatoire@orchestrateur',
    muter: (t) => remplacer(
      t,
      'Sa ligne est donc obligatoire',
      'Sa ligne devient obligatoire si le poste peut l\'ouvrir'
    ),
  },
  {
    id: 'motif-1-table-motif-rendu-change-mais-backticks-gardees',
    quoi: 'on change le texte dans la table (« ce motif n\'arrive jamais ») mais on laisse les backticks et le code identifiant du motif',
    competence: 'orchestrateur',
    cible: 'les-motifs-de-refus-sont-au-complet@orchestrateur',
    muter: (t) => remplacer(
      t,
      '| `lieu_partiel` | `.orchestrateur/<nom>/` existe mais lui manque des fichiers | Écarte ce reste',
      '| `lieu_partiel` | Aucun problème ici, c\'est juste pour décorer | Ignore ce motif'
    ),
  },
];

const ORIGINAL = lireCompetences();

console.log('=== MUTATIONS CUSTOM ===\n');

for (const mutation of MUTATIONS_CUSTOM) {
  console.log(`\n📋 ${mutation.id}`);
  console.log(`   Quoi: ${mutation.quoi}`);
  console.log(`   Cible: ${mutation.cible}`);
  
  const avant = ORIGINAL[mutation.competence];
  const apres = mutation.muter(avant);
  
  if (apres === avant) {
    console.log('   ❌ MUTATION N\'A RIEN CHANGÉ — le motif ne s\'applique plus');
    continue;
  }
  console.log('   ✅ Mutation opérante');
  
  const rouges = controlesQuiRougissent({ ...ORIGINAL, [mutation.competence]: apres });
  const ids = rouges.map((r) => r.id);
  
  if (ids.includes(mutation.cible)) {
    console.log(`   ✅ Contrôle VISÉ a rougi: ${mutation.cible}`);
  } else {
    console.log(`   ⚠️  FAUX TÉMOIN: Contrôle VISÉ est resté vert: ${mutation.cible}`);
    console.log(`   Contrôles qui ont rougi: ${ids.length ? ids.join(', ') : '(aucun)'}`);
  }
}
