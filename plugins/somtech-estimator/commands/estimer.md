---
description: Estimer les coûts d'un projet forfaitaire à partir d'un cahier des charges
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: [chemin-vers-cdc.docx]
---

# /estimer — Estimation de projet forfaitaire

## Vue d'ensemble

Cette commande produit un document d'estimation comparant deux modèles :
1. **Traditionnel** — jours-personne par rôle avec taux du marché québécois
2. **IA-assisté** — mêmes rôles avec facteurs d'accélération IA par type de tâche

Inclut une analyse de risque (complexité technique + dépendances hors contrôle).

## Prérequis

- Un fichier .docx de cahier des charges (CDC) accessible dans le workspace
- Si aucun argument fourni, chercher un CDC dans le workspace : `**/*cahier*des*charges*.docx`, `**/*CDC*.docx`, `**/*specification*.docx`

## Pipeline

### Phase 1 — Extraction du CDC

1. **Localiser le CDC** : utiliser l'argument fourni, ou chercher dans le workspace
2. **Lire le skill estimation-engine** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-engine/SKILL.md`
3. **Extraire les features** selon les instructions du skill
4. **Présenter la liste extraite** à l'utilisateur pour validation rapide :
   ```
   J'ai extrait X features du CDC :
   1. [Feature] — Type: [type], Complexité: [complexité]
   2. ...
   Ça te semble correct ? Tu veux ajouter/modifier/retirer des features ?
   ```
5. Attendre la validation avant de continuer

### Phase 2 — Calcul automatique

1. **Charger les données de référence** : `${CLAUDE_PLUGIN_ROOT}/templates/defaults.json`
2. **Consulter le skill** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-engine/SKILL.md` (section Phase 2)
3. **Pour chaque feature** :
   - Calculer l'effort traditionnel (jours par rôle, coûts)
   - Évaluer les risques (complexité + dépendances)
   - Calculer l'effort IA-assisté (facteurs Dev + non-Dev)
4. **Calculer les totaux** : architecte (5% surplus), facteur de risque global, totaux avec risque

### Phase 3 — Review utilisateur

1. **Présenter le tableau récapitulatif** :

   ```
   ## Résumé de l'estimation

   | # | Feature | Type | Compl. | Trad. (j) | Risque | IA factor | IA (j) | Trad. ($) | IA ($) |
   |---|---------|------|--------|-----------|--------|-----------|--------|-----------|--------|
   | 1 | ...     | ...  | ...    | ...       | ×1.XX  | -XX%      | ...    | X XXX $   | X XXX $|

   ### Totaux
   - Traditionnel brut : XX XXX $
   - IA-assisté brut : XX XXX $
   - Architecte (5%) : X XXX $ (trad) / X XXX $ (IA)
   - Facteur de risque global : ×X.XX
   - **Traditionnel avec risque : XX XXX $**
   - **IA-assisté avec risque : XX XXX $**
   - **Économie projetée : XX% (XX XXX $)**

   Tu veux ajuster quelque chose (jours, risques, facteurs IA) ou on génère le rapport ?
   ```

2. **Si ajustements demandés** : modifier les valeurs, recalculer, re-présenter le tableau
3. **Si validation** : passer à Phase 4

### Phase 4 — Génération du rapport

1. **Lire le skill estimation-report** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-report/SKILL.md`
2. **Générer le markdown** dans `estimations/YYYY-MM-DD-<nom-projet>-estimation.md`
3. **Générer le .docx** si le gabarit existe dans `${CLAUDE_PLUGIN_ROOT}/templates/estimation-report.docx`
4. **Confirmer** :
   ```
   Rapport d'estimation généré :
   - Markdown : estimations/YYYY-MM-DD-<nom-projet>-estimation.md
   - Word : estimations/YYYY-MM-DD-<nom-projet>-estimation.docx (si gabarit disponible)

   Traditionnel : XX XXX $ | IA-assisté : XX XXX $ | Économie : XX%
   ```

## Règles critiques

- **Ne jamais inventer des features** qui ne sont pas dans le CDC
- **Toujours attendre la validation** avant de passer à la phase suivante
- **Montants en CAD**, séparateur d'espace, convention québécoise (`12 500 $`)
- **Taxes exclues** de tous les montants
- Si le CDC a **20+ features**, regrouper par module/section dans les tableaux
