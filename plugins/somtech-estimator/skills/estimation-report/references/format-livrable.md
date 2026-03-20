# Template du rapport d'estimation

## Conventions de formatage

- **Devise** : CAD ($), taxes exclues
- **Format des montants** : Séparateur d'espace pour les milliers, convention québécoise (ex: `12 500 $`)
- **Arrondi montants** : À l'unité (pas de centimes)
- **Arrondi jours** : Au 0.5 le plus proche
- **Facteur de risque** : 2 décimales (ex: `1.25`)

## Template markdown

Le rapport est généré dans `estimations/YYYY-MM-DD-<nom-projet>-estimation.md` (dans le projet courant, pas dans le plugin).

~~~markdown
# Estimation — [Nom du projet]
Date: YYYY-MM-DD
Source: [nom-du-cdc.docx]

## Sommaire exécutif
- Estimation traditionnelle: XX XXX $
- Estimation IA-assistée: XX XXX $
- Économie projetée: XX% (XX XXX $)
- Facteur de risque global: X.XX

## Détail par feature

### 1. [Nom de la feature]
- **Type**: CRUD / Intégration API / etc.
- **Complexité**: Simple / Moyen / Complexe
- **Risque**: Complexité X/5 | Dépendances X/5 → Facteur X.XX

| Rôle | Trad. (jours) | Trad. ($) | IA (jours) | IA ($) |
|------|---------------|-----------|------------|--------|
| Dev Senior | X | X $ | X | X $ |
| Dev Junior | X | X $ | X | X $ |
| Designer | X | X $ | X | X $ |
| PM | X | X $ | X | X $ |
| QA | X | X $ | X | X $ |
| **Sous-total** | **X** | **X $** | **X** | **X $** |

### 2. [Feature suivante...]
...

## Synthèse

| | Trad. | IA-assisté |
|---|-------|------------|
| Jours totaux | X | X |
| Coût brut | X $ | X $ |
| Architecte (5%) | X $ | X $ |
| Marge de risque (×X.XX) | X $ | X $ |
| **Total avec risque** | **X $** | **X $** |

## Hypothèses et exclusions
- [Hypothèses posées pendant l'estimation]
- [Ce qui n'est pas inclus]

## Paramètres utilisés

### Taux journaliers
| Rôle | Taux/jour |
|------|-----------|
| ... | ... $ |

### Facteurs IA appliqués
| Type | Réduction |
|------|-----------|
| ... | XX% |

*Note : si des paramètres ont été modifiés par l'utilisateur pendant la Phase 3, indiquer les valeurs modifiées.*
~~~

## Template .docx

Le .docx suit le même contenu, mis en forme avec le branding Somtech via le gabarit `${CLAUDE_PLUGIN_ROOT}/templates/estimation-report.docx` (méthode unpack/edit/repack).
