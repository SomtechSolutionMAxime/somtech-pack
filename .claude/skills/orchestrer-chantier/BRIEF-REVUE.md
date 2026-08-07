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
- Un correctif touch pas une table → vérifier aussi ce qui en **sort**
- Une validation ajoutée → tester aussi la suppression / annulation / rollback du même état
- Deux sens ? Résolve le positif **ET** le négatif.

---

## Avant de commencer — les trois niveaux orchestration

Le code ou le texte que tu reviews prescrit-il les trois niveaux ?

| Niveau | Doit être nommé et expliqué | Exemple de défaut à chercher |
|---|---|---|
| **Orchestrateur** | « cadre, découpe, arbitre, fusionne, tient registre » | dit qu'il code, ou qu'il revoit lui-même |
| **Chef d'équipe** | « distribue, synthétise, rend compte au seul orchestrateur » | dit qu'il ouvre un agent herdr (rôle du niveau suivant) |
| **Sous-agents/coéquipiers** | « écrivent, testent, reviewent » ; distingue les deux outils | confond sous-agent (jetable, `Agent(prompt)`) et coéquipier (persistant, `Agent(..., name)` + `SendMessage`) |

Le texte doit dire **quand** chaque niveau se justifie. Cherche : « 2+ périmètres » ou « 5+ agents » pour chef d'équipe, « tâche < 30 min » pour ne pas ouvrir d'agent.

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
- mutation 1 : [décrivain ce que tu as changé → a fait rougir / n'a pas rougir]
- mutation 2 : […]
- mutation 3 : […]

Verdict : `REJET` / `RIEN VU` (Haiku) | `mergeable` / `correctifs` / `reprendre` (Sonnet)
```

---

## Souvenirs d'incidents réels

- T-20260806-0192 : représentant relève l'historique avant d'ouvrir sa ligne. Quatre messages restent sans réponse.
- D-20260805-0005 : neuf agents lancés en parallèle → chacun 15-20 min de startup → coût total 2h+ pour un travail de 90 min.
- Un mock de service retourne toujours « succès » → code sort inerte → découvert en prod.
- Vérification d'ajout, oubli de suppression → la valeur remise en cause reste accessible par un autre chemin.
