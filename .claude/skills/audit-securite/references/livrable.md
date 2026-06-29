# Gabarit du livrable (phase 4) — rapport Somcraft + tickets ServiceDesk

Consommé par la Phase 4 du SKILL.md. Deux livrables : **A** un rapport Somcraft,
**B** un epic + des tickets ServiceDesk. **Seuls les findings `confirme` génèrent des
tickets.** Aucune valeur de secret ne doit apparaître (masquer partout).

---

## A. Rapport Somcraft

- **MCP** : `write_document` du serveur Somcraft de la session.
- **Workspace** : celui du **client** (`somcraft.workspace_id` de `.somtech/app.yaml`).
- **Path** : `/operations/<app-slug>/audits/audit-securite-<YYYY-MM-DD>.md`.

### Structure Markdown

```markdown
# Audit de sécurité — <app> — <YYYY-MM-DD>

## Résumé exécutif
- Couches exécutées : <liste> ; sautées : <liste + raison>
- Findings confirmés : <n> (critique <c>, high <h>, medium <m>, low <l>)
- Findings réfutés (faux positifs écartés) : <r> — voir annexe
- À valider humainement (incertain) : <i>

## Score par couche
| Couche | Confirmés | Sévérité max | Statut |
|--------|-----------|--------------|--------|
| code | … | … | exécutée |
| rls | … | … | exécutée |
| frontend | … | … | exécutée |
| api | … | … | exécutée |
| infra | … | … | exécutée |
| pentest | … | … | exécutée / sautée (pas d'url_staging) |

## Findings confirmés (par sévérité décroissante)
Pour chaque finding `confirme` :
### [<id>] <titre> — <severite>
- **Couche** : <couche>
- **Cible** : <fichier:ligne | endpoint | table | URL>
- **Description** : …
- **Preuve** : <extrait — secrets/PII masqués>
- **Remédiation** : …
- **Référence** : <STD-038 | ADR-xxx | CWE-xxx | —>
- **Corrélation** : <ex. RLS-003 (statique) ↔ PEN-002 (runtime) — même faille>

## Matrice de couverture
- Couches exécutées / sautées + raison.
- Drift ontologie relevé en phase 1 (le cas échéant).

## Annexe — findings réfutés (faux positifs)
| id | couche | titre | raison du verdict réfuté |
|----|--------|-------|--------------------------|
```

---

## B. Tickets ServiceDesk

1. **`application_id`** : récupérer le réel via `mcp__servicedesk__applications`
   action `list` (matcher le nom de l'app). **Ne jamais inventer un application_id.**
2. **Epic ombrelle** (`mcp__servicedesk__epics` action create) :
   - Titre : `[SÉCURITÉ] Audit sécurité <app> <YYYY-MM-DD>`
   - Description : lien vers le rapport Somcraft (PoW) + résumé des compteurs.
3. **1 ticket par finding `confirme`** (`mcp__servicedesk__tickets` action create,
   rattaché à l'epic) :
   - **Type** : `incident`.
   - **Titre** : `[FIX] <titre>` (ou `[DEBT] <titre>` si non urgent).
   - **Priorité** : mapping sévérité → `critique→high`, `high→high`, `medium→medium`,
     `low→low`.
   - **Description** : description + cible + remédiation + référence + **G/W/T de
     reproduction** :
     ```
     Given <contexte : user/role/état>
     When <action qui déclenche la faille>
     Then <comportement vulnérable observé> — attendu : <comportement sécurisé>
     ```
   - **PoW** : lien vers le rapport Somcraft.
   - **Secrets** : jamais la valeur, seulement `fichier:ligne` + masque.
4. **1 ticket par finding `incertain`** :
   - **Type** : `improvement`, titre `[À VALIDER] <titre>`, tag de revue.
   - **Jamais fermé automatiquement** — attend une validation humaine.
5. **Zéro ticket** pour les findings `refute`.

---

## Garde-fous de la phase 4

- Aucune écriture hors : 1 doc Somcraft + 1 epic + N tickets.
- Aucun ticket sans verdict `confirme` ou `incertain` (les `refute` restent en annexe
  du rapport seulement).
- Aucune valeur de secret dans le rapport ni les tickets.
- `application_id` et `workspace_id` réels, récupérés des sources — jamais inventés.
