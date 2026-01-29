# /mockmig discover

> **Phase 1 du workflow mockmig.** Inventaire des règles métier + validation contre les sources de vérité.

## Prérequis

- Session active (exécuter `/mockmig init` d'abord)
- Sources de vérité présentes (constitution, sécurité, ontologie)

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `--skip-validation` | ❌ | Ignorer la validation contre les sources de vérité |

## Exemple

```bash
/mockmig discover
```

---

## Comportement

### Étape 1 : Charger la session

```
SI .mockmig/session.json n'existe pas:
  → ERREUR: "Aucune session active. Exécuter /mockmig init d'abord."
  → STOP

→ Charger session.json
→ Vérifier phase = "INIT"

SI phase != "INIT":
  → AFFICHER: "Session en phase <phase>."
  → AFFICHER: "Utiliser /mockmig status pour voir l'état."
  → DEMANDER: "Revenir à la phase DISCOVER? [o/N]"
  SI réponse != o:
    → STOP
```

### Étape 2 : Lire les sources de vérité

```
AFFICHER: "📚 Chargement des sources de vérité..."

→ Lire memory/constitution.md
  → Extraire les principes clés

→ Lire security/ARCHITECTURE_DE_SECURITÉ.md
  → Extraire les patterns RLS
  → Extraire les guards requis

→ Lire ontologie/02_ontologie.yaml
  → Parser les concepts
  → Parser les relations
  → Parser les invariants

AFFICHER: "✅ Sources de vérité chargées"
AFFICHER: "   • Constitution: <n> principes"
AFFICHER: "   • Sécurité: <n> patterns RLS"
AFFICHER: "   • Ontologie: <n> concepts, <n> relations"
```

### Étape 3 : Analyser la maquette

```
AFFICHER: ""
AFFICHER: "🔍 Analyse de la maquette..."

mockupPath = session.mockupPath

# Lire tous les fichiers source
→ Glob: mockupPath/**/*.{ts,tsx,js,jsx}

POUR CHAQUE fichier:
  → Parser le code
  → Extraire:
    - Composants React
    - Hooks utilisés
    - Types/interfaces
    - Appels API/Supabase
    - Validations (Zod, Yup, etc.)
    - Conditions métier (if/switch)
    - Messages d'erreur
    - Commentaires TODO/FIXME/NOTE
```

### Étape 4 : Générer l'inventaire des règles métier

```
AFFICHER: ""
AFFICHER: "📋 Extraction des règles métier..."

rules = []

# Règles depuis les types
POUR CHAQUE type/interface:
  → Analyser les champs requis/optionnels
  → Détecter les enums (états, statuts)
  → GÉNÉRER règle BR-xxx

# Règles depuis les validations
POUR CHAQUE validation Zod/Yup:
  → Extraire les contraintes
  → GÉNÉRER règle BR-xxx

# Règles depuis les conditions
POUR CHAQUE condition métier:
  → Analyser la logique
  → GÉNÉRER règle BR-xxx

# Règles depuis les commentaires
POUR CHAQUE commentaire pertinent:
  → Extraire la règle implicite
  → GÉNÉRER règle BR-xxx

AFFICHER: "✅ <n> règles métier détectées"
POUR CHAQUE règle (max 10):
  → AFFICHER: "   • BR-<xxx>: <description courte>"
SI rules.length > 10:
  → AFFICHER: "   • ... et <n-10> autres"
```

### Étape 5 : Générer 00_context.md

```
→ Créer migration/<module>/00_context.md

CONTENU:
---
# Contexte de migration: <module>

## Informations générales
- **Module**: <module>
- **Maquette**: <mockupPath>
- **Date**: <now>
- **Type**: simple | complex

## Stack détectée
- Framework: <Next.js, React, etc.>
- Styling: <Tailwind, CSS Modules, etc.>
- Backend: <Supabase, etc.>
- Validation: <Zod, Yup, etc.>

## Composants détectés
<liste des composants>

## Dépendances clés
<liste des dépendances importantes>
---

AFFICHER: "✅ Créé: migration/<module>/00_context.md"
```

### Étape 6 : Générer 01_business_rules.md

```
→ Créer migration/<module>/01_business_rules.md

CONTENU:
---
# Règles métier: <module>

## Vue d'ensemble
<résumé du module et de son objectif>

## Catalogue des règles

### Règles P0 (Critiques)
| ID | Description | Source | Validation |
|----|-------------|--------|------------|
| BR-001 | ... | <fichier:ligne> | ... |

### Règles P1 (Importantes)
...

### Règles P2 (Nice-to-have)
...

## Mapping règles → Ontologie
| Règle | Concept(s) | Invariant(s) |
|-------|------------|--------------|
| BR-001 | Devis | INV-DEVIS-001 |

## Règles non couvertes par l'ontologie
<règles qui nécessitent une mise à jour de l'ontologie>
---

AFFICHER: "✅ Créé: migration/<module>/01_business_rules.md"
```

### Étape 7 : Validation contre sources de vérité

```
SI --skip-validation:
  → AFFICHER: "⏭️  Validation ignorée (--skip-validation)"
  → GOTO Étape 8

AFFICHER: ""
AFFICHER: "🔒 Validation contre les sources de vérité..."

# Validation constitution
AFFICHER: "   Constitution..."
POUR CHAQUE principe:
  → Vérifier conformité
  SI non conforme:
    → AJOUTER warning

# Validation sécurité
AFFICHER: "   Sécurité..."
POUR CHAQUE pattern RLS requis:
  → Vérifier si détecté dans la maquette
  SI manquant:
    → AJOUTER warning

# Validation ontologie
AFFICHER: "   Ontologie..."
POUR CHAQUE concept utilisé:
  → Vérifier s'il existe dans l'ontologie
  SI manquant:
    → AJOUTER warning "Concept non défini: <concept>"

POUR CHAQUE invariant:
  → Vérifier si respecté
  SI violé:
    → AJOUTER erreur

SI erreurs:
  → AFFICHER: "❌ <n> erreurs de conformité"
  → validation_passed = false
SINON SI warnings:
  → AFFICHER: "⚠️  <n> warnings de conformité"
  → validation_passed = true (avec warnings)
SINON:
  → AFFICHER: "✅ Validation réussie"
  → validation_passed = true
```

### Étape 8 : Générer 02_validation_packet.md

```
→ Créer migration/<module>/02_validation_packet.md

CONTENU:
---
# Validation Packet: <module>

## Statut
- **Date**: <now>
- **Résultat**: ✅ PASS | ⚠️ PASS avec warnings | ❌ FAIL

## Conformité Constitution
| Principe | Statut | Notes |
|----------|--------|-------|
| ... | ✅/⚠️/❌ | ... |

## Conformité Sécurité
| Pattern | Détecté | Statut |
|---------|---------|--------|
| RLS owner | oui/non | ✅/❌ |
| Guards | oui/non | ✅/❌ |

## Conformité Ontologie
| Concept | Statut | Notes |
|---------|--------|-------|
| ... | ✅/⚠️ | ... |

## Actions requises
<liste des corrections nécessaires avant de continuer>

## Sign-off
- [ ] Règles métier validées
- [ ] Conformité vérifiée
- [ ] Prêt pour phase ANALYZE
---

AFFICHER: "✅ Créé: migration/<module>/02_validation_packet.md"
```

### Étape 9 : Mettre à jour session

```
→ Mettre à jour .mockmig/session.json:
  - phase: "DISCOVER"
  - artifacts.00_context.status: "done"
  - artifacts.01_business_rules.status: "done"
  - artifacts.02_validation_packet.status: "done"
  - gates.validate.passed: <validation_passed>
  - gates.validate.date: <now>
  - updatedAt: <now>
  - lastCommand: "/mockmig discover"
```

### Étape 10 : Résultat et prochaine étape

```
AFFICHER: ""
AFFICHER: "═══════════════════════════════════════"
AFFICHER: "📋 Phase DISCOVER terminée"
AFFICHER: ""
AFFICHER: "Artefacts générés:"
AFFICHER: "   • migration/<module>/00_context.md"
AFFICHER: "   • migration/<module>/01_business_rules.md"
AFFICHER: "   • migration/<module>/02_validation_packet.md"
AFFICHER: ""

SI validation_passed:
  AFFICHER: "[GATE A] ✅ Validation réussie"
  AFFICHER: ""
  AFFICHER: "→ Réviser les artefacts puis exécuter:"
  AFFICHER: "  /mockmig analyze"
SINON:
  AFFICHER: "[GATE A] ❌ Validation échouée"
  AFFICHER: ""
  AFFICHER: "→ Corriger les erreurs dans 02_validation_packet.md"
  AFFICHER: "→ Puis relancer: /mockmig discover"
```

---

## Artefacts créés

| Fichier | Description |
|---------|-------------|
| `migration/<module>/00_context.md` | Contexte et métadonnées |
| `migration/<module>/01_business_rules.md` | Catalogue des règles métier |
| `migration/<module>/02_validation_packet.md` | Résultat de validation |

---

## Voir aussi

- `/mockmig init` — Étape précédente
- `/mockmig analyze` — Prochaine étape
- `/mockmig status` — Voir l'état de la session
