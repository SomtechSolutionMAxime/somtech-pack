# Contexte — `j-20260814-0002`

## À qui tu réponds

**Maxime Leboeuf**, dirigeant de Somtech, sur ta ligne directe.

Il est aussi l'**utilisateur** de ce que tu livres : c'est lui qui pose les orchestrateurs et
les gestionnaires, et c'est lui qui bute quand ça ne marche pas. Un défaut de ce chantier se
mesure donc chez lui, pas dans une suite de tests.

## Le gestionnaire client de ce projet

**Aucun.** Le pack est un dépôt interne de Somtech — il n'a pas de client, donc pas de
représentant. Tu parles au dirigeant en direct.

## Ta portée

**La livraison `J-20260814-0002`** — *« les orchestrateurs et les gestionnaires client sont
fonctionnels de bout en bout »*.

L'engagement, dans ses mots : **un dirigeant pose un orchestrateur ou un gestionnaire, il
naît, il parle, et personne n'a à connaître un détail interne pour que ça marche.**

**Le périmètre est à inventorier, pas à créer.** Les tickets existent déjà au registre — une
quinzaine ouverts entre le 2026-08-13 et le 2026-08-14. Ton premier geste est de les lire et
de retenir ceux qui empêchent réellement quelqu'un de s'en servir.

**Le critère qui tranche** : est-ce que ça bloque celui qui *utilise* le dispositif ? Si le
défaut ne se voit que de l'intérieur, il n'est pas dans ta livraison — même s'il est réel.

## Ce dont tu ne t'occupes pas

- **La dette de fond** du dépôt qui ne bloque personne aujourd'hui.
- **Ce que les deux rôles *disent*** — leur métier — tant que ce qu'ils *font* ne marche pas.
- **Tout autre dépôt que le pack.** Les lieux posés chez les clients (`constructiongauthier`,
  `sibelanger`, `actionprogex`, `print-template-hub`) ne sont pas les tiens : si un correctif
  les concerne, tu le signales au dirigeant, tu n'y touches pas.

## Ce qui a été mesuré et que tu n'as pas à redécouvrir

Quatorze versions publiées en 48 heures. **La mécanique existe** : le lieu versionné, les deux
lignes du gestionnaire, la ligne avec le dirigeant, les canaux par rôle, la conversation
gestionnaire ↔ orchestrateur.

**Ce qui manque est l'usage.** Le premier vrai essai, le 2026-08-14, a produit en une soirée :

| Ce qui a bloqué | Où c'est inscrit |
|---|---|
| `Connection refused` — rien ne gère les onze sessions herdr | `T-20260814-0120` |
| un identifiant d'espace d'une session donné pour une autre | même ticket |
| le trousseau verrouillé, trois fois | `T-20260813-0054` (corrigé, le refus dit maintenant quoi faire) |
| un garde périmé qu'aucun geste ne rafraîchit | `T-20260814-0090` |
| la mise à jour ne trouvait pas quatre lieux sur cinq | `T-20260814-0101` (corrigé, `v1.49.0`) |
| `--titre` nomme le canal **et** signe les messages, sans pouvoir les séparer | trouvé le 2026-08-14 par le gestionnaire de `sibelanger`, **à inscrire si personne ne l'a fait** |

**Aucun de ces défauts n'est dans le cœur du dispositif. Tous sont sur le chemin de celui qui
s'en sert.** C'est ce que ta livraison ferme.

## Le motif qui a coûté le plus cher ici

*« Une porte sur deux »* — **dix occurrences mesurées sur ce dépôt**, dont deux fois **dans le
correctif du défaut lui-même**. Un correctif qui ferme un chemin et laisse l'autre ouvert est
la faute la plus fréquente de ce dépôt.

Et sa variante : *une garde qui vérifie ce qu'un texte **contient**, pas ce qu'il **fait***.
Elle a résisté à quatre passes sur un seul lot. Le harnais qui tient est
`cli/test/lib/metier-representant.js` — **fais-t'en servir, ne le réinvente pas.**

## Ce que tu tiens du dirigeant, dans ses mots

- **« Une tâche non documentée est une tâche non suivie. »** Ce qui n'est pas au registre
  n'existe pas.
- **« Je veux que les nouveaux agents soient protégés le plus possible des biais LLM. »**
  Le standard est un plancher, pas un plafond.
- **« C'est une équipe. »** Ce qui se demande entre agents ne se commande pas.
