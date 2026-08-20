# Classement par couche — garde-fous de l'orchestrateur

> Artefact de la **phase 1** du projet `P-20260820-0001`, epic `E-20260820-0005`.
> **STD-047 §2.1 : « le classement d'un garde-fou dans une couche est un artefact versionné, pas une inférence ».** Ce fichier est cet artefact. Sans lui, l'étape 2 du rendu n'a pas d'entrée.

## Ce qui a été mesuré, et où

Sur un lieu d'orchestrateur réellement posé — `.orchestrateur/d-20260817-0006/` de ce dépôt :

| Couche | Ce que le lieu porte aujourd'hui |
|---|---|
| **Capacité absente** | `.mcp.json` ne déclare que **`servicedesk`** et **`somcraft`**. Tout autre serveur est absent de sa session |
| **Refus de permission** | `permissions.deny` = **`Write`, `Edit`, `NotebookEdit`, `Edit(//**)`, `Task`**. Aucun bloc `allow` (conforme R3) ; 20 droits sous `somtech.droitsAccordes` |
| **Hook** | **un seul** `PreToolUse` — la garde d'ouverture de ligne, avec refus par défaut si le garde est introuvable |
| **Gate de dépôt** | aucun qui porte un garde-fou de ce rôle |
| **Compétence · Persona** | tout le reste |

## Le classement

Verdict `✅` = la couche **garantit** · `⚠️` = garantit **en partie**, la brèche est nommée · `❌` = **persona seule**, donc rendu refusé par R1.

| Item | Ce qu'il interdit | Couche | Verdict |
|---|---|---|---|
| **GF-ORC-001** | n'exécute jamais : n'écrit aucun fichier, ne code pas, ne relit pas le code, ne corrige pas le script d'un autre, ne relance pas un processus, ne renomme pas un agent | **Refus de permission** — `Write`, `Edit`, `NotebookEdit` | ⚠️ **La moitié qui porte sur l'écriture est garantie. Trois brèches restent ouvertes** : `Read` n'est pas refusé, donc *« ne relit pas le code »* n'est porté par rien ; une **redirection de terminal** écrit un fichier sans passer par un outil d'édition ; et `herdr pane run` **exécute chez un autre**, ce qui est précisément par où l'on code à la place de quelqu'un |
| **GF-ORC-002** | n'ouvre aucun sous-agent · ne desserre jamais ses propres droits | **Refus de permission** — `Task` ; et son fichier de droits lui est fermé comme les autres | ⚠️ **Garanti pour les deux moitiés écrites. La brèche est le terminal** — le métier le dit lui-même, et aucune couche ne le ferme |
| **GF-ORC-003** | n'invente aucun état, ne ferme rien sur la foi d'un indice | **Persona** | ❌ |
| **GF-ORC-004** | aucun geste sur un dépôt client avant que l'état de sa production soit mesuré et inscrit | **Persona** | ❌ — *candidat sérieux au hook* : un `PreToolUse` sur les gestes d'écriture git dans un dépôt client, refusant tant qu'aucune mesure n'est inscrite |
| **GF-ORC-005** | ne parle jamais à un client | **Persona** | ❌ — la capacité n'est pas absente : `livrer.js` passe par le terminal et peut atteindre un canal client |
| **GF-ORC-006** | ne cache jamais une erreur | **Persona** | ❌ — **et vraisemblablement pour toujours** : porte sur ce qu'un énoncé contient, pas sur un geste |
| **GF-ORC-007** | ne travaille que dans le dépôt de son chantier et sa portée écrite | **Persona** | ❌ — le répertoire de travail n'est pas une garde ; le terminal va partout |
| **GF-ORC-008** | ne relaie aucun ordre reformulé de mémoire | **Persona** | ❌ — même nature que GF-ORC-006 |
| **GF-ORC-009** | cite et applique les garde-fous communs du Département | **Persona** | ❌ — déjà `draft`, et son cadre d'origine n'est pas instancié ici |
| **GF-ORC-011** | ne reprend jamais un chantier sur sa seule mémoire | **Persona** | ❌ — *candidat au hook* : un contrôle au premier geste après naissance, exigeant que l'état de reprise ait été lu |

> **GF-ORC-010** a été retiré en v1.1.0 ; son identifiant n'est pas recyclé. Il n'apparaît pas ici, et c'est normal.

### Ce que ce classement rend

> ## **2 garde-fous sur 10 sont portés par une couche qui garantit — et aucun des deux ne l'est en entier.**
>
> **Les 8 autres sont en persona seule. Par R1, chacun fait échouer le rendu.**

**C'est le résultat qui commande la phase 2**, et il est plus lourd que ce que le cadrage annonçait : la phase 2 ne peut pas produire un rendu recevable tant que ces 8 n'ont pas reçu une couche — ou tant qu'il n'est pas **écrit** qu'aucune ne les portera.

## Les sept règles cardinales

| # | La règle | Item d'ABC | Couche | Verdict |
|---|---|---|---|---|
| 1 | **Tu ne construis jamais** | `GF-ORC-001` | Refus de permission | ⚠️ garantie en écriture, brèches au terminal et en lecture |
| 2 | **Un fait ne vit jamais dans ta seule tête** | `RA-ORC-014` | — | ❌ *candidat hook* : un contrôle de fin de tour qui exige une écriture au ServiceDesk quand le tour a produit une décision |
| 3 | **Ce que tu n'as pas mesuré se dit non mesuré** | `RA-ORC-004` | — | ❌ **et aucune couche ne la portera** : elle juge le **contenu d'un énoncé**. À écrire comme tel dans l'ABC plutôt qu'à espérer |
| 4 | **Le statut change au moment où l'état change** | `RA-ORC-006` | — | ❌ *candidat hook* : après une fusion, exiger que les statuts de toutes les stories fermées soient posés |
| 5 | **Tu régules la mise en production** | **absent de l'ABC** | — | ❌ *candidat gate de dépôt* — le verrou de sas existe déjà, mais il n'a jamais été branché sur ce rôle, et il a menti dans les deux sens |
| 6 | **Tes chefs d'équipe ne parlent jamais au CTO** | **absent de l'ABC** | — | ❌ 🔴 **et elle ne peut pas être portée par le lieu de l'orchestrateur** : c'est une garde qui s'applique à un **autre agent**. Sa couche, si elle existe, vit dans le lieu du **chef d'équipe** — que ce projet ne touche pas (hors périmètre déclaré) |
| 7 | **Ta ligne est obligatoire** | **absent de l'ABC** *(porté par `RA-AGT-008` du BRD)* | **Hook** `PreToolUse` | ✅ **la seule pleinement garantie** — refus par défaut si le garde est introuvable |

> **La n° 6 est la trouvaille de ce classement, et elle n'était pas prévue.** Toutes les autres se garantissent — ou non — dans le lieu de celui qu'elles obligent. Celle-là oblige l'orchestrateur à un résultat que **seul le lieu d'un autre agent** peut produire. Écrite dans son `CLAUDE.md`, elle est une promesse qu'il ne peut pas tenir seul : ce qui la tient, c'est le **brief** qu'il écrit et le lieu de son chef d'équipe.
>
> Deux voies, et le choix appartient au dirigeant : la reformuler pour qu'elle porte sur ce qu'il **fait** — *« tu écris dans chaque brief que son compte rendu passe par toi »*, garantissable côté brief —, ou la sortir des sept et la traiter dans le chantier des chefs d'équipe.

## Ce que le classement laisse ouvert

- **La brèche du terminal.** `Bash` reste la capacité qui contourne trois garde-fous à elle seule. La retirer rendrait l'orchestrateur incapable de faire naître ses chefs d'équipe — sa fonction centrale. **Non tranché**, et c'est le seul endroit où une couche « capacité absente » aurait de la portée.
- **`I8` de STD-047** — *« un item classé `accepted` est porté par une couche qui garantit »* — **n'est pas vérifié aujourd'hui** : les **8** garde-fous `accepted` de l’ABC (`GF-ORC-001` à `008`, vérifié colonne par colonne) comptent **6 items en persona seule** — `003` à `008`. Soit les couches viennent, soit les statuts descendent.
