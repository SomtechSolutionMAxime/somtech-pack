# Découpage — D-20260710-0009 · Accès BRD calculé à la demande

> **Source** : workflow `analyse-decoupage-demande` (run `wf_ecc1e29d-e45`, 7 agents, critique adversariale).
> **Statut critique** : `pret_a_creer: false` en sortie brute → **rendu prêt** après application des 3 défauts
> majeurs + 5 mineurs (ci-dessous). Dépassement de gate **validé explicitement par Maxime** (GO du 2026-07-10),
> tracé ici (règle STD-030 / skill plan-servicedesk §D.1).

## Contexte BRD

- **App cible** : « Somtech Pack » (`2098c2fd-5448-46a3-bd98-83778e7a064d`), `module_id = null`.
- **Grain BRD** : `application` · **résolu depuis** : `application`.
- **BRD** : **AUCUN** (pointeur ServiceDesk vide : `brd_document_id=null`, `brd_yaml_document_id=null`).
- **Traçabilité EF** : **N/A par nature** (pas par omission) — confirmé par la Demande (règle d'or n°10).
  Le cadre opposable de chaque story est **STD-033** (sections citées), pas une EF.
- **Méta-traçabilité** : cette Demande ré-outille le mécanisme *même* de traçabilité EF (`/brd extract`) pour
  tout le parc d'apps réellement dotées d'un BRD (Action Progex app-level, Ma Place RH module-level). Une
  divergence sémantique du port TS casserait leurs projections → **parité sémantique = condition de succès
  centrale**, testée rouge-avant/vert-après. Pas de dogfooding possible ici (repo sans BRD) : la QA passe par
  un **BRD bac-à-sable** dédié (jamais un BRD client via `update_block`).

## Corrections appliquées à la sortie du workflow

| # | Sévérité | Défaut | Correction appliquée |
|---|----------|--------|----------------------|
| 1 | Majeur | Epic B empilait 3 comportements testés séparément (> 1 PR) | **Scindé en 2 stories** : B1 (écriture ciblée + préservation) · B2 (concurrence / anti-lost-update) |
| 2 | Majeur | Contingence NO-GO du spike non documentée (peut invalider B/C/D) | Spike A1 = **gate formel** ; **plan de repli NO-GO documenté** dans A1 (quelles stories tombent, quel repli lecture-seule reste livrable) |
| 3 | Majeur | Ordre migration Epic E retirait l'API avant le frontend (expand-contract inversé → casse prod) | **Réordonné** : frontend → API → DROP colonne → regen types |
| 4 | Mineur | Fixture BRD bac-à-sable non scopée | **Ajoutée comme livrable explicite du spike A1** |
| 5 | Mineur | Cible de taille A(index) contradictoire (~1 Ko vs ordre de grandeur) | **Seuil unique opposable** : « ≥ 1 ordre de grandeur < MD source, baseline mesurée au spike » ; ~1 Ko = objectif design non testé |
| 6 | Mineur | Story « emplacement + squelette rouge » = phase RED masquée en story | **Fusionnée** dans la story de portage (red→green interne) ; emplacement = prérequis issu du spike |
| 7 | Mineur | Dépendance A(index) → B1 implicite | **Explicitée** dans la dépendance de B1 |
| 8 | Mineur | Test anti-cache C1 inatteignable côté lib (option B interdit de stocker l'index) | **Reformulé** en garde-fou côté APPELANT |

## Séquençage (ordre recommandé + dépendances)

```
Epic 0  [HORS REPO — Architecture]  ── prérequis normatif (amont/synchrone)
  └─► Epic A  (parser + projections)  ── SPIKE A1 = gate GO/NO-GO en tête
        └─► Epic B  (écriture)   dépend: spike GO + A(index)
        └─► Epic C  (lib Orbit)  dépend: A (+ B pour l'écriture)
        └─► Epic D  (retrait brd.yaml stocké — consommateurs internes)
              └─► Epic E  [HORS REPO — ServiceDesk]  DROP colonne — SEULEMENT après D mergé + DROP prod re-confirmé
```

> **Règle d'or n°2 + n°7** : Epic 0 (repo Architecture) et Epic E (repo ServiceDesk) sont **hors du repo
> somtech-pack** → sessions dédiées. Présents dans la hiérarchie pour **gater la livraison de la Demande**
> (les triggers DB ne passeront pas la Demande à `delivered` tant que la chaîne complète n'est pas fermée).

---

## Epic 0 — [HORS REPO — Architecture] Prérequis normatif : amendement STD-033

- **Problem** : la livraison somtech-pack implémente l'option B (BRD calculé à la demande, `brd.yaml` stocké
  supprimé) alors que STD-033 §2.11 décrit ENCORE un `brd.yaml` stocké/publié, et le design doc source décrit
  encore l'option A (endpoint ServiceDesk). Sans amender le standard, le skill `/brd` violerait le cadre
  opposable qu'il applique.
- **Outcome** : STD-033 amendé (§2.2, §2.11 déprécié, §2.12 réécrit), champ `brd_yaml_document_id` retiré du
  standard ; design doc réaligné A→B. Acté avant/synchrone à la livraison somtech-pack.
- **Out of scope** : tout code/écriture dans somtech-pack. Vit dans le repo Architecture (règle d'or n°7).

**Story 0.1** — [HORS REPO — Architecture] Amender STD-033 + réaligner le design doc A→B
- **G** STD-033 §2.11 décrit un `brd.yaml` stocké/publié + champ pointeur `brd_yaml_document_id` ; le design doc décrit l'option A
- **W** on amende §2.2/§2.11/§2.12 pour décrire le calcul à la demande côté appelant, on retire le champ pointeur du standard, et on réaligne le design doc sur l'option B
- **T** standard + design doc décrivent le calcul déterministe à la demande sans référencer aucun `brd.yaml` stocké ni pointeur `brd_yaml_document_id` — le skill `/brd` livré ne contredira plus le standard
- **EF** : N/A (référentiel amendé = le STANDARD, pas une EF) · **Test** : gouvernance documentaire

---

## Epic A — Accès BRD calculé à la demande : parser déterministe + projections index/full

- **Problem** : aujourd'hui `/brd` fait parser le MD→YAML par le LLM lui-même (risque d'erreur), et le
  `brd.yaml` stocké dérive (pointeurs cassés : ActionProgex, module « Baux et crédit »). L'appelant veut charger
  le contexte BRD de façon FIABLE (zéro parse LLM) et PAS CHER (index léger vs MD 74 Ko / yaml 35 Ko), sans
  jamais lire un artefact dérivé.
- **Outcome** : un seul parse déterministe (zéro LLM) porté du parser Python de référence, exposant DEUX
  projections calculées à la demande et jamais stockées : INDEX léger (avec `md_block_id` par exigence) et FULL
  (YAML complet). L'ancienne écriture LLM du yaml stocké est retirée du flux `extract`.
- **Out of scope** : l'écriture/MAJ du BRD (Epic B), le packaging Orbit (Epic C), le retrait des autres
  consommateurs internes (Epic D).

**Story A1** — [SPIKE bloquant — GATE GO/NO-GO] Dé-risquer le contrat `block_id`, l'emplacement du parser, le corpus de parité + créer le BRD bac-à-sable
- **G** un BRD.md **bac-à-sable créé pour ce spike** (jamais un BRD client), le parser Python de référence + goldens (repo Architecture, lecture seule) et la décision option B
- **W** on lit un tableau domaine×type via `read_document(include_block_ids=true)`, on rappelle `update_block` avec l'id rendu, on inspecte l'exposition des marqueurs `bid` inline, le grain d'adressage (table entière vs ligne), la stabilité des ids après réécriture full-doc, le comportement en écriture concurrente, et on tranche où vit le code TS exécutable (lib CLI `@somtech-solutions/pack` vs module aims vs script invoqué)
- **T** on produit un REF/ADR statuant **GO/NO-GO** qui fixe : id accepté tel quel (oui/non), grain d'adressage confirmé, invariant de stabilité read→write documenté, politique de concurrence retenue, emplacement du parser tranché, corpus de parité constitué, **BRD bac-à-sable disponible**, ET **le plan de repli si NO-GO est écrit** (si les ids ne sont pas stables-pour-écrire : Epic B tombe et l'ancrage `md_block_id` de A(index) devient lecture-seule ; les projections FULL/INDEX en lecture restent livrables si les ids résolvent-pour-lire) — AUCUN artefact prod livré
- **EF** : N/A (cadre STD-033, amendement Epic 0) · **Test** : investigation + validation empirique MCP, livrable REF/ADR

**Story A2** — Porter le parser BRD Python→TS avec parité sémantique (emplacement issu du spike, red→green interne)
- **G** le corpus golden du spike et la logique du parser Python de référence (tableaux EA/EF/RA/HS, échappement des pipes, cellules vides, symétrie couvre/encadre) ; l'emplacement TS tranché au spike (net-new — le repo n'a aucun parser BRD)
- **W** on crée le module TS + sa suite de parité `node --test` (amorcée ROUGE sur un cas golden réel), puis on implémente le parser et on compare la sortie par **re-parse round-trip** (PAS byte-à-byte : PyYAML ≠ sérialiseur TS)
- **T** tous les cas golden passent en vert ET une divergence sémantique volontairement introduite (ex : inversion couvre/encadre) rend au moins un test ROUGE — le test attrape un bug réel, pas un PASS
- **EF** : N/A (cadre STD-033 §2.12) · **Test** : unit

**Story A3** — `/brd extract` — mode FULL (YAML) calculé à la demande, jamais stocké
- **G** un BRD.md dans Somcraft et le parser TS déterministe
- **W** l'appelant demande la projection full
- **T** il obtient le YAML complet calculé sans LLM, à parité sémantique avec la référence, SANS aucune écriture Somcraft ni `set_brd_pointer(brd_yaml_document_id)` ; l'ancienne branche « Claude joue le rôle de parser » est retirée du flux `extract`
- **EF** : N/A (cadre STD-033 §2.11 déprécié / §2.12) · **Test** : unit + intégration MCP

**Story A4** — `/brd extract` — mode INDEX léger avec `md_block_id` par exigence
- **G** le même parse et un `read_document(include_block_ids=true)` sur le BRD.md
- **W** l'appelant demande la projection index
- **T** il reçoit UNIQUEMENT `{ID, titre court, statut, domaine, priorité, couvre/encadre, md_block_id}` par exigence — aucun corps d'exigence — d'une taille **≥ 1 ordre de grandeur inférieure au MD source (baseline mesurée au spike)** ; chaque `md_block_id` résout vers un bloc adressable réel du BRD.md. *(~1 Ko = objectif design, non testé.)*
- **EF** : N/A (cadre STD-033 §2.11 déprécié / §2.12) · **Test** : unit + intégration MCP

---

## Epic B — Boucle d'écriture ciblée du BRD (`update_block` au grain domaine)

- **Problem** : fermer la boucle lecture→écriture — éditer une exigence sans réécrire tout le BRD.md (74 Ko) et
  sans réintroduire un artefact stocké. Grain d'écriture = table domaine×type (~10 lignes). Sans garde-fous, deux
  agents (amplifiés par la lib Orbit) qui éditent la même table se perdent silencieusement, et une réécriture
  from-scratch effacerait le contenu MD non modélisé.
- **Outcome** : `update_block(md_block_id)` au grain domaine, réécriture préservante + politique de concurrence
  explicite — symétrie de la lecture (Epic A). Zéro artefact stocké.
- **Out of scope** : projections de lecture (Epic A), packaging Orbit (Epic C).
- **Dépend de** : spike A1 = GO + Story A4 (l'index produit le `md_block_id`).

**Story B1** — Écriture ciblée `update_block(md_block_id)` au grain domaine, préservante
- **G** une exigence portant son `md_block_id` (projection index — **sortie de A4**) et une MAJ au grain domaine×type
- **W** on applique `update_block` sur la table du domaine
- **T** seule la table ciblée change et un re-parse confirme la parité ; ET le contenu non modélisé de la table (note, cellule multi-ligne, colonne hors-schéma) est **PRÉSERVÉ** (réécriture additive, pas un rendu from-scratch de la projection) — chacun de ces deux volets a un test rouge-avant/vert-après
- **EF** : N/A (cadre STD-033 §2.12) · **Test** : unit + intégration MCP

**Story B2** — Politique de concurrence / anti-lost-update sur la même table
- **G** deux écritures concurrentes visant des exigences distinctes de la même table domaine×type
- **W** on applique les deux `update_block` successifs/concurrents selon la politique retenue au spike (relire→comparer→réécrire, ou verrou optimiste)
- **T** aucune des deux écritures ne se perd silencieusement : soit les deux modifs coexistent (relecture avant réécriture), soit le conflit est **détecté et signalé** — test rouge-avant (lost-update reproduit) / vert-après
- **EF** : N/A (cadre STD-033 §2.12) · **Test** : unit + intégration MCP

---

## Epic C — Généralisation : lib de projection pour agents Orbit

- **Problem** : les agents Orbit doivent consommer exactement les mêmes projections déterministes que le skill
  `/brd`, avec une résolution de chemin cross-poste, sans réintroduire un cache d'index qui deviendrait périmé.
- **Outcome** : la fonction de projection (index/full + écriture) packagée en lib importable, résultat identique
  au skill, invariant read→write dans le même cycle documenté.
- **Out of scope** : implémentation du parser (Epic A) et de l'écriture (Epic B) — ici c'est du packaging.

**Story C1** — Packager la projection en lib réutilisable pour les agents Orbit
- **G** la lib parser TS et ses projections index/full/écriture
- **W** un agent Orbit (ou harness équivalent) importe la lib et demande une projection
- **T** il obtient un résultat identique à celui du skill `/brd`, la résolution de chemin fonctionne cross-poste (via le CLI pack), et l'invariant « read→write dans le même cycle, jamais de cache d'index persisté » est documenté et **testé comme garde-fou côté APPELANT** : si un appelant cache l'index hors-lib puis le réutilise après une réécriture intercalée, la lib le rejette ou le signale périmé (l'index n'est jamais persisté par la lib elle-même)
- **EF** : N/A (cadre STD-033 + besoin Orbit) · **Test** : unit

---

## Epic D — Retrait du `brd.yaml` stocké : consommateurs internes + cleanup

- **Problem** : 6 fichiers du repo lisent/écrivent le `brd.yaml` stocké ou le pointer `brd_yaml_document_id`
  (dont `analyse-decoupage-demande.js`, qui a `brd_yaml_publie_mcp` en champ requis de son schéma, et alimente
  `/plan-servicedesk` & `/superplan`). Tant qu'un seul appelant lit ce pointer, le DROP côté ServiceDesk
  casserait la prod. Des artefacts orphelins (brd.yaml + pointers cassés) subsistent aussi.
- **Outcome** : plus aucun code somtech-pack ne lit ni n'écrit le `brd.yaml` stocké ou le pointer ; artefacts et
  pointers orphelins purgés. Prérequis dur au DROP ServiceDesk (Epic E).
- **Out of scope** : le DROP de la colonne et les surfaces API/frontend côté ServiceDesk (Epic E, autre repo).

**Story D1** — Purger la sémantique « brd.yaml stocké » du skill `/brd`
- **G** `brd.md` présuppose partout un `brd.yaml` stocké/publié (actions extract/read/validate/list, tableau des sources, modèle de publication, anti-patterns)
- **W** on réécrit `brd.md` pour refléter le calcul à la demande
- **T** aucune action ne dépend du pointer `brd_yaml_document_id`, aucune ne publie de `brd.yaml` dans Somcraft, et read/validate/list opèrent sur les projections calculées
- **EF** : N/A (cadre STD-033 §2.2/§2.11) · **Test** : revue + unit si logique extraite en lib

**Story D2** — Reconvertir les consommateurs internes du pointer yaml en calcul à la demande
- **G** `ontology.md` (l.198, 276), `analyse-decoupage-demande.js` (l.98-99 + champ requis `brd_yaml_publie_mcp` de son schéma), `agent-brief` et `audit-preprod` lisent le `brd.yaml` via le pointer
- **W** on les reconvertit pour consommer la projection calculée à la demande
- **T** chaque consommateur produit le même résultat fonctionnel qu'avant SANS lire `brd_yaml_document_id`, et un test de non-régression sur `analyse-decoupage-demande.js` confirme que `/plan-servicedesk` & `/superplan` gardent leur comportement
- **EF** : N/A (cadre STD-033 §2.11) · **Test** : unit

**Story D3** — Purger les `brd.yaml` Somcraft orphelins et les pointers `brd_yaml_document_id` posés
- **G** des `brd.yaml` stockés et des pointers déjà posés, dont cassés (ActionProgex yaml introuvable, module « Baux et crédit »)
- **W** on inventorie puis purge les artefacts et les pointers
- **T** aucun pointer `brd_yaml_document_id` actif ne subsiste côté appelant — condition préalable vérifiée avant tout DROP côté ServiceDesk
- **EF** : N/A (cadre STD-033 §2.11) · **Test** : opération data, inventaire + validation manuelle

---

## Epic E — [HORS REPO — ServiceDesk] Coordination cross-repo : DROP `brd_yaml_document_id`

- **Problem** : une fois Epic D livré, la colonne `brd_yaml_document_id` et ses surfaces API/frontend côté
  ServiceDesk sont mortes. Il faut les retirer sans casser la prod : un DROP avant retrait des lectures casse la
  décomposition de demandes et les audits (règle d'or n°2).
- **Outcome** : colonne DROP, types régénérés, surfaces API et frontend nettoyées — dans le repo ServiceDesk,
  après Epic D mergé, DROP prod re-confirmé.
- **Out of scope** : repo somtech-pack (règle d'or n°7). Session dédiée dans le repo ServiceDesk.
- **Dépend de** : Epic D mergé + DROP prod re-confirmé explicitement par Maxime.

**Story E1** — [HORS REPO — ServiceDesk] Migration destructive séquencée du retrait de `brd_yaml_document_id`
- **G** Epic D mergé (plus aucun appelant somtech-pack ni Orbit ne lit/écrit le pointer) et le DROP prod confirmé explicitement par Maxime
- **W** on retire **d'abord la surface frontend** qui consomme ces données, PUIS les endpoints/lectures API (`get/set/list_brd_yaml`, `brd_manifest`, `brd_coverage`, `set_brd_pointer`), PUIS on **DROP** la colonne, PUIS regen types *(ordre corrigé — expand-contract, pas d'API morte pendant que le frontend l'appelle encore)*
- **T** l'ordre est vérifié (aucune surface ne consomme la colonne avant son retrait, aucune lecture API ne subsiste avant le DROP), la prod ServiceDesk reste fonctionnelle, et un smoke test de migration passe sur base vierge
- **EF** : N/A (repo ServiceDesk) — coordination STD-033 §2.11 + STD-031 §2.7.8 · **Test** : L2 (migration smoke, repo ServiceDesk)

---

## Faits non vérifiés reportés (règle d'or n°7, hors accès direct)

- Design doc source (`docs/superpowers/specs/2026-07-10-brd-acces-calcule-a-la-demande-design.md`, repo
  Architecture, branche `docs/brd-acces-calcule-index`, commits `f7bf621`+`ffe34a7` — **décrit encore l'option A**),
  parser Python `extract-brd-yaml.py` (587 l.) et goldens `test-brd/` **non inspectés** → tous adressés par le SPIKE A1.
- Contrat `block_id` / grain table vs ligne : **confirmé au niveau schéma** par l'analyse risques
  (`read_document(include_block_ids=true)` rend `{id,kind,preview}` et `update_block` accepte cet id sans préfixe
  `bid:`), **non confirmé empiriquement** → spike A1.
- Absence de verrou optimiste sur `update_block` : confirmée par schéma, comportement concurrent réel **non testé** → spike A1 + Epic B.
- Inventaire exact des surfaces ServiceDesk (`get/set/list_brd_yaml`, `brd_manifest`, `brd_coverage`) → à faire dans la session ServiceDesk (Epic E).
