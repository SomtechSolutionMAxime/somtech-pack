# Correspondance métier → ABC de l'orchestrateur

> Artefact de la **phase 1** du projet `P-20260820-0001`, epic `E-20260820-0005`.
> Il répond à une seule question, section par section : **de quel item de l'ABC cette règle dérive-t-elle ?**
> Et devant l'absence de réponse, il tranche entre **créer l'item** et **constater que la règle n'avait pas lieu d'être**.

## Méthode — et ce qu'elle ne prouve pas

**Objet mesuré** : `.claude/templates/orchestrateur/CLAUDE.md`, empreinte `bcaa169289ce`, identique au gabarit installé sur le poste (vérifié par `shasum`, les deux termes concordent). L'ABC : Somcraft `88eb7d88-f013-4527-a8d6-057cbcad626b`, empreinte `ee815181a780d5b6`.

**Unité d'appariement** : la **section** (`#`, `##`, `###` hors blocs de code) — 88 au total. C'est le grain auquel le métier est écrit ; découper plus fin ferait apparaître des règles que personne n'a écrites comme telles.

**Trois verdicts, et un seul par section :**

| Verdict | Ce qu'il dit |
|---|---|
| **COUVERT** | la section est du *comment* — elle dérive d'un item existant, qu'elle nomme ou non |
| **À CRÉER** | la section porte une règle **qu'aucun item ne dit** : elle remonte vers l'ABC |
| **RETRAIT** | la section n'a pas lieu d'être dans le métier — récit, doublon, ou contenu qui appartient à un autre texte |

⚠️ **Ce que cette table ne prouve pas.** L'appariement est un **jugement de lecture**, pas une mesure : deux lecteurs peuvent classer différemment une section frontière. Ce qui est vérifiable et l'a été, c'est l'inverse — qu'un item cité **existe** et dit bien ce qu'on lui fait dire. Aucun verdict COUVERT ne repose sur un item qui n'a pas été relu dans l'ABC.

## Les mesures de départ, refaites

| | Mesure | Méthode |
|---|---|---|
| volume du métier | **1 515 lignes · 25 283 mots · 146 349 o** | `wc` |
| dont prose | **1 404 lignes (93 %)** | 112 lignes en blocs de code |
| volume de l'ABC | **424 lignes · 10 451 mots** | idem, marqueurs de bloc retirés |
| **rapport métier ÷ ABC** | **2,42×** | 25 283 ÷ 10 451 |
| interdits | **146** = 120 `jamais` + 26 `tu ne … pas/jamais` | comptage de l'architecte, rejoué à l'identique sur le même fichier |
| statuts de l'ABC | **95 `proposed` · 20 `accepted` · 4 `in_force` · 39 `draft` · 1 `deprecated`** | comptage d'occurrences |

**Et le constat qui porte, qui ne dépend d'aucun motif de comptage** : sur **8** occurrences d'un vocabulaire de préséance dans le métier, **aucune ne déclare qu'une règle de conduite prime sur une autre**. Deux portent sur des *documents* (l'ABC contre le métier), une sur les *permissions techniques*, une sur *corpus contre invention*, une sur deux *mécanismes*, une sur un *ordre temporel* de statuts — et **deux nient explicitement être une préséance**. Les 146 interdits sont donc de rang strictement égal.

> C'est ce constat, et non le chiffre 146, qui justifie les sept règles cardinales. Un compte d'occurrences surcompte (un `jamais` explicatif n'est pas un interdit) et sous-compte (un interdit sans `jamais` lui échappe) ; l'absence de hiérarchie, elle, se vérifie en cherchant une phrase qui n'existe pas.

---

## La table

### Préambule — 3 100 mots

| # | Section du métier | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 1 | Tu es l'orchestrateur de ce chantier | 608 | §2 Persona · RA-ORC-001 · RA-ORC-002 · GF-ORC-006 · MEM-ORC-003 | **COUVERT** |
| 1b | ⤷ *l'ordre de préséance des trois textes* | — | **aucun** | **À CRÉER** — l'ABC ne dit nulle part qu'il fait foi sur le métier |
| 2 | Qui tu soutiens, et ce que ça change à ton ton | 203 | §1 Mission · MEM-ORC-001 | **COUVERT** |
| 2b | ⤷ *« tu parles la langue de Somtech »* — `ServiceDesk`, jamais « registre » | — | **aucun** | **À CRÉER** |
| 3 | Tu écris à un technique | 106 | RA-ORC-001 | **COUVERT** |
| 4 | Devant l'incertitude | 48 | §2 Persona · RA-ORC-004 | **COUVERT** |
| 5 | Trois formes de chantier | 102 | R1.1 · R2.5 | **COUVERT** |
| 6 | La ronde — ce qui te réveille | 706 | §La ronde (loop) · R5.9 · RA-ORC-015 · TOOL-ORC-009 · MEM-ORC-008 | **COUVERT** |
| 6b | ⤷ *le prompt de la `/loop` porte le briefing, et **se repose** quand son contenu change* | — | **aucun** | **À CRÉER** — le seul support de continuité qui n'exige aucune discipline |
| 7 | Ce que tu ne peux pas faire | 535 | GF-ORC-001 · GF-ORC-002 | **COUVERT** |
| 7b | ⤷ *mécanique des couches : un refus l'emporte, une autorisation est ignorée avant approbation* | — | STD-047 §2.1 | **RETRAIT** — appartient au standard, pas au métier d'un rôle |
| 8 | Ce que tu ne fais pas de tes mains | 326 | GF-ORC-001 (les quatre gestes y sont nommés) | **COUVERT** |
| 9 | Tes réflexes — les biais qui te visent, toi | 1 019 | GF-ORC-008 · RA-ORC-003 · RA-ORC-004 · GF-COM-006 | **COUVERT** en partie |
| 9b | ⤷ *un dispositif — hook, `/goal`, rappel — **n'est pas une personne*** | — | **aucun** | **À CRÉER** |
| 9c | ⤷ *une **inférence** rendue comme citation* | — | **aucun** | **À CRÉER** |
| 9d | ⤷ *la complaisance **ascendante** — celui qui reçoit se tait quand son supérieur se trompe en sa faveur* | — | **aucun** | **À CRÉER** |
| 9e | ⤷ *tu ne t'évalues pas toi-même — une conclusion vaut ce que vaut ce qui l'atteste* | — | **aucun** | **À CRÉER** |
| 10 | Tu relis **après** ton propre geste | 338 | **aucun** — RA-ORC-003 porte sur le fait qu'on vérifie *avant* | **À CRÉER** |
| 11 | Et tu relis pour la **cohérence** | 353 | **aucun** | **À CRÉER** — « qu'est-ce que je viens d'écrire qui rend ma conclusion fausse ? » |
| 12 | Une règle vaut pour sa **fonction** | 310 | RA-ORC-009 | **COUVERT** |
| 13 | Les trois niveaux | 278 | R3.1 · GF-ORC-002 · §Conventions | **COUVERT** |
| 13b | ⤷ *le niveau se lit dans le **rôle**, jamais dans un seuil* + le récit du seuil inventé | — | **aucun** / récit | **À CRÉER** (la règle) · **RETRAIT** (le récit) |
| 14 | Combien de chefs d'équipe ouvrir | 129 | R2.3 en partie | **À CRÉER** — le nombre suit les **périmètres réellement indépendants** |

### R1 — Tenir le ServiceDesk — 1 418 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 15 | Ce qui vient de lui s'ouvre en Demande | 221 | R1.1 · RA-ORC-005 | **COUVERT** |
| 16 | Ton backlog, ce sont les DEMANDES | 41 | R1.2 | **COUVERT** |
| 17 | Le statut change au moment où l'état change | 336 | R1.3 · RA-ORC-006 | **COUVERT** |
| 17b | ⤷ *les **trois** formes ont un geste d'entrée* — Projet : deux transitions ; Livraison : tout à la main | — | **aucun** — R1.3 ne nomme que la Demande | **À CRÉER** |
| 18 | Inscrire vient avant tenir à jour | 323 | R1.4 | **COUVERT** |
| 18b | ⤷ *la polarité : ce qui n'est **pas** au ServiceDesk **n'existe pas*** | — | **aucun** | **À CRÉER** |
| 19 | La filiation — au moment où tu ouvres | 227 | R1.5 · MEM-ORC-002 | **COUVERT** |
| 20 | L'hygiène du ServiceDesk | 270 | R1.6 | **COUVERT** |
| 20b | ⤷ *le compte rendu d'avancement est **une surface de sa parole**, comme la ligne* | — | **aucun** — déductible de RA-ORC-009, jamais écrit | **À CRÉER** |

### R2 — Cadrer et concevoir — 1 224 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 21 | Ce que tu lis avant de découper | 298 | R2.1 | **COUVERT** |
| 22 | Découper par valeur pour l'utilisateur | 208 | R2.3 · R2.5 | **COUVERT** |
| 23 | Dimensionner — la règle qui décide de tout | 344 | R2.3 · RA-ORC-007 | **COUVERT** |
| 23b | ⤷ 🔴 *le **renversement** : pour lui, le compact devient une hygiène qu'il déclenche* | — | **contredit RA-ORC-007 tel qu'écrit** | **À CRÉER** — l'ABC dit « aucun agent ne doit avoir besoin de compacter, **l'orchestrateur compris** » ; le métier dit l'inverse pour lui depuis que son état vit dehors |
| 24 | Concevoir — avant d'envoyer construire | 236 | R2.2 | **COUVERT** |
| 25 | Chercher avant d'inventer | 138 | R2.4 · RA-ORC-008 · RA-ORC-013 | **COUVERT** |

### R3 — Faire naître, mener et fermer — 3 578 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 26 | Le nom d'un chef d'équipe vient du mandat | 111 | RA-ORC-010 | **COUVERT** |
| 27 | ⚠️ Et **toi**, tu portes un nom de **rivière** | 545 | **aucun** — RA-ORC-010 dit « un nom vient du mandat », sans exception | **À CRÉER** |
| 28 | Déclarer le modèle — toujours | 323 | R3.2 | **COUVERT** |
| 29 | Écrire le brief au ServiceDesk | 481 | R3.3 · R4.1 | **COUVERT** |
| 30 | Faire naître — l'espace avant l'agent | 253 | R3.2 | **COUVERT** |
| 31 | Livrer le brief — et vérifier qu'il a été **pris** | 477 | R3.4 · TOOL-ORC-004 | **COUVERT** |
| 32 | Poser son but — obligatoire | 408 | R3.5 | **COUVERT** |
| 32b | ⤷ *les conditions de fin vivent **aux deux endroits** — le but ET les critères de succès* | — | **aucun** | **À CRÉER** |
| 32c | ⤷ *un arbitrage qui contredit un but déjà posé **corrige le but dans le même geste*** | — | **aucun** | **À CRÉER** |
| 33 | 🔴 Un texte grisé n'est pas un texte saisi | 517 | mécanique d'outil | **RETRAIT** vers le chapitre L2 — sauf les **trois conditions** du geste de soumission, qui sont une règle → **À CRÉER** |
| 34 | Poser la veille de déblocage | 523 | R3.6 · TOOL-ORC-007 | **COUVERT** |
| 34b | ⤷ *une garde se juge sur **deux** chiffres : ce qu'elle attrape et ce qu'elle refuse à tort* | — | **aucun** | **À CRÉER** — règle générale, réemployée quatre fois dans le métier |
| 35 | Exiger le suivi actif | 170 | R3.6 | **COUVERT** |
| 36 | Sous-agent ou coéquipier | 90 | GF-ORC-002 **le lui interdit** | **RETRAIT** — décrit un choix qui n'est pas le sien ; sa place est le brief du chef d'équipe |
| 37 | Fermer proprement — les trois choses | 330 | R3.7 | **COUVERT** |
| 38 | Mettre à jour un agent vivant | 153 | R3.8 · HS-ORC-006 · HS-ORC-009 | **COUVERT** |
| 38b | ⤷ *tu ne refermes **pas** ta ligne en renaissant* | — | **aucun** | **À CRÉER** |

### R4 — Faire appliquer et valider — 1 990 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 39 | Tu es le gardien des ADR | 458 | R4.1 · R4.5 · TOOL-ORC-002 | **COUVERT** |
| 40 | Connaître le corpus | 75 | R4.7 · R5.8 · MEM-ORC-007 | **COUVERT** |
| 41 | Exiger deux passes de revue | 716 | R4.2 | **COUVERT** |
| 41b | ⤷ *« on teste quand il n'y a rien ; on ne teste pas quand on ne peut pas voir »* | — | **aucun** | **À CRÉER** |
| 41c | ⤷ *la **sonde dupliquée** : deux copies d'un critère divergent en silence* | — | **aucun** | **À CRÉER** |
| 42 | Exiger ce qu'un lot montre | 408 | R4.3 · GF-ORC-003 | **COUVERT** |
| 42b | ⤷ *pas d'arbitrage sur un texte qu'on n'a pas sous les yeux* | — | **aucun** | **À CRÉER** |
| 43 | Avant tout geste sur un dépôt client | 226 | R4.4 · GF-ORC-004 | **COUVERT** |
| 44 | Signaler l'écart, ne pas le trancher | 107 | R4.5 · R4.6 | **COUVERT** |
| 44b | ⤷ *une hypothèse **non prouvée** n'est pas une hypothèse **fausse*** | — | **aucun** | **À CRÉER** |

### R5 — Les rondes — 2 651 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 45 | 1 — Tes agents et le travail qui tourne | 1 181 | R5.1 | **COUVERT** |
| 45b | ⤷ *les quatre états qui se ressemblent, et le protocole qui les tranche* | — | mécanique d'outil | **RETRAIT** vers L2 |
| 45c | ⤷ *`agent_not_found` est la **panne de la mesure**, jamais la mort d'un agent* | — | RA-ORC-004 l'implique sans le dire | **À CRÉER** |
| 46 | Une ronde qui observe sans agir est un journal | 126 | **aucun** | **À CRÉER** |
| 47 | 2 — Ta ligne et ta boîte de saisie | 319 | R5.2 · RA-ORC-011 | **COUVERT** |
| 47b | ⤷ *tout message non accusé appelle son `LU` **maintenant***, avant même la réponse | — | **aucun** | **À CRÉER** |
| 48 | 3 — Récolter ton propre contexte | 209 | R5.3 | **COUVERT** |
| 49 | 4 — Si rien n'avance, repars du backlog | 176 | R5.4 | **COUVERT** |
| 50 | 5 — L'amélioration continue de ton métier | 26 | R5.5 | **COUVERT** |
| 51 | 6 — Le topo du matin | 376 | R5.6 | **COUVERT** |
| 51b | ⤷ *les deux contrôles quotidiens : espaces orphelins, lignes sans personne au bout* | — | **aucun** | **À CRÉER** |
| 52 | 8 — Ce qui a changé dans le corpus | 45 | R5.8 | **COUVERT** |
| 53 | Ta ronde ne se termine pas tant que… | 57 | R5.3 · R7.5 | **COUVERT** |

### R6 — Rendre compte et arbitrer — 2 730 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 54 | Ta ligne est obligatoire | 319 | R6.1 | **COUVERT** |
| 54b | ⤷ *un représentant mandataire **partage** cette ligne — ce n'est pas une seconde* | — | **aucun** | **À CRÉER** |
| 55 | Accuser LU — et dire ce que tu commences | 575 | R6.2 | **COUVERT** |
| 55b | ⤷ 🔴 *une **réponse utile** n'est pas un `LU`* — la règle perd contre l'envie d'être utile, pas contre la négligence | — | **aucun** | **À CRÉER** — quatre violations en une journée sur un texte qui portait déjà la règle |
| 56 | Des faits, pas ton raisonnement | 482 | R6.3 · RA-ORC-001 | **COUVERT** |
| 57 | Tout message se termine par « J'ai besoin de toi : » | 189 | R6.4 | **COUVERT** |
| 58 | Mets le pane devant lui (focus) | 294 | **aucun** | **À CRÉER** |
| 59 | Ce que tu fais monter, et ce que tu tranches | 323 | R6.5 · R6.6 · RA-ORC-002 | **COUVERT** |
| 60 | Tu ne parles jamais à un client | 41 | GF-ORC-005 · HS-ORC-004 | **COUVERT** |
| 61 | Ce que tu transmets porte sa source | 69 | GF-ORC-008 | **COUVERT** |
| 62 | Coordonner les chantiers voisins | 247 | **aucun** — l'ABC ne connaît pas les pairs | **À CRÉER** |
| 63 | Tu appelles les agents spécialisés | 231 | **aucun** dans l'ABC (le BRD le porte en `EF-AGT-005`) | **À CRÉER** |

### R7 — La continuité — 1 606 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 64 | Ton état de reprise, à chaque tour de ronde | 213 | R7.1 · MEM-ORC-006 | **COUVERT** |
| 65 | Ce que tu récoltes, et où chaque chose va | 359 | R5.3 · R7.5 · MEM-ORC-006 | **COUVERT** |
| 65b | ⤷ *une conclusion démentie **se supersède**, elle ne se corrige jamais par ajout* | — | **aucun** | **À CRÉER** |
| 66 | Reprendre par la lecture, jamais par la mémoire | 96 | R7.2 · GF-ORC-011 · RA-ORC-014 | **COUVERT** |
| 67 | Relis ta ligne depuis le début | 46 | R7.3 · MEM-ORC-005 | **COUVERT** |
| 68 | Ronde sur les textes qui te documentent | 58 | R7.4 | **COUVERT** |
| 69 | Ne laisse jamais un fait vivre dans ta tête | 41 | R7.5 · RA-ORC-014 | **COUVERT** |
| 70 | Ton état, et pourquoi le compact devient une hygiène | 473 | **aucun MEM ne porte l'état de travail dans Somcraft** | **À CRÉER** — l'ABC ne connaît que l'état de reprise au ServiceDesk (MEM-ORC-006) |
| 71 | Mesure ta marge de contexte | 84 | R7.6 · MEM-ORC-008 | **COUVERT** |

### Pousser, merger, clore — 1 162 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 72 | Prérequis | 42 | §4 Outils | **COUVERT** |
| 73 | Le sas — et si la mise en ligne est occupée | 490 | 🔴 **aucun — l'ABC ne dit rien de la mise en production** | **À CRÉER** — c'est la règle cardinale n° 5, absente de l'ABC |
| 74 | Merger et fermer les statuts dans le même geste | 164 | R1.3 · RA-ORC-006 | **COUVERT** |
| 75 | Clore | 462 | R6.1 en partie | **À CRÉER** — la clôture d'un chantier, et le choix ligne durable/jetable, ne sont nulle part |

### Fin — 2 567 mots

| # | Section | Poids | Item d'ABC | Verdict |
|---|---|---|---|---|
| 76 | Tes outils | 210 | §4 TOOL-ORC-001 à 009 | **COUVERT** |
| 77 | Sur les mémoires | 353 | TOOL-ORC-008 · MEM-ORC-004 | **COUVERT** |
| 77b | ⤷ *un rappel ne fait pas foi — le **gate de promotion** est la seule porte* | — | **aucun** | **À CRÉER** |
| 78 | **Anti-patterns** | **2 004** | — | **RETRAIT** — 72 de ses 78 lignes redisent le corps. Sa forme, elle, est la **carte L1** : c'est le seul endroit du métier où toutes les règles sont visibles d'un coup d'œil |

---

## Ce que la table rend

**Chiffres calculés depuis la table elle-même** — pas estimés : chaque ligne porte son verdict, chaque section entière porte son poids en mots. Les sous-lignes `⤷` n'ont pas de poids propre : elles désignent un énoncé **à l'intérieur** d'une section déjà comptée, et le grain de la section ne permet pas de les peser séparément.

| | Lignes | Mots (sections entières) |
|---|---|---|
| **COUVERT** — du *comment*, légitime | 64 | 18 155 |
| **À CRÉER** — remonte vers l'ABC | **39 énoncés** | *non pesables au grain de la section* |
| **RETRAIT** — n'a pas lieu d'être ici | 6 | **2 611** |

**Le résultat contredit une attente du cadrage, et c'est la trouvaille de cette phase.** On attendait que l'écart de 14 000 mots soit du remplissage. Il ne l'est pas : **39 énoncés opposables n'ont aucune source dans l'ABC**, dont l'un contredit frontalement un item existant (23b), dont trois portent des règles cardinales que l'ABC ne connaît pas (le sas, la parole exclusive, la ligne obligatoire), et dont plusieurs sont les leçons les plus chères du dispositif — la complaisance ascendante, la relecture de cohérence, la garde jugée sur deux chiffres.

> **L'ABC n'était pas la source du métier : il en était un sous-ensemble.** Le métier a grossi parce qu'il était le **seul** endroit où l'on pouvait écrire — un agent a `Write` refusé, mais le pack, lui, écrit dans le gabarit. La dérive n'est pas un défaut de discipline : c'est le seul chemin qui restait ouvert.

**Ce que ça change pour la suite, et c'est mesuré.** Le retrait seul ne fait pas passer le rapport sous 1 :

| | Métier | ABC | Rapport |
|---|---|---|---|
| aujourd'hui | 25 283 | 10 451 | **2,42×** |
| après les 6 retraits | **22 672** | 10 451 | **2,17×** |
| cible du projet | — | — | **< 1,00×** |

**Le retrait déplace 0,25 sur 1,42.** C'est la **remontée** des 39 énoncés vers l'ABC qui fait le reste du chemin — l'ABC grossit d'autant, et le métier rendu ne portera plus que le *comment*. Les deux gestes sont nécessaires, et **c'est le second qui compte**.

⚠️ **Et il faut le dire maintenant plutôt qu'à l'arrivée** : un ABC qui absorbe 39 énoncés ne fera pas 10 451 mots, il en fera davantage. Le rapport « métier ÷ ABC < 1 » sera donc atteint **des deux côtés à la fois**, et il ne mesure pas la même chose qu'un métier devenu court. **Le chiffre qui mesure vraiment le but du projet est le budget de L1 — 2 500 tokens de socle permanent —, pas ce rapport.**
