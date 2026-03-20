# somtech-estimator

Plugin Cowork pour l'estimation de projets forfaitaires à partir d'un cahier des charges (CDC).

## Commande

### `/estimer [chemin-vers-cdc.docx]`

Produit un rapport d'estimation comparant deux modèles :

1. **Traditionnel** — jours-personne par rôle avec taux du marché québécois
2. **IA-assisté** — mêmes rôles avec facteurs d'accélération IA par type de tâche et par rôle

Inclut une analyse de risque **par bloc fonctionnel** (complexité technique + dépendances hors contrôle) avec facteur multiplicateur propre à chaque bloc, et une sous-décomposition en tâches concrètes.

## Prérequis

- Un fichier .docx de cahier des charges (CDC) accessible dans le workspace
- Compatible avec les CDC produits par `/complete-cahier` de somtech-proposals
- Python 3 avec openpyxl (installé automatiquement si absent)

## Ce que le plugin produit

- **Markdown** : `estimations/YYYY-MM-DD-<nom-projet>-estimation.md` — fichier de travail versionnable avec détail par bloc, tâches et risque par bloc
- **Excel (.xlsx)** : rapport client structuré en 4 feuilles (Traditionnel, Accéléré IA, Comparatif, Risque)

## Pipeline

1. **Extraction** — Parse le CDC et identifie les blocs fonctionnels
2. **Sous-décomposition** — Chaque bloc est décomposé en tâches concrètes, soumises à validation
3. **Calcul** — Estime l'effort (trad + IA), évalue les risques par bloc
4. **Review** — Présente un tableau récapitulatif par bloc (avec tâches et risque) pour validation/ajustement
5. **Génération** — Produit les livrables (markdown + Excel 4 feuilles)

## Structure Excel

Le fichier `.xlsx` contient 4 feuilles :

| Feuille | Contenu |
|---------|---------|
| **Traditionnel** | Breakdown par bloc → tâches → rôles, jours, coûts. Sous-totaux brut et avec risque par bloc. |
| **Accéléré IA** | Même structure avec facteurs IA appliqués par rôle/type. |
| **Comparatif** | Tableau par rôle : jours trad vs IA, économies. Totaux avec/sans risque. |
| **Risque** | Analyse par bloc : scores, facteur, coût brut, impact risque ($), coût avec risque. |

## Configuration

Les données de référence sont dans `templates/defaults.json` :

- **Taux journaliers** : mis à jour selon le marché québécois actuel
- **Facteurs IA par rôle** : facteurs distincts pour Dev et non-Dev, par type de tâche
- **Types de tâches supportés** : `crud`, `integration_api`, `auth`, `ui_composant`, `reporting`, `migration_data`, `gestion_projet`, `autre`
- **Grille de risque** : scores complexité + dépendances externes → facteur ×1.00 à ×1.50 par bloc
- **Allocation des rôles** : répartition par type de tâche
- **Effort de base** : fourchettes en jours par type × complexité (simple/moyen/complexe)

Pour personnaliser, modifier `defaults.json` avant d'exécuter `/estimer`.

## Risque par bloc

Chaque bloc reçoit un facteur de risque indépendant basé sur :
- **Score complexité** (1–5) : complexité technique intrinsèque du bloc
- **Score dépendances** (1–5) : dépendances externes hors contrôle

Le facteur global de l'estimation est la **moyenne pondérée** des facteurs par bloc (pondérée par les coûts bruts).

Le rapport affiche systématiquement :
- Coût brut du bloc
- Coût avec risque du bloc (brut × facteur)

## Gabarit Excel

Le fichier Excel est généré dynamiquement via Python (openpyxl) — aucun gabarit préexistant requis. Voir `templates/ESTIMATION-REPORT-TEMPLATE.md` pour les spécifications de formatage.

## Version

0.2.0
