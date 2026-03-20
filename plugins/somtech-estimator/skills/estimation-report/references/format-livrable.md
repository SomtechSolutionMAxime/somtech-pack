# Template du rapport d'estimation

## Conventions de formatage

- **Devise** : CAD ($), taxes exclues
- **Format des montants** : Séparateur d'espace pour les milliers, convention québécoise (ex : `12 500 $`)
- **Arrondi montants** : À l'unité (pas de centimes)
- **Arrondi jours** : Au 0.5 le plus proche
- **Facteur de risque** : 2 décimales (ex : `1.25`)
- **Facteur de risque par bloc** : affiché avec le préfixe × (ex : `×1.20`)

---

## Template markdown

Le rapport est généré dans `estimations/YYYY-MM-DD-<nom-projet>-estimation.md` (dans le projet courant, pas dans le plugin).

~~~markdown
# Estimation — [Nom du projet]
Date: YYYY-MM-DD
Source: [nom-du-cdc.docx]

## Sommaire exécutif

| | Traditionnel | IA-assisté |
|---|---|---|
| Coût brut | XX XXX $ | XX XXX $ |
| Architecte (5%) | X XXX $ | X XXX $ |
| Marge de risque (×X.XX) | X XXX $ | X XXX $ |
| **Total avec risque** | **XX XXX $** | **XX XXX $** |

- Économie projetée : XX% (XX XXX $)
- Facteur de risque global : ×X.XX

## Détail par bloc fonctionnel

### 1. [Nom du bloc]
- **Type** : CRUD / Intégration API / etc.
- **Complexité** : Simple / Moyen / Complexe
- **Risque** : Complexité X/5 | Dépendances X/5 → Facteur ×X.XX

**Tâches incluses** :
- [Tâche 1]
- [Tâche 2]
- [Tâche 3]

| Rôle | Trad. (j) | Trad. ($) | IA (j) | IA ($) |
|------|-----------|-----------|--------|--------|
| Dev Senior | X | X XXX $ | X | X XXX $ |
| Dev Junior | X | X XXX $ | X | X XXX $ |
| Designer | X | X XXX $ | X | X XXX $ |
| PM | X | X XXX $ | X | X XXX $ |
| QA | X | X XXX $ | X | X XXX $ |
| **Sous-total brut** | **X** | **X XXX $** | **X** | **X XXX $** |
| **Sous-total avec risque (×X.XX)** | | **X XXX $** | | **X XXX $** |

### 2. [Bloc suivant]
- **Type** : ...
- **Complexité** : ...
- **Risque** : Complexité X/5 | Dépendances X/5 → Facteur ×X.XX

**Tâches incluses** :
- [Tâche 1]
- ...

| Rôle | Trad. (j) | Trad. ($) | IA (j) | IA ($) |
|------|-----------|-----------|--------|--------|
| ...  | ... | ... $ | ... | ... $ |
| **Sous-total brut** | **X** | **X XXX $** | **X** | **X XXX $** |
| **Sous-total avec risque (×X.XX)** | | **X XXX $** | | **X XXX $** |

## Synthèse

| | Trad. | IA-assisté |
|---|-------|------------|
| Jours totaux | X | X |
| Coût brut | X XXX $ | X XXX $ |
| Architecte (5%) | X XXX $ | X XXX $ |
| Marge de risque (×X.XX) | X XXX $ | X XXX $ |
| **Total avec risque** | **X XXX $** | **X XXX $** |
| **Économie** | | **XX% (X XXX $)** |

## Hypothèses et exclusions

### Hypothèses
- [Hypothèse 1 posée pendant l'estimation]
- [Hypothèse 2]

### Exclusions
- [Ce qui n'est pas inclus dans cette estimation]
- [Intégrations tierces non documentées dans le CDC]

## Paramètres utilisés

### Taux journaliers
| Rôle | Taux/jour |
|------|-----------|
| Dev Senior | X XXX $ |
| Dev Junior | X XXX $ |
| Designer | X XXX $ |
| PM | X XXX $ |
| QA | X XXX $ |
| Architecte | X XXX $ |

### Facteurs IA appliqués
| Type de tâche | Facteur Dev | Facteur non-Dev |
|---------------|-------------|-----------------|
| crud | -XX% | -15% |
| integration_api | -XX% | -15% |
| auth | -XX% | -15% |
| ui_composant | -XX% | -15% |
| reporting | -XX% | -15% |
| migration_data | -XX% | -15% |
| gestion_projet | N/A | -15% |
| autre | -XX% | -15% |

*Note : si des paramètres ont été modifiés par l'utilisateur pendant la Phase 3, indiquer les valeurs modifiées.*
~~~

---

## Structure Excel (.xlsx)

Le rapport Excel est généré automatiquement via Python (openpyxl). Il contient 4 feuilles :

### Feuille "Traditionnel"
- En-tête : nom projet, date, source CDC
- Colonnes : Bloc | Tâche | Rôle | Jours | Taux/jour | Coût
- Sous-total brut par bloc (gras, fond #D9E1F2)
- Sous-total avec risque par bloc (×X.XX) (gras, fond #D9E1F2)
- Ligne architecte (5%)
- Total général (gras, fond #E2EFDA)

### Feuille "Accéléré IA"
- Même structure que Traditionnel
- Colonnes supplémentaires : Facteur IA | Jours IA | Coût IA
- Sous-totaux bruts et avec risque par bloc

### Feuille "Comparatif"
- Par rôle : Jours trad | Jours IA | Écon. jours | Écon. % | Taux/jour | Coût trad | Coût IA | Écon. $
- Totaux bruts, architecte, totaux avec risque, économie globale
- Section hypothèses du mode accéléré

### Feuille "Risque"
- Par bloc : Score complexité | Score dépendances | Score moyen | Facteur | Coût brut | Impact risque ($) | Coût avec risque
- Facteur global pondéré
- Impact total du risque en $

### Formatage
- En-têtes : fond #1F4E79, texte blanc, gras
- Alternance de lignes : #F2F2F2 / #FFFFFF
- Sous-totaux : gras, fond #D9E1F2
- Totaux : gras, fond #E2EFDA
- Montants : format comptable CAD (ex : `12 500 $`)
