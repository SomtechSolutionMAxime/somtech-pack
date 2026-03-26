---
name: estimation-report
description: >
  Ce skill génère le rapport d'estimation final en deux formats : markdown
  (fichier de travail versionnable) et .xlsx (document client structuré en
  plusieurs feuilles). Déclenché après la validation utilisateur en Phase 3
  du pipeline d'estimation. Inclut le risque par bloc et la sous-décomposition
  en tâches.
version: 0.4.0
---

# Skill: estimation-report

Génération des livrables d'estimation (markdown + .xlsx).

## Responsabilités

1. Générer le rapport markdown dans le projet (fichier de travail)
2. Générer le rapport Excel (.xlsx) client via Python (openpyxl)

---

## Phase 4a — Rapport Markdown

**Emplacement** : `estimations/YYYY-MM-DD-<nom-projet>-estimation.md` (dans le projet courant, pas dans le plugin)

**Format** : Voir `${CLAUDE_PLUGIN_ROOT}/skills/estimation-report/references/format-livrable.md` pour le template exact.

**Règles de formatage** :
- Montants en CAD ($), taxes exclues
- Séparateur d'espace pour les milliers : `12 500 $` (convention québécoise)
- Arrondir les montants à l'unité (pas de centimes)
- Arrondir les jours au 0.5 le plus proche
- Le facteur de risque global est affiché avec 2 décimales (ex : `1.25`)
- Le facteur de risque par bloc est affiché avec 2 décimales (ex : `×1.20`)

**Contenu obligatoire** :
1. **Sommaire exécutif** : totaux trad/IA, économie projetée (% et $), facteur de risque global
2. **Détail par bloc fonctionnel** : chaque bloc contient ses tâches (sous-décomposition), tableau par rôle avec jours et coûts (trad + IA), puis sous-total brut et sous-total avec risque
3. **Synthèse** : tableau comparatif avec coût brut, architecte, marge de risque, total avec risque — pour chaque modèle (trad et IA)
4. **Hypothèses et exclusions** : lister les hypothèses posées pendant l'estimation et ce qui n'est pas inclus
5. **Paramètres utilisés** : taux journaliers, facteurs IA utilisés (surtout si modifiés par l'utilisateur)

**Structure du détail par bloc — Mode Formule** :

```markdown
### 1. [Nom du bloc]
- **Type** : CRUD / Intégration API / etc.
- **Complexité** : Simple / Moyen / Complexe
- **Risque** : Complexité X/5 | Dépendances X/5 → Facteur ×X.XX

**Tâches incluses** :
- [Tâche 1]
- [Tâche 2]
- ...

| Rôle | Trad. (j) | Trad. ($) | IA (j) | IA ($) |
|------|-----------|-----------|--------|--------|
| Dev Senior | X | X $ | X | X $ |
| Dev Junior | X | X $ | X | X $ |
| Designer   | X | X $ | X | X $ |
| PM         | X | X $ | X | X $ |
| QA         | X | X $ | X | X $ |
| **Sous-total brut** | **X** | **X $** | **X** | **X $** |
| **Sous-total avec risque (×X.XX)** | | **X $** | | **X $** |
```

**Structure du détail par bloc — Mode Direct** :

```markdown
### 1. [Nom du bloc]
- **Risque** : Complexité X/5 | Dépendances X/5 → Facteur ×X.XX

| Tâche | Type | Jours Trad | Jours IA | Coût Trad | Coût IA |
|-------|------|-----------|----------|-----------|---------|
| [Tâche 1] | crud | X | X | X $ | X $ |
| [Tâche 2] | logique_metier | X | X | X $ | X $ |
| **Sous-total brut** | | **X** | **X** | **X $** | **X $** |
| **Avec risque (×X.XX)** | | | | **X $** | **X $** |

### Overhead projet (bloc fixe, hors risque)

| Rôle | Jours Trad | Jours IA | Coût Trad | Coût IA |
|------|-----------|----------|-----------|---------|
| PM | X | X | X $ | X $ |
| QA | X | X | X $ | X $ |
| Designer | X | X | X $ | X $ |
| Architecte | X | X | X $ | X $ |
| **Total overhead** | **X** | **X** | **X $** | **X $** |
```

---

## Phase 4b — Rapport Excel (.xlsx)

**Emplacement** : `estimations/YYYY-MM-DD-<nom-projet>-estimation.xlsx`

**Méthode** : Générer via Python avec `openpyxl`. Écrire le script Python inline dans un bloc bash et l'exécuter.

### Structure du fichier Excel

Le fichier contient 5 feuilles :

#### Feuille 1 : "Traditionnel"

- En-tête : nom du projet, date, source CDC (ligne de titre fusionnée)
- Colonnes : Bloc | Tâche | Rôle | Jours | Taux/jour | Coût
- Regroupement par bloc fonctionnel (une ligne par tâche × rôle)
- Sous-total brut par bloc (somme des coûts des tâches/rôles du bloc)
- Sous-total avec risque par bloc (sous-total brut × facteur du bloc)
- **Mode formule** : Ligne architecte (5% sur le total brut global)
- **Mode direct** : Bloc "Overhead projet" séparé (PM, QA, Designer, Architecte en jours fixes, hors risque)
- Total général brut et total avec risque

#### Feuille 2 : "Accéléré IA"

- Même structure que "Traditionnel"
- **Mode formule** : Jours et coûts calculés avec les facteurs IA appliqués par rôle/type, facteur IA affiché par rôle dans une colonne dédiée
- **Mode direct** : Jours IA estimés directement par tâche, overhead IA = overhead trad × (1 - réduction par rôle)
- Sous-totaux bruts et avec risque par bloc

#### Feuille 3 : "Comparatif"

- Tableau par rôle : Jours trad | Jours IA | Écon. jours | Écon. % | Taux/jour | Coût trad | Coût IA | Écon. $
- Section totaux :
  - Total brut trad / IA
  - Architecte (5%) trad / IA
  - Total avec risque trad / IA
  - Économie totale ($) et (%)
- Section hypothèses du mode accéléré (liste des facteurs IA utilisés par type)

#### Feuille 4 : "Risque"

- Tableau par bloc : Bloc | Score complexité | Score dépendances | Score moyen | Facteur ×X.XX | Coût brut | Impact risque ($) | Coût avec risque
- Ligne de facteur global pondéré (pondéré par les coûts bruts)
- Impact total du risque en $

#### Feuille 5 : "Paramètres"

Documente toutes les décisions prises pendant l'estimation :
- **Mode d'estimation** : Formule (Phase 2A) ou Direct (Phase 2B) — avec justification
- Nature du projet (custom / data-BI / config / migration / hybride)
- Équipe retenue (rôles, volumes, rôles exclus)
- Facteur de reproduction (valeur, blocs concernés, justification)
- Infrastructure : premier module ou additionnel (% appliqué, coût infra référence)
- Taux journaliers utilisés
- **Mode formule** : Facteurs IA appliqués par type, allocation par rôle
- **Mode direct** : Jours overhead par rôle (référence grille + ajustements)
- Modifications manuelles faites en Phase 3

### Formatage Excel

- **En-têtes de colonnes** : fond #1F4E79, texte blanc, gras
- **Alternance de lignes** : #F2F2F2 / #FFFFFF
- **Sous-totaux** : gras, fond #D9E1F2
- **Totaux généraux** : gras, fond #E2EFDA
- **Format montants** : `#,##0 "$"` (ex : `12 500 $`)
- **Largeur colonnes** : auto-ajustée au contenu (min 12, max 40)

### Script Python (modèle)

Générer le script inline et l'exécuter via bash :

```bash
python3 - <<'PYEOF'
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# --- Données d'estimation (injecter depuis le calcul Phase 2) ---
projet = "Nom du projet"
date_str = "YYYY-MM-DD"
source_cdc = "nom-du-cdc.docx"

# blocs = liste de dicts avec :
#   name, type, risque_score_complexite, risque_score_dependances,
#   risque_facteur, taches (liste de str),
#   roles (dict rôle → {jours_trad, cout_trad, ia_factor, jours_ia, cout_ia})
blocs = [ ... ]

taux_journaliers = { ... }

# --- Génération ---
wb = openpyxl.Workbook()
# ... créer les 4 feuilles ...
wb.save(f"estimations/{date_str}-{projet.lower().replace(' ', '-')}-estimation.xlsx")
print("Excel généré.")
PYEOF
```

### Gestion d'erreurs

- **Si `openpyxl` n'est pas disponible** : tenter `pip install openpyxl --quiet` puis réessayer
- **Si l'installation échoue** : générer un fallback CSV par feuille (`-traditionnel.csv`, `-accelere-ia.csv`, `-comparatif.csv`, `-risque.csv`, `-parametres.csv`) et informer l'utilisateur
- **Si le dossier `estimations/` n'existe pas** dans le projet courant, le créer avec `mkdir -p estimations`
