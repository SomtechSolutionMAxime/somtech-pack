# Migration de maquettes — Workflow `mockmig.*`

## Objectif
Standardiser la migration d’une maquette (stockée sous `modules/maquette/**`) vers un module produit, en générant des artefacts dans `migration/{module}/` :

- inventaire des règles métier (depuis la maquette)
- paquet de validation (**gate obligatoire**)
- audit de l’existant (read-only)
- gap analysis
- tâches backend
- tâches UI (reconstruction “à l’identique”)

## TL;DR (ce qui change pour l’utilisateur)

- **Point d’entrée unique** : commence par `/mockmig.start` (au lieu de deviner “par quoi partir”).\n
- **Guidage** : à tout moment, `/mockmig.status` te dit **NEXT** (commande suivante) et **READY** (prêt/pas prêt).\n
- **Zéro perte de règles métier** : si la maquette contient des composants, l’inventaire **par composant** est requis (l’inventaire module seul est insuffisant).

## Deux cas d’usage (important)

### Cas 1 — Module simple
Règles métier plutôt centralisées, peu (ou pas) de composants sous `src/components/`.

### Cas 2 — Module complexe (multi-composants)
Règles métier dispersées au travers de composants sous `<mockupPath>/src/components/*`.\n
Dans ce cas, on fait **2 couches** :
- couche **module** (vue d’ensemble, cartographie, gate)\n
- couche **composant** (pipeline complet par composant)

## Sources de vérité (NON négociables)
- `memory/constitution.md`
- `security/ARCHITECTURE_DE_SECURITÉ.md`
- `ontologie/01_ontologie.md` + `ontologie/02_ontologie.yaml`
- (si impact utilisateurs) `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md`

## Paramètres (très important)
Chaque commande prend **les mêmes paramètres** :
- `--module <slug>` : **nom du module cible** (sert aussi au dossier de sortie `migration/{module}/`)
  - format: minuscules, chiffres, tirets (ex: `devis`, `ma-place-rh`, `gestion-chantier`)
- `--mockupPath <chemin>` : chemin **relatif repo** vers la maquette
  - **par défaut** : `modules/maquette/<module>/...` (ex: `modules/maquette/devis/v1`)
  - **alternative (maquette dans le module)** : `modules/<module>/maquette/...` (ex: `modules/ma-place-rh/maquette/v1` ou `modules/ma-place-rh/maquette`)
- `--component <slug>` *(optionnel)* : exécute le workflow **scopé** à un composant de maquette
  - définition par défaut: 1 composant = 1 dossier sous `<mockup>/src/components/<component>/`
  - sortie: `migration/{module}/components/{component}/`

Optionnel (pour réinitialiser les fichiers de sortie) :
- `--force`

## Démarrage rapide (recommandé)
### 1) Démarrer (recommandé)

```text
/mockmig.start --module devis --mockupPath modules/maquette/devis/v1
```

> Cette commande te dit immédiatement si tu es dans le cas **module simple** ou **module complexe** (composants), et t’affiche la **NEXT** commande à exécuter.

### 2) Inventaire des règles métier (exhaustif)

Commence par l’inventaire **module** :

```text
/mockmig.inventory --module devis --mockupPath modules/maquette/devis/v1
```

Si des composants sont détectés sous `<mockupPath>/src/components/*`, fais ensuite l’inventaire **par composant** (obligatoire pour éviter toute perte de règles métier) :

```text
/mockmig.inventory --module devis --mockupPath modules/maquette/devis/v1 --component evaluations
```

### 3) Gate de validation (STOP obligatoire)

```text
/mockmig.validate --module devis --mockupPath modules/maquette/devis/v1
```

### 4) À tout moment : savoir quoi faire ensuite

```text
/mockmig.status --module devis --mockupPath modules/maquette/devis/v1
```

Cette commande affiche :
- ce qui manque (artefacts + gates)\n
- **NEXT** : la commande suivante recommandée\n
- **READY** : prêt/pas prêt (et pourquoi)

### 5) (Optionnel mais recommandé) Générer le plan d’implémentation

```text
/mockmig.plan --module devis --mockupPath modules/maquette/devis/v1
```

## Ce que fait `/mockmig.run` (et ce qu’il ne fait PAS)
Tu peux lancer l’orchestrateur :

```text
/mockmig.run --module devis --mockupPath modules/maquette/devis/v1
```

Mais **ça ne doit pas tout exécuter jusqu’au bout automatiquement** :
- `/mockmig.run` sert à te proposer les étapes via **handoffs** (boutons / actions Cursor).
- Le workflow **doit s’arrêter après** `/mockmig.validate` jusqu’à un **OK explicite** de ta part.

> Recommandé : utilise `/mockmig.start` au tout début et `/mockmig.status` pour savoir **NEXT/READY** au lieu de “deviner”.

## Workflow complet (pas-à-pas)
### Mode module (1ère passe) — cartographie + gate + scaffold composants
0) (Recommandé) Démarrer et valider le contexte (path + cas simple/complexe) :

```text
/mockmig.start --module devis --mockupPath modules/maquette/devis/v1
```

1) Inventaire règles métier + cartographie composants :

```text
/mockmig.inventory --module devis --mockupPath modules/maquette/devis/v1
```

2) Gate de validation (STOP après génération du paquet) :

```text
/mockmig.validate --module devis --mockupPath modules/maquette/devis/v1
```

3) Tu ouvres `migration/devis/02_validation_packet.md`, tu complètes la section **Sign-off** et tu donnes un **OK** (oui/non).

4) Après OK seulement : initialiser les dossiers composants (scaffold)

```text
/mockmig.components.init --module devis --mockupPath modules/maquette/devis/v1
```

> Si la maquette contient des composants : l’inventaire **par composant** est obligatoire avant de passer à l’implémentation, afin de ne perdre aucune règle métier.

### PRD (module + composant) — nouveau standard
- **PRD module** : `modules/{module}/prd/{module}.md`
- **PRD composant** (obligatoire quand le travail est scopé composant) : `modules/{module}/prd/components/{component}.md`
- Le scaffold du PRD composant est créé automatiquement lors des runs **scopés composant** (ex: `components.init` + `--component`).
- Synchroniser le contenu (module + composant) via :

```text
/mockmig.prd.sync --plan migration/<module>/components/<component>/07_implementation_plan.md
```

### Mode composant (itératif) — pipeline complet par composant
> Pour chaque composant (ex: `evaluations`, `leave`, `surveys`), exécuter le pipeline complet dans `migration/{module}/components/{component}/`.

5) Pour un composant donné (orchestrateur recommandé) :

```text
/mockmig.component.run --module devis --mockupPath modules/maquette/devis/v1 --component evaluations
```

6) Ou, si tu veux le faire “à la main”, après OK seulement :

```text
/mockmig.audit --module devis --mockupPath modules/maquette/devis/v1 --component evaluations
/mockmig.gap --module devis --mockupPath modules/maquette/devis/v1 --component evaluations
/mockmig.backend.tasks --module devis --mockupPath modules/maquette/devis/v1 --component evaluations
/mockmig.ui.tasks --module devis --mockupPath modules/maquette/devis/v1 --component evaluations
/mockmig.plan --module devis --mockupPath modules/maquette/devis/v1 --component evaluations
```

7) (Recommandé) Régénérer le runbook si tu as modifié des artefacts (préserve l’avancement) :

```text
/mockmig.plan.regen --plan migration/devis/components/evaluations/07_implementation_plan.md
```

8) Implémenter réellement (code + migrations Supabase) — **requiert `--confirm`** et un **Sign-off** dans le runbook :

```text
/mockmig.implementation --plan migration/devis/components/evaluations/07_implementation_plan.md --confirm
```

> Recommandé après implémentation :
>
> ```text
> /mockmig.prd.sync --plan migration/devis/components/evaluations/07_implementation_plan.md
> ```

> Rétro-compat: l’ancien mode reste possible:
>
> ```text
> /mockmig.implementation --module devis --mockupPath modules/maquette/devis/v1 --component evaluations --confirm
> ```
## Où sont les fichiers générés ?
### Mode module
Tout est dans `migration/{module}/` :
- `00_context.md`
- `00_component_map.md` (cartographie composants)
- `01_business_rules.md`
- `02_validation_packet.md` (décisions / validation amont, optionnel)
- `03_existing_audit.md`
- `04_gap_analysis.md`
- `05_backend_tasks.md`
- `06_ui_tasks.md`
- `07_implementation_plan.md` (**runbook + gate**)

### Mode composant
Tout est dans `migration/{module}/components/{component}/` :
- `00_context.md`
- `01_business_rules.md`
- `02_validation_packet.md` (décisions / validation amont, optionnel)
- `03_existing_audit.md`
- `04_gap_analysis.md`
- `05_backend_tasks.md`
- `06_ui_tasks.md`
- `07_implementation_plan.md` (**runbook + gate**)

## Dépannage rapide
- **Erreur “mockupPath doit commencer par …”** : corrige le chemin (voir section Paramètres). Certains modules stockent la maquette dans `modules/<module>/maquette` (submodule Git).
- **Erreur “Dossier maquette introuvable”** : le dossier n’existe pas dans le repo (typo / mauvais niveau).
- **Tu veux repartir de zéro** : relance la commande avec `--force` (ça réécrit les templates dans `migration/{module}/`).
- **Je ne sais pas quoi faire ensuite** : exécute `/mockmig.status --module <slug> --mockupPath <path>` et suis **NEXT/READY**.

## Notes d’exécution (interne)
- Les scripts d’initialisation sont dans `.mockmig/scripts/bash/`.
- Ils créent `migration/{module}/` et initialisent les fichiers si absents (ou avec `--force`).


