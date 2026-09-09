# Un métier qui consolide l'amélioration continue des autres métiers

> **Demande** : `D-20260908-0007` (Somtech Pack) · **Premier agent de ce métier** : `koksoak`
> **Rendu le** : 2026-09-08 · **Révisé le** : 2026-09-08 (§5, §6.4, §10 — voir §12)
> **Arbitrages du dirigeant** : tous rendus le 2026-09-08, cités en §8
> **Cadre opposable** : [ADR-040](../../../../architecture/adr/ADR-040-metier-des-agents-abc-source-rendu.md) (l'ABC est la source, le métier est un rendu) · [STD-036](../../../../architecture/standards/STD-036-gestion-agent-brief-canonique.md) (format de l'ABC) · [STD-041](../../../../architecture/standards/STD-041-processus-abc-vers-agent.md) (ABC → agent) · [veille outillage agents du 2026-09-08](../../../../architecture/docs/metier-agents/2026-09-08-veille-outillage-agents.md) (discipline d'écriture)

---

## 1 — Le défaut, mesuré

`metier/chapitres/rondes.md` §5 prescrit à chaque orchestrateur :

> « Relève les zones d'amélioration de l'orchestrateur et inscris-les dans un **epic à ton nom** sous la demande-ServiceDesk prévue. »

**Trois réceptacles ont été ouverts le 2026-09-08** — `D-20260908-0004` (transverse, Somcraft), `D-20260908-0005` (matane2), `D-20260908-0006` (mingan) — sur **trois applications différentes**, avec des titres libres. Ils ont été ouverts le jour même où quelqu'un est venu nommer la section 5 ; avant ça, la prescription tournait à vide depuis l'origine.

Deux choses manquent encore, et la seconde est celle qui coûte :

1. **Personne ne relit ces réceptacles.** Aucun geste ne consolide ce que plusieurs agents ont trouvé séparément, ne juge ce qui vaut un amendement de métier, ni ne referme un billet une fois son constat repris.
2. **Rien ne les rend trouvables.** Le métier désigne « *la* demande prévue » au singulier défini, alors qu'il y en a une par chantier, sur des applications différentes. Un agent qui voudrait toutes les visiter devrait deviner.

> ⚠️ **C'est le même mode de panne que celui qui a fait ouvrir `D-20260908-0004`, décalé d'un cran** : une prescription dont le réceptacle n'existe pas produit du silence, jamais une erreur. Un réceptacle qu'on remplit et que personne ne vide produit exactement le même silence — il a l'air vivant parce que rien ne s'en plaint.

## 2 — Ce qu'on construit, et ce qu'on ne construit pas

**Un troisième métier d'agent**, à côté de `orchestrateur` et `gestionnaire-client`.

Il ne mène aucun chantier, n'ouvre aucun chef d'équipe, ne régule aucune mise en production, ne parle à aucun client. Il fait **un tour par jour** et rend un dossier.

**Il propose et il refuse ; il n'adopte jamais.** Amender le corpus d'un métier reste une décision du dirigeant. C'est déjà la règle du workflow qu'il appelle (`cycle-amelioration-metier` : « la machine propose et refuse, elle n'adopte jamais »), et elle ne bouge pas d'un pouce ici.

**Hors scope, nommément** : écrire dans le corpus d'un métier · décider d'un amendement · toucher au produit, à la dette technique ou aux chantiers eux-mêmes · créer les réceptacles à la place des agents qui les remplissent.

## 3 — Pourquoi un métier neuf plutôt qu'un orchestrateur détourné

Le corpus de l'orchestrateur **promet ce que ce rôle ne fait pas** : mener un chantier jusqu'en production, ouvrir et fermer des chefs d'équipe un à un, réguler le sas de livraison, être le seul à parler au CTO sur *son* chantier. Un agent né sous ce corpus porterait des règles qu'il ne peut ni appliquer ni violer — et un texte dont la moitié ne mord jamais apprend à son lecteur que le reste est facultatif.

**Le coût est faible, et le dépôt l'a déjà tranché.** `ligne-directe/src/roles.js`, verbatim :

> « Les deux rôles ne diffèrent QUE par ce tableau. Tout le reste — les gardes, le point d'écriture unique, le retrait de ce qui a été commencé, l'attente avant de nommer, la vérification par le fait — est le même code, appelé deux fois. » · « **Ajouter un rôle, c'est ajouter une ligne — jamais un module.** »

On ajoute donc une ligne, un dossier de gabarits, et une compétence de pose. Le corps qui pose, garde et refuse est appelé une **troisième** fois, inchangé.

## 4 — Le nom

| Ce qu'on nomme | Nom | Pourquoi |
|---|---|---|
| Le **métier** | `curateur-metiers` | Nommé par sa fonction, comme `orchestrateur` et `gestionnaire-client`. « Curateur » est déjà le vocabulaire Somtech pour qui tient un modèle vivant à jour (`ing-curateur-architecture`, STD-031). |
| Le **premier agent** | `koksoak` | Une rivière, comme `mingan` et `matane2`. La Koksoak naît de la confluence de deux autres rivières : elle ne fait que ramasser ce qui descend d'ailleurs. Forme herdr valide (7 caractères, minuscules). |

La rivière nomme l'agent, jamais le métier — c'est déjà la pratique : `mingan` et `matane2` sont des **orchestrateurs**.

## 5 — L'ABC d'abord, le gabarit ensuite

**Un métier ne s'écrit pas à la main.** [ADR-040](../../../../architecture/adr/ADR-040-metier-des-agents-abc-source-rendu.md) D3 et STD-041 §2.1 : le `CLAUDE.md` d'un agent et ses chapitres sont des **produits de construction**, rendus depuis l'**ABC** — le BRD de l'agent. `INV-ABC-2` pose que l'ABC **précède** le code.

Rien n'est construit à ce jour : l'ABC passe donc simplement en tête du lot, et aucune reprise rétroactive n'est nécessaire.

### 5.1 — L'ABC du curateur

Source canonique, dans Somcraft, au workspace du Département IA propriétaire :

```
/departement-ia/agents/curateur-metiers/agent-brief-curateur-metiers.md
```

Format STD-036 §2.2, onze sections. Les quatre qui portent le fond de ce design :

| Section | Ce qu'elle reçoit d'ici |
|---|---|
| **§1 Mission** | Consolider ce que les métiers d'agents ont appris, en amendements d'ABC recevables, et le rendre au dirigeant |
| **§3 Responsabilités** | Les cinq gestes du tour (§6), un `R#` chacun |
| **§6 Garde-fous** | Ce qui suit se classe ici, avec sa couche : la fermeture qui cite sa cible (§6.4), le tour qui doit alléger (§6.4bis), l'interdiction d'écrire dans le corpus d'un autre métier |
| **§8 Hors-scope** | Ce que §2 nomme déjà : adopter un amendement, toucher au produit, créer les réceptacles à la place des agents |

> ⚠️ **Règle de refus de STD-041, applicable au rendu** : *« Le rendu est refusé si un garde-fou n'atterrit qu'en persona. »* Un `CLAUDE.md` **est** de la persona. Chaque `GF` de cet ABC porte donc sa couche — capacité retirée, code, configuration ou outil — et celui qui n'en trouve aucune est nommé comme tel plutôt que réputé tenu.

### 5.2 — Ce que le lot écrit ensuite

```
<dépôt>/
└── .curateur/
    └── koksoak/
        ├── CLAUDE.md               ← RENDU depuis l'ABC — ni écrit ni édité à la main
        ├── CONTEXTE.md             ← sa portée, à qui il répond — à la main, jamais écrasé
        ├── RONDE.md                ← le briefing qu'il pose en /loop — à la main, jamais écrasé
        ├── .mcp.json               ← le ServiceDesk et Somcraft
        └── .claude/settings.json   ← ses droits et ses refus
```

| Fichier à écrire | Nature du travail |
|---|---|
| L'**ABC** (Somcraft) | **Premier geste du lot.** Rien d'autre ne commence avant lui |
| `.claude/templates/curateur-metiers/` | le **rendu** de l'ABC, plus `CONTEXTE.md` et `RONDE.md` à chevrons, `.mcp.json`, `.claude/settings.json` |
| `ligne-directe/src/roles.js` | **une entrée** `curateur` : `dossier: '.curateur'`, `gabarits: 'curateur-metiers'`, `nature: 'interne'`, une ligne au chantier libre, les en-têtes de reconnaissance |
| `.claude/skills/curateur-metiers/SKILL.md` | la compétence de pose — décalquée de `/orchestrateur`, sans le chapitre « chefs d'équipe ». **Son libellé décide de son déclenchement**, jamais son corps (veille, prise 1 levier 1) |
| `ligne-directe/bin/ligne-directe.js` | un verbe `curateur <nom>`, jumeau de `orchestrateur` |
| `~/.somtech/gardes/sous-agent-decision.js` | **`ROLES_GARDES`** : y inscrire `curateur` — voir §9, c'est le piège qui le ferait naître infirme |
| `.claude/templates/orchestrateur/metier/chapitres/rondes.md` §5 | l'amendement qui rend les réceptacles trouvables (§7). ⚠️ **Ce fichier est lui-même un rendu** : l'amendement passe par l'ABC de l'orchestrateur, jamais par une édition directe |
| `.claude/skills/orchestrateur/SKILL.md` | corriger l'affirmation périmée sur les sous-agents (§9) |

### 5.3 — Comment ce texte se rédige

La [veille du 2026-09-08](../../../../architecture/docs/metier-agents/2026-09-08-veille-outillage-agents.md) donne les leviers, et ADR-040 mesure ce qu'ils réparent : le métier de l'orchestrateur pèse ≈ 33 000 tokens chargés en permanence et porte **146 interdits sans priorité déclarée**. Trois leviers s'appliquent au rendu de ce métier-ci :

- **Formulation positive.** On énonce le comportement visé, de sorte que celui qu'on écarte n'est jamais prononcé. Une prohibition ne survit que comme garde-fou dur, et elle s'accompagne alors de sa cible positive.
- **Échelle d'information.** Ce dont toute branche a besoin reste dans le socle ; ce qu'une seule branche atteint descend derrière un pointeur.
- **Critère de complétion net.** Chaque geste du tour se termine sur une condition qui distingue fait de pas-fait — une borne floue produit une complétion prématurée.

## 6 — Son métier — le tour quotidien

**Un seul tour par jour**, posé en `/loop` à sa naissance comme celui d'un orchestrateur. Cinq gestes, dans cet ordre.

### 6.1 — Inventorier

Il liste les demandes **toutes applications confondues** et retient celles dont le titre porte le préfixe normalisé (§7). Pour chacune, il liste les epics, et sous chaque epic les stories.

**Il ne conclut jamais d'une absence** : « aucun réceptacle relevé sur cette passe » n'est pas « il n'y en a pas ». La distinction est celle de `RA-ORC-004`, et elle vaut ici pour la même raison.

### 6.2 — Lire

Il lit les stories **dans les mots de leur source**, jamais reformulées de mémoire. Ce qu'il retient de chacune : la **classe qui se rejoue** (jamais le compte des occurrences), la **mesure qui l'a établie** avec sa date, et le **geste** que la leçon appelle.

> Une leçon qui commence par « faire attention à » n'est pas finie : c'est la version faible d'une règle qui demande une commande. Il le dit plutôt que de la porter au dossier telle quelle.

### 6.3 — Faire mesurer

Il appelle le workflow **`cycle-amelioration-metier`**, qui existe déjà et qui fait exactement ce travail : recevabilité (ce que la machine *peut* trancher — coût en tokens du socle, couche qui pourrait le garantir, retrait exigé en compensation) puis contradiction (ce qui, dans la source elle-même, réfute la proposition ; ce qu'un item d'ABC dit déjà ; si l'amendement porte sur une **fonction** ou seulement sur le geste où le défaut est apparu).

**Il ne réécrit pas ce travail.** Deux copies d'un même jugement divergent — le dépôt l'a déjà payé une fois.

⚠️ **Le workflow doit être étendu** : il ne lit aujourd'hui que les tickets de l'application « Somtech Pack », et n'accepte que les rôles `orchestrateur` et `gestionnaire-client`. Il devra lire les réceptacles inventoriés en 6.1, quelle que soit leur application, et accepter `curateur` parmi les rôles.

### 6.4 — Consolider en amendement d'ABC

**Le dossier n'est pas une liste d'améliorations : c'est un amendement d'ABC.** [ADR-040](../../../../architecture/adr/ADR-040-metier-des-agents-abc-source-rendu.md) D2 : toute modification d'un métier exige d'ajuster son ABC d'abord — une règle de métier qui ne se rattache à aucun item d'ABC est une violation au même titre qu'un manifeste d'architecture périmé.

Chaque amélioration consolidée est donc rendue **au grain de l'item** : l'ABC visé, l'item concerné (`R#.#`, `TOOL-…`, `RA-…`, `GF-…`, `MEM-…`, `HS-…`) ou la mention qu'il est neuf, l'**issue** — `adopter`, `fusionner`, `retirer` — et pour un garde-fou, la **couche** qui le porterait. C'est déjà le vocabulaire du workflow appelé en 6.3 : les deux se rejoignent sans traduction.

Le dossier porte aussi, pour chaque amélioration : sa **classe**, **toutes** ses sources (une classe qui se rejoue chez deux agents pèse plus que la même vue une fois), le verdict de recevabilité et le verdict de contradiction.

### 6.4bis — Un tour doit alléger, et c'est mécanique

> ADR-040 vise ce chantier nommément : appliqué à l'état actuel, un dispositif qui « juge son exécution et propose des améliorations » **industrialise la production de règles dans un texte qui n'a qu'une entrée et aucune sortie**.

**Deux des trois issues allègent.** Un tour dont toutes les propositions portent l'issue `adopter` est **refusé** — il repart chercher ce qui peut sortir. Ce n'est pas une consigne de vigilance : c'est une condition, et elle est portée par un banc (§10), pas par le texte du métier.

Ajouter est naturel ; retirer ne l'est jamais. C'est pour ça que la garantie ne peut pas vivre dans la persona.

### 6.4ter — Fermer en citant où le constat a atterri

**Dans le même geste que le dossier** : chaque story dont le constat est repris passe `completed`, avec un commentaire qui **cite l'endroit exact** où il a atterri — le dossier, et l'item d'ABC visé.

Une story **non** reprise **reste ouverte, avec le motif écrit**. C'est la moitié qui empêche la fermeture de servir de ménage, et c'est elle que le banc de §10 tient.

### 6.5 — Le topo, sur sa ligne

Quatre lignes, pas un journal : **ce qui a été consolidé** · **les amendements qui tiennent** · **ceux qui sont tombés, et sur quoi** · `J'ai besoin de toi : …` en dernière ligne, `rien.` compris.

**Un tour qui ne trouve rien est un résultat**, et il se dit. Un dispositif qui trouve toujours quelque chose cesse d'être lu.

### 6.6 — Sa condition de fin

**Son tour ne se termine pas tant que ce qu'il a trouvé n'est pas écrit au ServiceDesk.** Reprise mot pour mot de la ronde de l'orchestrateur, et pour la même raison : un constat qui meurt avec la session n'a existé pour personne, pas même pour celui qui l'a fait.

## 7 — L'amendement qui rend les réceptacles trouvables

**Ce qui a été écarté, et pourquoi** : un **tag** ServiceDesk avait été proposé et retenu. Vérification faite, les tags ne s'appliquent qu'aux **tickets**, jamais aux epics, et **aucune commande de liste ne filtre par tag**. Le tag ne rendait donc rien trouvable — il aurait fallu lister puis interroger chaque ticket un à un.

**Ce qu'on retient** : un **préfixe de titre normalisé sur la demande**, `[AMELIORATION-METIER]`. La liste des demandes se lit toutes applications confondues et rend les titres : le filtre est un test de chaîne, sans un seul appel de plus. C'est la convention déjà en vigueur (`[FEAT]`, `[FIX]`, `[DEBT]`, `[STD-XXX]`), et elle a l'avantage qu'un humain qui balaie le registre voit le marqueur aussi.

`rondes.md` §5 devient donc prescriptif sur **trois** points au lieu d'un : ouvrir la demande **si elle n'existe pas** (le singulier défini d'aujourd'hui suppose un réceptacle qui n'existait pas), la titrer avec le préfixe, y ouvrir l'epic à son nom.

**Les trois demandes déjà ouvertes seront renommées** pour porter le préfixe — sans quoi le premier tour ne les verrait pas.

⚠️ **Et l'amendement passe par l'ABC de l'orchestrateur, pas par une édition de `rondes.md`.** Ce chapitre est un rendu (ADR-040 D3) : le corriger directement rejouerait, dans le lot qui installe la discipline, très exactement le défaut qu'elle répare.

## 8 — Les arbitrages rendus (2026-09-08)

| Question | Arbitrage |
|---|---|
| Forme | **Métier neuf**, qui s'appuie sur le workflow existant plutôt que de le réécrire |
| Portée | **Tous les métiers d'agents** — orchestrateurs et représentants, toutes applications |
| Fermeture | **À la consolidation**, en citant où le constat a atterri — pas après l'arbitrage du dirigeant |
| Rendu | **Sa ligne directe** |
| Réceptacles | Marqueur mécanique **imposé en amendant `rondes.md` §5** (forme : préfixe de titre, cf. §7) |
| Nom | Métier `curateur-metiers` · agent `koksoak` |

## 9 — Deux choses fausses dans l'existant, trouvées en concevant

**a) La doc de `/orchestrateur` est périmée sur les sous-agents.** Elle affirme encore : « ce qu'il ne peut PAS : écrire un fichier, ouvrir un sous-agent — refusé, pas seulement non autorisé ». C'est faux depuis `D-20260826-0010` : `Task` a quitté `permissions.deny`, et la garde `sous-agent` laisse passer les types dont l'outillage exclut l'écriture (`Explore`, `Plan`) en refusant tous les autres. À corriger dans ce lot.

**b) Et c'est le piège qui ferait naître le curateur infirme.** Cette garde ne décide que pour les rôles qu'elle connaît :

```js
export const ROLES_GARDES = new Set(['orchestrateur']);
```

Le fil qui l'appelle dans `settings.json` **refuse par défaut** quand la garde ne rend aucun verdict — délibérément (« un garde absent ne vaut jamais un garde permissif »). Un rôle absent de cet ensemble se voit donc **tout refuser**, y compris l'analyse en lecture seule dont son tour dépend. Il naîtrait détecté, nommé, au bon endroit, et incapable de faire son travail — sans qu'aucune erreur ne le dise avant le premier tour.

⚠️ **Question ouverte à trancher par la mesure, pas par la lecture** : l'outil `Workflow` passe-t-il par le matcher `Task` ? S'il a son propre chemin, il faudra soit l'ajouter aux droits accordés, soit lui donner sa propre garde. **À mesurer sur un lieu posé avant de déclarer le métier vivant** — c'est exactement la forme de défaut que ce dépôt paie le plus cher : une fonction inerte derrière une pose verte.

## 10 — Ce qui garantit que ça tient

Le dépôt éprouve ses rôles par ce qu'ils **empêchent**, jamais par ce qu'ils affichent (`ligne-directe/tests/`). Le troisième rôle hérite des bancs existants, qui deviennent paramétrés par rôle plutôt que dupliqués :

- un lieu **partiel** est refusé, et le répertoire n'existe pas après le refus ;
- un `.claude/settings.json` **non versionnable** est refusé ;
- un lieu est reconnu **par ses en-têtes**, pas par son nom de dossier ;
- un gabarit **périmé** par rapport au pack est refusé, comparé par empreinte.

**Trois bancs neufs**, qui rougissent sur des défauts que rien d'existant n'attrape :

1. **Une story fermée sans citer où son constat a atterri fait rougir.** C'est la seule garantie qui distingue « consolider » de « faire du ménage », et aucune couche ne la porte aujourd'hui.
2. **Un tour dont toutes les issues sont `adopter` est refusé** (§6.4bis). Sans banc, cette règle vit en persona — donc elle incline sans garantir, et c'est exactement ce qu'ADR-040 annonce comme mode de panne de ce chantier.
3. **Un rôle absent de `ROLES_GARDES` fait rougir**, sur le rôle lui-même et non sur une liste recopiée dans le test. Sans ça, §9b se rejoue au prochain rôle ajouté — et se rejoue en silence.

**Et un gate sur le rendu**, hérité de STD-041 §2.6 : un garde-fou de l'ABC qui n'atterrit qu'en **persona** fait refuser le rendu. Le classement par couche est un artefact versionné (`D1`), pas une inférence — il se relit, il ne se devine pas.

## 11 — Ce qu'il faut savoir avant de commencer

**Le dépôt est occupé.** La branche courante (`chore/orchestrateur-j-20260814-0002`) porte 76 commits d'avance sur `main` et **71 entrées non commitées**, dont les gabarits des deux métiers existants. Deux orchestrateurs vivent ici (`.orchestrateur/j-20260814-0002`, `.orchestrateur/p-20260819-0001`).

**Ce lot ne doit donc pas naître dans cet arbre de travail.** Il se démarre dans une session propre (`claude-swt`), sur une branche `feat/D-20260908-0007-metier-curateur-metiers` tirée de `origin/main`. Ce document est le seul fichier déposé ici, et il n'en touche aucun autre.

## 12 — Ce que la révision du 2026-09-08 a changé

Le premier rendu de ce document ignorait [ADR-040](../../../../architecture/adr/ADR-040-metier-des-agents-abc-source-rendu.md), lu après coup sur indication du dirigeant. Trois corrections, aucune ne touche aux arbitrages de §8 :

| § | Avant | Après |
|---|---|---|
| **5** | Le corpus du métier s'écrivait à la main dans `.claude/templates/` | L'**ABC** est écrit d'abord, dans Somcraft ; le gabarit du pack en est le **rendu**. `INV-ABC-2` : l'ABC précède le code |
| **6.4** | Le dossier listait des « améliorations » | Le dossier est un **amendement d'ABC**, au grain de l'item, avec sa couche pour un garde-fou (D2) |
| **6.4bis / 10** | « deux des trois issues allègent » était une consigne du texte | C'est une **condition portée par un banc** : un tour qui n'allège rien est refusé |

**Et une réserve levée** : rien n'étant construit, l'ABC ne se rattrape pas rétroactivement — il passe en tête du lot. La reprise rétroactive concerne les métiers **existants**, écrits à la main, et ADR-040 la porte déjà.
