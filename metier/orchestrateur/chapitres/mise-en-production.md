# Pousser, merger, clore

## Prérequis

- Tu tournes dans herdr (`HERDR_ENV=1`). Sinon, arrête.
- Le MCP `servicedesk` est disponible.
- `git worktree` et `claude --model …` sont disponibles dans les panes que tu ouvres.
- Le chantier existe au ServiceDesk et tu as son code.

## Le sas — et si la mise en ligne est occupée, le dire avant toute chose

`/pousse-staging` refuse (`acquired: false`) quand une autre livraison occupe le sas. **Ce n'est pas un incident, c'est le fonctionnement voulu** — ton travail est prêt, il attend son tour.

> ⚠️ **Le verrou ne fait pas foi. Mesure l'écart, pas l'annonce.**
>
> Le **2026-08-14**, le feed a rapporté **deux** défaillances du même verrou : un `lock_status` qui répond « libre » sur un staging occupé depuis trois jours, **et le verrou accordé à une nouvelle PR alors que le sas était déjà pris**. **Un `acquired: true` ne prouve donc pas davantage qu'un `locked: false`.**
>
> ```bash
> git fetch origin
> git log origin/staging -1 --format="%cI"                    # depuis quand staging ne bouge plus
> git diff origin/main..origin/staging --name-only | wc -l    # 0 = vraiment libre
> ```
>
> Un écart non nul dit qu'une livraison occupe le sas, **quoi qu'en dise le verrou**. Celui-ci sert à savoir **qui** détient ; il ne suffit ni à savoir **si**, ni à t'autoriser à pousser.

**Le problème n'est pas l'attente, c'est le silence.** Ton représentant de client peut voir qu'un détenteur est nommé ; ce qu'il ne peut pas savoir, c'est que **le chantier qui attend derrière est le sien** — le verrou nomme son détenteur, jamais ceux qui patientent. **Toi seul le sais.** Sans un mot de ta part, il dira au client « c'est en cours » — ce qui est faux, et se découvre au pire moment.

Alors tu le lui dis. **Deux fois** : quand tu entres en attente, et quand ton tour vient.

```bash
L=".claude/skills/orchestrer-chantier/lib/attente-au-sas.sh"

ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-20260806-0042 \
ATS_APPLICATION="Portail Acme" ATS_APPLICATION_ID=<app-id> \
ATS_DETENTEUR_PR=412 ATS_DEPUIS=2026-08-06T11:20:00Z \
  bash "$L" attente

ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-20260806-0042 \
ATS_APPLICATION="Portail Acme" ATS_APPLICATION_ID=<app-id> \
ATS_ATTENTE_DECLAREE=oui \
  bash "$L" passage
```

Les valeurs viennent de là où elles existent, **jamais de ton estimation** : `ATS_REPRESENTANT` est le nom d'agent que ton brief te donne — **recopie-le, ne le devine pas** ; `ATS_APPLICATION` est le nom que le client reconnaîtrait, jamais un code ; `ATS_APPLICATION_ID` est le `servicedesk.app_id` de `.somtech/app.yaml` ; `ATS_DETENTEUR_PR` et `ATS_DEPUIS` viennent du refus lui-même.

Sur `DECISION=DIRE`, exécute la ligne `COMMANDE=` telle qu'elle est rendue. Sur `RIEN`, il n'y a rien à dire. Sur `FAIL`, **ne te tais pas** : corrige et recommence.

- **Ton chantier n'a pas de représentant ?** Il rend compte au CTO, et **rien ne change**. C'est le cas le plus fréquent.
- **Un refus de `lock_acquire` porte toujours sur ta propre application.** Emprunter l'attente d'un voisin serait une information fausse, et elle voyagerait jusqu'à son client.

**Ne construis rien pour attendre.** Pas de ServiceDesk, pas de numéro d'ordre, pas de reprise automatique : tu retentes ta poussée quand tu es prêt. Un second mécanisme de file se désynchroniserait du premier.

**Et réinscris-le au ServiceDesk** : ce qui ne vit que dans le fil disparaît avec la session qui l'a lu.

## Merger et fermer les statuts dans le même geste

Règle d'or n°13. Toutes les stories que le merge ferme passent `completed` **immédiatement**.

> ⚠️ **Mais la QA passe AVANT le merge — le merge n'est qu'un constat.** L'ordre est `in_progress → [QA passe] → ready_to_deploy → [/merge] → completed` (STD-030). **`ready_to_deploy` n'est pas décoratif** : il dit que **le scénario a été rejoué**, pas seulement que la chaîne est verte. Merger d'abord et fermer ensuite fait de la règle d'or n°5 une intention.

*Si ton chantier est une Livraison* — **c'est ici que se joue ton calendrier.** Staging est un sas à une seule livraison (règle d'or n°14) et on ne bundle jamais (n°4) : chaque lot traverse **un par un**. Un jalon de vingt tickets n'est donc pas vingt travaux parallèles qui convergent, **mais une file** — et sa durée est la **somme** des passages, pas celle du plus long. Dimensionne la date là-dessus, et **dis-le tôt si elle ne tient pas**.

## Clore

Une **Demande** passe `delivered` toute seule quand tous ses enfants sont fermés — c'est un trigger. Un **Projet** ne se ferme pas seul.

*Si ton chantier est une Livraison* — rien ne se fermera tout seul, et il y a **deux fronts** :

- **le jalon** : `qa` puis `deployed`, à la main, dans cet ordre. **`deployed` sans être passé par `qa` est un mensonge sur ce qui a été vérifié.** ⚠️ En pratique presque personne ne l'utilise — ce que tu lis est une **prescription, pas un usage** : en t'y tenant, tu inaugures. Assume-le, et laisse la trace de ce qui a été vérifié ;
- **les demandes d'origine.** Un jalon est transverse : fermer le jalon n'en ferme aucune. Celles dont il reste une story ailleurs sont encore ouvertes **à bon droit** — c'est une information, pas un oubli.

*Comment fermer `qa`* : la méthode et son coût sont cadrés par STD-030 §2.7. **L'arbitrage est le tien et il pèse** — la validation par cahier de test coûte quelques dizaines de sous par scénario, la recette pilotée par un agent dans un vrai navigateur de l'ordre de cent fois plus. Sur vingt tickets, l'écart n'est plus un détail. **Réserve la seconde à ce qui la mérite** : sécurité, facturation, authentification, ou un parcours qu'aucun scénario ne couvre.

Avant d'y arriver : vérifie qu'aucun epic ne reste ouvert pour de la dette qui aurait dû être sortie, et qu'aucun espace de travail orphelin ne traîne.

> 🔴 **Tu ne refermes ta ligne que si le CHANTIER est clos — jamais si c'est TOI qui t'arrêtes** (renaissance, relais). Le chantier continue sans toi, et refermer **couperait le CTO entre ta mort et la naissance de ton successeur**.
>
> **Tu écris à la place** un dernier message : où en est le chantier, **que le canal reste ouvert**, ce qui reste `[non établi]` — puis sa dernière ligne, comme tout message.
>
> ⚠️ **Durable ou jetable ?** Une ligne **durable** rouvre sous le même titre ; une **jetable** est archivée, **donc irréversible** — le désarchivage est réservé à un compte humain. *(Mesuré sur un jalon `planned` portant 14 demandes — `T-20260818-0128`.)*

**Referme ta ligne, avec son bilan** — c'est le dernier geste **d'un chantier clos** :

```bash
node "$HOME/.somtech/ligne-directe/bin/ligne-directe.js" fermer \
  --bilan "<ce qui a été livré, ce qui reste, ce qui appartient au CTO>"
```

**Le bilan est un message comme les autres** : des faits, et `J'ai besoin de toi : …` en dernière ligne — `rien.` s'il ne reste rien qui lui appartienne, et c'est précisément le cas où l'écrire compte, puisque c'est le dernier mot du chantier.

Une ligne qu'on abandonne sans la refermer laisse un canal ouvert sur une question sans réponse.

---
