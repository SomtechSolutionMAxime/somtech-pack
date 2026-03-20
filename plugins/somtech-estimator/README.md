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
- **Excel (.xlsx)** : rapport client structuré en 5 feuilles (Traditionnel, Accéléré IA, Comparatif, Risque, Paramètres)

## Pipeline

1. **Qualification** — Identifie la nature du projet, détecte le facteur de reproduction, détermine le type d'infrastructure
2. **Extraction** — Parse le CDC et identifie les blocs fonctionnels
3. **Sous-décomposition** — Chaque bloc est décomposé en tâches concrètes, soumises à validation
4. **Équipe** — Propose la composition d'équipe selon les volumes calculés
5. **Calcul** — Estime l'effort (trad + IA), applique reproduction et infra, évalue les risques par bloc
6. **Review** — Présente un tableau récapitulatif par bloc (avec tâches et risque) pour validation/ajustement
7. **Génération** — Produit les livrables (markdown + Excel 5 feuilles)

## Structure Excel

Le fichier `.xlsx` contient 5 feuilles :

| Feuille | Contenu |
|---------|---------|
| **Traditionnel** | Breakdown par bloc → tâches → rôles, jours, coûts. Sous-totaux brut et avec risque par bloc. |
| **Accéléré IA** | Même structure avec facteurs IA appliqués par rôle/type. |
| **Comparatif** | Tableau par rôle : jours trad vs IA, économies. Totaux avec/sans risque. |
| **Risque** | Analyse par bloc : scores, facteur, coût brut, impact risque ($), coût avec risque. |
| **Paramètres** | Nature projet, équipe retenue, facteur de reproduction, infrastructure, taux, facteurs IA, modifications. |

## Configuration

Les données de référence sont dans `templates/defaults.json` :

- **Taux journaliers** : mis à jour selon le marché québécois actuel
- **Facteurs IA par rôle** : facteurs distincts pour Dev et non-Dev, par type de tâche
- **Types de tâches supportés** : `crud`, `integration_api`, `auth`, `ui_composant`, `reporting`, `migration_data`, `gestion_projet`, `autre`, `etl_data`, `dashboard_config`, `migration_donnees`
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

## Qualification du projet (v0.3.0+)

Avant l'extraction des blocs, le plugin qualifie le projet selon sa nature dominante :

| Nature | Indicateurs | Types de tâches privilégiés |
|--------|-------------|----------------------------|
| Développement custom | App web, API, UI, formulaires | crud, ui_complexe, logique_metier, auth_securite |
| Data / BI | ETL, entrepôt, dashboards, KPI, Superset, PowerBI | etl_data, dashboard_config |
| Configuration | Paramétrage outil, intégration API | dashboard_config, integration_api |
| Migration | Remplacement système, import données | migration_donnees, etl_data |
| Hybride | Mix des précédents | Par bloc selon sa nature |

La qualification est présentée à l'utilisateur pour validation avant l'extraction.

## Nouveaux types de tâches (v0.3.0+)

Trois types supplémentaires couvrent les projets Data/BI et migration :

| Type | Cas d'usage |
|------|-------------|
| `etl_data` | ETL, pipeline de données, transformation SQL, vues matérialisées, entrepôt de données, data warehouse |
| `dashboard_config` | Dashboard BI, Superset, PowerBI, Metabase, KPI, rapports analytiques |
| `migration_donnees` | Migration de données, import depuis un système existant, scripts de réconciliation, conversion |

## Proposition d'équipe projet (v0.3.0+)

Après la sous-décomposition, le plugin analyse les volumes par rôle et propose une composition d'équipe :

- Rôles avec moins de 2 jours total → recommandés ❌ (non requis)
- Rôles avec 2-5 jours → recommandés à temps partiel
- Rôles avec 5+ jours → recommandés plein temps

L'utilisateur peut ajouter ou retirer des rôles. Les rôles exclus sont mis à 0% d'allocation et leurs jours sont redistribués proportionnellement.

## Facteur de reproduction (v0.3.0+)

Quand le CDC décrit un remplacement ou une reproduction d'un outil existant ("remplacer", "reproduire", "migrer depuis", "équivalent à"), le plugin propose un facteur de reproduction (défaut : 0.65, plage : 0.50–1.00).

Ce facteur est appliqué sur les blocs identifiés comme reproduction : `effort_ajusté = effort_base × facteur_reproduction`

## Infrastructure initiale vs additionnelle (v0.3.0+)

Le plugin demande si le module est le premier du système ou un module additionnel :

- **Premier module** : un bloc "Infrastructure initiale" est ajouté automatiquement (auth, CI/CD, design system, architecture, domaine)
- **Module additionnel** : un pourcentage d'infrastructure est appliqué (0% à 50%) selon l'impact sur l'existant :
  - 0% = aucune modification
  - 10% = ajustements mineurs
  - 20% = modifications modérées
  - 30% = modifications significatives

## Version

0.3.0
