# Index des règles — Navigateur & Tests

Ce document indexe toutes les règles liées à la stratégie de validation navigateur et tests automatisés.

## 🎯 Règle maîtresse

- **[browser-validation-strategy.mdc](.cursor/rules/browser-validation-strategy.mdc)**
  - Type : `alwaysApply: true`
  - Description : Stratégie globale définissant l'utilisation du navigateur intégré vs tests automatisés
  - Contenu : Tableaux de décision, workflows types, règles de priorisation

## 🌐 Navigateur intégré (Validation interactive)

### Règles obligatoires
- **[ui-changes-require-playwright-tests.mdc](.cursor/rules/ui-changes-require-playwright-tests.mdc)**
  - Type : `alwaysApply: true`
  - Description : Validation obligatoire via navigateur MCP après toute modification UI
  - Contenu : Procédure de validation, checklist, distinction tests auto vs validation interactive

### Règles de référence
- **[ui-browser-interactive.mdc](.cursor/rules/ui-browser-interactive.mdc)**
  - Type : `alwaysApply: false` (référence)
  - Description : Catalogue exhaustif des outils MCP Playwright disponibles
  - Contenu : Liste complète des commandes, exemples, workflows de validation/débogage/exploration

- **[ui-interface-playwright.mdc](.cursor/rules/ui-interface-playwright.mdc)**
  - Type : `alwaysApply: false` (référence)
  - Description : Workflows de validation et exploration d'interface
  - Contenu : Cas d'usage mobile/desktop, débogage console, architecture projet

## 🧪 Tests automatisés

### Règle de référence
- **[ui-testing-automated.mdc](.cursor/rules/ui-testing-automated.mdc)**
  - Type : `alwaysApply: false` (référence)
  - Description : Guide complet des tests automatisés Playwright (e2e)
  - Contenu : Quand créer des tests, structure, conventions, recettes, CI/CD

## 🔀 Orchestrateur

- **[00_orchestrator.mdc](.cursor/rules/00_orchestrator.mdc)**
  - Type : `alwaysApply: true`
  - Description : Agent orchestrateur principal (mis à jour)
  - Contenu :
    - Mission : validation navigateur MCP obligatoire
    - Règle d'or #8 : validation UI systématique
    - Matrice d'intentions étendue
    - Heuristiques enrichies
    - Processus étape 6 : workflow validation UI
    - Section "Règles spécialisées" réorganisée

## 👥 Agents impactés

### Dev Frontend
- **[04_dev_frontend.mdc](.cursor/rules/04_dev_frontend.mdc)**
  - Modifications : DoD enrichi (validation MCP obligatoire, capture logs console)

### QA Testeur
- **[06_qa_testeur.mdc](.cursor/rules/06_qa_testeur.mdc)**
  - Modifications : Commande `*console-capture`, DoD avec erreurs console capturées

## 📚 Documentation

### Guides pour développeurs
- **[docs/REFONTE_COMPLETE.md](docs/REFONTE_COMPLETE.md)**
  - Résumé complet de la refonte
  - Liste des règles modifiées/créées
  - Workflow type
  - Points clés et références

- **[docs/refonte-strategie-navigateur-tests.md](docs/refonte-strategie-navigateur-tests.md)**
  - Vue d'ensemble détaillée
  - Changements principaux
  - Bénéfices et migration
  - Prochaines étapes

- **[docs/guide-navigateur-tests.md](docs/guide-navigateur-tests.md)**
  - Guide rapide et visuel
  - Tableaux de décision
  - Aide-mémoire outils MCP
  - FAQ

## 🗂️ Anciennes règles (supprimées)

- ~~`ui-testing-playwright.mdc`~~ → Remplacée par `ui-testing-automated.mdc`

## 📊 Vue d'ensemble

```
Stratégie globale (alwaysApply)
├── browser-validation-strategy.mdc ⚠️ RÈGLE MAÎTRESSE
│
Validation obligatoire (alwaysApply)
├── ui-changes-require-playwright-tests.mdc
│
Références navigateur intégré
├── ui-browser-interactive.mdc
└── ui-interface-playwright.mdc
│
Référence tests automatisés
└── ui-testing-automated.mdc
│
Orchestrateur & agents
├── 00_orchestrator.mdc (mis à jour)
├── 04_dev_frontend.mdc (mis à jour)
└── 06_qa_testeur.mdc (mis à jour)
│
Documentation
├── docs/REFONTE_COMPLETE.md
├── docs/refonte-strategie-navigateur-tests.md
└── docs/guide-navigateur-tests.md
```

## 🔍 Recherche rapide

### Par besoin
| Besoin | Règle à consulter |
|--------|-------------------|
| Comprendre la stratégie globale | `browser-validation-strategy.mdc` |
| Valider une modification UI | `ui-changes-require-playwright-tests.mdc` |
| Trouver un outil MCP spécifique | `ui-browser-interactive.mdc` |
| Créer un test automatisé | `ui-testing-automated.mdc` |
| Workflow mobile/desktop | `ui-interface-playwright.mdc` |
| Vue d'ensemble refonte | `docs/REFONTE_COMPLETE.md` |
| Guide rapide | `docs/guide-navigateur-tests.md` |

### Par type d'usage
| Usage | Règle | Obligatoire |
|-------|-------|-------------|
| Validation interactive | `ui-changes-require-playwright-tests.mdc` | ✅ Oui |
| Tests automatisés e2e | `ui-testing-automated.mdc` | ⚙️ Parcours critiques |
| Débogage console | `ui-interface-playwright.mdc` | ✅ Oui |
| Exploration web externe | `ui-browser-interactive.mdc` | ⚙️ À la demande |

---

**Dernière mise à jour** : 2025-10-26  
**Mainteneur** : Orchestrateur

