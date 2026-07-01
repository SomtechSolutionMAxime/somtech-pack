# Gabarit du livrable (phase 5) — rapport priorisé + projet ServiceDesk

Consommé par la Phase 5 du SKILL.md. Deux livrables : **A** un rapport Somcraft qui porte
un **verdict go/no-go** et un **plan priorisé**, **B** un **projet ServiceDesk** (epics /
stories tracés au rapport et aux EF). **Seuls les findings `confirme` / `incertain`**
génèrent des stories. Aucune valeur de secret ne doit apparaître (masquer partout).

---

## A. Rapport Somcraft

- **MCP** : `write_document` du serveur Somcraft de la session.
- **Workspace** : celui du **client** (`somcraft.workspace_id` de `.somtech/app.yaml`).
- **Path** : `/operations/<app-slug>/audits/audit-preprod-<fonction>-<YYYY-MM-DD>.md`.

L'audit ne gagne sa valeur que s'il **transforme le constat en décision** (RETEX §2.5).
Le rapport doit donc trancher, pas seulement lister.

### Structure Markdown

```markdown
# Audit pré-production — <fonction> — <app> — <YYYY-MM-DD>

## Verdict global
**Bon pour la production : OUI / NON / SOUS CONDITIONS.**
- Bloquants service ouverts : <n> — la fonction ne doit pas rester en prod en l'état / peut rester.
- Ref auditée : <commit origin/main> · Environnements sondés : prod <oui/non>, staging <oui/non>.

## Tableau des écarts (sévérité × exploitable)
| id | axe | titre | sévérité | exploitable ? | écart vs baseline | prod | staging | verdict |
|----|-----|-------|----------|---------------|-------------------|------|---------|---------|
| DBSEC-001 | db-securite | … | high | oui — <scénario> | incohérent 4/10 | ✗ | ✗ | confirme |

## Plan d'action priorisé (effort × bloquant)
- **P1 — bloquant service** (à corriger avant de laisser en prod) : <findings>
- **P2 — important, non bloquant** : <findings>
- **P3 — dette planifiée** : <findings>
Chaque ligne : id, remédiation, effort estimé (S/M/L), et pourquoi ce rang.

## Findings confirmés (détail, par sévérité décroissante)
Pour chaque `confirme` :
### [<id>] <titre> — <severite>
- **Axe** : <axe>
- **Cible** : <fichier:ligne | table | fonction | workflow CI>
- **Constat réel** : prod → <live_prod> · staging → <live_staging> · <corroboration>
- **Exploitabilité** : <scénario concret | non exploitable — raison>
- **Écart vs baseline** : <outlier / norme — chiffre>
- **Remédiation** : …
- **Référence** : <EF/RA | STD-xxx | CWE-xxx | —>

## À valider humainement (incertain)
<liste — jamais présentés comme prouvés>

## Matrice de couverture
- Axes exécutés / sautés + raison.
- Fraîcheur du BRD (pointer vs .md) ; drift ontologie relevé en phase 1 (le cas échéant).
- Sondage live : réalisé / dégradé (raison).

## Annexe — findings réfutés (faux positifs écartés)
| id | axe | titre | raison du verdict réfuté |
|----|-----|-------|--------------------------|
```

---

## B. Projet ServiceDesk

RETEX §4.5 « officialiser » : un audit pré-production alimente un **projet** (pas un simple
epic isolé), pour porter la suite des correctifs avec traçabilité.

1. **`application_id`** : récupérer le réel via `mcp__servicedesk__applications` action
   `list` (matcher le nom de l'app). **Ne jamais inventer un application_id.**
2. **Projet** (`mcp__servicedesk__projects` action create) :
   - Titre : `[AUDIT] Pré-prod <fonction> <YYYY-MM-DD>`.
   - Description : verdict global + lien vers le rapport Somcraft (PoW) + compteurs.
3. **Epics** (`mcp__servicedesk__epics` action create) = regroupement par **plan de
   priorité** (P1 bloquant / P2 / P3) ou par axe, selon le volume. Rattachés au projet.
4. **1 story par finding `confirme`** (`mcp__servicedesk__tickets` action create,
   `type=story`, rattachée à l'epic) :
   - **Titre** : `[FIX] <titre>` (ou `[DEBT] <titre>` si P3).
   - **Priorité** : mapping sévérité → `critique→high`, `high→high`, `medium→medium`,
     `low→low`.
   - **Traçabilité** : `reference` du finding → l'**EF/RA du BRD** concernée (règle d'or
     n°10). Si l'EF n'existe pas, l'ajouter/amender le BRD **avant** (Phase 1 STD-033).
   - **G/W/T de reproduction** (le constat live devient le scénario) :
     ```
     Given <contexte : rôle/état + environnement (prod/staging)>
     When <action qui déclenche le défaut>
     Then <comportement observé — constat live> — attendu : <comportement correct>
     ```
   - **PoW** : lien vers le rapport Somcraft + la ligne du tableau des écarts.
   - **Secrets** : jamais la valeur, seulement `fichier:ligne` + masque.
5. **1 story par finding `incertain`** (`mcp__servicedesk__tickets` action create,
   `type=improvement`) : titre `[À VALIDER] <titre>`, tag de revue, **jamais fermée
   automatiquement** — attend une validation humaine.
6. **Zéro story** pour les findings `refute`.

---

## Garde-fous de la phase 5

- Aucune écriture hors : 1 doc Somcraft + 1 projet + ses epics/stories.
- Aucune story sans verdict `confirme` ou `incertain` (les `refute` restent en annexe du
  rapport seulement).
- Chaque story `confirme` est **tracée à une EF/RA** ; une story sans traçabilité est une
  violation (règle d'or n°10).
- Aucune valeur de secret dans le rapport ni les stories.
- `application_id` et `workspace_id` réels, récupérés des sources — **jamais inventés**.
- Rappel : **aucune correction n'est appliquée par ce skill** — il constate, priorise,
  officialise. La correction est un chantier séparé (un ticket à la fois jusqu'en prod).
