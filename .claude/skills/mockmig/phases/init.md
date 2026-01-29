# /mockmig init

> **Point d'entrée du workflow mockmig.** Preflight check + bootstrap des sources de vérité si absentes.

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `--module <slug>` | ✅ | Nom du module (kebab-case). Ex: `devis`, `core` |
| `--mockupPath <path>` | ✅ | Chemin vers la maquette. Ex: `modules/maquette/core/v1` |
| `--skip-netlify` | ❌ | Ignorer la vérification Netlify MCP |
| `--skip-bootstrap` | ❌ | Ne pas générer les sources de vérité (échoue si absentes) |
| `--force` | ❌ | Réinitialiser une session existante |

## Exemples

```bash
# App single-module
/mockmig init --module core --mockupPath modules/maquette/core/v1

# App multi-modules
/mockmig init --module devis --mockupPath modules/maquette/devis/v1

# Sans Netlify (CI/local)
/mockmig init --module core --mockupPath modules/maquette/core/v1 --skip-netlify
```

---

## Comportement

### Étape 1 : Validation des arguments

```
SI --module manquant OU --mockupPath manquant:
  → ERREUR: "Arguments requis: --module <slug> --mockupPath <path>"
  → STOP

SI --module ne matche pas ^[a-z0-9]+(-[a-z0-9]+)*$:
  → ERREUR: "Module invalide (kebab-case requis): <module>"
  → STOP

SI mockupPath n'existe pas:
  → ERREUR: "Maquette introuvable: <path>"
  → STOP
```

### Étape 2 : Vérification session existante

```
SI .mockmig/session.json existe ET --force absent:
  → AFFICHER: "Session existante détectée pour module <module>"
  → AFFICHER: "Phase actuelle: <phase>"
  → DEMANDER: "Reprendre la session? [O/n/--force pour réinitialiser]"

SI réponse = O:
  → Charger session existante
  → GOTO /mockmig status

SI réponse = n OU --force:
  → Supprimer .mockmig/session.json
  → Continuer
```

### Étape 3 : Preflight Check MCPs

```
AFFICHER: "🔍 Preflight Check"
AFFICHER: "=================="

AFFICHER: "🔌 MCPs"

# Supabase MCP (REQUIS)
SI Supabase MCP connecté:
  → Récupérer projectId, role
  → AFFICHER: "✅ Supabase: connecté (projet: <id>, role: <role>)"
SINON:
  → AFFICHER: "❌ Supabase: NON CONNECTÉ"
  → AFFICHER: "   → Installer: npx supabase mcp install"
  → AJOUTER blocker critique

# GitHub MCP (REQUIS)
SI GitHub MCP connecté:
  → Récupérer repo, permissions
  → AFFICHER: "✅ GitHub: connecté (repo: <repo>)"
SINON:
  → AFFICHER: "❌ GitHub: NON CONNECTÉ"
  → AJOUTER blocker critique

# Netlify MCP (OPTIONNEL)
SI --skip-netlify:
  → AFFICHER: "⏭️  Netlify: ignoré (--skip-netlify)"
SINON SI Netlify MCP connecté ET site lié:
  → AFFICHER: "✅ Netlify: connecté (site: <site>)"
SINON SI Netlify MCP connecté MAIS site non lié:
  → AFFICHER: "⚠️  Netlify: connecté mais site non lié"
  → AFFICHER: "   → Action: netlify link"
  → AJOUTER warning
SINON:
  → AFFICHER: "⚠️  Netlify: non connecté (optionnel)"
  → AJOUTER warning
```

### Étape 4 : Validation maquette

```
AFFICHER: "📦 Maquette"

SI mockupPath existe:
  → AFFICHER: "✅ <mockupPath> existe"

  # Détecter structure
  SI src/components/ existe:
    → Lister composants
    → AFFICHER: "✅ Structure valide (<n> composants détectés)"
    POUR CHAQUE composant:
      → AFFICHER: "   • <composant>.tsx"
  SINON:
    → AFFICHER: "⚠️  Structure non standard (pas de src/components/)"
    → AJOUTER warning

  # Détecter package.json
  SI package.json existe:
    → Lire dependencies
    → Détecter stack (Next.js, React, Tailwind, Supabase, etc.)
SINON:
  → AFFICHER: "❌ Maquette introuvable: <path>"
  → AJOUTER blocker critique
```

### Étape 5 : Vérification sources de vérité

```
AFFICHER: "📁 Sources de vérité"

sources = [
  "memory/constitution.md",
  "security/ARCHITECTURE_DE_SECURITÉ.md",
  "ontologie/01_ontologie.md",
  "ontologie/02_ontologie.yaml"
]

sources_manquantes = []

POUR CHAQUE source:
  SI existe:
    → AFFICHER: "✅ <source> (existant)"
  SINON:
    → AFFICHER: "⚠️  <source> (ABSENT)"
    → sources_manquantes.push(source)

SI sources_manquantes.length > 0:
  → bootstrap_needed = true
```

### Étape 6 : Résultat preflight

```
AFFICHER: "─────────────────────────────────────────"

SI blockers critiques:
  → AFFICHER: "❌ BLOCKERS (<n> critique(s))"
  POUR CHAQUE blocker:
    → AFFICHER: "<n>. <description>"
  → STOP (ne pas créer de session)

SI bootstrap_needed ET --skip-bootstrap:
  → AFFICHER: "❌ Sources de vérité manquantes et --skip-bootstrap actif"
  → STOP

SI bootstrap_needed:
  → AFFICHER: "⚠️  BOOTSTRAP NEEDED"
  → GOTO Étape 7 (Bootstrap)

SINON:
  → AFFICHER: "✅ READY"
  → GOTO Étape 8 (Créer session)
```

### Étape 7 : Bootstrap (si sources manquantes)

```
AFFICHER: "Analyse de la maquette en cours..."

# Analyser les types/interfaces TypeScript
→ Lire tous les fichiers .ts/.tsx dans mockupPath
→ Extraire interfaces, types, enums
→ Détecter relations (références entre types)

AFFICHER: "📊 Entités détectées:"
POUR CHAQUE entité:
  → AFFICHER: "   • <Entité> (<attributs>)"

# Analyser les patterns de sécurité
→ Chercher AuthGuard, ProtectedRoute, useAuth
→ Chercher vérifications de rôles
→ Détecter patterns RLS implicites

AFFICHER: "🔒 Patterns de sécurité détectés:"
POUR CHAQUE pattern:
  → AFFICHER: "   • <pattern> → <suggestion RLS>"

# Analyser la stack
→ Lire package.json
→ Détecter frameworks, librairies

AFFICHER: "📜 Stack détectée:"
POUR CHAQUE tech:
  → AFFICHER: "   • <tech>"

# Demander confirmation
AFFICHER: "─────────────────────────────────────────"
AFFICHER: "Générer les sources de vérité? [O/n]"

SI réponse = O:
  # Générer les fichiers
  → Créer memory/constitution.md (basé sur .claude/templates/bootstrap/memory/constitution.example.md)
  → Créer security/ARCHITECTURE_DE_SECURITÉ.md (basé sur template)
  → Créer ontologie/01_ontologie.md (basé sur template)
  → Créer ontologie/02_ontologie.yaml (basé sur entités détectées)

  AFFICHER: "✅ Fichiers générés:"
  POUR CHAQUE fichier:
    → AFFICHER: "   • <fichier>"

  AFFICHER: "⚠️  IMPORTANT: Veuillez réviser ces fichiers avant de continuer."

SINON:
  → AFFICHER: "Bootstrap annulé. Créez les fichiers manuellement."
  → STOP
```

### Étape 8 : Créer session

```
# Créer le dossier .mockmig si absent
→ mkdir -p .mockmig

# Créer le dossier migration/<module>
→ mkdir -p migration/<module>

# Créer session.json
session = {
  "module": "<module>",
  "mockupPath": "<mockupPath>",
  "migrationDir": "migration/<module>",
  "type": "simple" | "complex",  # complex si >3 composants
  "components": [...],
  "phase": "INIT",
  "gates": {
    "validate": { "passed": false },
    "signoff": { "passed": false },
    "confirm": { "passed": false }
  },
  "artifacts": {
    "00_context": { "status": "pending" },
    "01_business_rules": { "status": "pending" },
    ...
  },
  "mcps": {
    "supabase": { ... },
    "netlify": { ... },
    "github": { ... }
  },
  "createdAt": "<now>",
  "updatedAt": "<now>",
  "lastCommand": "/mockmig init",
  "lastError": null
}

→ Écrire .mockmig/session.json

AFFICHER: "✅ Session créée: .mockmig/session.json"
AFFICHER: "   Module: <module>"
AFFICHER: "   Type: <simple|complex>"
SI complex:
  AFFICHER: "   Composants: <n>"
```

### Étape 9 : Prochaine étape

```
AFFICHER: ""
AFFICHER: "→ Exécuter: /mockmig discover"
```

---

## Artefacts créés

| Fichier | Description |
|---------|-------------|
| `.mockmig/session.json` | État de la session de migration |
| `migration/<module>/` | Dossier des artefacts de migration |
| `memory/constitution.md` | (si bootstrap) Constitution générée |
| `security/ARCHITECTURE_DE_SECURITÉ.md` | (si bootstrap) Sécurité générée |
| `ontologie/01_ontologie.md` | (si bootstrap) Ontologie narrative |
| `ontologie/02_ontologie.yaml` | (si bootstrap) Ontologie structurée |

---

## Erreurs possibles

| Code | Message | Solution |
|------|---------|----------|
| `ERR_ARGS` | Arguments manquants | Fournir --module et --mockupPath |
| `ERR_MODULE` | Module invalide | Utiliser kebab-case (ex: `mon-module`) |
| `ERR_MOCKUP` | Maquette introuvable | Vérifier le chemin |
| `ERR_MCP_SUPABASE` | Supabase non connecté | `npx supabase mcp install` |
| `ERR_MCP_GITHUB` | GitHub non connecté | Configurer GitHub MCP |
| `ERR_BOOTSTRAP` | Bootstrap échoué | Créer les sources manuellement |

---

## Voir aussi

- `/mockmig status` — Voir l'état de la session
- `/mockmig discover` — Phase 1 (prochaine étape)
- `.claude/MOCKMIG_ANALYSIS.md` — Documentation complète
