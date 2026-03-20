---
name: estimation-engine
description: >
  Ce skill doit être utilisé quand l'utilisateur demande à "estimer un projet",
  "calculer les coûts", "analyser un cahier des charges pour estimation",
  "évaluer le risque d'un projet", ou a besoin d'extraire les features d'un CDC
  et de produire une estimation en jours-personne. Aussi déclenché par
  "estimation", "forfait", "coûts", "jours-personne", "facteur de risque".
version: 0.1.0
---

# Skill: estimation-engine

Moteur d'extraction et de calcul pour l'estimation de projets forfaitaires.

## Responsabilités

1. Parser un CDC .docx et extraire la liste des features/modules
2. Catégoriser chaque feature par type de tâche
3. Estimer l'effort en jours par feature (traditionnel + IA-assisté)
4. Évaluer les risques par feature et calculer le facteur global
5. Présenter le tableau récapitulatif pour validation utilisateur

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
   - **Type de tâche** : catégoriser selon les 8 types définis (voir référence)
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

### Sortie Phase 1

Liste structurée :

```
Feature 1: [Nom]
  Type: [type]
  Complexité: [simple|moyen|complexe]
  Description: [résumé]
```

### Gestion d'erreurs

- **Document non-.docx** : Informer l'utilisateur que seul .docx est supporté
- **CDC non structuré** : Lister ce qui a été extrait, demander à l'utilisateur de compléter
- **Aucune feature trouvée** : Signaler et demander un autre fichier ou une saisie manuelle

## Phase 2 — Calcul automatique

Charger les données de référence depuis `${CLAUDE_PLUGIN_ROOT}/templates/defaults.json`.
Consulter `${CLAUDE_PLUGIN_ROOT}/skills/estimation-engine/references/defaults.md` pour les tableaux lisibles.

### Pour chaque feature :

#### 2a. Effort traditionnel

1. Lire la fourchette de jours dans `effortBaseJours[type][complexité]`
2. Prendre le **milieu de la fourchette** comme estimation (arrondi au 0.5 le plus proche)
3. Répartir par rôle selon `allocationRoles[type]` :
   - `jours_role = effort_total × allocation_role`
4. Calculer le coût : `cout_role = jours_role × tauxJournaliers[role]`
5. Sous-total feature = somme des coûts par rôle

#### 2b. Évaluation des risques

Pour chaque feature, évaluer deux scores (1-5) :
- **Complexité technique** : selon la grille de risque (references/defaults.md)
- **Dépendances hors contrôle** : selon la grille de risque

Calcul du facteur par feature :
1. `score_moyen = (complexité + dépendances) / 2`
2. Mapper vers le facteur multiplicateur via `grilleRisque.facteurParScoreMoyen`

Facteur de risque global :
- `risque_global = somme(cout_feature × facteur_feature) / somme(cout_feature)`
- C'est une moyenne pondérée par le coût de chaque feature

#### 2c. Estimation IA-assistée

Pour chaque feature et chaque rôle :
- **Rôles Dev** (`dev_senior`, `dev_junior`) : `jours_ia = jours_trad × (1 - reductionIA[type])`
- **Rôles non-Dev** (`designer`, `pm`, `qa`) : `jours_ia = jours_trad × (1 - reductionIA_rolesNonDev)`
- Recalcul du coût : `cout_ia_role = jours_ia × tauxJournaliers[role]`

#### 2d. Architecte (surplus global)

- `cout_architecte_trad = somme(tous_couts_features_trad) × architectePourcentageGlobal / 100`
- `jours_architecte_trad = cout_architecte_trad / tauxJournaliers.architecte`
- Même calcul pour IA-assisté

#### 2e. Totaux avec risque

- `total_trad_brut = somme(couts_features_trad) + cout_architecte_trad`
- `total_trad_risque = total_trad_brut × risque_global`
- Même calcul pour IA-assisté

## Phase 3 — Review utilisateur

Présenter le tableau récapitulatif. L'interaction utilisateur est gérée par la commande `/estimer`.

L'utilisateur peut :
- **Ajuster les jours** d'une feature (recalcul automatique des coûts)
- **Modifier le type** d'une feature (recalcul de l'allocation et du facteur IA)
- **Changer un score de risque** (recalcul du facteur)
- **Modifier un facteur IA** pour une feature spécifique
- **Valider tel quel** pour passer à la génération
- **Annuler** — aucun fichier n'est généré

Si le CDC a 20+ features, regrouper par module/section dans le tableau de review.
