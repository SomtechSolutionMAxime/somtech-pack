# /mockmig execute

> **Phase 4 du workflow mockmig.** Implémentation des tâches backend et UI.

## Prérequis

- Phase PLAN complétée
- Gate B (Sign-off) passée
- Flag `--confirm` requis pour exécuter

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `--confirm` | ✅ | Confirmation explicite pour exécuter |
| `--task <id>` | Non | Exécuter une tâche spécifique (ex: BE-001) |
| `--phase <A\|B\|C\|D>` | Non | Exécuter une phase complète |
| `--dry-run` | Non | Prévisualiser sans exécuter |

## Exemples

```bash
# Exécuter toutes les tâches
/mockmig execute --confirm

# Dry-run (prévisualisation)
/mockmig execute --dry-run

# Exécuter une tâche spécifique
/mockmig execute --confirm --task BE-001

# Exécuter une phase
/mockmig execute --confirm --phase A
```

---

## Comportement

### Étape 1 : Validation pré-exécution

```
SI .mockmig/session.json n'existe pas:
  → ERREUR: "Aucune session active. Exécuter /mockmig init d'abord."
  → STOP

→ Charger session.json

SI phase != "PLAN":
  → AFFICHER: "Phase actuelle: <phase>"
  → AFFICHER: "→ Compléter les phases précédentes d'abord"
  → STOP

SI --confirm n'est pas fourni:
  → AFFICHER: "⚠️  Flag --confirm requis pour exécuter"
  → AFFICHER: ""
  → AFFICHER: "Résumé de l'exécution:"
  → AFFICHER: "   • Backend: <n> tâches"
  → AFFICHER: "   • UI: <n> tâches"
  → AFFICHER: "   • Effort estimé: <x>h"
  → AFFICHER: ""
  → AFFICHER: "Pour prévisualiser: /mockmig execute --dry-run"
  → AFFICHER: "Pour exécuter: /mockmig execute --confirm"
  → STOP
```

### Étape 2 : Vérification Gate B

```
SI gates.signoff.passed != true:
  → AFFICHER: "⚠️  Gate B (Sign-off) non passée"
  → AFFICHER: ""
  → AFFICHER: "Avant d'exécuter, un Tech Lead/PO doit valider:"
  → AFFICHER: "   migration/<module>/SIGNOFF_CHECKLIST.md"
  → AFFICHER: ""
  → DEMANDER: "Le sign-off a-t-il été obtenu? (oui/non)"

  SI réponse = "oui":
    → Mettre à jour session.json:
      - gates.signoff.passed: true
      - gates.signoff.date: <now>
      - gates.signoff.by: "manual"
  SINON:
    → AFFICHER: "→ Obtenir le sign-off avant d'exécuter"
    → STOP
```

### Étape 3 : Charger le plan

```
AFFICHER: "🚀 Phase EXECUTE"
AFFICHER: "================"
AFFICHER: ""
AFFICHER: "📖 Chargement du plan..."

→ Lire migration/<module>/05_backend_tasks.md
→ Lire migration/<module>/06_ui_tasks.md
→ Lire migration/<module>/07_runbook.md

→ Parser les tâches et dépendances
→ Construire le graphe d'exécution

SI --task:
  → Filtrer pour ne garder que la tâche spécifiée + ses dépendances

SI --phase:
  → Filtrer pour ne garder que les tâches de la phase

AFFICHER: "   Tâches à exécuter: <n>"
```

### Étape 4 : Mode Dry-Run

```
SI --dry-run:
  AFFICHER: ""
  AFFICHER: "🔍 Mode Dry-Run (prévisualisation)"
  AFFICHER: ""

  POUR CHAQUE tâche dans l'ordre:
    AFFICHER: "   [<id>] <description>"
    SI tâche.type = "migration":
      AFFICHER: "      → Créer migration: supabase/migrations/<timestamp>_<name>.sql"
    SI tâche.type = "rls":
      AFFICHER: "      → Ajouter policy dans migration"
    SI tâche.type = "component":
      AFFICHER: "      → Créer: app/src/modules/<module>/components/<name>.tsx"
    ...

  AFFICHER: ""
  AFFICHER: "→ Pour exécuter réellement: /mockmig execute --confirm"
  → STOP
```

### Étape 5 : Exécution Backend (via Supabase MCP)

```
AFFICHER: ""
AFFICHER: "🔧 Exécution Backend..."

executed = []
failed = []

POUR CHAQUE tâche backend dans l'ordre des dépendances:
  AFFICHER: "   [<id>] <description>..."

  SI tâche a des dépendances non exécutées:
    → AFFICHER: "      ⏸️  En attente de: <deps>"
    → Continuer à la prochaine

  ESSAYER:
    SI tâche.type = "migration":
      → Générer fichier SQL depuis ontologie
      → Supabase MCP: créer migration
      → Supabase MCP: appliquer migration

    SI tâche.type = "rls":
      → Générer policy SQL depuis pattern
      → Supabase MCP: ajouter à migration existante ou créer nouvelle
      → Supabase MCP: appliquer

    SI tâche.type = "function":
      → Générer fonction SQL depuis business rules
      → Supabase MCP: créer fonction

    SI tâche.type = "index":
      → Générer CREATE INDEX
      → Supabase MCP: appliquer

    → AFFICHER: "      ✅ Succès"
    → executed.push(tâche)

  EN CAS D'ERREUR:
    → AFFICHER: "      ❌ Échec: <error>"
    → failed.push({tâche, error})
    → DEMANDER: "Continuer malgré l'erreur? (oui/non)"
    SI non:
      → GOTO étape_bilan

AFFICHER: ""
AFFICHER: "   Backend: <executed.length>/<total> tâches complétées"
```

### Étape 6 : Génération Types TypeScript

```
SI executed contient des migrations:
  AFFICHER: ""
  AFFICHER: "📝 Régénération des types..."

  → Bash: supabase gen types typescript --local > app/src/types/supabase.ts

  AFFICHER: "   ✅ Types régénérés: app/src/types/supabase.ts"
```

### Étape 7 : Exécution UI

```
AFFICHER: ""
AFFICHER: "🎨 Exécution UI..."

POUR CHAQUE tâche UI dans l'ordre des dépendances:
  AFFICHER: "   [<id>] <description>..."

  SI tâche a des dépendances backend non exécutées:
    → AFFICHER: "      ⚠️  Dépendance backend manquante"
    → Continuer

  ESSAYER:
    SI tâche.type = "component":
      → Lire composant source depuis maquette
      → Adapter le code:
        - Remplacer mock data par hooks Supabase
        - Ajouter types générés
        - Ajouter guards si nécessaire
        - Ajouter loading/error states
      → Écrire dans app/src/modules/<module>/components/

    SI tâche.type = "page":
      → Générer page Next.js
      → Intégrer composants migrés
      → Configurer route

    SI tâche.type = "guard":
      → Générer guard selon pattern
      → Écrire dans app/src/components/guards/

    → AFFICHER: "      ✅ Créé: <path>"
    → executed.push(tâche)

  EN CAS D'ERREUR:
    → AFFICHER: "      ❌ Échec: <error>"
    → failed.push({tâche, error})

AFFICHER: ""
AFFICHER: "   UI: <executed.length>/<total> tâches complétées"
```

### Étape 8 : Hooks et utilitaires

```
SI des composants ont été créés:
  AFFICHER: ""
  AFFICHER: "🔗 Génération hooks..."

  → Créer app/src/modules/<module>/hooks/use<Module>.ts
    - Hooks CRUD basés sur les tables créées
    - Utilisation de @supabase/ssr

  → Créer app/src/modules/<module>/types/index.ts
    - Re-export des types Supabase pertinents

  → Créer app/src/modules/<module>/index.ts
    - Barrel export du module

  AFFICHER: "   ✅ Module structure créée"
```

### Étape 9 : Bilan d'exécution

```
:étape_bilan

AFFICHER: ""
AFFICHER: "═══════════════════════════════════════"
AFFICHER: "📊 Bilan d'exécution"
AFFICHER: ""

total = backend_tasks.length + ui_tasks.length
success = executed.length
failures = failed.length

AFFICHER: "   Succès: <success>/<total>"
AFFICHER: "   Échecs: <failures>/<total>"

SI failures > 0:
  AFFICHER: ""
  AFFICHER: "❌ Tâches en échec:"
  POUR CHAQUE f dans failed:
    AFFICHER: "   • [<f.tâche.id>] <f.error>"

  → Créer migration/<module>/EXECUTION_ERRORS.md avec détails

  AFFICHER: ""
  AFFICHER: "→ Corriger les erreurs puis relancer:"
  AFFICHER: "  /mockmig execute --confirm --task <failed_id>"

  → Mettre à jour session.json:
    - lastError: "Exécution partielle: <failures> échecs"

SI success = total:
  AFFICHER: ""
  AFFICHER: "✅ Migration complète!"

  → Mettre à jour session.json:
    - phase: "EXECUTE"
    - gates.confirm.passed: true
    - gates.confirm.date: <now>
```

### Étape 10 : Tests automatisés (E2E)

> **OBLIGATOIRE**: Claude doit tester l'implémentation avant de conclure.

```
SI success = total:
  AFFICHER: ""
  AFFICHER: "═══════════════════════════════════════"
  AFFICHER: "🧪 TESTS AUTOMATISÉS"
  AFFICHER: "═══════════════════════════════════════"
```

#### 10.1 - Créer un utilisateur de test

```
AFFICHER: ""
AFFICHER: "👤 Création utilisateur de test..."

# Générer credentials de test
test_email = "test-<module>-<timestamp>@test.local"
test_password = "Test123!<random>"

# Créer l'utilisateur via Supabase MCP ou SQL
→ Supabase MCP: créer utilisateur auth
  OU
→ SQL: INSERT INTO auth.users (...)

# Si l'app a des rôles, assigner un rôle de test
SI roles détectés dans l'ontologie:
  → Assigner le rôle approprié pour tester toutes les fonctionnalités

# Créer des données de test si nécessaire
SI module a besoin de données existantes:
  → Insérer données de test minimales
  → Respecter les contraintes FK

AFFICHER: "   ✅ Utilisateur créé: <test_email>"
AFFICHER: "   ✅ Données de test: <n> enregistrements"

# Sauvegarder les credentials pour cleanup
→ test_credentials = { email, password, user_id, data_ids }
```

#### 10.2 - Lancer le serveur de développement

```
AFFICHER: ""
AFFICHER: "🚀 Démarrage serveur de dev..."

→ Bash (background): npm run dev
→ Attendre que le serveur soit prêt (port 3000)
→ Vérifier: curl http://localhost:3000 → 200 OK

SI serveur ne démarre pas:
  → AFFICHER: "❌ Échec démarrage serveur"
  → AFFICHER: "   Erreur: <error>"
  → GOTO cleanup

AFFICHER: "   ✅ Serveur démarré: http://localhost:3000"
```

#### 10.3 - Navigation et tests UI (Claude in Chrome)

```
AFFICHER: ""
AFFICHER: "🌐 Tests d'interface..."

# Ouvrir le navigateur
→ Chrome MCP: tabs_create_mcp
→ Chrome MCP: navigate → http://localhost:3000

# Se connecter avec l'utilisateur de test
AFFICHER: "   🔐 Connexion..."
→ Chrome MCP: find → "login" ou "connexion"
→ Chrome MCP: form_input → email, password
→ Chrome MCP: computer → click submit
→ Attendre navigation

SI login échoue:
  → AFFICHER: "   ❌ Échec connexion"
  → Capturer screenshot
  → AJOUTER erreur

# Naviguer vers le module
AFFICHER: "   📍 Navigation vers /<module>..."
→ Chrome MCP: navigate → http://localhost:3000/<module>

# Vérifier erreurs console
→ Chrome MCP: read_console_messages → pattern: "error|Error|ERROR"
SI erreurs console:
  → AFFICHER: "   ⚠️  Erreurs console détectées: <n>"
  POUR CHAQUE erreur:
    → AFFICHER: "      • <error>"
  → AJOUTER warning
SINON:
  → AFFICHER: "   ✅ Console: aucune erreur"
```

#### 10.4 - Test des boutons

```
AFFICHER: ""
AFFICHER: "🔘 Test des boutons..."

# Identifier tous les boutons
→ Chrome MCP: find → "button"
→ Chrome MCP: read_page → filter: "interactive"

buttons_tested = 0
buttons_failed = 0

POUR CHAQUE bouton interactif:
  → AFFICHER: "   Testing: <button_text>..."

  # Capturer état avant
  → Chrome MCP: computer → screenshot

  # Cliquer
  → Chrome MCP: computer → click sur bouton

  # Attendre réaction (animation, navigation, modal)
  → Attendre 500ms

  # Vérifier erreurs console après clic
  → Chrome MCP: read_console_messages → onlyErrors: true
  SI nouvelles erreurs:
    → AFFICHER: "      ❌ Erreur après clic: <error>"
    → buttons_failed++
    → Capturer screenshot
  SINON:
    → AFFICHER: "      ✅ OK"
    → buttons_tested++

  # Revenir à l'état initial si navigation
  SI URL a changé ET pas attendu:
    → Chrome MCP: navigate → back

AFFICHER: "   Résultat: <buttons_tested>/<total> boutons OK"
SI buttons_failed > 0:
  → AFFICHER: "   ⚠️  <buttons_failed> boutons avec erreurs"
```

#### 10.5 - Test des formulaires

```
AFFICHER: ""
AFFICHER: "📝 Test des formulaires..."

# Identifier tous les formulaires
→ Chrome MCP: find → "form"

forms_tested = 0
forms_failed = 0

POUR CHAQUE formulaire:
  → AFFICHER: "   Testing: <form_name>..."

  # Identifier les champs
  → Chrome MCP: read_page → ref_id: form_ref, depth: 3

  # Remplir avec des données de test valides
  POUR CHAQUE champ:
    → Générer valeur de test selon le type:
      - text → "Test value"
      - email → "test@test.com"
      - number → 123
      - date → today
      - select → première option
      - checkbox → toggle
    → Chrome MCP: form_input → ref, value

  # Soumettre le formulaire
  → Chrome MCP: find → "submit" ou "button[type=submit]"
  → Chrome MCP: computer → click

  # Attendre réponse
  → Attendre 1000ms

  # Vérifier le résultat
  → Chrome MCP: read_console_messages → onlyErrors: true
  → Chrome MCP: read_page → chercher message succès/erreur

  SI erreur console OU message d'erreur inattendu:
    → AFFICHER: "      ❌ Échec soumission"
    → forms_failed++
    → Capturer screenshot
  SINON:
    → AFFICHER: "      ✅ Soumission OK"
    → forms_tested++

  # Reset pour prochain test
  → Rafraîchir la page ou naviguer back

AFFICHER: "   Résultat: <forms_tested>/<total> formulaires OK"
SI forms_failed > 0:
  → AFFICHER: "   ⚠️  <forms_failed> formulaires avec erreurs"
```

#### 10.6 - Test des validations

```
AFFICHER: ""
AFFICHER: "🔒 Test des validations..."

# Tester les cas d'erreur (validation côté client)
POUR CHAQUE formulaire:
  # Soumettre vide
  → Chrome MCP: computer → click submit sans remplir
  → Vérifier que validation bloque
  → AFFICHER: "   ✅ Validation champs requis: OK"

  # Soumettre avec données invalides
  SI champ email existe:
    → form_input → "invalid-email"
    → click submit
    → Vérifier message d'erreur
    → AFFICHER: "   ✅ Validation email: OK"

  SI champ nombre existe:
    → form_input → "abc" (texte dans nombre)
    → Vérifier comportement
    → AFFICHER: "   ✅ Validation nombre: OK"
```

#### 10.7 - Vérification RLS (sécurité)

```
AFFICHER: ""
AFFICHER: "🛡️  Test sécurité RLS..."

# Créer un 2ème utilisateur de test
test_user_2 = créer_utilisateur_test()

# Créer une donnée avec user 1
→ Se connecter user 1
→ Créer un enregistrement

# Tenter d'accéder avec user 2
→ Se déconnecter
→ Se connecter user 2
→ Tenter d'accéder à l'enregistrement de user 1

SI accès refusé (comme attendu):
  → AFFICHER: "   ✅ RLS Owner pattern: OK"
SINON:
  → AFFICHER: "   ❌ RLS VIOLATION: user 2 voit données user 1!"
  → AJOUTER erreur critique
```

#### 10.8 - Générer rapport de test

```
AFFICHER: ""
AFFICHER: "📊 Génération rapport de test..."

→ Créer migration/<module>/08_test_report.md

CONTENU:
---
# Rapport de Tests: <module>

## Informations
| Clé | Valeur |
|-----|--------|
| Date | <now> |
| Environnement | localhost:3000 |
| Utilisateur test | <test_email> |

## Résumé
| Catégorie | Passés | Échecs | Total |
|-----------|--------|--------|-------|
| Console | <n> | <n> | <n> |
| Boutons | <n> | <n> | <n> |
| Formulaires | <n> | <n> | <n> |
| Validations | <n> | <n> | <n> |
| Sécurité RLS | <n> | <n> | <n> |
| **Total** | <n> | <n> | <n> |

## Résultat global
<✅ PASS | ⚠️ PASS AVEC WARNINGS | ❌ FAIL>

## Erreurs console détectées
<liste des erreurs>

## Boutons en échec
<liste avec screenshots>

## Formulaires en échec
<liste avec détails>

## Violations de sécurité
<liste critique>

## Screenshots
<liens vers captures d'écran>

---

AFFICHER: "✅ Créé: migration/<module>/08_test_report.md"
```

#### 10.9 - Cleanup

```
:cleanup

AFFICHER: ""
AFFICHER: "🧹 Nettoyage..."

# Supprimer l'utilisateur de test
→ Supabase MCP: DELETE FROM auth.users WHERE email = test_email

# Supprimer les données de test
POUR CHAQUE table avec données de test:
  → DELETE FROM <table> WHERE id IN (test_data_ids)

# Arrêter le serveur de dev
→ Bash: kill server process

AFFICHER: "   ✅ Utilisateur de test supprimé"
AFFICHER: "   ✅ Données de test nettoyées"
AFFICHER: "   ✅ Serveur arrêté"
```

#### 10.10 - Résultat des tests

```
AFFICHER: ""
AFFICHER: "═══════════════════════════════════════"

SI tous tests passés:
  AFFICHER: "🎉 TESTS PASSÉS"
  AFFICHER: ""
  AFFICHER: "   Console: ✅"
  AFFICHER: "   Boutons: ✅"
  AFFICHER: "   Formulaires: ✅"
  AFFICHER: "   Sécurité: ✅"

  → tests_passed = true

SINON SI erreurs critiques (sécurité):
  AFFICHER: "❌ TESTS ÉCHOUÉS - ERREURS CRITIQUES"
  AFFICHER: ""
  AFFICHER: "⚠️  Des violations de sécurité ont été détectées!"
  AFFICHER: "→ Corriger AVANT de merger"

  → tests_passed = false

SINON:
  AFFICHER: "⚠️  TESTS AVEC WARNINGS"
  AFFICHER: ""
  AFFICHER: "   Erreurs non-bloquantes détectées."
  AFFICHER: "   Voir 08_test_report.md pour détails."

  → tests_passed = true (avec warnings)
```

---

### Étape 11 : Actions post-exécution

```
SI success = total ET tests_passed:
  AFFICHER: ""
  AFFICHER: "📋 Actions recommandées:"
  AFFICHER: ""
  AFFICHER: "1. Vérifier les migrations:"
  AFFICHER: "   supabase db diff"
  AFFICHER: ""
  AFFICHER: "2. Revoir le rapport de test:"
  AFFICHER: "   migration/<module>/08_test_report.md"
  AFFICHER: ""
  AFFICHER: "3. Créer une PR:"
  AFFICHER: "   gh pr create --title 'feat(<module>): migration from mockup'"
  AFFICHER: ""
  AFFICHER: "4. Déployer sur preview:"
  AFFICHER: "   (automatique via Netlify)"

SINON:
  AFFICHER: ""
  AFFICHER: "⚠️  Corriger les erreurs avant de continuer:"
  AFFICHER: "   → Voir 08_test_report.md"
  AFFICHER: "   → Relancer: /mockmig execute --confirm"
```

### Étape 13 : Mettre à jour session

```
→ Mettre à jour .mockmig/session.json:
  - phase: "EXECUTE" (ou rester sur PLAN si échecs)
  - updatedAt: <now>
  - lastCommand: "/mockmig execute --confirm"
  - execution: {
      started: <timestamp>,
      completed: <timestamp>,
      success: <n>,
      failed: <n>,
      tasks: [
        {id: "BE-001", status: "done", duration: <ms>},
        {id: "BE-002", status: "failed", error: "..."},
        ...
      ]
    }
  - tests: {
      ran: true,
      passed: <tests_passed>,
      console_errors: <n>,
      buttons: { passed: <n>, failed: <n> },
      forms: { passed: <n>, failed: <n> },
      rls: { passed: <n>, failed: <n> },
      report: "migration/<module>/08_test_report.md"
    }

SI tous succès ET tests_passed:
  AFFICHER: ""
  AFFICHER: "═══════════════════════════════════════"
  AFFICHER: "🎉 Migration terminée et testée!"
  AFFICHER: ""
  AFFICHER: "   ✅ Implémentation: <n>/<n> tâches"
  AFFICHER: "   ✅ Tests: passés"
  AFFICHER: ""
  AFFICHER: "→ Voir le statut final: /mockmig status"
  AFFICHER: "→ Créer la PR: gh pr create"

SINON:
  AFFICHER: ""
  AFFICHER: "═══════════════════════════════════════"
  AFFICHER: "⚠️  Migration incomplète"
  AFFICHER: ""
  AFFICHER: "→ Corriger les erreurs puis relancer"
```

---

## Fichiers créés

Lors de l'exécution, les fichiers suivants peuvent être créés:

### Backend
| Type | Emplacement |
|------|-------------|
| Migrations SQL | `supabase/migrations/<timestamp>_<name>.sql` |
| Types générés | `app/src/types/supabase.ts` |

### Frontend
| Type | Emplacement |
|------|-------------|
| Composants | `app/src/modules/<module>/components/*.tsx` |
| Pages | `app/src/modules/<module>/pages/*.tsx` |
| Hooks | `app/src/modules/<module>/hooks/*.ts` |
| Types | `app/src/modules/<module>/types/index.ts` |
| Guards | `app/src/components/guards/*.tsx` |

### Tests
| Type | Emplacement |
|------|-------------|
| Rapport de test | `migration/<module>/08_test_report.md` |
| Screenshots | `migration/<module>/screenshots/*.png` |

---

## Gestion des erreurs

### Erreur de migration SQL
```
❌ Échec: relation "users" already exists
```
→ Vérifier si la table existe déjà, ajuster la migration

### Erreur RLS
```
❌ Échec: policy "owner_select" already exists
```
→ Utiliser CREATE OR REPLACE ou DROP IF EXISTS

### Erreur TypeScript
```
❌ Échec: Type 'X' is not assignable to type 'Y'
```
→ Régénérer les types, vérifier les imports

---

## Voir aussi

- `/mockmig plan` — Étape précédente
- `/mockmig status` — Voir l'état de la session
- `supabase db diff` — Voir les changements DB
