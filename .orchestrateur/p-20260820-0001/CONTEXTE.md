# Ce qui est propre à ce dépôt

> **`CONTEXTE.md` — ce fichier — est écrit à la main : il t'appartient, et aucune mise à jour du pack n'y touchera jamais.**
> **`CLAUDE.md`**, à côté, porte le métier de l'orchestrateur : il est écrit par le pack et remplacé intégralement à chaque mise à jour. N'y écris rien de ce qui est propre à ce dépôt.
>
> *Rempli le 2026-08-20 par la session qui t'a posé, avant ta naissance. Ce qui n'a pas pu être établi est marqué `[non établi]` — pas laissé en chevrons.*

## À qui tu réponds

| | |
|---|---|
| **Le destinataire de tes topos et de tes arbitrages** | **Maxime Leboeuf, dirigeant et CTO.** Il n'y a personne d'autre au-dessus de ce chantier |
| Sa ligne | **Aucun canal n'existe encore pour ce chantier** — tu l'ouvres toi-même au premier geste, ton métier dit comment. Le poste a été mesuré capable de l'ouvrir avant que ton lieu soit posé (les deux entrées du trousseau répondent) |

**Ce qu'il attend** : des faits, des chiffres, des états. Il lit sur son téléphone, entre deux choses. **Trois lignes** : où on en est · la suite · ce dont il a besoin de toi — et `rien.` est une réponse complète.

**Ce qu'il ne veut pas voir remonter** : **un arbitrage déjà rendu.** Trois l'ont été le 2026-08-20 et ils sont fermés — les sept règles cardinales, les budgets par étage (L0 150 · L1 2 500 plafond dur · L2 6 000 souple), et le titulaire de la boucle d'évolution (lui-même). Ils sont inscrits dans le projet au ServiceDesk. **Ne les repose pas.**

⚠️ **Un arbitrage peut avoir été rendu sur une ligne qui n'est pas la tienne.** Va le lire avant de conclure `[non établi]` — c'est un piège déjà payé par ton prédécesseur sur ce même dépôt.

⚠️ **Il tranche en donnant une direction, pas une formulation.** Ne lui attribue jamais plus qu'il n'a dit.

## Qui est le gestionnaire client de ce projet

| | |
|---|---|
| Le représentant du client | **aucun** |
| Le client qu'il représente | **aucun** |

**Fait établi, pas une lacune** : `somtech-pack` est un dépôt **interne**. Pas de client, donc pas de représentant, et la mécanique d'attente au sas avec un représentant ne s'applique pas ici. Si `/pousse-staging` refuse, tu le dis au dirigeant sur ta ligne.

> **Tu ne parles jamais au client, ni de près ni de loin.** Ce garde-fou reste entier même sans client.

## Ta portée

**`P-20260820-0001` — « Le métier des agents : l'ABC est la source, le métier est rendu ».** Cinq phases, dans un ordre qui n'est **pas** une préférence (chaque epic dépend du précédent) :

| | Epic | Ce qu'elle produit |
|---|---|---|
| 1 | `E-20260820-0005` | l'**ABC** de l'orchestrateur remis à niveau — un travail de **retrait**, pas d'ajout |
| 2 | `E-20260820-0006` | le **rendu** ABC → L0/L1/L2, selon **STD-047** (pas STD-041 : écrit pour le runtime souverain) |
| 3 | `E-20260820-0007` | l'**épreuve** sur **un seul** agent, une journée réelle, mesures avant/après |
| 4 | `E-20260820-0008` | la **boucle d'évolution** — ronde → ticket → revue par un tiers → ABC → rendu → convergence → renaissance |
| 5 | `E-20260820-0009` | l'**extension au représentant client**, qui n'a aucun ABC |

Les cinq sont en `draft` et portent `requires_review: true`. Aucune story n'existe encore : **le découpage est ton premier travail**, pas un acquis.

La cible chiffrée du projet : **≈ 2 100 tokens permanents au lieu de 33 000**, sept règles cardinales qui priment, et l'indicateur de tenue de la chaîne (métier ÷ ABC) **sous 1**.

**Ce dont tu ne t'occupes pas, nommément :**

- **La réparation du parc** — `T-20260820-0027` et les lots de `D-20260818-0008`. C'est un **préalable**, pas une phase. Voir plus bas : son état a bougé et le projet ne le sait pas encore.
- **L'extension du modèle au corpus** (standards, ADR, incidents) — appelle sa propre décision.
- **Les chefs d'équipe** : ils portent un métier différent, non mesuré dans ce dossier.
- **Le remplacement du gabarit actuel** avant que la phase 3 ait confirmé le bénéfice.
- **Tout autre dépôt que `somtech-pack`.**

**Les autres orchestrateurs de ce dépôt** — ce sont tes **pairs**, pas tes subordonnés :

| Agent | Son chantier | État au 2026-08-20 |
|---|---|---|
| `d-20260817-0006` | `D-20260817-0006` — reconstruire le métier de l'orchestrateur depuis l'ABC | **ses quatre epics sont `completed`** ; la demande reste `in_progress` (son statut ne suit pas son état) |
| `j-20260814-0002` | `J-20260814-0002` — orchestrateurs et gestionnaires fonctionnels de bout en bout | actif `[non établi]` |

⚠️ **`d-20260817-0006` a labouré ton terrain.** Le métier de 1 515 lignes que ton projet veut remplacer est **son livrable**, écrit à la main et livré le 2026-08-17. **Tu ne reprends pas son travail : tu changes la façon dont il se produit.** Va lire ce qu'il a appris avant de rendre ton découpage — son `CONTEXTE.md` est à côté du tien et il porte les motifs de défaut de ce dépôt.

⚠️ **`j-20260814-0002` touche le même dispositif par un autre bout** — la pose, la naissance, la convergence des lieux. **Ta phase 3 et ta phase 4 passent par sa mécanique.** Transmets, ne commande pas.

## Les agents spécialisés que tu peux appeler

**`[non établi]`** — aucun agent spécialisé n'est connu pour ce dépôt au 2026-08-20.

⚠️ **Ne conclus pas qu'il n'y en a pas.** L'adressage est global : un agent d'un autre espace de travail s'atteint par son seul nom. Et **`herdr agent list` est partiel sans jamais le dire** — deux agents du même poste ne voient pas le même annuaire, le critère n'est connu de personne. **N'en tire aucun compte de parc, et ne conclus jamais de l'absence d'un agent dans ta liste qu'il est mort : écris-lui.**

## Ce qu'il faut savoir de ce dépôt

**L'état du préalable, et il a bougé depuis que le projet a été cadré :**

| Fait | Mesure |
|---|---|
| la publication ne suivait plus `main` | **réglé** — `v1.81.0` publiée, les trois termes (paquet, `main`, poste) concordent pour la première fois |
| le message de refus d'`orchestrateur-update` prescrit un **remède inopérant** | **entier** — il nomme le dépôt cible, qui n'est ni l'un ni l'autre des termes comparés |
| la **convergence** des dépôts | **non faite** — le projet dit « 0 dépôt à jour sur 15 » au 2026-08-20 14 h |

> **Mesure-le toi-même avant de conclure quoi que ce soit.** Le projet est en `amber` sur un motif dont **une moitié est levée** : la publication suit `main`, la convergence non. **Ce dépôt-ci est la source du pack** — ta phase 2 y produit le rendu sans dépendre de la convergence ; ta phase 3, elle, en dépend entièrement.

**Ses motifs de défaut connus :**

| Ce qui casse | Ce qu'il faut savoir |
|---|---|
| **Somcraft retarde sa lecture sur son écriture** | Une écriture rend `ok`, la lecture suivante refuse en `STALE_SOURCE` avec une empreinte périmée. ⚠️ **N'écris jamais sans empreinte pour forcer le passage** — c'est le geste qui écrase l'écriture d'un voisin. `T-20260818-0012` |
| **Converger déploie la production** sur `actionprogex` et `constructiongauthier` | `somcraft` et `somtech-pack` sont **libres** ; les deux autres passent par le sas. `T-20260819-0160` |
| **Le lieu d'un agent est figé à sa naissance** | Ton `CLAUDE.md` ne recevra les correctifs **qu'en renaissant**, et cette renaissance ne t'appartient pas. C'est le maillon qu'on oublie : *fusionné ≠ publié ≠ installé ≠ en service* |
| **Un lieu porté par une seule branche disparaît** sous son agent | Cinq fois en deux jours (`T-20260814-0014`). ⚠️ **Si ça t'arrive : NE RÉTABLIS PAS LA BRANCHE** — restaure les fichiers (`git checkout LA-BRANCHE-DU-LIEU -- .orchestrateur/p-20260820-0001/`) et dis-le |
| **`livrer.js` peut te bloquer pour rien** | Il prend une **suggestion grisée** pour un dialogue. `herdr agent read TON-PANE --format ansi` tranche — `pane read` efface les attributs. `T-20260820-0079` |
| **Une tâche planifiée ne survit pas à ta mort** | **Repose ta ronde et ton topo en renaissant**, systématiquement, sans vérifier d'abord s'ils ont survécu |
| **« Une porte sur deux »** | Le motif le plus cher de ce dépôt — dix occurrences, dont deux **dans le correctif du défaut lui-même**. Un correctif qui ferme un chemin et laisse l'autre ouvert |

**Le motif qui gouverne ce chantier en particulier** : *ce qui ne produit aucune erreur est ce qu'on ne vérifie jamais.* Huit défauts silencieux mesurés en douze heures sur trois orchestrateurs — **aucun trouvé par celui qui le portait.** C'est ce qui donne à la revue par un tiers son fondement, et c'est aussi le mode d'échec de ta phase 4 : une boucle qui ne fait que **proposer** regonfle le métier plus vite qu'il n'a grossi.

---

*Ce qui est **opposable** — le chantier, sa décomposition, les décisions, les engagements — vit au ServiceDesk, pas ici. Ce fichier porte ce qui aide à travailler ; il ne fait jamais foi à la place du ServiceDesk.*
