# Claude Context — Projet Somtech

> Ce fichier est chargé automatiquement par Claude Code à chaque session ouverte dans ce projet. Il complète le **CLAUDE.md global utilisateur** (`~/.claude/CLAUDE.md`) qui définit les règles transversales Somtech (règles d'or, biais LLM, workflow ServiceDesk, etc.). **Ne pas dupliquer ici ce qui est dans le global** — référencer.
>
> 🧠 **Mémoire externe d'état d'app (STD-027)** : si ce projet a `.somtech/app.yaml`, l'état opérationnel courant sera injecté automatiquement au boot via le hook `SessionStart`. Sinon, exécuter `/lier-app` pour activer.

---

## 1. Sources de vérité du projet

À remplir au bootstrap (les fichiers peuvent ne pas tous exister selon la maturité du projet) :

| Fichier projet | Rôle | Quand le lire |
|---|---|---|
| `ontologie/02_ontologie.yaml` | Modèle de données, entités, relations | Avant toute modification DB/types |
| `ontologie/01_ontologie.md` | Version narrative de l'ontologie | Pour comprendre le contexte métier |
| `memory/constitution.md` | Principes non-négociables du projet | Avant toute décision d'architecture |
| `security/ARCHITECTURE_DE_SECURITE.md` | RLS, guards, patterns de sécurité | Avant toute modification d'accès |
| `.somtech/app.yaml` | Mapping ServiceDesk + Somcraft (STD-027) | Lu auto par le hook SessionStart |

**Règle absolue** : si tu n'as pas lu l'ontologie, tu ne touches pas au code. Si l'ontologie n'est pas à jour avec le code constaté, **signaler à l'utilisateur AVANT** de continuer.

---

## 2. Stack technique

À remplir au bootstrap selon le projet. Par défaut (nouveaux projets Somtech depuis 2026-04) :

- **Frontend** : Next.js 15 (App Router) + React + TypeScript strict + Tailwind CSS — voir [ADR-012](https://somcraft.somtech.ca) (Architecture)
- **Backend** : Supabase (PostgreSQL, Auth, RLS, Edge Functions) — voir ADR-001
- **Hébergement** : Digital Ocean TOR1 (Droplet ou App Platform) via Docker — voir ADR-008, ADR-012
- **Tests** : Playwright (E2E) + Vitest (unitaires) — taxonomie L1→L5 ([STD-027](https://somcraft.somtech.ca) ou réf Architecture)
- **Versioning** : Git + GitHub

**Projets legacy** : Vite + Netlify (ADR-003 + ADR-004 superseded par ADR-012). À identifier au bootstrap, ne pas migrer sans décision explicite.

---

## 3. Sources de vérité Somtech (transverses)

Toutes documentées dans le repo [`Architecture/`](https://github.com/SomtechSolutionMAxime/architecture) (sync miroir dans Somcraft `/standards/` et `/adr/`).

| Référence | Contenu |
|---|---|
| **STD-001** — Méta-standard | Comment écrire un standard Somtech |
| **STD-002** — Cycle de vie projet client | Phases pré-flight → discovery → build → production |
| **STD-027** — Mémoire externe d'état d'app | Convention `.somtech/app.yaml` + doc Somcraft `/operations/<app-slug>/etat-app.md` |
| **ADR-012** — Stack clients | Next.js 15 + Docker + DO TOR1 (supersede ADR-003 + ADR-004) |
| **ADR-001** — Supabase BaaS | Choix Supabase comme BaaS standard |
| **ADR-014** — Cohere Embed v4 | Embeddings FR-first pour le RAG Service |

📖 Registre complet : `Architecture/standards/_index.md` et `Architecture/adr/_metadata.yaml`.

---

## 4. Règles d'or

**Ne sont PAS dupliquées ici.** Référence canonique dans le CLAUDE.md global utilisateur (`~/.claude/CLAUDE.md`) :

1. Si tu n'as pas lu l'ontologie, tu ne touches pas au code
2. On ne brise pas la prod
3. On protège la synchronicité entre staging et prod
4. Qualité avant vitesse (un ticket à la fois jusqu'en prod, jamais de bundle)
5. Jamais dire « c'est corrigé » sans `qa-utilisateur` sur la fonction
6. Les tests sont aussi importants que la feature
7. Jamais toucher au code d'un autre repo (rester dans le répertoire de travail courant)
8. Code review obligatoire avant fermeture (sub-agent fresh ou humain)

📖 Détails et fichiers mémoire associés : voir `~/.claude/CLAUDE.md` → section « Règles d'or ».

---

## 5. ServiceDesk — Workflow Demande → Epic → Story

**Tout travail tracé dans ServiceDesk** (registre unique transverse à tous les projets Somtech).

```
📨 Demande (D-…)            ← niveau client / besoin business
   ├─ 🧱 Epic (E-…)         ← 1 epic = 1 application impactée (obligatoire)
   │     └─ 📖 Story (T-…, type=story)   ← unité testable avec G/W/T Gherkin
   └─ 🎟️ Ticket direct (T-…, type=incident|improvement)
```

**Règle absolue** : toute epic doit avoir une demande parente via `demand_id`, **sans exception** (incluant infra/dette/sécurité). Les agents peuvent **proposer** une demande quand ils identifient un besoin (source `agent`).

📖 Référence complète (statuts, triggers DB auto, cascade de mise à jour, méthode qa-utilisateur) : `~/.claude/memory/reference_gestion-des-tickets.md`.

**Application courante** : `<APP_ID>` (à remplir au bootstrap depuis `mcp__servicedesk__applications` action=list).

---

## 6. Mémoire externe d'état d'application (STD-027)

Si le projet est lié (`.somtech/app.yaml` présent) :

- **READ** auto : le hook `SessionStart` (de `somtech-pack/.claude/hooks/`) lit `.somtech/app-state.md` (cache local) et l'injecte dans `additionalContext` au démarrage de Claude
- **WRITE** : à la fin de session, lancer `/end-session` — il propose un diff du doc Somcraft `/operations/<app-slug>/etat-app.md` (source de vérité) avec validation explicite
- **REFRESH** : si le cache est manquant ou stale (>7 jours), lancer `/sync-app-state`

Si le projet n'est **pas** lié, lancer `/lier-app` pour le provisionner (1 fois). Repos transversaux (Architecture/, somtech-pack/, etc.) restent non-liés par design.

---

## 7. Supabase — Workflow Dev Local + MCP Push

### Interdit
- `supabase db push --linked`
- Modifier les migrations déjà mergées sur main

### Workflow standard
1. Dev local (`supabase start`)
2. Créer migration : `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
3. Tester sur base vierge : `supabase db reset`
4. Pousser en prod via **MCP Supabase** (exécuter le SQL directement, ne pas utiliser `db push --linked`)
5. Rafraîchir cache si besoin : `NOTIFY pgrst, 'reload schema';`

### MCP Supabase
Configuration dans `.mcp.json` du projet pointant vers le `project_ref` de **CE** projet (pas un autre).

**Règle d'isolation stricte** : le MCP Supabase d'une session ne doit opérer que sur le `project_ref` configuré ici. Voir la règle « Migrations Supabase — Isolation stricte par projet » dans `~/.claude/CLAUDE.md`.

---

## 8. Skills et agents disponibles

Skills et sub-agents sont livrés par `somtech-pack` (auto-installés via `/somtech-pack-maj`). Les triggers/descriptions sont auto-chargés dans la session — pas besoin de les répéter ici.

📖 Inventaire complet et descriptions : `~/.claude/memory/reference_skills-disponibles.md` (global).

**Sub-agents par défaut** : `frontend`, `backend`, `qa`, `product`, `database`, `devops`, `design`.

**Skills clés** :
- `/lier-app`, `/sync-app-state`, `/end-session` — mémoire externe (STD-027)
- `/pousse`, `/somtech-pack-maj` — workflow git/sync
- `/audit-rls`, `/create-migration`, `/validate-ui` — patterns Somtech récurrents
- `/playwright-tests`, `/webapp-testing` — tests E2E

---

## 9. Gestion des ports de développement

Avant de démarrer un serveur de dev :

1. Vérifier `~/.claude/ports-inventory.json` pour le port assigné à ce projet
2. Si aucun port assigné : prendre `next_available`, mettre à jour l'inventaire
3. Configurer le projet (`vite.config.ts`, `next.config.js`, etc.) avec le port assigné

**Ne jamais** : `strictPort: false` sans vérification, tuer un serveur d'un autre projet, changer le port sans MAJ inventaire.

📖 Plages réservées et procédure complète : `~/.claude/memory/reference_gestion-des-ports.md`.

---

## 10. Conventions de code

### Nommage
- **Fichiers** : kebab-case (`devis-form.tsx`)
- **Composants React** : PascalCase (`DevisForm`)
- **Variables/fonctions** : camelCase (`getDevisById`)
- **Tables DB** : snake_case (`ligne_devis`)
- **Enums** : SCREAMING_SNAKE_CASE (`DEVIS_STATUS`)

### Patterns obligatoires
- **RLS** : toute table avec données utilisateur a une policy `user_id = auth.uid()` (sauf justification documentée)
- **Guards** : vérification côté client ET côté serveur
- **Types** : générer depuis Supabase (`supabase gen types typescript`)

### Git
- Branches : `feat/<desc>`, `fix/<desc>`, `chore/<desc>`. **Jamais** de dev direct sur `main` ou `staging`.
- Commits : `type(scope): description` (conventional commits)
- Une tâche = une branche, une PR (cf. `~/.claude/CLAUDE.md` règle d'or 4)

---

## 11. Avant de coder — Checklist

1. ✅ Lire l'ontologie (`ontologie/`) — signaler si désalignée
2. ✅ Lire `memory/constitution.md` si décision d'architecture
3. ✅ Lire `security/ARCHITECTURE_DE_SECURITE.md` si modif d'accès
4. ✅ Vérifier `.somtech/app.yaml` (lié à ServiceDesk + Somcraft ?)
5. ✅ Vérifier la branche : créer `feat/`, `fix/` ou `chore/` dédié si nécessaire
6. ✅ Vérifier les ports (`~/.claude/ports-inventory.json`)
7. ✅ Vérifier les tickets en cours sur cette app (`mcp__servicedesk__tickets` action=list)

---

## Notes d'installation

Ce fichier est versionné dans `somtech-pack/.claude/CLAUDE.md`. Quand il est mis à jour côté pack et que le projet exécute `/somtech-pack-maj`, l'ancien est sauvegardé en `.bak-YYYYMMDDHHMMSS` et remplacé. Les sections projet-spécifiques (sources de vérité, stack, application_id) doivent être restaurées manuellement après MAJ (mécanisme de merge intelligent à venir, cf. epic E-20260513-0011 story future).
