# Analyse du Workflow Mockmig — Migration vers Claude Code

> **Objectif** : Analyser le processus actuel de migration maquette → production et proposer une refonte optimisée pour Claude Code.

---

## 1. Vue d'ensemble du processus actuel

### 1.1 Concept fondamental

Le workflow **mockmig** permet de transformer une **maquette** (prototype UI dans `modules/maquette/<module>/`) en **code de production** en passant par une série d'artefacts de spécification.

```
┌─────────────┐    ┌──────────────────────────────────┐    ┌──────────────┐
│   MAQUETTE  │ → │  ARTEFACTS MIGRATION (00-07)     │ → │  PRODUCTION  │
│  (mockup/)  │    │  (migration/<module>/)           │    │  (app/src/)  │
└─────────────┘    └──────────────────────────────────┘    └──────────────┘
```

### 1.2 Pipeline actuel (17 commandes)

```
doctor → start → inventory → [GATE A: validate] → components.init
       → audit → gap → backend.tasks → ui.tasks → plan
       → [GATE B: sign-off] → [GATE C: --confirm] → implementation
       → prd.sync → status
```

### 1.3 Artefacts générés

| Fichier | Commande | Rôle |
|---------|----------|------|
| `00_context.md` | inventory | Métadonnées module/maquette |
| `00_component_map.md` | inventory | Cartographie composants (si complexe) |
| `01_business_rules.md` | inventory | Catalogue règles métier BR-xxx |
| `02_validation_packet.md` | validate | **GATE A** — Conformité constitution/sécu/ontologie |
| `03_existing_audit.md` | audit | Audit read-only de l'existant |
| `04_gap_analysis.md` | gap | Écarts priorisés P0/P1/P2 |
| `05_backend_tasks.md` | backend.tasks | Tâches DB/RLS/API |
| `06_ui_tasks.md` | ui.tasks | Tâches UI/guards/tests |
| `07_implementation_plan.md` | plan | **GATE B** — Runbook avec sign-off |

### 1.4 Sources de vérité requises

- `memory/constitution.md` — Principes non-négociables du projet
- `security/ARCHITECTURE_DE_SECURITÉ.md` — RLS, AuthZ, guards
- `ontologie/01_ontologie.md` + `02_ontologie.yaml` — Modèle de données

---

## 2. Forces du système actuel ✅

### 2.1 Gouvernance stricte
- **3 gates de contrôle** empêchent l'implémentation précipitée
- **Sign-off obligatoire** avant toute modification de code
- **`--confirm` explicite** pour l'exécution

### 2.2 Traçabilité
- Chaque artefact a un rôle clair et documenté
- Le runbook (`07_implementation_plan.md`) sert de journal
- Système **NEXT/READY** pour guider l'utilisateur

### 2.3 Conformité intégrée
- Validation automatique contre constitution/sécurité/ontologie
- Séparation claire backend vs UI
- Prioritisation P0/P1/P2 pour les écarts

### 2.4 Flexibilité
- Support module simple vs module complexe (composants)
- Scripts bash réutilisables (`setup-migration.sh`)

---

## 3. Faiblesses et problèmes identifiés ⚠️

### 3.1 Complexité excessive

| Problème | Impact |
|----------|--------|
| **17+ commandes** à connaître | Courbe d'apprentissage élevée |
| Enchaînement manuel | Risque d'oubli d'étapes |
| Paramètres répétitifs | `--module`, `--mockupPath` à chaque commande |
| Duplication de structure | Chaque commande a le même "outline" |

**Exemple de friction** :
```bash
/mockmig.start --module devis --mockupPath modules/maquette/devis/v1
/mockmig.inventory --module devis --mockupPath modules/maquette/devis/v1
/mockmig.validate --module devis --mockupPath modules/maquette/devis/v1
# ... etc, 10+ commandes avec les mêmes paramètres
```

### 3.2 Pas de persistance de contexte

- Chaque commande doit re-parser les paramètres
- Pas de "session" de migration
- Le script `setup-migration.sh` est appelé à chaque fois

### 3.3 Workflow trop linéaire

- Pas de parallélisation (ex: backend.tasks + ui.tasks simultanément)
- Impossible de sauter des étapes non pertinentes
- Pas de "mode rapide" pour petites migrations

### 3.4 Gestion d'erreurs limitée

- Pas de rollback automatique
- Pas de checkpoint/reprise après échec
- Les artefacts partiellement générés peuvent rester incohérents

### 3.5 Couplage Cursor-spécifique

- `handoffs` n'existe pas dans Claude Code
- Format des commandes `.cursor/commands/*.md` non compatible
- Variables `$ARGUMENTS` propres à Cursor

### 3.6 Validation insuffisante

- Pas de validation automatique des artefacts générés
- Pas de tests de cohérence cross-artefacts
- Le "doctor" ne vérifie que l'existence des fichiers

---

## 4. Propositions d'amélioration 🚀

### 4.1 Refonte en 4 phases (au lieu de 17 commandes)

```
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DISCOVER                                                   │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐                           │
│  │ doctor  │→ │ inventory │→ │ validate │ [GATE A]                  │
│  └─────────┘  └───────────┘  └──────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: ANALYZE                                                    │
│  ┌───────┐  ┌─────┐                                                 │
│  │ audit │→ │ gap │                                                 │
│  └───────┘  └─────┘                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 3: PLAN                                                       │
│  ┌───────────────┐  ┌──────────┐  ┌──────┐                          │
│  │ backend.tasks │  │ ui.tasks │→ │ plan │ [GATE B]                 │
│  └───────────────┘  └──────────┘  └──────┘                          │
│         ↑               ↑                                            │
│         └───── PARALLÈLE ┘                                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 4: EXECUTE                                                    │
│  ┌────────────────┐  ┌──────────┐                                   │
│  │ implementation │→ │ prd.sync │ [GATE C: --confirm]               │
│  └────────────────┘  └──────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Nouvelles commandes Claude Code** :
```
/mockmig discover   # Phases 1 (regroupe doctor+inventory+validate)
/mockmig analyze    # Phase 2 (regroupe audit+gap)
/mockmig plan       # Phase 3 (regroupe backend+ui+plan)
/mockmig execute    # Phase 4 (regroupe implementation+prd.sync)
/mockmig status     # Vue d'ensemble à tout moment
```

### 4.2 Session de migration persistante

Créer un fichier `.mockmig/session.json` pour persister le contexte :

```json
{
  "module": "devis",
  "mockupPath": "modules/maquette/devis/v1",
  "migrationDir": "migration/devis",
  "type": "simple|complex",
  "components": ["form-devis", "table-devis"],
  "phase": "ANALYZE",
  "gates": {
    "validate": { "passed": true, "date": "2026-01-28" },
    "signoff": { "passed": false },
    "confirm": { "passed": false }
  },
  "artifacts": {
    "00_context": { "status": "done", "hash": "abc123" },
    "01_business_rules": { "status": "done", "hash": "def456" },
    "02_validation_packet": { "status": "done", "hash": "ghi789" },
    "03_existing_audit": { "status": "pending" }
  },
  "lastCommand": "/mockmig analyze",
  "lastError": null
}
```

**Avantages** :
- Plus besoin de répéter `--module` et `--mockupPath`
- Reprise automatique après interruption
- Historique des actions

### 4.3 Mode interactif vs mode batch

**Mode interactif** (défaut) :
```
> /mockmig
? Module à migrer: devis
? Chemin maquette: modules/maquette/devis/v1
? Type de migration: [Simple] / Complexe (composants)

📋 Session créée: migration/devis
   Phase actuelle: DISCOVER

Exécuter /mockmig discover pour commencer.
```

**Mode batch** (CI/automation) :
```
/mockmig run --module devis --mockupPath modules/maquette/devis/v1 --auto-approve
```

### 4.4 Validation automatique des artefacts

Ajouter des schemas JSON pour valider la structure des artefacts :

```
.claude/
  schemas/
    business_rules.schema.json
    gap_analysis.schema.json
    implementation_plan.schema.json
```

Exemple de validation :
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Business Rules",
  "type": "object",
  "required": ["rules"],
  "properties": {
    "rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "description", "priority", "source"],
        "properties": {
          "id": { "type": "string", "pattern": "^BR-[0-9]{3}$" },
          "priority": { "enum": ["P0", "P1", "P2"] }
        }
      }
    }
  }
}
```

### 4.5 Checkpoints et rollback

```
/mockmig checkpoint save "avant-backend"
/mockmig checkpoint list
/mockmig checkpoint restore "avant-backend"
```

Structure :
```
migration/devis/
  .checkpoints/
    2026-01-28T10-30-00_avant-backend.tar.gz
    2026-01-28T11-45-00_post-ui.tar.gz
```

### 4.6 Modes de migration

| Mode | Description | Artefacts | Gates |
|------|-------------|-----------|-------|
| `full` | Pipeline complet | 00-07 | 3 |
| `quick` | Petites modifications | 01, 04, 07 | 1 |
| `patch` | Hotfix urgent | 07 seulement | 0 (danger) |

```
/mockmig start --mode quick
```

### 4.7 Intégration Claude Code

**Adaptation des commandes** :

| Cursor | Claude Code |
|--------|-------------|
| `.cursor/commands/mockmig.*.md` | `.claude/commands/mockmig/*.md` |
| `$ARGUMENTS` | Arguments CLI standards |
| `handoffs` | Chaînage explicite dans le prompt |
| `---` frontmatter | Métadonnées JSON ou TOML |

**Format Claude Code proposé** :
```markdown
<!-- .claude/commands/mockmig/discover.md -->
# /mockmig discover

## Description
Phase 1 du workflow mockmig : découverte et validation initiale.

## Arguments
- `--module` (optionnel si session active)
- `--mockupPath` (optionnel si session active)
- `--skip-doctor` : ignorer la vérification pré-vol

## Comportement
1. Charger ou créer la session (`.mockmig/session.json`)
2. Exécuter doctor (sauf --skip-doctor)
3. Exécuter inventory → génère 00_context + 01_business_rules
4. Exécuter validate → génère 02_validation_packet
5. **GATE A** : Demander validation explicite
6. Mettre à jour la session

## Prochaine étape
```
/mockmig analyze
```
```

---

## 5. Structure proposée pour `.claude/`

```
.claude/
├── commands/
│   └── mockmig/
│       ├── discover.md      # Phase 1
│       ├── analyze.md       # Phase 2
│       ├── plan.md          # Phase 3
│       ├── execute.md       # Phase 4
│       ├── status.md        # Vue d'ensemble
│       ├── checkpoint.md    # Gestion checkpoints
│       └── session.md       # Gestion session
├── skills/
│   └── mockmig/
│       ├── SKILL.md         # Documentation principale
│       ├── inventory.md     # Sous-skill inventory
│       ├── audit.md         # Sous-skill audit
│       └── ...
├── rules/
│   ├── mockmig.md           # Règles spécifiques mockmig
│   └── security.md          # Règles sécurité
├── templates/
│   └── mockmig/
│       ├── 00_context.template.md
│       ├── 01_business_rules.template.md
│       └── ...
├── schemas/
│   └── mockmig/
│       ├── session.schema.json
│       ├── business_rules.schema.json
│       └── ...
└── scripts/
    └── mockmig/
        ├── setup-session.sh
        ├── validate-artifact.sh
        └── checkpoint.sh
```

---

## 6. Plan de migration

### Phase 1 : Fondations (cette semaine)
- [x] Créer structure `.claude/`
- [ ] Adapter `setup-migration.sh` pour session JSON
- [ ] Créer le skill principal `mockmig/SKILL.md`
- [ ] Créer la commande `/mockmig status`

### Phase 2 : Commandes principales (semaine 2)
- [ ] Implémenter `/mockmig discover`
- [ ] Implémenter `/mockmig analyze`
- [ ] Implémenter `/mockmig plan`
- [ ] Implémenter `/mockmig execute`

### Phase 3 : Fonctionnalités avancées (semaine 3)
- [ ] Système de checkpoints
- [ ] Validation par schemas
- [ ] Mode batch pour CI

### Phase 4 : Documentation et tests (semaine 4)
- [ ] Guide utilisateur complet
- [ ] Tests de non-régression
- [ ] Migration des projets existants

---

## 7. Décisions prises

| Question | Décision |
|----------|----------|
| Gates de validation | **V1 avec 3 gates**, objectif de les retirer progressivement |
| Nombre de phases | **4 phases** confirmées (discover, analyze, plan, execute) |
| Parallélisation | Specs en parallèle, exécution séquentielle (backend → UI) |
| Intégration CI/CD | Via **MCPs** (Supabase, Netlify, GitHub) |

---

## 8. Preflight Check & MCPs

### 8.1 Contexte d'infrastructure

Le repo de production inclut :
- **Supabase** : BD de prod, migrations, RLS, Edge Functions
- **Netlify** : Déploiement, env vars, preview deploys
- **GitHub** : Repo, PRs, Issues, Actions

### 8.2 MCPs requis

| MCP | Rôle dans mockmig | Vérifié au preflight |
|-----|-------------------|---------------------|
| **Supabase** | Migrations DB, RLS, types TypeScript | ✅ Connexion + accès projet |
| **Netlify** | Deploy previews, env vars | ✅ Connexion + site lié |
| **GitHub** | PRs automatiques, issues | ✅ Connexion + accès repo |

### 8.3 Nouveau flow "preflight" avec bootstrap

```
/mockmig init
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  PREFLIGHT CHECK                                                 │
│                                                                  │
│  1. MCPs connectés                                               │
│     □ Supabase MCP → projet lié? accès admin?                   │
│     □ Netlify MCP → site lié? deploy access?                    │
│     □ GitHub MCP → repo accès? permissions PR?                  │
│                                                                  │
│  2. Maquette valide                                              │
│     □ Chemin existe?                                             │
│     □ Structure reconnue? (src/components/, etc.)               │
│                                                                  │
│  3. Sources de vérité                                            │
│     → SI EXISTENT: les charger                                   │
│     → SI ABSENTES: déclencher BOOTSTRAP (voir ci-dessous)       │
│                                                                  │
│  RESULT: ✅ READY | ⚠️ BOOTSTRAP NEEDED | ❌ BLOCKERS            │
└─────────────────────────────────────────────────────────────────┘
    │
    ├─── (si BOOTSTRAP NEEDED) ───┐
    │                             ▼
    │         ┌───────────────────────────────────────────────────┐
    │         │  BOOTSTRAP (génération depuis maquette)           │
    │         │                                                   │
    │         │  Analyser la maquette pour générer :              │
    │         │                                                   │
    │         │  📜 memory/constitution.md                        │
    │         │     • Principes UI/UX détectés                   │
    │         │     • Stack technique                             │
    │         │     • Conventions de nommage                      │
    │         │                                                   │
    │         │  🔒 security/ARCHITECTURE_DE_SECURITÉ.md          │
    │         │     • Patterns d'accès détectés (auth, roles)    │
    │         │     • RLS suggérées                               │
    │         │     • Guards nécessaires                          │
    │         │                                                   │
    │         │  📊 ontologie/01_ontologie.md + 02_ontologie.yaml │
    │         │     • Entités détectées (types, interfaces)      │
    │         │     • Relations entre entités                    │
    │         │     • Schéma DB suggéré                          │
    │         │                                                   │
    │         │  → Demander validation utilisateur                │
    │         └───────────────────────────────────────────────────┘
    │                             │
    └─────────────────────────────┘
    │
    ▼
/mockmig discover
```

### 8.4 Logique du Bootstrap

Le bootstrap analyse la maquette pour **inférer** les sources de vérité :

| Source | Inféré depuis | Exemple |
|--------|---------------|---------|
| **Constitution** | Structure projet, README, package.json | "Projet Next.js + Tailwind + Supabase" |
| **Sécurité** | Composants auth, guards, middleware | "AuthGuard détecté → RLS par user_id" |
| **Ontologie** | Types TypeScript, interfaces, schémas | "interface Devis { id, client, lignes[] }" |

```typescript
// Exemple : analyse d'un composant maquette
// src/components/DevisForm.tsx

interface DevisFormProps {
  client: Client;        // → Entité "Client" dans ontologie
  lignes: LigneDevis[];  // → Entité "LigneDevis" avec relation
}

// Guard détecté
if (!user.canEdit(devis)) {  // → RLS: user_id = auth.uid()
  return <AccessDenied />;
}
```

**Génère automatiquement (format réel basé sur template Somtech) :**

```yaml
# ontologie/02_ontologie.yaml (généré par bootstrap)
meta:
  domaine: "MonProjet"
  version: "1.0"
  description: "Ontologie générée depuis maquette devis"
  date_generation: "2026-01-28"

hierarchy:
  Actor:
    subclasses: ["AppUser", "Client"]
  WorkItem:
    subclasses: ["Devis", "LigneDevis"]

concepts:
  Devis:
    description: "Un devis commercial pour un client."
    role: "Entité centrale du module devis"
    keys_metier: ["numero_devis"]
    attributes:
      - name: "client_id"
        type: "uuid"
      - name: "user_id"
        type: "uuid"
      - name: "status"
        type: "enum"
        domain: "DevisStatus"
    lifecycle:
      states: ["draft", "sent", "accepted", "rejected"]

  LigneDevis:
    description: "Une ligne de produit/service dans un devis."
    attributes:
      - name: "devis_id"
        type: "uuid"
      - name: "produit"
        type: "string"
      - name: "quantite"
        type: "integer"

relations:
  - name: "OwnedBy"
    from: "Devis"
    to: "AppUser"
    type: "dependency"
    cardinality: "N:1"
    semantic_hint: "RLS: user_id = auth.uid()"

  - name: "ComposedOf"
    from: "Devis"
    to: "LigneDevis"
    type: "composition"
    cardinality: "1:N"

patterns:
  RLS_Scope:
    applies_to: ["Devis", "LigneDevis"]
    implementation:
      fields: ["user_id"]

domains:
  DevisStatus:
    type: "enum"
    values: ['draft', 'sent', 'accepted', 'rejected']

invariants_ontologiques:
  - id: "INV-DEVIS-001"
    description: "Un devis envoyé ne peut plus être modifié."
    scope: ["Devis"]
    type: "metier"

reasoning_hints:
  - "Un devis appartient toujours à un user_id (RLS owner pattern)"
```

### 8.5 Exemples de sortie preflight

**Cas 1 : Repo existant avec sources de vérité**
```
$ /mockmig init --module devis --mockupPath modules/maquette/devis/v1

🔍 Preflight Check
==================

🔌 MCPs
   ✅ Supabase: connecté (projet: abc123, role: admin)
   ✅ Netlify: connecté (site: mon-site-preview)
   ✅ GitHub: connecté (repo: somtech/mon-projet)

📦 Maquette
   ✅ modules/maquette/devis/v1 existe
   ✅ Structure valide (3 composants détectés)

📁 Sources de vérité
   ✅ memory/constitution.md (existant)
   ✅ security/ARCHITECTURE_DE_SECURITÉ.md (existant)
   ✅ ontologie/01_ontologie.md (existant)

─────────────────────────────────────────
✅ READY

→ Exécuter: /mockmig discover
```

**Cas 2 : Nouveau repo (sources de vérité absentes)**
```
$ /mockmig init --module devis --mockupPath modules/maquette/devis/v1

🔍 Preflight Check
==================

🔌 MCPs
   ✅ Supabase: connecté (projet: abc123, role: admin)
   ✅ Netlify: connecté (site: mon-site-preview)
   ✅ GitHub: connecté (repo: somtech/mon-projet)

📦 Maquette
   ✅ modules/maquette/devis/v1 existe
   ✅ Structure valide (3 composants détectés)
      • DevisForm.tsx
      • DevisTable.tsx
      • DevisPreview.tsx

📁 Sources de vérité
   ⚠️  memory/constitution.md (ABSENT)
   ⚠️  security/ARCHITECTURE_DE_SECURITÉ.md (ABSENT)
   ⚠️  ontologie/01_ontologie.md (ABSENT)

─────────────────────────────────────────
⚠️  BOOTSTRAP NEEDED

Analyse de la maquette en cours...

📊 Entités détectées:
   • Devis (id, client_id, user_id, created_at, status)
   • LigneDevis (id, devis_id, produit, quantite, prix)
   • Client (id, nom, email)

🔒 Patterns de sécurité détectés:
   • AuthGuard sur DevisForm → RLS par user_id
   • RoleCheck "admin" sur DevisTable → RLS par role

📜 Stack détectée:
   • Next.js 14 + App Router
   • Tailwind CSS
   • Supabase (Auth + DB)
   • TypeScript strict

─────────────────────────────────────────
Générer les sources de vérité? [O/n]
> O

✅ Fichiers générés:
   • memory/constitution.md
   • security/ARCHITECTURE_DE_SECURITÉ.md
   • ontologie/01_ontologie.md
   • ontologie/02_ontologie.yaml

⚠️  IMPORTANT: Veuillez réviser ces fichiers avant de continuer.

→ Exécuter: /mockmig discover
```

**Cas 3 : MCP manquant**
```
$ /mockmig init --module devis --mockupPath modules/maquette/devis/v1

🔍 Preflight Check
==================

🔌 MCPs
   ❌ Supabase: NON CONNECTÉ
       → Installer: npx supabase mcp install
       → Puis: supabase link --project-ref <ref>
   ⚠️  Netlify: connecté mais site non lié
       → Action: netlify link
   ✅ GitHub: connecté (repo: somtech/mon-projet)

─────────────────────────────────────────
❌ BLOCKERS (1 critique, 1 warning)

CRITIQUE:
  1. Supabase MCP non connecté (requis pour migrations DB)

WARNING:
  2. Netlify site non lié (optionnel, skip avec --skip-netlify)
```

### 8.6 Actions MCP pendant le workflow

| Phase | Actions MCP |
|-------|-------------|
| **discover** | - |
| **analyze** | Supabase: lire schéma actuel, RLS existantes |
| **plan** | GitHub: créer branche de migration |
| **execute** | Supabase: appliquer migrations, Netlify: déclencher preview, GitHub: ouvrir PR |

### 8.7 Configuration MCP dans session

```json
{
  "module": "devis",
  "mcps": {
    "supabase": {
      "connected": true,
      "projectId": "abc123",
      "role": "admin"
    },
    "netlify": {
      "connected": true,
      "siteId": "xyz789",
      "linked": true
    },
    "github": {
      "connected": true,
      "repo": "somtech/mon-projet",
      "branch": "migration/devis",
      "permissions": ["write", "pr"]
    }
  }
}

---

## 9. Architecture finale proposée

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           /mockmig init                                  │
│                  (preflight + bootstrap + session)                       │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
   ┌─────────┐              ┌─────────┐              ┌─────────┐
   │ Supabase│              │ Netlify │              │ GitHub  │
   │   MCP   │              │   MCP   │              │   MCP   │
   └────┬────┘              └────┬────┘              └────┬────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BOOTSTRAP (si sources absentes)                                         │
│  • Générer constitution depuis maquette                                  │
│  • Générer architecture sécurité depuis patterns détectés               │
│  • Générer ontologie depuis types/interfaces                            │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DISCOVER                                                       │
│  • Inventaire règles métier                                              │
│  • Validation constitution/sécu/ontologie (existantes ou générées)      │
│  • [GATE A si V1]                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: ANALYZE                                                        │
│  • Audit existant (via Supabase MCP: schéma, RLS)                       │
│  • Gap analysis                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: PLAN                                                           │
│  ┌──────────────┐ ┌──────────────┐                                       │
│  │backend.tasks │ │  ui.tasks    │  ← PARALLÈLE (specs only)            │
│  └──────┬───────┘ └──────┬───────┘                                       │
│         └────────┬───────┘                                               │
│                  ▼                                                       │
│         ┌──────────────┐                                                 │
│         │   MERGE +    │                                                 │
│         │   RUNBOOK    │                                                 │
│         └──────────────┘                                                 │
│  • GitHub MCP: créer branche                                             │
│  • [GATE B si V1]                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: EXECUTE                                                        │
│  • Backend (Supabase MCP: migrations, RLS, types)                       │
│  • UI (code local)                                                       │
│  • Tests                                                                 │
│  • Netlify MCP: preview deploy                                          │
│  • GitHub MCP: ouvrir PR                                                │
│  • [GATE C si V1: --confirm]                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Prochaines étapes

### Immédiat
1. ✅ Analyse validée
2. [ ] Créer `/mockmig init` avec preflight check
3. [ ] Définir le format des commandes Claude Code

### Court terme
4. [ ] Implémenter les 4 phases
5. [ ] Intégrer Supabase MCP
6. [ ] Intégrer GitHub MCP

### Moyen terme
7. [ ] Intégrer Netlify MCP
8. [ ] Retirer progressivement les gates
9. [ ] Mode batch pour CI

---

*Document généré le 2026-01-28*
*Basé sur l'analyse de somtech-pack v1.x*
*Mis à jour avec décisions équipe*
