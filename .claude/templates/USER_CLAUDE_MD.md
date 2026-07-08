# Template — Réflexe CLAUDE.md « socle always-on de la mémoire » (STD-039 §2.6)

> **Quoi** : le **noyau minimal** à greffer dans un CLAUDE.md **toujours chargé** (global
> `~/.claude/CLAUDE.md` et/ou projet). Il matérialise le **socle always-on** de la couche
> d'usage de la mémoire (STD-039). **Comment l'installer** : copier le bloc ci-dessous
> (entre les marqueurs) tel quel dans le CLAUDE.md cible. Le pack **ne pousse pas** les
> CLAUDE.md (ceux-ci appartiennent à leur propriétaire) — c'est une greffe manuelle.
>
> **Garde-fou (MUST)** : ce noyau reste **minimal** — les 4 invariants ci-dessous + le
> pointeur. Ne PAS y graver la carte complète (§2.3) ni les huit invariants verbatim :
> les exposer en permanence les livrerait au *trimming* (CLAUDE.md sous audit de charge,
> STD-011) et ferait perdre au socle son sens. S'il grossit au-delà, c'est une dérive à
> corriger, pas à tolérer.

<!-- ==== DÉBUT DU NOYAU À GREFFER (STD-039 §2.6) ==== -->

## Socle mémoire — always-on (STD-039)

Ces invariants gouvernent **tout geste de mémoire**, quel que soit le skill ou l'outil, et
s'appliquent **sans invoquer** aucun skill :

- **I1 — nommer par fonction, jamais par mécanisme.** Un geste de mémoire se nomme par sa
  fonction/intention (`/episodique`, `/rappel`, `/memoire`), jamais par la techno
  (`/graphiti`, `/neo4j`, `/search`).
- **I3 — un rappel ne fait pas foi.** L'épisodique et le travail *rappellent* ; ils ne
  prouvent pas. La **seule** remontée d'un fait non-opposable vers l'**opposable**
  (ServiceDesk / Somcraft) passe par le **gate de promotion**.
- **I4 — frontière D5.** L'agent fait le pont entre substrats en **appels explicites** ;
  aucun pont direct substrat-à-substrat (ex. lire l'épisodique **via** le SD-Graph est
  interdit — on interroge la mémoire épisodique directement).
- **I5 — cantonnement `group_id`.** Toute lecture/écriture **épisodique** est **scopée à un
  `group_id`** (projet/sujet). L'isolation Loi 25 inter-Département IA est une affaire
  d'infra (séparation d'instance), pas du skill.

**Pour le reste** — la carte fonction → interface (quelle mémoire pour quoi) et les
invariants **I2, I6, I7, I8** — voir **STD-039** (Interface d'usage de la mémoire) et le
hub **`/memoire`**. Ces éléments se consultent au besoin, ils ne sont pas mémorisés en
permanence.

<!-- ==== FIN DU NOYAU À GREFFER ==== -->

---

*Source de vérité : STD-039 (`/standards/STD-039-interface-usage-memoire.md`, `accepted`
2026-07-08). Gestes de fonction : `/episodique` (épisodique), `/rappel` (fan-out),
`/memoire` (hub). Cadre : ADR-033, BRD Mémoire (EA-MEM-006, domaine PRO).*
