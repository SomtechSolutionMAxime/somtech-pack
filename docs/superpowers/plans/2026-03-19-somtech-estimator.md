# somtech-estimator — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le plugin Cowork `somtech-estimator` qui estime les coûts de projets forfaitaires à partir d'un CDC .docx, comparant un modèle traditionnel et un modèle IA-assisté avec analyse de risque.

**Architecture:** Plugin Cowork avec une commande `/estimer` qui orchestre un pipeline en 4 phases (extraction CDC → calcul automatique → review utilisateur → génération). Deux skills fournissent la logique : `estimation-engine` (extraction + calcul) et `estimation-report` (génération markdown + docx). Les données de référence (taux, facteurs IA, risques) sont externalisées dans `defaults.json`.

**Tech Stack:** Markdown (commandes, skills), JSON (configuration), .docx (gabarit Word pour le rapport client)

**Spec:** `docs/superpowers/specs/2026-03-19-somtech-estimator-design.md`

---

## File Map

```
plugins/somtech-estimator/
├── .claude-plugin/
│   └── plugin.json                          # Manifeste du plugin (Task 1)
├── commands/
│   └── estimer.md                           # Commande principale /estimer (Task 5)
├── skills/
│   ├── estimation-engine/
│   │   ├── SKILL.md                         # Skill extraction + calcul (Task 3)
│   │   └── references/
│   │       └── defaults.md                  # Référence lisible des valeurs par défaut (Task 3)
│   └── estimation-report/
│       ├── SKILL.md                         # Skill génération rapport (Task 4)
│       └── references/
│           └── format-livrable.md           # Template markdown du rapport (Task 4)
├── templates/
│   ├── defaults.json                        # Taux, facteurs IA, grille de risque (Task 2)
│   └── estimation-report.docx              # Gabarit Word — à créer manuellement (Task 6)
├── README.md                                # Documentation du plugin (Task 6)
└── somtech-estimator-v0.1.0.zip            # Archive de distribution (Task 7)
```

---

### Task 1: Scaffold du plugin (plugin.json + arborescence)

**Files:**
- Create: `plugins/somtech-estimator/.claude-plugin/plugin.json`

- [ ] **Step 1: Créer l'arborescence du plugin**

```bash
mkdir -p plugins/somtech-estimator/.claude-plugin
mkdir -p plugins/somtech-estimator/commands
mkdir -p plugins/somtech-estimator/skills/estimation-engine/references
mkdir -p plugins/somtech-estimator/skills/estimation-report/references
mkdir -p plugins/somtech-estimator/templates
```

- [ ] **Step 2: Créer plugin.json**

Créer `plugins/somtech-estimator/.claude-plugin/plugin.json` :

```json
{
  "name": "somtech-estimator",
  "version": "0.1.0",
  "description": "Estimation de projets forfaitaires — comparaison traditionnelle vs IA-assistée avec analyse de risque",
  "author": {
    "name": "Somtech"
  },
  "keywords": ["estimation", "coûts", "forfait", "CDC", "risque", "IA"]
}
```

- [ ] **Step 3: Vérifier la structure**

```bash
find plugins/somtech-estimator -type f -o -type d | sort
```

Expected: L'arborescence complète avec plugin.json présent.

- [ ] **Step 4: Commit**

```bash
git add plugins/somtech-estimator/.claude-plugin/plugin.json
git commit -m "feat(somtech-estimator): scaffold plugin structure + plugin.json"
```

---

### Task 2: defaults.json (données de référence)

**Files:**
- Create: `plugins/somtech-estimator/templates/defaults.json`

- [ ] **Step 1: Créer defaults.json avec toutes les données de référence**

Créer `plugins/somtech-estimator/templates/defaults.json` :

```json
{
  "version": "0.1.0",
  "currency": "CAD",
  "taxesIncluses": false,
  "formatMontant": "espace_milliers_dollar_suffix",

  "tauxJournaliers": {
    "dev_senior": 1200,
    "dev_junior": 750,
    "designer": 1000,
    "pm": 1100,
    "qa": 850,
    "architecte": 1400
  },

  "architectePourcentageGlobal": 5,

  "typesDesTaches": [
    "crud",
    "pages_statiques",
    "ui_complexe",
    "logique_metier",
    "integration_api",
    "auth_securite",
    "infrastructure",
    "reporting"
  ],

  "reductionIA": {
    "crud": 0.70,
    "pages_statiques": 0.80,
    "ui_complexe": 0.50,
    "logique_metier": 0.40,
    "integration_api": 0.30,
    "auth_securite": 0.25,
    "infrastructure": 0.35,
    "reporting": 0.60
  },

  "reductionIA_rolesNonDev": 0.15,

  "allocationRoles": {
    "crud":            { "dev_senior": 0.20, "dev_junior": 0.40, "designer": 0.15, "pm": 0.10, "qa": 0.15 },
    "pages_statiques": { "dev_senior": 0.10, "dev_junior": 0.30, "designer": 0.35, "pm": 0.10, "qa": 0.15 },
    "ui_complexe":     { "dev_senior": 0.30, "dev_junior": 0.20, "designer": 0.25, "pm": 0.10, "qa": 0.15 },
    "logique_metier":  { "dev_senior": 0.50, "dev_junior": 0.20, "designer": 0.00, "pm": 0.15, "qa": 0.15 },
    "integration_api": { "dev_senior": 0.55, "dev_junior": 0.15, "designer": 0.00, "pm": 0.15, "qa": 0.15 },
    "auth_securite":   { "dev_senior": 0.60, "dev_junior": 0.10, "designer": 0.00, "pm": 0.10, "qa": 0.20 },
    "infrastructure":  { "dev_senior": 0.60, "dev_junior": 0.15, "designer": 0.00, "pm": 0.15, "qa": 0.10 },
    "reporting":       { "dev_senior": 0.30, "dev_junior": 0.25, "designer": 0.20, "pm": 0.10, "qa": 0.15 }
  },

  "effortBaseJours": {
    "crud":            { "simple": [2, 4],  "moyen": [5, 8],   "complexe": [9, 15] },
    "pages_statiques": { "simple": [1, 2],  "moyen": [3, 5],   "complexe": [6, 8] },
    "ui_complexe":     { "simple": [5, 8],  "moyen": [9, 15],  "complexe": [16, 25] },
    "logique_metier":  { "simple": [5, 10], "moyen": [11, 20], "complexe": [21, 35] },
    "integration_api": { "simple": [3, 6],  "moyen": [7, 12],  "complexe": [13, 20] },
    "auth_securite":   { "simple": [5, 8],  "moyen": [9, 15],  "complexe": [16, 25] },
    "infrastructure":  { "simple": [3, 5],  "moyen": [6, 10],  "complexe": [11, 18] },
    "reporting":       { "simple": [2, 4],  "moyen": [5, 8],   "complexe": [9, 14] }
  },

  "grilleRisque": {
    "facteurParScoreMoyen": [
      { "min": 1.0, "max": 1.99, "facteur": 1.00 },
      { "min": 2.0, "max": 2.99, "facteur": 1.15 },
      { "min": 3.0, "max": 3.99, "facteur": 1.30 },
      { "min": 4.0, "max": 5.0,  "facteur": 1.50 }
    ]
  }
}
```

- [ ] **Step 2: Valider le JSON**

```bash
python3 -c "import json; json.load(open('plugins/somtech-estimator/templates/defaults.json')); print('JSON valide')"
```

Expected: `JSON valide`

- [ ] **Step 3: Vérifier la cohérence des allocations (somme = 100%)**

```bash
python3 -c "
import json
d = json.load(open('plugins/somtech-estimator/templates/defaults.json'))
for t, roles in d['allocationRoles'].items():
    total = sum(roles.values())
    status = 'OK' if abs(total - 1.0) < 0.001 else 'ERREUR'
    print(f'{t}: {total:.0%} [{status}]')
"
```

Expected: Toutes les lignes à 100% [OK].

- [ ] **Step 4: Commit**

```bash
git add plugins/somtech-estimator/templates/defaults.json
git commit -m "feat(somtech-estimator): add defaults.json with rates, IA factors, risk grid"
```

---

### Task 3: Skill estimation-engine (extraction + calcul)

**Files:**
- Create: `plugins/somtech-estimator/skills/estimation-engine/SKILL.md`
- Create: `plugins/somtech-estimator/skills/estimation-engine/references/defaults.md`

- [ ] **Step 1: Créer references/defaults.md (version lisible des données)**

Créer `plugins/somtech-estimator/skills/estimation-engine/references/defaults.md` avec les tableaux lisibles des taux, facteurs IA, grille de risque, allocation des rôles, et effort de base. Ce fichier reprend les données de `defaults.json` sous forme de tableaux markdown pour que Claude puisse les consulter facilement pendant l'estimation.

Contenu exact :

````markdown
# Données de référence — somtech-estimator

Source : `${CLAUDE_PLUGIN_ROOT}/templates/defaults.json`

## Taux journaliers (marché québécois)

| Rôle | Clé JSON | Taux/jour |
|------|----------|-----------|
| Dev Senior | `dev_senior` | 1 200 $ |
| Dev Junior | `dev_junior` | 750 $ |
| Designer UX/UI | `designer` | 1 000 $ |
| Chef de projet (PM) | `pm` | 1 100 $ |
| QA / Testeur | `qa` | 850 $ |
| Architecte | `architecte` | 1 400 $ |

**Architecte** : 5% du coût total global, ajouté **en surplus** (pas dans l'allocation par feature).

## Facteurs d'accélération IA par type de tâche

**Formule Dev** : `Effort IA = Effort traditionnel × (1 - Réduction IA)`
**Rôles Dev** : `dev_senior`, `dev_junior` — utilisent le facteur du tableau ci-dessous
**Rôles non-Dev** : `designer`, `pm`, `qa` — réduction fixe de **15%** (`reductionIA_rolesNonDev: 0.15`)

| Type de tâche | Clé JSON | Réduction IA (Dev) | Effort Dev restant |
|---------------|----------|-------------------|-------------------|
| CRUD / formulaires | `crud` | 70% | 30% |
| Pages statiques / contenu | `pages_statiques` | 80% | 20% |
| UI complexe | `ui_complexe` | 50% | 50% |
| Logique métier complexe | `logique_metier` | 40% | 60% |
| Intégration API tierce | `integration_api` | 30% | 70% |
| Auth / sécurité | `auth_securite` | 25% | 75% |
| Infrastructure / DevOps | `infrastructure` | 35% | 65% |
| Reporting / exports | `reporting` | 60% | 40% |

## Grille de risque

### Scores (1-5)

| Score | Complexité technique | Dépendances hors contrôle |
|-------|---------------------|--------------------------|
| 1 | Pattern connu, déjà fait | Aucune dépendance externe |
| 2 | Variante d'un pattern connu | API tierce bien documentée |
| 3 | Nouvelle implémentation | API tierce moyenne, données client |
| 4 | Technologie nouvelle pour l'équipe | Dépendance peu fiable ou mal documentée |
| 5 | R&D, incertitude majeure | Dépendance critique sans alternative |

### Facteur multiplicateur

`score_moyen = (complexité + dépendances) / 2`

| Score moyen | Facteur |
|-------------|---------|
| 1.0 – 1.99 | ×1.00 |
| 2.0 – 2.99 | ×1.15 |
| 3.0 – 3.99 | ×1.30 |
| 4.0 – 5.0 | ×1.50 |

**Facteur global** = moyenne pondérée par coût : `somme(cout_feature × facteur_feature) / somme(cout_feature)`

## Allocation des rôles par type de tâche

Chaque ligne totalise 100%. L'architecte (5%) est en surplus.

| Type | Dev Sr | Dev Jr | Designer | PM | QA |
|------|--------|--------|----------|-----|-----|
| `crud` | 20% | 40% | 15% | 10% | 15% |
| `pages_statiques` | 10% | 30% | 35% | 10% | 15% |
| `ui_complexe` | 30% | 20% | 25% | 10% | 15% |
| `logique_metier` | 50% | 20% | 0% | 15% | 15% |
| `integration_api` | 55% | 15% | 0% | 15% | 15% |
| `auth_securite` | 60% | 10% | 0% | 10% | 20% |
| `infrastructure` | 60% | 15% | 0% | 15% | 10% |
| `reporting` | 30% | 25% | 20% | 10% | 15% |

## Effort de base par type et complexité (jours)

Claude estime au **milieu de la fourchette** (arrondi au 0.5 le plus proche). L'utilisateur ajuste en Phase 3.

| Type | Simple | Moyen | Complexe |
|------|--------|-------|----------|
| `crud` | 2 – 4 | 5 – 8 | 9 – 15 |
| `pages_statiques` | 1 – 2 | 3 – 5 | 6 – 8 |
| `ui_complexe` | 5 – 8 | 9 – 15 | 16 – 25 |
| `logique_metier` | 5 – 10 | 11 – 20 | 21 – 35 |
| `integration_api` | 3 – 6 | 7 – 12 | 13 – 20 |
| `auth_securite` | 5 – 8 | 9 – 15 | 16 – 25 |
| `infrastructure` | 3 – 5 | 6 – 10 | 11 – 18 |
| `reporting` | 2 – 4 | 5 – 8 | 9 – 14 |
````

- [ ] **Step 2: Créer SKILL.md**

Créer `plugins/somtech-estimator/skills/estimation-engine/SKILL.md` :

```markdown
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

Présenter le tableau récapitulatif (voir skill estimation-report pour le format exact).

L'utilisateur peut :
- **Ajuster les jours** d'une feature (recalcul automatique des coûts)
- **Modifier le type** d'une feature (recalcul de l'allocation et du facteur IA)
- **Changer un score de risque** (recalcul du facteur)
- **Modifier un facteur IA** pour une feature spécifique
- **Valider tel quel** pour passer à la génération
- **Annuler** — aucun fichier n'est généré

Si le CDC a 20+ features, regrouper par module/section dans le tableau de review.
```

- [ ] **Step 3: Relire le SKILL.md et vérifier la cohérence avec le spec**

Lire le fichier créé et comparer avec le spec (`docs/superpowers/specs/2026-03-19-somtech-estimator-design.md`). Vérifier que :
- Les formules correspondent
- Les types de tâches sont les mêmes (8 types)
- Les phases 1-3 sont couvertes
- Les cas limites sont documentés

- [ ] **Step 4: Commit**

```bash
git add plugins/somtech-estimator/skills/estimation-engine/
git commit -m "feat(somtech-estimator): add estimation-engine skill + defaults reference"
```

---

### Task 4: Skill estimation-report (génération)

**Files:**
- Create: `plugins/somtech-estimator/skills/estimation-report/SKILL.md`
- Create: `plugins/somtech-estimator/skills/estimation-report/references/format-livrable.md`

- [ ] **Step 1: Créer references/format-livrable.md**

Ce fichier contient le template markdown exact du rapport d'estimation, tel que défini dans le spec (section "Format du livrable markdown"). Inclure :
- Le template complet avec les placeholders `[Nom du projet]`, `XX XXX $`, `X.XX`, etc.
- Les instructions de formatage : montants en CAD, séparateur d'espace pour les milliers, convention québécoise (`12 500 $`)
- La note que les taxes sont exclues
- La structure du tableau de synthèse (Trad vs IA-assisté avec risque)

- [ ] **Step 2: Créer SKILL.md**

Créer `plugins/somtech-estimator/skills/estimation-report/SKILL.md` :

```markdown
---
name: estimation-report
description: >
  Ce skill génère le rapport d'estimation final en deux formats : markdown
  (fichier de travail versionnable) et .docx (document client avec branding
  Somtech). Déclenché après la validation utilisateur en Phase 3 du pipeline
  d'estimation.
version: 0.1.0
---

# Skill: estimation-report

Génération des livrables d'estimation (markdown + .docx).

## Responsabilités

1. Générer le rapport markdown dans le projet
2. Générer le rapport .docx client à partir du gabarit Word

## Phase 4 — Génération

### 4a. Rapport Markdown

**Emplacement** : `estimations/YYYY-MM-DD-<nom-projet>-estimation.md` (dans le projet courant, pas dans le plugin)

**Format** : Voir `${CLAUDE_PLUGIN_ROOT}/skills/estimation-report/references/format-livrable.md` pour le template exact.

**Règles de formatage** :
- Montants en CAD ($), taxes exclues
- Séparateur d'espace pour les milliers : `12 500 $` (convention québécoise)
- Arrondir les montants à l'unité (pas de centimes)
- Arrondir les jours au 0.5 le plus proche
- Le facteur de risque global est affiché avec 2 décimales (ex: `1.25`)

**Contenu obligatoire** :
1. **Sommaire exécutif** : totaux trad/IA, économie projetée (% et $), facteur de risque global
2. **Détail par feature** : tableau par rôle avec jours et coûts (trad + IA)
3. **Synthèse** : tableau comparatif avec coût brut, marge de risque, total avec risque
4. **Hypothèses et exclusions** : lister les hypothèses posées pendant l'estimation et ce qui n'est pas inclus
5. **Paramètres utilisés** : taux journaliers, facteurs IA utilisés (surtout si modifiés par l'utilisateur)

### 4b. Rapport .docx

**Gabarit** : `${CLAUDE_PLUGIN_ROOT}/templates/estimation-report.docx`

**Méthode** : unpack/edit/repack (même approche que somtech-proposals).
Voir le SKILL.md de `completion-documents` dans somtech-proposals pour les règles de formatage Word :
- Apostrophes : uniquement `'` (U+0027)
- Styles : utiliser `<w:pStyle>` pour les titres
- Tableaux : bordures explicites, largeur en `dxa`, alternance de couleurs
- En-têtes/pieds de page : préserver `xml:space="preserve"`

**Contenu** : identique au markdown, mis en forme avec le branding Somtech (en-tête, couleurs corporatives, logo).

### Gestion d'erreurs

- Si le gabarit .docx n'est pas trouvé, générer uniquement le markdown et informer l'utilisateur
- Si le dossier `estimations/` n'existe pas, le créer
```

- [ ] **Step 3: Vérifier la cohérence avec le spec**

Comparer avec le spec pour s'assurer que le format du livrable correspond exactement.

- [ ] **Step 4: Commit**

```bash
git add plugins/somtech-estimator/skills/estimation-report/
git commit -m "feat(somtech-estimator): add estimation-report skill + deliverable format reference"
```

---

### Task 5: Commande /estimer (orchestrateur)

**Files:**
- Create: `plugins/somtech-estimator/commands/estimer.md`

- [ ] **Step 1: Créer la commande estimer.md**

Créer `plugins/somtech-estimator/commands/estimer.md` :

```markdown
---
description: Estimer les coûts d'un projet forfaitaire à partir d'un cahier des charges
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: [chemin-vers-cdc.docx]
---

# /estimer — Estimation de projet forfaitaire

## Vue d'ensemble

Cette commande produit un document d'estimation comparant deux modèles :
1. **Traditionnel** — jours-personne par rôle avec taux du marché québécois
2. **IA-assisté** — mêmes rôles avec facteurs d'accélération IA par type de tâche

Inclut une analyse de risque (complexité technique + dépendances hors contrôle).

## Prérequis

- Un fichier .docx de cahier des charges (CDC) accessible dans le workspace
- Si aucun argument fourni, chercher un CDC dans le workspace : `**/*cahier*des*charges*.docx`, `**/*CDC*.docx`, `**/*specification*.docx`

## Pipeline

### Phase 1 — Extraction du CDC

1. **Localiser le CDC** : utiliser l'argument fourni, ou chercher dans le workspace
2. **Lire le skill estimation-engine** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-engine/SKILL.md`
3. **Extraire les features** selon les instructions du skill
4. **Présenter la liste extraite** à l'utilisateur pour validation rapide :
   ```
   J'ai extrait X features du CDC :
   1. [Feature] — Type: [type], Complexité: [complexité]
   2. ...
   Ça te semble correct ? Tu veux ajouter/modifier/retirer des features ?
   ```
5. Attendre la validation avant de continuer

### Phase 2 — Calcul automatique

1. **Charger les données de référence** : `${CLAUDE_PLUGIN_ROOT}/templates/defaults.json`
2. **Consulter le skill** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-engine/SKILL.md` (section Phase 2)
3. **Pour chaque feature** :
   - Calculer l'effort traditionnel (jours par rôle, coûts)
   - Évaluer les risques (complexité + dépendances)
   - Calculer l'effort IA-assisté (facteurs Dev + non-Dev)
4. **Calculer les totaux** : architecte (5% surplus), facteur de risque global, totaux avec risque

### Phase 3 — Review utilisateur

1. **Présenter le tableau récapitulatif** :

   ```
   ## Résumé de l'estimation

   | # | Feature | Type | Compl. | Trad. (j) | Risque | IA factor | IA (j) | Trad. ($) | IA ($) |
   |---|---------|------|--------|-----------|--------|-----------|--------|-----------|--------|
   | 1 | ...     | ...  | ...    | ...       | ×1.XX  | -XX%      | ...    | X XXX $   | X XXX $|

   ### Totaux
   - Traditionnel brut : XX XXX $
   - IA-assisté brut : XX XXX $
   - Architecte (5%) : X XXX $ (trad) / X XXX $ (IA)
   - Facteur de risque global : ×X.XX
   - **Traditionnel avec risque : XX XXX $**
   - **IA-assisté avec risque : XX XXX $**
   - **Économie projetée : XX% (XX XXX $)**

   Tu veux ajuster quelque chose (jours, risques, facteurs IA) ou on génère le rapport ?
   ```

2. **Si ajustements demandés** : modifier les valeurs, recalculer, re-présenter le tableau
3. **Si validation** : passer à Phase 4

### Phase 4 — Génération du rapport

1. **Lire le skill estimation-report** : `${CLAUDE_PLUGIN_ROOT}/skills/estimation-report/SKILL.md`
2. **Générer le markdown** dans `estimations/YYYY-MM-DD-<nom-projet>-estimation.md`
3. **Générer le .docx** si le gabarit existe dans `${CLAUDE_PLUGIN_ROOT}/templates/estimation-report.docx`
4. **Confirmer** :
   ```
   Rapport d'estimation généré :
   - Markdown : estimations/YYYY-MM-DD-<nom-projet>-estimation.md
   - Word : estimations/YYYY-MM-DD-<nom-projet>-estimation.docx (si gabarit disponible)

   Traditionnel : XX XXX $ | IA-assisté : XX XXX $ | Économie : XX%
   ```

## Règles critiques

- **Ne jamais inventer des features** qui ne sont pas dans le CDC
- **Toujours attendre la validation** avant de passer à la phase suivante
- **Montants en CAD**, séparateur d'espace, convention québécoise (`12 500 $`)
- **Taxes exclues** de tous les montants
- Si le CDC a **20+ features**, regrouper par module/section dans les tableaux
```

- [ ] **Step 2: Vérifier que la commande référence correctement les skills et templates**

Grep pour `${CLAUDE_PLUGIN_ROOT}` dans la commande et vérifier que chaque chemin correspond à un fichier existant dans le plugin.

- [ ] **Step 3: Commit**

```bash
git add plugins/somtech-estimator/commands/estimer.md
git commit -m "feat(somtech-estimator): add /estimer command orchestrating the 4-phase pipeline"
```

---

### Task 6: README.md + gabarit .docx placeholder

**Files:**
- Create: `plugins/somtech-estimator/README.md`
- Note: `templates/estimation-report.docx` doit être créé manuellement (fichier Word avec branding Somtech)

- [ ] **Step 1: Créer README.md**

Créer `plugins/somtech-estimator/README.md` avec :
- Titre et description du plugin
- Commande disponible (`/estimer`)
- Prérequis (CDC .docx)
- Ce que le plugin produit (markdown + .docx)
- Les deux modèles comparés (traditionnel vs IA-assisté)
- Mention du facteur de risque
- Configuration : comment modifier les taux, facteurs IA dans `defaults.json`
- Note que le gabarit Word (`estimation-report.docx`) doit être créé/personnalisé avec le branding du client

- [ ] **Step 2: Créer un fichier placeholder pour le gabarit .docx**

Créer `plugins/somtech-estimator/templates/ESTIMATION-REPORT-TEMPLATE.md` :

```markdown
# Gabarit estimation-report.docx

Ce fichier sert de placeholder. Le gabarit Word `estimation-report.docx` doit être créé
manuellement avec :

- En-tête Somtech (logo, coordonnées)
- Pied de page (numéro de page, mention confidentiel)
- Styles Heading1, Heading2, Heading3
- Style de tableau avec bordures et alternance de couleurs (#1F4E79 / #F2F2F2 / #FFFFFF)
- Section pour le sommaire exécutif
- Section pour le détail par feature (avec tableaux)
- Section pour la synthèse
- Section pour les hypothèses et exclusions

Une fois créé, placer le fichier .docx ici et supprimer ce placeholder.
```

- [ ] **Step 3: Commit**

```bash
git add plugins/somtech-estimator/README.md plugins/somtech-estimator/templates/ESTIMATION-REPORT-TEMPLATE.md
git commit -m "feat(somtech-estimator): add README and docx template placeholder"
```

---

### Task 7: Archive .zip de distribution + validation finale

**Files:**
- Create: `plugins/somtech-estimator/somtech-estimator-v0.1.0.zip`

- [ ] **Step 1: Vérifier la structure complète du plugin**

```bash
find plugins/somtech-estimator -type f | sort
```

Expected: Tous les fichiers des tasks 1-6 sont présents.

- [ ] **Step 2: Vérifier le contenu des fichiers clés**

Lire et vérifier :
- `plugin.json` : version 0.1.0, nom correct
- `defaults.json` : JSON valide, allocations à 100%
- `estimer.md` : références `${CLAUDE_PLUGIN_ROOT}` correctes
- Skills SKILL.md : frontmatter valide (name, description, version)

- [ ] **Step 3: Générer l'archive .zip**

```bash
cd plugins/somtech-estimator && rm -f *.zip && zip -r "somtech-estimator-v$(python3 -c "import json;print(json.load(open('.claude-plugin/plugin.json'))['version'])").zip" . -x "*.DS_Store" -x "*.zip"
```

Expected: `somtech-estimator-v0.1.0.zip` créé.

- [ ] **Step 4: Vérifier le contenu du zip**

```bash
unzip -l plugins/somtech-estimator/somtech-estimator-v0.1.0.zip
```

Expected: La racine contient `.claude-plugin/`, `commands/`, `skills/`, `templates/`, `README.md`.

- [ ] **Step 5: Mettre à jour le CLAUDE.md racine**

Ajouter `somtech-estimator` dans le tableau "Plugins Cowork disponibles" de `/opt/gitrepo/somtech-pack/CLAUDE.md` :

```markdown
| **somtech-estimator** | Voir plugin.json | Estimation de projets forfaitaires — comparaison traditionnelle vs IA-assistée avec analyse de risque |
```

- [ ] **Step 6: Commit final**

```bash
git add plugins/somtech-estimator/somtech-estimator-v0.1.0.zip CLAUDE.md
git commit -m "chore(somtech-estimator): add v0.1.0 distribution archive + update CLAUDE.md"
```
