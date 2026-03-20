# somtech-estimator

Plugin Cowork pour l'estimation de projets forfaitaires à partir d'un cahier des charges (CDC).

## Commande

### `/estimer [chemin-vers-cdc.docx]`

Produit un document d'estimation comparant deux modèles :

1. **Traditionnel** — jours-personne par rôle avec taux du marché québécois
2. **IA-assisté** — mêmes rôles avec facteurs d'accélération IA par type de tâche

Inclut une analyse de risque (complexité technique + dépendances hors contrôle) avec un facteur multiplicateur.

## Prérequis

- Un fichier .docx de cahier des charges (CDC) accessible dans le workspace
- Compatible avec les CDC produits par `/complete-cahier` de somtech-proposals

## Ce que le plugin produit

- **Markdown** : `estimations/YYYY-MM-DD-<nom-projet>-estimation.md` — fichier de travail versionnable
- **.docx** : rapport client avec branding Somtech (si gabarit Word disponible)

## Pipeline

1. **Extraction** — Parse le CDC et identifie les features/module
2. **Calcul** — Estime l'effort (trad + IA), évalue les risques
3. **Review** — Présente un tableau récapitulatif pour validation/ajustement
4. **Génération** — Produit les livrables (markdown + .docx)

## Configuration

Les données de référence sont dans `templates/defaults.json` :

- **Taux journaliers** : Dev Senior (1 200 $), Dev Junior (750 $), Designer (1 000 $), PM (1 100 $), QA (850 $), Architecte (1 400 $)
- **Facteurs IA** : réduction de 25% à 80% selon le type de tâche (Dev uniquement, PM/QA/Designer = 15% fixe)
- **Grille de risque** : scores complexité + dépendances externes → facteur ×1.00 à ×1.50
- **Allocation des rôles** : répartition par type de tâche (8 types × 5 rôles)
- **Effort de base** : fourchettes en jours par type × complexité (simple/moyen/complexe)

Pour personnaliser, modifier `defaults.json` avant d'exécuter `/estimer`.

## Gabarit Word

Le fichier `templates/estimation-report.docx` doit être créé manuellement avec le branding Somtech. Voir `templates/ESTIMATION-REPORT-TEMPLATE.md` pour les spécifications. Sans ce gabarit, seul le rapport markdown est généré.

## Version

0.1.0
