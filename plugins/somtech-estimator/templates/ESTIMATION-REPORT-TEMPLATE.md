# Gabarit Excel estimation

Le rapport Excel est généré automatiquement par le plugin via Python (openpyxl). Aucun gabarit préexistant n'est requis.

## Structure des feuilles

### Feuille "Traditionnel"

- En-tête : nom projet, date, source CDC (ligne de titre fusionnée sur toutes les colonnes)
- Colonnes : Bloc | Tâche | Rôle | Jours | Taux/jour | Coût
- Une ligne par combinaison tâche × rôle, regroupée par bloc fonctionnel
- **Sous-total brut par bloc** : somme des coûts des tâches/rôles du bloc (gras, fond #D9E1F2)
- **Sous-total avec risque par bloc** (×X.XX) : sous-total brut × facteur du bloc (gras, fond #D9E1F2)
- Ligne architecte (5% sur le total brut global)
- **Total général** : total brut + architecte + risque global (gras, fond #E2EFDA)

### Feuille "Accéléré IA"

- Même structure que "Traditionnel"
- Colonnes supplémentaires : Facteur IA | Jours IA | Coût IA
- Jours et coûts calculés avec les facteurs IA appliqués par rôle et par type de tâche
- Sous-totaux bruts et avec risque par bloc (mêmes facteurs de risque par bloc)

### Feuille "Comparatif"

- Tableau par rôle :
  - Jours trad | Jours IA | Écon. jours | Écon. % | Taux/jour | Coût trad | Coût IA | Écon. $
- Section totaux :
  - Total brut trad / IA
  - Architecte (5%) trad / IA
  - Marge de risque trad / IA
  - Total avec risque trad / IA
  - Économie totale ($) et (%)
- Section hypothèses du mode accéléré :
  - Liste des facteurs IA utilisés par type de tâche (Dev vs non-Dev)

### Feuille "Risque"

- Tableau par bloc :
  - Bloc | Score complexité (1–5) | Score dépendances (1–5) | Score moyen | Facteur ×X.XX | Coût brut | Impact risque ($) | Coût avec risque
- Ligne facteur global pondéré (moyenne pondérée par les coûts bruts)
- Impact total du risque en $

### Feuille "Paramètres"

Documente toutes les décisions prises pendant l'estimation :
- **Nature du projet** : custom / data-BI / config / migration / hybride
- **Équipe retenue** : liste des rôles avec volumes (jours), et rôles exclus avec justification
- **Facteur de reproduction** : valeur appliquée (ex : 0.65), blocs concernés, justification extraite du CDC
- **Infrastructure** : premier module ou additionnel (% appliqué, coût infra de référence)
- **Taux journaliers utilisés** : tableau rôle → taux/jour
- **Facteurs IA appliqués** : tableau type de tâche → facteur Dev → facteur non-Dev
- **Modifications manuelles faites en Phase 3** : liste des ajustements effectués par l'utilisateur

## Formatage

| Élément | Style |
|---------|-------|
| En-têtes de colonnes | Fond #1F4E79, texte blanc, gras |
| Ligne de titre (en-tête feuille) | Fond #1F4E79, texte blanc, gras, 14pt |
| Alternance de lignes | #F2F2F2 / #FFFFFF |
| Sous-totaux par bloc | Gras, fond #D9E1F2 |
| Totaux généraux | Gras, fond #E2EFDA |
| Montants | Format comptable CAD : `# ##0 "$"` (ex : `12 500 $`) |
| Jours | Format décimal 1 chiffre (ex : `3.5`) |
| Pourcentages | Format `0%` |
| Facteurs de risque | Format `×0.00` |
| Largeur colonnes | Auto-ajustée (min 12, max 40 caractères) |
| Bordures | Bordures fines sur toutes les cellules de données |

## Exemple de script Python (structure générale)

```python
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

COULEUR_ENTETE = "1F4E79"
COULEUR_SUBTOTAL = "D9E1F2"
COULEUR_TOTAL = "E2EFDA"
COULEUR_LIGNE_PAIRE = "F2F2F2"
COULEUR_LIGNE_IMPAIRE = "FFFFFF"

def style_entete(cell):
    cell.font = Font(bold=True, color="FFFFFF", size=11)
    cell.fill = PatternFill("solid", fgColor=COULEUR_ENTETE)
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

def style_subtotal(cell):
    cell.font = Font(bold=True)
    cell.fill = PatternFill("solid", fgColor=COULEUR_SUBTOTAL)

def style_total(cell):
    cell.font = Font(bold=True)
    cell.fill = PatternFill("solid", fgColor=COULEUR_TOTAL)

def format_montant(cell):
    cell.number_format = '# ##0 "$"'

wb = openpyxl.Workbook()

# Feuille Traditionnel
ws_trad = wb.active
ws_trad.title = "Traditionnel"
# ... remplir la feuille ...

# Feuille Accéléré IA
ws_ia = wb.create_sheet("Accéléré IA")
# ...

# Feuille Comparatif
ws_comp = wb.create_sheet("Comparatif")
# ...

# Feuille Risque
ws_risk = wb.create_sheet("Risque")
# ...

# Feuille Paramètres
ws_params = wb.create_sheet("Paramètres")
# ... documenter nature projet, équipe, facteur reproduction, infrastructure, taux, facteurs IA, modifications ...

# Auto-ajuster les largeurs
for ws in [ws_trad, ws_ia, ws_comp, ws_risk, ws_params]:
    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=0)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(max_len + 2, 12), 40)

wb.save("estimations/YYYY-MM-DD-nom-projet-estimation.xlsx")
```

## Fallback CSV

Si `openpyxl` ne peut pas être installé, générer 5 fichiers CSV séparés :
- `estimations/YYYY-MM-DD-nom-projet-traditionnel.csv`
- `estimations/YYYY-MM-DD-nom-projet-accelere-ia.csv`
- `estimations/YYYY-MM-DD-nom-projet-comparatif.csv`
- `estimations/YYYY-MM-DD-nom-projet-risque.csv`
- `estimations/YYYY-MM-DD-nom-projet-parametres.csv`
