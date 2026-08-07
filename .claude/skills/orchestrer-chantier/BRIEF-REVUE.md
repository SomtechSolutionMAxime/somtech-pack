# Brief de revue réutilisable — EF-AGT-001

> Ce brief porte les trois motifs de défaut mesurés sur des chantiers orchestrés.
> Il est livré tel quel aux sous-agents reviewers (Haiku passe 1, Sonnet passe 2).
> Les motifs restent valables : chacun a coûté.

---

## Motif 1 — La garde vérifie le **contenu**, pas le **fait**

**Ce qu'il a coûté** : 10 survies (6 + 4 consécutives sur un seul lot). Un refus a survécu au remplacement par son contresens exact.

**Exemple du pire cas** :
- Énoncé original : « Tu remontes au dirigeant »
- Énoncé après mutation : « Tu ne remontes rien »
- Résultat : un test qui cherchait le mot « remontes » resta vert dans les deux cas.

**Garde efficace** : résoudre par le **libellé entier** (pas mot-clé), la **position dans un tableau** (pas index), la **modalité** (pas rang seul), le **compte** d'éléments (pas présence).

---

## Motif 2 — Le double de test plus permissif que le vrai service

**Ce qu'il a coûté** : 6 survies. Une fonction **inerte en production** derrière 97 tests verts et deux revues.

**Exemple** : un mock de service externe retourne toujours le cas heureux. Le code sort avec son bug caché, la prod l'active, et personne ne le voit.

**Garde efficace** :
- Test rouge avant vert ? Introduis un bug dans le code, le test rougit-il ?
- Mock vs réel ? Vérifie qu'une fonction morte (ex: `return null`) fait rougir le test, pas rester vert.
- Deux portes ? Une vérification de présence n'économise pas une vérification d'absence.

---

## Motif 3 — Un correctif qui ne couvre qu'une porte sur deux

**Ce qu'il a coûté** : 3 survies. La moitié des chemins reste ouverte, personne n'en parle.

**Exemple** :
- Vérification ajoutée : « le prix est renseigné »
- Oubli : « le prix est supprimé si remis en cause »
- Résultat : une valeur périmée reste accessible par l'autre chemin.

**Garde efficace** :
- Un correctif ajoute quelque chose dans une table → vérifier aussi ce qui en **sort**
- Une validation ajoutée → tester aussi la suppression / annulation / rollback du même état
- Deux sens ? Résous le positif **ET** le négatif.

---

## Avant de commencer — les trois niveaux orchestration

Le code ou le texte que tu reviews prescrit-il les trois niveaux ?

| Niveau | Doit être nommé et expliqué | Exemple de défaut à chercher |
|---|---|---|
| **Orchestrateur** | « cadre, découpe, arbitre, fusionne, tient registre » | dit qu'il code, qu'il revoit lui-même, ou qu'il ouvre autre chose qu'un chef d'équipe |
| **Chef d'équipe** | « mène son unité, distribue à ses sous-agents, intègre, rend compte au seul orchestrateur » | dit qu'il ouvre un agent herdr (rôle du niveau au-dessus) |
| **Sous-agents/coéquipiers** | « écrivent, testent, reviewent » ; distingue les deux outils | confond sous-agent (jetable, `Agent(prompt)`) et coéquipier (persistant, `Agent(..., name)` + `SendMessage`) |

⚠️ **Le défaut le plus grave à chercher ici est un seuil.** Le niveau chef d'équipe **ne se justifie par aucun chiffre** : tout agent herdr qu'un orchestrateur ouvre en est un, du seul fait qu'il lancera des sous-agents. Un texte qui écrit « à partir de 2 périmètres », « au-delà de 5 agents », ou toute autre condition numérique pour *ouvrir le niveau* a réintroduit l'erreur que ce brief existe pour attraper. Le chiffre a le droit de rester pour décider **combien** d'agents ouvrir (le démarrage coûte 15-20 min) — jamais pour décider **si le niveau existe**.

Cherche aussi « tâche < 30 min » : c'est la forme légitime du critère, celle qui dit de ne pas ouvrir un agent *de plus*.

## Les trois autres prescriptions à vérifier

| Prescription | Ce que le texte doit dire | Défaut à chercher |
|---|---|---|
| **Modèle déclaré au lancement** | le modèle se déclare **toujours**, explicitement ; un lancement nu naît en Haiku et **n'hérite pas** de la session appelante ; agent herdr = Opus, **jamais** Haiku ; sous-agent = Haiku possible et utile en passe 1 | « par défaut », « si besoin », « on peut préciser » — toute forme qui rend la déclaration facultative ; ou l'affirmation que le modèle s'hérite |
| **Registre → mandat → agent** | le nom **vient du mandat** au registre (`e-…`, `d-…`, `t-…`), jamais du sujet du chantier ni d'un rôle ; le **libellé d'onglet** porte le code puis 2 à 4 mots sur ce que l'agent **fabrique** | un exemple de libellé qui nomme le domaine ou le rôle ; la confusion nom d'agent / libellé d'onglet ; un nom inventé donné en exemple sans être marqué comme fautif |
| **Les gestes qui n'appartiennent pas à l'orchestrateur** | renommer, débloquer une permission, corriger un script, relancer un processus — **les quatre**, chacun rendu au chef d'équipe | l'énumération amputée : trois gestes sur quatre, ou un geste transformé en « sauf si ça presse ». Compte-les |

---

## Sous-agent vs coéquipier — vérifier le critère

Le texte distingue-t-il les deux ? Voici comment les identifier :

- **Sous-agent** (`Agent` sans nom) : une tâche isolée (exploration, revue passe 1, vérification), pas de suite → OK, meurt après
- **Coéquipier** (`Agent` avec nom, puis `SendMessage` vers ce nom) : travail qu'on reprend (correction post-revue, lot complexe découpé) → OK, persiste

**Défaut à chercher** : le texte dit « ouvre un agent » pour du travail qu'on va reprendre, sans mentionner SendMessage pour le reprendre. Coût : perte de contexte.

---

## Revue à deux passes — vérifier les rôles

| Passe | Je suis | Ma seule mission | Verdict autorisé | Verdict interdit |
|---|---|---|---|---|
| **1 (Haiku)** | portail de rejet | rejeter rapidement les cas perdus, ou dire « rien vu » | `REJET`, `RIEN VU` | **`mergeable`** — jamais |
| **2 (Sonnet)** | revue de fond | revue complète sur du code candidat | `mergeable`, `correctifs`, `reprendre` | — |

**Défaut passe 1** : rend un verdict mitigé « peut-être mergeable si … » → non, c'est rejet ou rien.

**Défaut passe 2** : enregistre « Haiku n'a rien vu » comme une validation → non, il n'a trouvé aucun défaut *évident*, pas qu'il n'y en a pas.

---

## Mutations du cru — exigence obligatoire

**Avant de rendre ton verdict**, pose **trois mutations** de ton invention :

1. Remplace une phrase clé par son contresens — ça doit rougir
2. Retire ou modifie une garde de polarité / position / modalité — ça doit rougir
3. Crée un trou dans le motif que tu audites — ça doit rougir

Si une mutation ne fait pas rougir, tu as trouvé un faux témoin. Signale-le dans le verdict.

---

## Format du verdict

```
**PASSE 1 (Haiku) / PASSE 2 (Sonnet)**

Défauts trouvés :
- [motif 1 ou 2 ou 3 ?] : détail observable du défaut
- [motif 1 ou 2 ou 3 ?] : détail observable du défaut

Mutations posées :
- mutation 1 : [ce que tu as changé → a rougi / est resté vert]
- mutation 2 : […]
- mutation 3 : […]

Mutations restées vertes (= faux témoins) : […] ou « aucune »

Verdict : `REJET` / `RIEN VU` (Haiku) | `mergeable` / `correctifs` / `reprendre` (Sonnet)
```

---

## Souvenirs d'incidents réels

- T-20260806-0192 : représentant relève l'historique avant d'ouvrir sa ligne. Quatre messages restent sans réponse.
- D-20260805-0005 : neuf agents lancés en parallèle → chacun 15-20 min de startup → coût total 2h+ pour un travail de 90 min.
- Un mock de service retourne toujours « succès » → code sort inerte → découvert en prod.
- Vérification d'ajout, oubli de suppression → la valeur remise en cause reste accessible par un autre chemin.
