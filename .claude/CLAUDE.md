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

## Règles Critiques

### Git
- **JAMAIS de push sur `main`** — toujours via branche + PR
- Branches : `feat/*`, `fix/*`, `chore/*`, `proto/*`
- Commits : `type(scope): description`

### Validation UI (OBLIGATOIRE)
Après toute modification UI :
1. Vérifier visuellement l'interface
2. Capturer logs console (erreurs)
3. Confirmer **0 erreur** avant de terminer

### Qualité > Vitesse
Poser des questions plutôt que supposer. Analyser avant d'agir.

---

## Serveurs de Développement - Gestion des Ports

### IMPORTANT: Utiliser l'inventaire des ports

Fichier d'inventaire: `~/.claude/ports-inventory.json`

### Avant de démarrer un serveur de dev

1. **Vérifier l'inventaire** pour le port assigné au projet
2. **Si aucun port assigné**:
   - Vérifier le prochain port disponible dans `next_available`
   - Mettre à jour l'inventaire avec le nouveau projet
3. **Configurer le projet** avec le port assigné (vite.config.ts, next.config.js, etc.)

### Commandes utiles

```bash
# Voir les ports utilisés
lsof -i :3000-3100 | grep LISTEN

# Voir l'inventaire
cat ~/.claude/ports-inventory.json | jq '.projects'
```

### Plages de ports réservées

| Framework    | Plage         |
|--------------|---------------|
| Vite         | 3000-3099     |
| Next.js      | 3100-3199     |
| Supabase API | 54321-54399   |
| Supabase DB  | 54322-54499   |

### Ne jamais

- Utiliser `strictPort: false` sans vérifier l'inventaire
- Changer le port d'un projet sans mettre à jour l'inventaire
- Tuer un serveur d'un autre projet pour libérer un port

---

## Supabase Local

### IMPORTANT: Ne jamais arrêter un serveur Supabase local

- **NE JAMAIS** utiliser `supabase stop` pour arrêter un projet Supabase en cours d'utilisation
- Si un conflit de port survient lors de `supabase start`, **NE PAS** arrêter l'autre projet
- Toujours vérifier les ports disponibles avant de démarrer

### Démarrer Supabase sur un port disponible

1. **Vérifier les ports utilisés:**
```bash
docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Ports}}"
lsof -i :54321
```

2. **Si conflit de port**, modifier `supabase/config.toml` du projet:
```toml
[api]
port = 54341  # Utiliser un port libre

[db]
port = 54342

[studio]
port = 54343
```

3. **Alternative**: Utiliser `--workdir` pour isoler:
```bash
supabase start --workdir /path/to/project
```

### Ports Supabase par défaut
- API: 54321
- DB: 54322
- Studio: 54323
- Inbucket: 54324
- Analytics: 54327

En cas de conflit, incrémenter de 10 ou 20 (ex: 54331, 54341, etc.)

---

## Supabase - Workflow Dev Local + MCP Push

### INTERDIT
- `supabase db push --linked`
- Supabase Branching (désactivé)
- Modifier les migrations déjà mergées sur main

### WORKFLOW STANDARD
1. **Dev local** avec Supabase local (`supabase start`)
2. **Créer migration** dans `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
3. **Tester** avec `supabase db reset`
4. **Pousser en prod** via MCP Supabase (exécuter le SQL directement)
5. **Rafraîchir cache** si besoin: `NOTIFY pgrst, 'reload schema';`

### VÉRIFICATION AVANT PUSH PROD
Toujours exécuter:
```bash
supabase db reset  # Vérifie que les migrations passent sur base vierge
```

### EN CAS D'ERREUR DE MIGRATION
Si une migration échoue sur base vierge:
1. **NE PAS** modifier la migration existante si déjà sur main
2. Créer une nouvelle migration corrective
3. Tester avec `supabase db reset` jusqu'à ce que ça passe

### MCP SUPABASE
Configuration dans `.mcp.json` du projet:
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF>"
    }
  }
}
```

---

## Skills disponibles

### Mockmig — Migration maquette → production

| Commande | Description |
|----------|-------------|
| `/mockmig init` | Preflight + bootstrap (génère sources de vérité si absentes) |
| `/mockmig discover` | Phase 1: Inventaire règles métier + validation |
| `/mockmig analyze` | Phase 2: Audit existant + gap analysis |
| `/mockmig plan` | Phase 3: Tâches backend/UI + runbook |
| `/mockmig execute --confirm` | Phase 4: Implémentation |
| `/mockmig status` | Vue d'ensemble de la migration en cours |

```bash
# App multi-modules
/mockmig init --module devis --mockupPath modules/maquette/devis/v1

# App single-module
/mockmig init --module core --mockupPath modules/maquette/core/v1
```

### Git-Module — Gestion des submodules

| Commande | Description |
|----------|-------------|
| `/git-module add <url> [path]` | Ajouter un nouveau submodule |
| `/git-module sync` | Synchroniser les submodules |
| `/git-module list` | Lister les submodules |
| `/git-module status` | État de synchronisation |
| `/git-module remove <path>` | Retirer un submodule |

### Autres Skills

| Commande | Description |
|----------|-------------|
| `/scaffold-component` | Créer un composant React/TypeScript/Tailwind |
| `/create-migration` | Créer une migration Supabase avec RLS |
| `/audit-rls` | Auditer les policies RLS |
| `/validate-ui` | Valider console (0 erreur) |

---

## Plugins activés

| Plugin | Commandes |
|--------|-----------|
| **Supabase** | `/supabase:*` — Opérations DB, migrations, Edge Functions |
| **Spec-Kit** | `/spec-kit:constitution`, `/spec-kit:specify`, `/spec-kit:plan`, `/spec-kit:tasks`, `/spec-kit:implement`, etc. |

---

## Sub-Agents disponibles

Claude délègue automatiquement aux agents selon le contexte :

| Agent | Triggers |
|-------|----------|
| **frontend** | composant, React, hook, UI, Tailwind |
| **backend** | endpoint, API, migration, Edge Function, MCP |
| **qa** | test, e2e, validation, console |
| **product** | story, epic, PRD, spec |
| **database** | RLS, policy, index, audit DB |
| **devops** | Docker, Railway, déploiement |
| **design** | wireframe, UX, accessibilité |

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

## Avant de coder

1. ✅ Lire l'ontologie (`/ontologie/`)
2. ✅ Vérifier la constitution (`/memory/constitution.md`)
3. ✅ Consulter l'architecture sécurité (`/security/`)
4. ✅ Vérifier s'il y a une migration en cours (`/mockmig status`)
5. ✅ Vérifier l'inventaire des ports (`~/.claude/ports-inventory.json`)
