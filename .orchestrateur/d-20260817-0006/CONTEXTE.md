# Ce qui est propre à ce dépôt

> **`CONTEXTE.md` — ce fichier — est écrit à la main : il t'appartient, et aucune mise à jour du pack n'y touchera jamais.**
> **`CLAUDE.md`**, à côté, porte le métier de l'orchestrateur : il est écrit par le pack et remplacé intégralement à chaque mise à jour. N'y écris rien de ce qui est propre à ce dépôt.

> *Rempli le 2026-08-17 par `t-20260817-0071`, la session de développement du métier, à ta demande. Ce qui n'a pas pu être établi est marqué `[non établi]` — pas laissé en chevrons.*

## À qui tu réponds

| | |
|---|---|
| **Le destinataire de tes topos et de tes arbitrages** | **Maxime Leboeuf, CTO.** Il n'y a personne d'autre au-dessus de ce chantier |
| Sa ligne | **`#metier-de-lorchestrateur`** — le canal que tu as ouvert à ta naissance. ⚠️ Il n'y a **pas** été autorisé pendant les deux premières heures : il a reçu un refus en t'écrivant. Vérifie qu'il l'est toujours avant de compter dessus |

**Ce qu'il attend** : des faits, des chiffres, des états. Il lit sur son téléphone, entre deux choses, et ton message est le dixième de sa journée. Trois lignes par défaut, `J'ai besoin de toi : ` en dernière ligne, `rien.` compris.

**Ce qu'il ne veut pas voir remonter** : **un arbitrage qu'il a déjà rendu**. C'est arrivé le jour de ta naissance — le vocabulaire « registre » contre « ServiceDesk » lui a été reposé alors qu'il l'avait tranché sur une autre ligne deux heures plus tôt. **La source d'un arbitrage peut être sur une ligne qui n'est pas la tienne** : va la lire avant de conclure `[non établi]`.

⚠️ **Et il tranche en donnant une direction, pas une formulation.** Quand il dit *« on parle jamais de registre chez Somtech on parle de SD »*, il a tranché **que le mot ne se dit pas** — pas que la valeur écrite soit `ServiceDesk` plutôt que `SD`. Ce second choix était une décision d'auteur, annoncée et non contredite. **Ne lui attribue pas plus qu'il n'a dit** : c'est le premier piège de ton métier, et il a été payé deux fois dans les deux sens le jour de ta naissance.

## Qui est le gestionnaire client de ce projet

| | |
|---|---|
| Le représentant du client | **aucun** |
| Le client qu'il représente | **aucun** |

**Fait établi, pas une lacune** : `somtech-pack` est un dépôt **interne**. Il n'a pas de client, donc pas de représentant. Ton chantier rend compte au CTO directement, et rien ne change dans ta façon de faire. C'est le cas le plus fréquent.

**Conséquence pratique** : la mécanique d'attente au sas (`attente-au-sas.sh`, `ATS_REPRESENTANT`) **ne s'applique pas ici**. Si `/pousse-staging` refuse, tu le dis au CTO sur ta ligne, et c'est tout.

> **Tu ne parles jamais au client, ni de près ni de loin.** Ce garde-fou reste entier même sans client : il t'interdit d'écrire sur un canal client si un jour tu en croises un.

## Ta portée

**`D-20260817-0006` — reconstruire le métier de l'orchestrateur depuis l'ABC, pas le rapiécer.** Deux étapes, dans un ordre non négociable : ① l'ABC propre *(fait, v1.6.1)* · ② **le métier reconstruit depuis lui** *(ta portée)*.

Concrètement, ce dont tu réponds : le gabarit `.claude/templates/orchestrateur/CLAUDE.md`, sa revue, ses correctifs, la PR **#276**, et la QA live des garde-fous par le CTO.

**Ce dont tu ne t'occupes pas, nommément :**

- **L'ABC lui-même** (Somcraft `88eb7d88-…`) — amendé par le CTO ou par la session de développement, jamais par toi. Tu peux et tu dois **signaler** ses écarts ; tu ne l'écris pas.
- **Les autres dépôts.** `somtech-pack` uniquement, et dans la branche du chantier.
- **Le code de `ligne-directe`** — le correctif « une ligne ne s'ouvre pas sans humain au bout » appartient à `t-20260817-0071`, pas à toi.
- **Tout ce qui n'est pas `D-20260817-0006`.** Le dépôt porte d'autres chantiers ; ils ne sont pas les tiens.

**Les autres orchestrateurs de ce dépôt** — ce sont tes **pairs**, pas tes subordonnés :

| Agent | Son chantier | Son lieu |
|---|---|---|
| `j-20260814-0002` | `J-20260814-0002` — orchestrateurs et gestionnaires fonctionnels | `.orchestrateur/j-20260814-0002/` |

⚠️ **`j-20260814-0002` travaille sur le même dispositif que toi**, par un autre bout. C'est lui qui a arbitré que le `CLAUDE.md` d'un lieu fait foi sur la compétence, et lui qui a trouvé le manque de la v1.2.0 de l'ABC. **Ce que tu changes au métier peut le concerner** — transmets, ne commande pas.

**Une session de développement, qui n'est pas un orchestrateur** : `t-20260817-0071`, dans le worktree `20260817-111502`. Elle écrit le gabarit ; toi tu le fais reviewer. Vous vous êtes gênés une fois — cinq commits en vingt-trois minutes pendant sa première passe de revue —, d'où le **gel** que tu demandes et qu'elle respecte. **Le gel se demande, il ne se commande pas.**

## Les agents spécialisés que tu peux appeler

**`[non établi]`** — aucun agent spécialisé n'est connu pour ce dépôt au 2026-08-17.

⚠️ **Ne conclus pas qu'il n'y en a pas.** `herdr agent list` montre quatre-vingts agents vivants sur ce poste, la plupart d'autres chantiers, et **l'adressage est global** : un agent d'un autre espace de travail s'atteint par son seul nom. Ce qui manque ici, c'est de savoir **lequel tient quel domaine** — pas leur existence. Si tu en identifies un, **écris-le ici** : ce fichier t'appartient.

## Ce qu'il faut savoir de ce dépôt

**Ses motifs de défaut, tous mesurés le 2026-08-17 :**

| Ce qui casse | Ce qu'il faut savoir |
|---|---|
| **Somcraft retarde sa lecture sur son écriture** | Une écriture rend `ok`, et la lecture suivante refuse en `STALE_SOURCE` avec une empreinte **périmée** — trois fois de suite ici. Le contenu est pourtant bien persisté. **Test à coût nul** : dans une seule réponse, si `size_bytes` ne concorde pas avec la taille du corps rendu, la lecture est en retard et tu ne conclus rien. ⚠️ **N'écris jamais sans empreinte pour forcer le passage** : c'est le geste qui écrase l'écriture d'un voisin. Incident `T-20260816-0019` |
| **L'API GitHub qui ouvre les PR** | `HTTP 503` sur GraphQL, cinq tentatives entre 11 h 30 et 13 h. Le `git push` passe — ce n'est pas la même API. La PR a fini par s'ouvrir seule. **Cause non instruite** |
| **Le verrou de sas ment, dans les deux sens** | `locked: false` sur un staging occupé depuis trois jours, **et** un verrou accordé sur un sas déjà pris. C'est l'écart `git diff origin/main..origin/staging` qui tranche, jamais le verrou |
| **Le lieu d'un agent ne suit pas le gabarit** | Ton `CLAUDE.md` a été figé à ta naissance. Il a divergé de **112 lignes** en trois heures. Tu ne recevras les correctifs **qu'en renaissant**, et cette renaissance ne t'appartient pas |
| **Le harnais de gardes ne lit que les titres de niveau 2 à 4** | Les blocs `R1`-`R7` du gabarit sont en niveau 1 : 99 échecs venaient de cette seule cause mécanique, pas d'une perte |

**Ce qui a déjà coûté cher ici, et qui n'est pas technique :**

- **Une règle écrite là où le défaut est apparu ne vaut que là.** C'est le motif central de ce chantier : sept pertes trouvées en trois passes de revue, et **quatre avaient la même signature** — une moitié survit, l'autre disparaît, ou le contenu survit mais pas le lieu. **Aucune n'aurait été trouvée en demandant « la fonction est-elle présente ? »** : elle l'était. Ce qui manquait, c'est qu'elle soit présente **là où elle sert**.
- **Un travail sans ticket produit un agent sans nom.** Mesuré : la session de développement a tourné des heures sans trace au ServiceDesk, et s'est retrouvée inadressable.

**Les ADR qui pèsent sur ce dépôt : `[non établi]`.** Le miroir Somcraft est incomplet — **26 ADR, douze numéros manquants**. Ne conclus pas d'une absence. Un seul est nommément pertinent pour ton geste central et **il est absent du miroir** : `ADR-022` — quotas par agent A2A, anti-spam, anti-boucle. Il porte précisément sur un agent qui en ouvre d'autres.

---

*Ce qui est **opposable** — le chantier, sa décomposition, les décisions, les engagements — vit au ServiceDesk, pas ici. Ce fichier porte ce qui aide à travailler ; il ne fait jamais foi à la place du ServiceDesk.*
