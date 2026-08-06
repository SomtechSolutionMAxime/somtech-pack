// cloison.js — le troisième mur : une suite de tests ne joint JAMAIS le vrai espace Slack.
//
// POURQUOI CE FICHIER EST DU CODE DE PRODUCTION ET NON UN OUTIL DE TEST
//
// Deux cloisons protégeaient déjà le poste, et elles sont bonnes : un `LIGNE_DIRECTE_RACINE`
// jetable met le registre et le socket hors de portée, un `PATH` sans `herdr` arrête la
// commande avant qu'elle ait quoi que ce soit à dire à Slack. Elles protègent le REGISTRE.
//
// Elles n'empêchent pas de FAIRE NAÎTRE UN VEILLEUR. Et un veilleur, lui, lit le vrai
// trousseau du poste et ouvre une connexion vers l'espace Slack de production — quel que
// soit le registre qu'on lui a donné. La vérification par mutation, que ce chantier impose,
// casse justement les garde-fous qui retenaient la commande en amont : c'est son travail.
//
// VÉCU, et le prix a été payé par le dirigeant : deux veilleurs orphelins nés d'une campagne
// de mutation ont tenu une connexion de production pendant des heures. Slack répartit ses
// événements entre les connexions actives — deux messages du dirigeant sur trois partaient
// donc vers un veilleur sans registre, et étaient jetés en silence. Il a cru sa ligne morte.
// Un canal de production est né du même coup, sans que personne l'ait demandé.
//
// Une cloison posée dans les tests ne peut rien contre ça : le veilleur naît dans un AUTRE
// PROCESSUS, que le fichier de test ne contrôle plus. Le mur doit donc vivre dans le code
// lui-même, et se déclencher sur une propriété que le processus enfant HÉRITE.
//
// C'est `NODE_TEST_CONTEXT`, posée par le lanceur de tests de Node et transmise à toute la
// descendance. Aucun processus de production ne la porte. Il n'y a volontairement AUCUNE
// porte de sortie : une cloison qu'on peut désactiver finit toujours par l'être. Pour une
// vraie sonde contre le vrai Slack, on lance le script hors du lanceur de tests.

export class CloisonEssais extends Error {
  constructor(quoi, detail) {
    super(
      `CLOISON D'ESSAIS — ${quoi} est refusé : ce processus descend du lanceur de tests.\n` +
        `  ${detail}\n` +
        `  Un test qui a besoin de Slack remplace le transport (globalThis.fetch) par le double\n` +
        `  de tests/aide/faux-slack.js. Il n'y a pas d'autre chemin, et c'est voulu : une suite\n` +
        `  de tests a déjà tenu une connexion de production pendant des heures.`
    );
    this.name = 'CloisonEssais';
    this.quoi = quoi;
  }
}

/**
 * Ce processus descend-il du lanceur de tests ?
 *
 * `NODE_TEST_CONTEXT` est posée par `node --test` dans chaque fichier de test, et l'
 * environnement se transmet aux processus enfants — y compris au veilleur détaché, qui est
 * précisément celui qu'on veut retenir.
 */
export function enEssais() {
  return Boolean(process.env.NODE_TEST_CONTEXT);
}

/**
 * Le transport a-t-il été remplacé par un double ?
 *
 * On compare à la référence capturée au chargement du module. C'est ce qui distingue « ce
 * test a monté un faux Slack » (permis, et c'est le chemin normal) de « cet appel part
 * vers slack.com » (refusé). Un test qui oublie de monter son double se le fait dire ;
 * il ne le découvre pas dans le journal d'un veilleur orphelin trois heures plus tard.
 */
export function transportRemplace(natif, courant) {
  return natif !== courant;
}

/** Refuse net, en nommant ce qui a été tenté. */
export function refuser(quoi, detail) {
  throw new CloisonEssais(quoi, detail);
}
