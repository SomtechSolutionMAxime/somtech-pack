# Skill: Gestion des Tests Playwright

Ce skill aide à créer, mettre à jour et exécuter les tests Playwright pour le projet Construction Gauthier.

## Déclencheurs
- `/test` - Commande principale
- `/playwright` - Alias

## Répertoire de Base
`/Users/maximeleboeuf/Library/Mobile Documents/com~apple~CloudDocs/Somtech/Dev/GitRepo/constructiongauthier-2`

## Structure des Tests
```
modules/ma-place-rh/tests/e2e/
├── fixtures/           # Fixtures d'authentification
├── page-objects/       # Page Object Models
├── workflows/          # Workflow builders multi-rôles
├── specs/              # Tests organisés par feature
└── utils/              # Utilitaires et constantes
```

## Actions Disponibles

### 1. Créer un nouveau test
**Usage:** `/test create <feature>`
**Exemple:** `/test create evaluations`

1. Analyser la feature demandée
2. Créer le Page Object correspondant dans `page-objects/`
3. Créer le fichier de test dans `specs/<feature>/`
4. Utiliser les fixtures existantes pour l'authentification

### 2. Créer un workflow multi-rôles
**Usage:** `/test workflow <name>`
**Exemple:** `/test workflow onboarding`

1. Créer un workflow builder dans `workflows/<name>.workflow.ts`
2. Utiliser le pattern fluent API existant
3. Supporter les rôles: employee, manager, direction

### 3. Créer un Page Object
**Usage:** `/test page-object <path>`
**Exemple:** `/test page-object employee/skills`

1. Créer le fichier dans `page-objects/<path>.page.ts`
2. Étendre `BasePage`
3. Inclure sélecteurs, actions et assertions

### 4. Lancer les tests
**Usage:** `/test run [project]`
**Exemples:**
- `/test run` - Tous les tests Ma Place RH
- `/test run workflows` - Seulement les workflows
- `/test run security` - Tests de permissions

Commandes Playwright correspondantes:
```bash
npx playwright test --project=ma-place-rh
npx playwright test --project=ma-place-rh:workflows
npx playwright test --project=ma-place-rh:security
```

### 5. Mettre à jour les tests
**Usage:** `/test update`

1. Analyser les changements récents dans le code source
2. Identifier les tests potentiellement obsolètes
3. Proposer des mises à jour ou nouveaux tests

## Utilisateurs de Test Disponibles

| Clé | Email | Rôle |
|-----|-------|------|
| `admin` | admin@constructiongauthier.com | admin |
| `directeur` | directeur@constructiongauthier.com | direction |
| `operations` | operations@constructiongauthier.com | direction |
| `surintendant` | surintendant@constructiongauthier.com | manager |
| `contremaitre1` | contremaitre1@constructiongauthier.com | manager |
| `compagnon1` | compagnon1@constructiongauthier.com | employee |
| `compagnon2` | compagnon2@constructiongauthier.com | employee |
| `apprenti1` | apprenti1@constructiongauthier.com | employee |
| `rh` | rh@constructiongauthier.com | rh |

Mot de passe: `password123`

## Patterns à Suivre

### Fixture d'authentification
```typescript
import { test, expect, TEST_USERS } from '../../fixtures';

test('Mon test', async ({ employeePage }) => {
  // employeePage est déjà authentifié comme compagnon1
});
```

### Workflow multi-rôles
```typescript
const workflow = new MyWorkflow(browser)
  .withEmployee('compagnon1')
  .withManager('contremaitre1');

await workflow.step1();
await workflow.step2();
```

### Page Object
```typescript
export class MyPage extends BasePage {
  async navigate() {
    await this.goto('/my-path');
  }

  async doAction() {
    await this.clickButton('Action');
  }

  async expectResult() {
    await this.expectSuccessToast();
  }
}
```

## Templates

Voir les fichiers dans `templates/` pour des exemples complets:
- `page-object.ts.tpl` - Template Page Object
- `workflow.ts.tpl` - Template Workflow
- `spec.ts.tpl` - Template fichier de test

## Vérification

Après création ou modification de tests:
```bash
# Vérifier la syntaxe
npx playwright test --project=ma-place-rh --list

# Exécuter un test spécifique
npx playwright test specs/leave/full-workflow.spec.ts

# Mode debug
npx playwright test --ui
```
