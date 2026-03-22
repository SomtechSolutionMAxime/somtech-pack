# Données de référence — somtech-estimator

Source : `${CLAUDE_PLUGIN_ROOT}/templates/defaults.json`
Stack : `${CLAUDE_PLUGIN_ROOT}/templates/stack.json`

## Bonus stack Somtech

Quand le projet utilise la stack standard Somtech (React + Supabase + Tailwind + shadcn/ui + Netlify), un bonus IA s'ajoute aux facteurs de base :

| Rôle | Bonus IA | Justification |
|------|---------|---------------|
| Dev (senior + junior) | +10% | Claude Code excelle sur React + Supabase + Tailwind |
| Designer | +5% | shadcn/ui = composants pré-fabriqués |
| QA | +5% | Playwright codegen |
| PM | +0% | Pas d'impact |

**Formule** : `reduction_finale = min(reduction_base + bonus_stack, 0.85)`

**Réduction infrastructure** : coût infra × 0.60 (Auth Supabase, CI/CD Netlify, shadcn/ui = built-in)

**Fonctionnalités gratuites** (ne pas estimer ou réduire drastiquement) :
- API REST auto-générée (PostgREST)
- Types TypeScript (`supabase gen types`)
- Auth (Supabase Auth) → config RLS seulement
- Realtime → config channels seulement
- Storage → config buckets seulement
- CI/CD → Netlify auto
- Composants UI de base → shadcn/ui assemblage

## Taux journaliers (marché québécois)

| Rôle | Clé JSON | Taux/jour |
|------|----------|-----------|
| Dev Senior | `dev_senior` | 950 $ |
| Dev Junior | `dev_junior` | 750 $ |
| Designer UX/UI | `designer` | 850 $ |
| Chef de projet (PM) | `pm` | 900 $ |
| QA / Testeur | `qa` | 700 $ |
| Architecte | `architecte` | 1 200 $ |

**Architecte** : 5% du coût total global, ajouté **en surplus** (pas dans l'allocation par tâche).

## Facteurs d'accélération IA par rôle

Les facteurs IA sont **spécifiques à chaque rôle**. Les rôles Dev utilisent le facteur du type de tâche ; les autres rôles ont une réduction fixe.

### Facteurs IA — Rôles non-Dev (réduction fixe)

| Rôle | Réduction IA | Justification |
|------|-------------|---------------|
| `dev_senior` | Selon type de tâche | Voir tableau facteurs IA Dev ci-dessous |
| `dev_junior` | Selon type de tâche | Voir tableau facteurs IA Dev ci-dessous |
| `designer` | 40% | Composants pré-fabriqués (Shadcn), Figma AI |
| `qa` | 35% | Tests E2E générés (Playwright codegen), validation reste humaine |
| `pm` | 25% | Documentation auto, rapports, mais planification humaine |

### Facteurs IA — Rôles Dev (réduction par type de tâche)

**Formule** : `Effort IA = Effort traditionnel × (1 - Réduction IA)`

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
| Gestion de projet | `gestion_projet` | 20% | 80% |
| ETL / pipelines de données | `etl_data` | 35% | 65% |
| Configuration dashboard | `dashboard_config` | 30% | 70% |
| Migration de données | `migration_donnees` | 30% | 70% |

## Grille de risque

Le risque est évalué **par bloc** (feature de haut niveau). Deux scores (1-5) sont attribués à chaque bloc.

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

**Facteur global** = moyenne pondérée par coût : `somme(cout_bloc × facteur_bloc) / somme(cout_bloc)`

### Affichage dans le rapport

Pour chaque bloc, le rapport doit montrer **deux colonnes de coût** :
- **Coût brut** : sans application du facteur de risque
- **Coût avec risque** : coût brut × facteur du bloc

Le total global affiche également les deux valeurs (brut et avec risque global pondéré).

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
| `gestion_projet` | 5% | 5% | 0% | 80% | 10% |
| `etl_data` | 70% | 10% | 0% | 10% | 10% |
| `dashboard_config` | 50% | 10% | 20% | 10% | 10% |
| `migration_donnees` | 45% | 15% | 0% | 10% | 30% |

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
| `gestion_projet` | 5 – 8 | 9 – 15 | 16 – 25 |
| `etl_data` | 2 – 4 | 5 – 10 | 11 – 18 |
| `dashboard_config` | 1 – 3 | 4 – 7 | 8 – 12 |
| `migration_donnees` | 2 – 5 | 6 – 10 | 11 – 16 |

## Effort de base IA-assisté par type et complexité (jours) — Mode direct

Fourchettes calibrées pour du dev IA-assisté sur stack moderne (Claude Code + Supabase + shadcn/ui). Utilisées comme **référence indicative** en mode direct (Phase 2B) — l'agent peut s'en écarter selon le contexte.

| Type | Simple | Moyen | Complexe |
|------|--------|-------|----------|
| `crud` | 0.5 – 1 | 1 – 2 | 2 – 4 |
| `pages_statiques` | 0.25 – 0.5 | 0.5 – 1 | 1 – 2 |
| `ui_complexe` | 1 – 2 | 2 – 4 | 4 – 8 |
| `logique_metier` | 1 – 3 | 3 – 6 | 6 – 12 |
| `integration_api` | 1 – 2 | 2 – 5 | 5 – 10 |
| `auth_securite` | 1 – 3 | 3 – 6 | 6 – 12 |
| `infrastructure` | 0.5 – 1 | 1 – 3 | 3 – 6 |
| `reporting` | 0.5 – 1 | 1 – 3 | 3 – 5 |
| `gestion_projet` | 3 – 5 | 5 – 10 | 10 – 18 |
| `etl_data` | 1 – 2 | 2 – 5 | 5 – 10 |
| `dashboard_config` | 0.5 – 1 | 1 – 3 | 3 – 6 |
| `migration_donnees` | 1 – 2 | 2 – 5 | 5 – 10 |

## Overhead fixe par taille de projet — Mode direct

Jours fixes d'overhead estimés en bloc pour le projet entier (pas distribués par tâche). L'architecte est inclus dans l'overhead (pas de surplus 5% séparé).

| Taille | Total jours dev trad | PM | QA | Designer | Architecte |
|--------|---------------------|-----|-----|----------|------------|
| Petit | < 20j | 3j | 2j | 2j | 1j |
| Moyen | 20 – 60j | 5j | 4j | 3j | 2j |
| Grand | 60 – 120j | 8j | 6j | 5j | 3j |
| Très grand | > 120j | 12j | 10j | 8j | 5j |

Ces valeurs sont des références — l'agent les ajuste selon le contexte (ex: 0j Designer si pas d'UI, plus de QA si domaine critique).

## Facteur de reproduction

Applicable lorsqu'un projet s'appuie sur un silo ou une base de code existante (reproduction partielle plutôt que greenfield).

**Formule** : `effort_ajusté = effort_base × facteur`

| Paramètre | Valeur |
|-----------|--------|
| Valeur par défaut | 0.65 |
| Minimum | 0.50 |
| Maximum | 1.00 |

- **0.50** : reproduction très fidèle d'un silo existant, changements mineurs
- **0.65** : reproduction standard avec adaptations modérées (valeur par défaut)
- **1.00** : projet greenfield, aucune réutilisation

## Infrastructure initiale

Tâches d'infrastructure standard à inclure pour tout nouveau silo applicatif. Ces tâches sont listées dans `infrastructureInitiale.taches` et peuvent être ajoutées automatiquement en phase d'estimation.

| Tâche | Type | Complexité |
|-------|------|-----------|
| Auth SSO + gestion des rôles | `auth_securite` | moyen |
| CI/CD pipeline | `infrastructure` | simple |
| Design system + layout de base | `ui_complexe` | moyen |
| Architecture API + conventions | `logique_metier` | simple |
| Configuration domaine + SSL | `infrastructure` | simple |
