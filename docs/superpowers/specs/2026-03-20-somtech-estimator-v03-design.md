# Design — somtech-estimator v0.3.0

> Ajustements pour des estimations plus réalistes : nouveaux types de tâches, proposition d'équipe, facteur de reproduction, qualification projet, coût infrastructure.

**Date**: 2026-03-20
**Statut**: Approuvé
**Base**: v0.2.0 existante

---

## Problème identifié

Le plugin v0.2.0 traite tous les projets comme du développement logiciel custom. Résultat : un projet BI (ETL + dashboards Superset) est estimé à 400K$ au lieu de ~77K$. Causes :

1. **Types de tâches manquants** — pas de type pour ETL, configuration dashboard, migration de données
2. **Allocation rigide** — chaque tâche alloue designer, dev junior, QA même quand ils ne sont pas nécessaires
3. **Pas de distinction premier module vs additionnel** — le plugin ré-estime l'infrastructure déjà en place
4. **Pas de facteur de reproduction** — reproduire un dashboard existant ≠ en créer un de zéro

---

## Changement 1 — Trois nouveaux types de tâches

### `etl_data`

Travail de data engineering : ETL, pipelines, transformations SQL, vues matérialisées, scheduling.

| Rôle | Allocation | Justification |
|------|-----------|---------------|
| dev_senior | 70% | Expert SQL, architecte données |
| dev_junior | 10% | Scripts auxiliaires |
| designer | 0% | Aucun besoin UI |
| pm | 10% | Coordination |
| qa | 10% | Validation données |

| Complexité | Effort (jours) |
|-----------|---------------|
| Simple | 2 – 4 |
| Moyen | 5 – 10 |
| Complexe | 11 – 18 |

Réduction IA Dev : **35%** (génération SQL assistée, mais validation humaine sur les transformations)

### `dashboard_config`

Configuration de dashboards BI dans un outil existant (Superset, PowerBI, Metabase). Pas de code custom.

| Rôle | Allocation | Justification |
|------|-----------|---------------|
| dev_senior | 50% | Requêtes SQL, configuration charts |
| dev_junior | 10% | Support |
| designer | 20% | Layout, choix visuels |
| pm | 10% | Coordination |
| qa | 10% | Validation visuelle |

| Complexité | Effort (jours) |
|-----------|---------------|
| Simple | 1 – 3 |
| Moyen | 4 – 7 |
| Complexe | 8 – 12 |

Réduction IA Dev : **30%** (templates IA, mais configuration manuelle dans l'outil)

### `migration_donnees`

Migration de données depuis un système existant (PipeDrive, Excel, Inlitix). Scripts + validation intensive.

| Rôle | Allocation | Justification |
|------|-----------|---------------|
| dev_senior | 45% | Scripts migration, mapping |
| dev_junior | 15% | Scripts auxiliaires |
| designer | 0% | Aucun besoin UI |
| pm | 10% | Coordination |
| qa | 30% | Validation données critique |

| Complexité | Effort (jours) |
|-----------|---------------|
| Simple | 2 – 5 |
| Moyen | 6 – 10 |
| Complexe | 11 – 16 |

Réduction IA Dev : **30%** (génération scripts assistée, validation reste humaine)

---

## Changement 2 — Qualification du projet (Phase 1 enrichie)

Avant d'extraire les blocs du CDC, le plugin identifie la **nature dominante du projet** et la présente à l'utilisateur :

```
J'ai analysé le CDC. Voici la nature du projet :

Nature : Data / BI
Indicateurs : ETL Maestro, entrepôt Supabase, tableaux de bord Superset, remplacement Inlitix

Impact sur l'estimation :
- Types privilégiés : etl_data, dashboard_config (au lieu de ui_complexe, logique_metier)
- Équipe réduite probable (pas de dev junior, designer limité)
- Facteur de reproduction possible (tableaux existants à reproduire)

Ça te semble correct ?
```

### Natures reconnues

| Nature | Indicateurs CDC | Types privilégiés |
|--------|----------------|-------------------|
| Développement custom | App web, API, UI, composants React, formulaires | Types existants (crud, ui_complexe, logique_metier, etc.) |
| Data / BI | ETL, entrepôt, dashboards, rapports, KPI, Superset, PowerBI | `etl_data`, `dashboard_config` |
| Configuration | Paramétrage outil existant, intégration API | `dashboard_config`, `integration_api` |
| Migration | Remplacement système, import données, scripts | `migration_donnees`, `etl_data` |
| Hybride | Mix des précédents | Par bloc, chaque bloc a sa propre nature |

---

## Changement 3 — Proposition d'équipe projet (nouvelle Phase 1.5)

Après la sous-décomposition (Phase 1) et avant le calcul (Phase 2), le plugin propose une **composition d'équipe projet** basée sur les types de tâches identifiés.

### Format de la proposition

```
Équipe recommandée pour ce projet :

✅ Dev Senior — 1 personne (lead technique, ETL, configuration Superset)
    Volume estimé : ~35 jours
✅ QA — 1 personne à ~30% (validation données, tests)
    Volume estimé : ~8 jours
✅ PM — 1 personne à ~10% (suivi, coordination)
    Volume estimé : ~5 jours
❌ Dev Junior — non requis (pas de code boilerplate)
❌ Designer — non requis (dashboards configurés, pas de UI custom)

Tu veux ajuster cette équipe ?
```

### Logique de recommandation

1. Pour chaque rôle, sommer les jours alloués sur toutes les tâches
2. Si un rôle a **moins de 2 jours** sur l'ensemble du projet → recommander ❌ (non requis)
3. Si un rôle a **2-5 jours** → recommander à temps partiel (XX%)
4. Si un rôle a **5+ jours** → recommander plein temps

### Impact sur le calcul

Les rôles marqués ❌ par l'utilisateur sont mis à **0% d'allocation** pour toutes les tâches du projet. Leurs jours sont redistribués proportionnellement aux rôles restants.

---

## Changement 4 — Facteur de reproduction

Quand le CDC indique qu'on **reproduit des fonctionnalités existantes**, le plugin applique un facteur de réduction sur l'effort de base.

### Détection

Mots-clés dans le CDC : "remplacer", "reproduire", "migrer depuis", "équivalent à", "mêmes fonctionnalités", "remplacement de [outil]".

### Proposition

```
Ce projet semble reproduire des fonctionnalités existantes :
- "Remplacer les tableaux de bord Inlitix" → dashboards existants à reproduire
- "Mêmes fonctionnalités avec plus de flexibilité" → specs déjà définies par l'existant

Facteur de reproduction recommandé : 0.65 (réduction de 35% sur l'effort de base)
Justification : les specs existent déjà dans l'outil actuel, pas de discovery

Tu veux ajuster ce facteur ? (0.5 = très similaire, 0.8 = beaucoup de changements, 1.0 = création from scratch)
```

### Application

Le facteur multiplie l'effort de base **avant** l'allocation par rôle :
- `effort_ajusté = effort_base × facteur_reproduction`
- S'applique uniquement aux blocs identifiés comme reproduction, pas à tout le projet

---

## Changement 5 — Coût infrastructure (premier module vs additionnel)

### Question obligatoire

Au début du pipeline (après qualification du projet), le plugin demande :

```
Ce module fait-il partie d'un système existant ou est-ce le premier module ?

A) Premier module — il faut bâtir l'infrastructure de base (auth, CI/CD, design system, architecture, domaine)
B) Module additionnel — l'infrastructure existe déjà
```

### Si premier module (A)

Le plugin ajoute un bloc **"Infrastructure initiale"** avec les tâches :

| Tâche | Type | Effort |
|-------|------|--------|
| Auth SSO + gestion des rôles | auth_securite | moyen |
| CI/CD pipeline (Netlify/Fly.io) | infrastructure | simple |
| Design system + layout de base | ui_complexe | moyen |
| Architecture API + conventions | logique_metier | simple |
| Configuration domaine + SSL | infrastructure | simple |

Ce bloc apparaît dans le rapport comme ligne séparée.

### Si module additionnel (B)

Le plugin demande le **pourcentage d'infrastructure** :

```
Quel pourcentage du coût d'infrastructure initiale s'applique pour les ajustements ?

- 0%  — Aucune modification d'infra nécessaire
- 10% — Ajustements mineurs (nouvelles permissions, routes)
- 20% — Modifications modérées (nouveau rôle auth, ajustements layout)
- 30% — Modifications significatives (nouveau service, refonte partielle)
- Autre — [valeur custom]
```

Le coût d'infrastructure est estimé une fois (comme si c'était le premier module), puis le pourcentage choisi est appliqué.

### Dans le rapport

```
Coût du module                          : XX XXX $
Infrastructure (XX% du coût initial)    : XX XXX $
────────────────────────────────────────
Total projet                            : XX XXX $
```

Le rapport documente toujours le coût d'infrastructure complet (100%) pour référence, même s'il est à 0%.

---

## Changement 6 — Pipeline mis à jour

Le pipeline passe de 4 à 6 phases :

```
Phase 1.0 — Qualification du projet (nature, premier module vs additionnel, % infra)
Phase 1.1 — Extraction du CDC (blocs + sous-décomposition en tâches)
Phase 1.2 — Détection facteur de reproduction
Phase 1.5 — Proposition d'équipe projet (rôles + volume)
Phase 2.0 — Calcul automatique
Phase 3.0 — Review utilisateur
Phase 4.0 — Génération rapport (markdown + Excel)
```

### Rapport Excel mis à jour

Ajout d'une 5e feuille **"Paramètres"** qui documente :
- Nature du projet
- Équipe retenue (rôles, volume)
- Facteur de reproduction (si applicable)
- Infrastructure : premier module ou additionnel (% appliqué)
- Taux journaliers utilisés
- Facteurs IA appliqués
- Toute modification manuelle faite en Phase 3

---

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `templates/defaults.json` | Ajouter 3 types, leurs allocations, efforts, facteurs IA |
| `skills/estimation-engine/SKILL.md` | Qualification projet, Phase 1.5 équipe, facteur reproduction |
| `skills/estimation-engine/references/defaults.md` | Tableaux mis à jour |
| `skills/estimer/SKILL.md` | Pipeline 6 phases, nouvelles questions utilisateur |
| `skills/estimation-report/SKILL.md` | 5e feuille Excel "Paramètres" |
| `skills/estimation-report/references/format-livrable.md` | Template markdown mis à jour |
| `.claude-plugin/plugin.json` | Version 0.3.0 |
| `README.md` | Documentation mise à jour |
