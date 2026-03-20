---
name: estimer
description: >
  Estimer les coûts d'un projet forfaitaire à partir d'un cahier des charges (.docx).
  Ce skill doit être utilisé quand l'utilisateur demande à "estimer un projet",
  "faire une estimation", "calculer les coûts d'un CDC", "produire une offre forfaitaire",
  "comparer traditionnel vs IA", ou fournit un fichier CDC .docx pour estimation.
  Aussi déclenché par "estimation", "forfait", "coûts projet", "estimer", "/estimer".
version: 0.3.0
---

# /estimer — Estimation de projet forfaitaire

## Vue d'ensemble

Cette commande produit un document d'estimation comparant deux modèles :
1. **Traditionnel** — jours-personne par rôle avec taux du marché québécois
2. **IA-assisté** — mêmes rôles avec facteurs d'accélération IA par type de tâche

Inclut une analyse de risque par bloc (complexité technique + dépendances hors contrôle) et une sous-décomposition en tâches de chaque bloc fonctionnel.

## Prérequis

- Un fichier .docx de cahier des charges (CDC) accessible dans le workspace
- Si aucun argument fourni, chercher un CDC dans le workspace : `**/*cahier*des*charges*.docx`, `**/*CDC*.docx`, `**/*specification*.docx`
- Python 3 disponible (pour génération Excel)

## Pipeline

### Phase 1.0 — Qualification du projet

1. **Analyser le CDC** pour identifier la nature du projet (custom / data-BI / config / migration / hybride)
2. **Présenter la qualification** :
   ```
   Nature : [identifiée]
   Impact : [types privilégiés, équipe probable]
   ```
3. **Demander** : "Ce module fait-il partie d'un système existant ou est-ce le premier module ?"
   - Si premier module → noter qu'un bloc infra sera ajouté
   - Si additionnel → demander le pourcentage d'infrastructure (0-50%)
4. **Détecter facteur de reproduction** : si le CDC mentionne un remplacement d'outil existant, proposer facteur (défaut 0.65)
5. Attendre validation de la qualification

### Phase 1.1 — Extraction et sous-décomposition

1. **Localiser le CDC** : utiliser l'argument fourni, ou chercher dans le workspace
2. **Lire le skill estimation-engine** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-engine/SKILL.md`
3. **Extraire les blocs fonctionnels** selon les instructions du skill
4. **Présenter la liste extraite** à l'utilisateur pour validation rapide :
   ```
   J'ai extrait X blocs fonctionnels du CDC :
   1. [Bloc] — Type: [type], Complexité: [complexité]
   2. ...
   Ça te semble correct ? Tu veux ajouter/modifier/retirer des blocs ?
   ```
5. Attendre la validation avant de continuer
6. **Sous-décomposition** : pour chaque bloc validé, décomposer en tâches concrètes et présenter :
   ```
   Voici la décomposition en tâches :

   **1. [Bloc]**
   - [Tâche 1]
   - [Tâche 2]
   - [Tâche 3]

   **2. [Bloc]**
   - ...

   Tu veux ajuster des tâches avant le calcul ?
   ```
7. Attendre la validation de la décomposition avant de continuer

### Phase 1.5 — Proposition d'équipe projet

1. **Analyser les tâches** identifiées et calculer le volume par rôle
2. **Proposer l'équipe** :
   ```
   ✅ [Rôle] — X personne(s) (justification), volume estimé : ~Xj
   ❌ [Rôle] — non requis (justification)
   ```
3. Attendre validation

### Phase 2.0 — Calcul automatique

1. **Charger les données de référence** : `${CLAUDE_PLUGIN_ROOT}/templates/defaults.json`
2. **Consulter le skill** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-engine/SKILL.md` (section Phase 2)
3. **Appliquer le facteur de reproduction** sur les blocs identifiés comme reproduction, avant toute allocation : `effort_ajusté = effort_base × facteur_reproduction`
4. **Appliquer la composition d'équipe validée** : mettre à 0% l'allocation des rôles exclus, redistribuer proportionnellement aux rôles restants
5. **Pour chaque bloc** :
   - Calculer l'effort traditionnel (jours par rôle, coûts) en tenant compte des tâches
   - Évaluer les risques du bloc (complexité + dépendances) → facteur de risque propre au bloc
   - Calculer l'effort IA-assisté (facteurs Dev + non-Dev par type)
   - Calculer sous-total brut et sous-total avec risque du bloc
6. **Si premier module** : calculer le bloc infrastructure initiale selon `defaults.json` section `infrastructureInitiale`
7. **Si module additionnel** : appliquer le pourcentage d'infrastructure validé sur le coût de référence infrastructure
8. **Calculer les totaux** : architecte (5% sur le brut global), facteur de risque global pondéré, totaux avec risque

### Phase 3.0 — Review utilisateur

1. **Présenter le tableau récapitulatif par bloc avec tâches** :

   ```
   ## Résumé de l'estimation

   ### Bloc 1 : [Nom du bloc]
   Tâches : [Tâche 1], [Tâche 2], [Tâche 3]

   | # | Bloc | Tâche | Type | Trad. (j) | Risque | IA factor | IA (j) | Trad. ($) | IA ($) |
   |---|------|-------|------|-----------|--------|-----------|--------|-----------|--------|
   | 1 | [Bloc 1] | [Tâche 1] | crud | X | ×1.XX | -XX% | X | X XXX $ | X XXX $ |
   | 1 | [Bloc 1] | [Tâche 2] | ui_composant | X | ×1.XX | -XX% | X | X XXX $ | X XXX $ |
   | **Sous-total brut** | | | | **X** | | | **X** | **X XXX $** | **X XXX $** |
   | **Sous-total avec risque (×1.XX)** | | | | | | | | **X XXX $** | **X XXX $** |

   ### Bloc 2 : [Nom du bloc]
   Tâches : [Tâche 1], ...

   | # | Bloc | Tâche | Type | Trad. (j) | Risque | IA factor | IA (j) | Trad. ($) | IA ($) |
   |---|------|-------|------|-----------|--------|-----------|--------|-----------|--------|
   | 2 | [Bloc 2] | [Tâche 1] | integration_api | X | ×1.XX | -XX% | X | X XXX $ | X XXX $ |
   | **Sous-total brut** | | | | **X** | | | **X** | **X XXX $** | **X XXX $** |
   | **Sous-total avec risque (×1.XX)** | | | | | | | | **X XXX $** | **X XXX $** |

   ---

   ### Totaux

   | | Traditionnel | IA-assisté |
   |---|---|---|
   | Total brut | XX XXX $ | XX XXX $ |
   | Architecte (5%) | X XXX $ | X XXX $ |
   | Marge de risque (×X.XX) | X XXX $ | X XXX $ |
   | Infrastructure (XX% du coût initial) | X XXX $ | X XXX $ |
   | **Total projet** | **XX XXX $** | **XX XXX $** |
   | **Économie projetée** | | **XX% (XX XXX $)** |

   Tu veux ajuster quelque chose (jours, risques, facteurs IA) ou on génère le rapport ?
   ```

2. **Si ajustements demandés** : modifier les valeurs, recalculer, re-présenter le tableau
3. **Si validation** : passer à Phase 4

### Phase 4.0 — Génération du rapport

1. **Lire le skill estimation-report** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-report/SKILL.md`
2. **Créer le dossier** `estimations/` si absent : `mkdir -p estimations`
3. **Générer le markdown** dans `estimations/YYYY-MM-DD-<nom-projet>-estimation.md`
4. **Générer le fichier Excel** (.xlsx) :
   - Vérifier que `openpyxl` est disponible : `python3 -c "import openpyxl"`
   - Si absent : `pip install openpyxl --quiet`
   - Écrire et exécuter le script Python inline pour générer `estimations/YYYY-MM-DD-<nom-projet>-estimation.xlsx`
   - Le fichier Excel contient 5 feuilles : Traditionnel, Accéléré IA, Comparatif, Risque, Paramètres
   - La feuille "Paramètres" documente : nature du projet, équipe retenue, facteur de reproduction, infrastructure %, taux utilisés, facteurs IA, modifications manuelles
5. **Confirmer** :
   ```
   Rapport d'estimation généré :
   - Markdown : estimations/YYYY-MM-DD-<nom-projet>-estimation.md
   - Excel : estimations/YYYY-MM-DD-<nom-projet>-estimation.xlsx (5 feuilles)

   Traditionnel : XX XXX $ | IA-assisté : XX XXX $ | Économie : XX%
   ```

## Règles critiques

- **Ne jamais inventer des blocs ou tâches** qui ne sont pas dans le CDC
- **Toujours attendre la validation** avant de passer à la phase suivante (blocs, tâches, calculs)
- **Montants en CAD**, séparateur d'espace, convention québécoise (`12 500 $`)
- **Taxes exclues** de tous les montants
- **Risque par bloc** : chaque bloc a son propre facteur de risque, visible dans le tableau Phase 3 et dans le rapport
- Si le CDC a **20+ blocs**, regrouper par module/section dans les tableaux
- Le facteur de risque global est la **moyenne pondérée** des facteurs par bloc (pondérée par les coûts bruts)
