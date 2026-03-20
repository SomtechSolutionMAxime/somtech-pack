# Design — Plugin somtech-estimator

> Plugin Cowork pour l'estimation de projets forfaitaires à partir d'un cahier des charges.

**Date**: 2026-03-19
**Statut**: Approuvé
**Approche retenue**: Hybride (auto + review)

---

## Objectif

Produire un document d'estimation standalone (markdown + .docx) qui compare deux modèles :
1. **Traditionnel** — jours-personne par rôle avec taux du marché
2. **IA-assisté** — mêmes rôles avec facteurs d'accélération IA par type de tâche

Inclut une évaluation des risques (complexité technique + dépendances hors contrôle) avec un facteur multiplicateur global.

## Entrée / Sortie

- **Entrée** : CDC .docx (produit par `/complete-cahier` de somtech-proposals ou fourni par le client)
- **Sortie** : Document d'estimation standalone (markdown + .docx) — ne s'intègre pas directement dans l'offre

---

## Manifeste du plugin (`plugin.json`)

```json
{
  "name": "somtech-estimator",
  "version": "0.1.0",
  "description": "Estimation de projets forfaitaires — comparaison traditionnelle vs IA-assistée avec analyse de risque",
  "author": "Somtech inc.",
  "keywords": ["estimation", "coûts", "forfait", "CDC", "risque", "IA"]
}
```

## Structure du plugin

```
plugins/somtech-estimator/
├── .claude-plugin/plugin.json
├── commands/
│   └── estimer.md              # Commande principale /estimer
├── skills/
│   ├── estimation-engine/
│   │   └── SKILL.md            # Extraction CDC + calcul
│   └── estimation-report/
│       └── SKILL.md            # Génération markdown + docx
├── templates/
│   ├── estimation-report.docx  # Gabarit Word du rapport client
│   └── defaults.json           # Taux, facteurs IA, grille de risque
└── README.md
```

### Commande unique

`/estimer` orchestre le pipeline complet : parse → calcul → review → génération.

### Skills

| Skill | Responsabilité |
|-------|---------------|
| `estimation-engine` | Extraction des features du CDC, catégorisation par type, calcul des estimés (trad + IA), évaluation des risques |
| `estimation-report` | Génération du markdown de travail + .docx client à partir du gabarit |

---

## Pipeline (4 phases)

### Phase 1 — Extraction du CDC

- Parse le .docx du cahier des charges
- Extrait les modules/features (sections, titres, descriptions)
- Catégorise chaque feature par type de tâche :
  - CRUD / formulaires
  - Pages statiques / contenu
  - UI complexe (dashboards, drag & drop)
  - Logique métier complexe
  - Intégration API tierce
  - Auth / sécurité
  - Infrastructure / DevOps
  - Reporting / exports
- Produit une liste structurée de features avec leur type

### Phase 2 — Calcul automatique

Pour chaque feature :

**Estimation traditionnelle :**
- Estimation de l'effort total en jours selon le type et le niveau de complexité (voir table de référence ci-dessous)
- Répartition par rôle selon la matrice d'allocation (voir section Allocation)
- Calcul du coût : jours × taux journalier par rôle

**Évaluation des risques :**
- Score de complexité technique (1-5)
- Score de dépendances hors contrôle (1-5)
- Facteur de risque par feature (moyenne des scores → multiplicateur)
- Facteur de risque global = moyenne pondérée par coût des features

**Estimation IA-assistée :**
- Application du facteur d'accélération IA selon le type de tâche. Formule : `Effort IA = Effort traditionnel × (1 - Réduction IA)`
- Le facteur IA s'applique **uniquement aux rôles Dev Sr et Dev Jr**. Les rôles PM, QA et Designer utilisent un facteur réduit fixe de 15% de réduction (l'IA assiste mais n'élimine pas ces rôles)
- Recalcul du coût par rôle

**Application du facteur de risque :**
- Le facteur de risque global s'applique comme multiplicateur sur le coût brut de chaque modèle (traditionnel et IA-assisté) indépendamment

### Phase 3 — Review utilisateur

Présentation d'un tableau récapitulatif :

| Feature | Type | Trad. (jours) | Risque | IA factor | IA (jours) | Trad. ($) | IA ($) |
|---------|------|---------------|--------|-----------|------------|-----------|--------|

Plus facteur de risque global et totaux.

L'utilisateur peut ajuster : jours, risques, facteurs IA, ou valider tel quel.

### Phase 4 — Génération

- Markdown dans `estimations/YYYY-MM-DD-<nom-projet>-estimation.md`
- .docx client à partir du gabarit `estimation-report.docx` (méthode unpack/edit/repack documentée dans somtech-proposals — voir le SKILL.md de completion-documents pour les règles de formatage Word)

---

## Données par défaut (`defaults.json`)

### Taux journaliers (marché québécois)

| Rôle | Taux/jour |
|------|-----------|
| Dev Senior | 1 200 $ |
| Dev Junior | 750 $ |
| Designer UX/UI | 1 000 $ |
| Chef de projet (PM) | 1 100 $ |
| QA / Testeur | 850 $ |
| Architecte | 1 400 $ |

### Facteurs d'accélération IA par type de tâche

**Formule** : `Effort IA (Dev) = Effort traditionnel × (1 - Réduction IA)`. Exemple : CRUD à 70% → l'effort Dev passe à 30% de l'original.

| Type de tâche | Réduction IA (% d'effort économisé, Dev uniquement) | Justification |
|---------------|-------------|---------------|
| CRUD / formulaires | 70% | Génération quasi-complète par IA |
| Pages statiques / contenu | 80% | Trivial avec IA |
| UI complexe (dashboards, drag & drop) | 50% | IA aide mais ajustements manuels |
| Logique métier complexe | 40% | IA accélère mais validation humaine requise |
| Intégration API tierce | 30% | Dépend de la doc, debug humain nécessaire |
| Auth / sécurité | 25% | Critique, revue humaine obligatoire |
| Infrastructure / DevOps | 35% | Scripts générés mais config spécifique |
| Reporting / exports | 60% | Templates bien gérés par IA |

### Grille de risque

| Score (1-5) | Complexité technique | Dépendances hors contrôle |
|-------------|---------------------|--------------------------|
| 1 | Pattern connu, déjà fait | Aucune dépendance externe |
| 2 | Variante d'un pattern connu | API tierce bien documentée |
| 3 | Nouvelle implémentation | API tierce moyenne, données client |
| 4 | Technologie nouvelle pour l'équipe | Dépendance peu fiable ou mal documentée |
| 5 | R&D, incertitude majeure | Dépendance critique sans alternative |

### Calcul du facteur de risque

| Score moyen | Facteur multiplicateur |
|-------------|----------------------|
| 1.0 – 1.99 | 1.00 (aucune marge) |
| 2.0 – 2.99 | 1.15 (+15%) |
| 3.0 – 3.99 | 1.30 (+30%) |
| 4.0 – 5.0 | 1.50 (+50%) |

---

## Allocation des rôles par type de tâche

Répartition en % de l'effort total estimé :

| Type de tâche | Dev Sr | Dev Jr | Designer | PM | QA |
|---------------|--------|--------|----------|-----|-----|
| CRUD / formulaires | 20% | 40% | 15% | 10% | 15% |
| Pages statiques | 10% | 30% | 35% | 10% | 15% |
| UI complexe | 30% | 20% | 25% | 10% | 15% |
| Logique métier complexe | 50% | 20% | 0% | 15% | 15% |
| Intégration API tierce | 55% | 15% | 0% | 15% | 15% |
| Auth / sécurité | 60% | 10% | 0% | 10% | 20% |
| Infrastructure / DevOps | 60% | 15% | 0% | 15% | 10% |
| Reporting / exports | 30% | 25% | 20% | 10% | 15% |

Le coût architecte (5% du total global) s'ajoute **en surplus** au coût par feature — les allocations ci-dessus totalisent 100% de l'effort feature, l'architecte est une ligne séparée.

### Table de référence — Effort de base par type et complexité

Claude estime l'effort total en jours pour chaque feature en s'appuyant sur cette grille de référence. L'utilisateur valide en Phase 3.

| Type de tâche | Simple (jours) | Moyen (jours) | Complexe (jours) |
|---------------|---------------|---------------|-------------------|
| CRUD / formulaires | 2 – 4 | 5 – 8 | 9 – 15 |
| Pages statiques / contenu | 1 – 2 | 3 – 5 | 6 – 8 |
| UI complexe | 5 – 8 | 9 – 15 | 16 – 25 |
| Logique métier complexe | 5 – 10 | 11 – 20 | 21 – 35 |
| Intégration API tierce | 3 – 6 | 7 – 12 | 13 – 20 |
| Auth / sécurité | 5 – 8 | 9 – 15 | 16 – 25 |
| Infrastructure / DevOps | 3 – 5 | 6 – 10 | 11 – 18 |
| Reporting / exports | 2 – 4 | 5 – 8 | 9 – 14 |

La complexité (simple/moyen/complexe) est déterminée par Claude à partir de la description dans le CDC.

---

## Format du livrable markdown

```markdown
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
- **Risque**: Complexité X/5 | Dépendances X/5 → Facteur X.XX

| Rôle | Trad. (jours) | Trad. ($) | IA (jours) | IA ($) |
|------|---------------|-----------|------------|--------|
| Dev Senior | X | X $ | X | X $ |
| ... | | | | |
| **Sous-total** | **X** | **X $** | **X** | **X $** |

### 2. [Feature suivante...]

## Synthèse

| | Trad. | IA-assisté |
|---|-------|------------|
| Jours totaux | X | X |
| Coût brut | X $ | X $ |
| Marge de risque (×X.XX) | X $ | X $ |
| **Total avec risque** | **X $** | **X $** |

## Hypothèses et exclusions

## Paramètres utilisés
```

Le .docx suit le même contenu avec le branding Somtech.

---

## Cas limites et gestion d'erreurs

- **Document invalide** : Si le .docx n'est pas un CDC reconnaissable (pas de sections features/modules), le plugin signale l'erreur et demande un autre fichier
- **CDC vide ou non structuré** : Le plugin liste ce qu'il a pu extraire et demande à l'utilisateur de compléter manuellement les features manquantes
- **Format non supporté** : Seul .docx est accepté. Si l'utilisateur fournit un PDF ou autre, le plugin indique de convertir en .docx d'abord
- **Annulation en Phase 3** : L'utilisateur peut annuler à tout moment pendant le review — aucun fichier n'est généré
- **CDC très volumineux (20+ features)** : Le plugin procède normalement mais regroupe le tableau de review par module/section pour faciliter la lecture

## Conventions de formatage

- **Devise** : CAD ($), taxes exclues
- **Format des montants** : Séparateur d'espace pour les milliers, convention québécoise (ex: `12 500 $`)
- **Commande** : `/estimer` (français, cohérent avec `/complete-cahier`, `/complete-offre`)

## Intégration dans l'écosystème

- **Indépendant** de somtech-proposals — le document d'estimation est standalone
- **Entrée compatible** — lit les CDC produits par `/complete-cahier`
- **Même structure plugin** — `.claude-plugin/`, commandes, skills, templates
- **Distribution** — archive `.zip` versionnée comme les autres plugins
