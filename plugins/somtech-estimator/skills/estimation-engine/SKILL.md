---
name: estimation-engine
description: >
  Ce skill doit être utilisé quand l'utilisateur demande à "estimer un projet",
  "calculer les coûts", "analyser un cahier des charges pour estimation",
  "évaluer le risque d'un projet", ou a besoin d'extraire les features d'un CDC
  et de produire une estimation en jours-personne. Aussi déclenché par
  "estimation", "forfait", "coûts", "jours-personne", "facteur de risque".
version: 0.2.0
---

# Skill: estimation-engine

Moteur d'extraction et de calcul pour l'estimation de projets forfaitaires.

## Responsabilités

1. Parser un CDC .docx et extraire la liste des features/modules
2. Sous-décomposer chaque feature en tâches individuelles
3. Catégoriser chaque tâche par type
4. Estimer l'effort en jours par tâche (traditionnel + IA-assisté)
5. Évaluer les risques par feature/bloc et calculer le facteur global
6. Présenter le tableau récapitulatif avec coûts bruts et avec risque par bloc

## Phase 1 — Extraction du CDC

### Entrée

Un fichier .docx de cahier des charges. Seul le format .docx est accepté.

### Processus d'extraction

1. Lire le .docx (méthode unpack : extraire le XML de `word/document.xml`)
2. Identifier les sections qui décrivent des features/modules :
   - Chercher les titres de niveau 2+ (Heading2, Heading3) qui décrivent des fonctionnalités
   - Chercher les listes numérotées de features/exigences
   - Ignorer les sections génériques (contexte, introduction, glossaire, annexes)
3. Pour chaque feature extraite, capturer :
   - **Nom** : titre de la section ou description courte
   - **Description** : contenu textuel de la section
   - **Type de tâche** : catégoriser selon les 9 types définis (voir référence)
   - **Complexité** : simple / moyen / complexe (selon la description)

### Types de tâches reconnus

| Type | Indicateurs dans le CDC |
|------|------------------------|
| `crud` | Formulaire, saisie, liste, CRUD, gestion de [entité] |
| `pages_statiques` | Page d'information, contenu statique, à propos, FAQ |
| `ui_complexe` | Dashboard, tableau de bord, drag & drop, graphiques, filtres avancés |
| `logique_metier` | Calcul, workflow, règles métier, processus, validation complexe |
| `integration_api` | API tierce, intégration, synchronisation, webhook, import/export externe |
| `auth_securite` | Authentification, autorisation, rôles, permissions, SSO, 2FA |
| `infrastructure` | Déploiement, CI/CD, monitoring, performance, cache, CDN |
| `reporting` | Rapport, export PDF/Excel, statistiques, métriques, analytics |
| `gestion_projet` | Gestion de projet, suivi, points de contrôle, accompagnement, coordination |

### Sous-décomposition en tâches

Après l'extraction des features de haut niveau, **chaque feature est décomposée en tâches individuelles** avant toute estimation. Cette étape est obligatoire — elle produit la granularité nécessaire pour une estimation précise.

**Principe** : une feature de haut niveau (ex: "Pipeline Kanban") génère plusieurs tâches atomiques, chacune avec son propre type et sa propre complexité.

**Exemple de décomposition** :

```
Feature: Pipeline Kanban (bloc "Gestion des projets")
  → Tâche 1: Modèle de données projets/colonnes    [crud, simple]
  → Tâche 2: CRUD fiches projets                   [crud, moyen]
  → Tâche 3: Vue Kanban drag-and-drop              [ui_complexe, complexe]
  → Tâche 4: Scoring automatique des projets       [logique_metier, moyen]
  → Tâche 5: Historique / audit log                [crud, simple]
```

**Règles de décomposition** :
- Viser 3 à 7 tâches par feature de complexité moyenne ou complexe
- Les features simples peuvent rester en 1 à 2 tâches
- Chaque tâche hérite du bloc parent (pour le regroupement dans le rapport) mais peut avoir son propre type
- Nommer les tâches de façon explicite et technique (ce qu'il faut construire, pas ce que ça fait)
- Une tâche = un livrable technique clair

### Sortie Phase 1

Liste structurée par bloc, avec tâches sous-jacentes :

```
Bloc 1: [Nom du module/feature principal]
  Risque: complexité=[1-5], dépendances=[1-5]

  Tâche 1.1: [Nom technique]
    Type: [type]
    Complexité: [simple|moyen|complexe]

  Tâche 1.2: [Nom technique]
    Type: [type]
    Complexité: [simple|moyen|complexe]

  ...

Bloc 2: [Nom du module/feature principal]
  ...
```

### Gestion d'erreurs

- **Document non-.docx** : Informer l'utilisateur que seul .docx est supporté
- **CDC non structuré** : Lister ce qui a été extrait, demander à l'utilisateur de compléter
- **Aucune feature trouvée** : Signaler et demander un autre fichier ou une saisie manuelle

## Phase 2 — Calcul automatique

Charger les données de référence depuis `${CLAUDE_PLUGIN_ROOT}/templates/defaults.json`.
Consulter `${CLAUDE_PLUGIN_ROOT}/skills/estimation-engine/references/defaults.md` pour les tableaux lisibles.

### Pour chaque tâche :

#### 2a. Effort traditionnel

1. Lire la fourchette de jours dans `effortBaseJours[type][complexité]`
2. Prendre le **milieu de la fourchette** comme estimation (arrondi au 0.5 le plus proche)
3. Répartir par rôle selon `allocationRoles[type]` :
   - `jours_role = effort_total × allocation_role`
4. Calculer le coût : `cout_role = jours_role × tauxJournaliers[role]`
5. Sous-total tâche = somme des coûts par rôle

#### 2b. Évaluation des risques par bloc

Le risque est calculé **au niveau du bloc** (feature de haut niveau), pas par tâche individuelle. Évaluer deux scores (1-5) par bloc :

- **Complexité technique** : selon la grille de risque (references/defaults.md)
- **Dépendances hors contrôle** : selon la grille de risque

Calcul du facteur par bloc :
1. `score_moyen = (complexité + dépendances) / 2`
2. Mapper vers le facteur multiplicateur via `grilleRisque.facteurParScoreMoyen`

Facteur de risque global :
- `risque_global = somme(cout_bloc × facteur_bloc) / somme(cout_bloc)`
- C'est une moyenne pondérée par le coût de chaque bloc

#### 2c. Estimation IA-assistée

Pour chaque tâche et chaque rôle, appliquer le facteur IA **spécifique au rôle** :

- **`dev_senior`** : `jours_ia = jours_trad × (1 - reductionIA[type])`
- **`dev_junior`** : `jours_ia = jours_trad × (1 - reductionIA[type])`
- **`designer`** : `jours_ia = jours_trad × (1 - 0.40)` (réduction fixe 40%)
- **`qa`** : `jours_ia = jours_trad × (1 - 0.35)` (réduction fixe 35%)
- **`pm`** : `jours_ia = jours_trad × (1 - 0.25)` (réduction fixe 25%)

Recalcul du coût : `cout_ia_role = jours_ia × tauxJournaliers[role]`

#### 2d. Architecte (surplus global)

- `cout_architecte_trad = somme(tous_couts_taches_trad) × architectePourcentageGlobal / 100`
- `jours_architecte_trad = cout_architecte_trad / tauxJournaliers.architecte`
- Même calcul pour IA-assisté

#### 2e. Totaux avec risque

Calcul des totaux globaux :

- `total_trad_brut = somme(couts_taches_trad) + cout_architecte_trad`
- `total_trad_risque = total_trad_brut × risque_global`
- Même calcul pour IA-assisté

#### 2f. Sous-totaux par bloc (affichage rapport)

Pour chaque bloc, calculer et afficher :

- `cout_bloc_brut_trad = somme(couts_taches_trad du bloc)`
- `cout_bloc_risque_trad = cout_bloc_brut_trad × facteur_risque_bloc`
- `cout_bloc_brut_ia = somme(couts_taches_ia du bloc)`
- `cout_bloc_risque_ia = cout_bloc_brut_ia × facteur_risque_bloc`

Le rapport doit afficher **pour chaque bloc** :
- Coût traditionnel brut
- Coût traditionnel avec risque (et le facteur appliqué)
- Coût IA brut
- Coût IA avec risque

## Phase 3 — Review utilisateur

Présenter le tableau récapitulatif. L'interaction utilisateur est gérée par la commande `/estimer`.

### Structure du rapport de review

Le rapport est organisé **par bloc**, avec le détail des tâches et les sous-totaux :

```
BLOC: [Nom du bloc]
  Risque: complexité=[score]/5, dépendances=[score]/5 → facteur ×[facteur]

  | Tâche              | Type          | Complexité | Jours Trad | Jours IA | Coût Trad  | Coût IA    |
  |--------------------|---------------|------------|------------|----------|------------|------------|
  | [Nom tâche 1]      | [type]        | [compl.]   | [j]        | [j]      | [X $]      | [X $]      |
  | ...                |               |            |            |          |            |            |

  Sous-total brut         : [X $] trad  |  [X $] IA
  Sous-total avec risque  : [X $] trad  |  [X $] IA  (×[facteur])

---

ARCHITECTE (surplus global, 5%) :
  Jours: [j] trad | [j] IA
  Coût : [X $] trad | [X $] IA

TOTAUX GLOBAUX :
  Brut         : [X $] trad  |  [X $] IA
  Avec risque  : [X $] trad  |  [X $] IA
  (Facteur de risque global pondéré : ×[facteur])
```

### Actions utilisateur disponibles

L'utilisateur peut :
- **Ajuster les jours** d'une tâche (recalcul automatique des coûts)
- **Modifier le type** d'une tâche (recalcul de l'allocation et du facteur IA)
- **Changer un score de risque** d'un bloc (recalcul du facteur)
- **Modifier un facteur IA** pour une tâche spécifique
- **Valider tel quel** pour passer à la génération
- **Annuler** — aucun fichier n'est généré

Si le CDC a 20+ tâches, le regroupement par bloc dans le tableau de review est obligatoire.
