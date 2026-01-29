# Claude Context — Somtech Project

> Ce fichier est chargé automatiquement par Claude Code. Il définit le contexte projet et les sources de vérité.

---

## Sources de vérité (TOUJOURS consulter)

Avant toute modification de code, consulte **obligatoirement** :

| Fichier | Rôle | Quand le lire |
|---------|------|---------------|
| `/ontologie/02_ontologie.yaml` | Modèle de données, entités, relations | Avant toute modification DB/types |
| `/ontologie/01_ontologie.md` | Version narrative de l'ontologie | Pour comprendre le contexte métier |
| `/memory/constitution.md` | Principes non-négociables du projet | Avant toute décision d'architecture |
| `/security/ARCHITECTURE_DE_SECURITÉ.md` | RLS, guards, patterns de sécurité | Avant toute modification d'accès |

**Règle d'or** : Si tu n'as pas lu l'ontologie, tu ne touches pas au code.

---

## Stack technique

- **Frontend** : Next.js 14+ (App Router), React, TypeScript strict, Tailwind CSS
- **Backend** : Supabase (PostgreSQL, Auth, RLS, Edge Functions)
- **Déploiement** : Netlify
- **Versioning** : Git + GitHub

---

## Skill Mockmig

Le workflow de migration maquette → production est disponible via le skill `/mockmig`.

### Commandes disponibles

| Commande | Description |
|----------|-------------|
| `/mockmig init` | Preflight + bootstrap (génère sources de vérité si absentes) |
| `/mockmig discover` | Phase 1: Inventaire règles métier + validation |
| `/mockmig analyze` | Phase 2: Audit existant + gap analysis |
| `/mockmig plan` | Phase 3: Tâches backend/UI + runbook |
| `/mockmig execute --confirm` | Phase 4: Implémentation |
| `/mockmig status` | Vue d'ensemble de la migration en cours |

### Exemples d'utilisation

```bash
# Aide
/mockmig

# App multi-modules (ex: module "devis")
/mockmig init --module devis --mockupPath modules/maquette/devis/v1

# App single-module (utiliser "core" comme nom de module)
/mockmig init --module core --mockupPath modules/maquette/core/v1

# Voir le statut détaillé
/mockmig status --verbose
```

### Documentation

- **Workflow complet** : `.claude/MOCKMIG_ANALYSIS.md`
- **Phases détaillées** : `.claude/skills/mockmig/phases/`
- **Schéma session** : `.claude/schemas/mockmig/session.schema.json`

---

## Conventions de code

### Nommage
- **Fichiers** : kebab-case (`devis-form.tsx`)
- **Composants** : PascalCase (`DevisForm`)
- **Variables/fonctions** : camelCase (`getDevisById`)
- **Tables DB** : snake_case (`ligne_devis`)
- **Enums** : SCREAMING_SNAKE_CASE (`DEVIS_STATUS`)

### Patterns obligatoires
- **RLS** : Toute table avec données utilisateur a une policy `user_id = auth.uid()`
- **Guards** : Vérification côté client ET côté serveur
- **Types** : Générer depuis Supabase (`supabase gen types typescript`)

---

## MCPs disponibles

| MCP | Usage |
|-----|-------|
| **Supabase** | Migrations, RLS, schéma DB, types |
| **GitHub** | PRs, branches, issues |
| **Netlify** | Deploy previews, env vars |

---

## Avant de coder

1. ✅ Lire l'ontologie (`/ontologie/`)
2. ✅ Vérifier la constitution (`/memory/constitution.md`)
3. ✅ Consulter l'architecture sécurité (`/security/`)
4. ✅ Vérifier s'il y a une migration en cours (`/mockmig status`)
