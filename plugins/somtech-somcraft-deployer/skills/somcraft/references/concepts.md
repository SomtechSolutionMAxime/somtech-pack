# SomCraft Concepts Reference

## Workspace

Unité d'isolation multi-tenant. Chaque workspace :

- A un nom, un slug unique, et un storage bucket Supabase dédié
- Peut avoir une API key MCP pour les agents externes
- A des membres (table `sc_workspace_members`) avec un rôle (viewer, editor, admin)
- Isole ses documents via RLS sur `workspace_id`

**Création :** Via INSERT dans `sc_workspaces` + création du bucket storage + INSERT du créateur comme admin.

**Suppression :** CASCADE supprime tous les documents et versions. Le bucket storage doit être supprimé séparément (pas automatique).

## Document

Représente un fichier ou un dossier dans un workspace.

**Types :**
- `file` — Fichier (Markdown, PDF, image, etc.)
- `folder` — Dossier hiérarchique

**Champs clés :**
- `workspace_id` — Workspace parent
- `parent_id` — Dossier parent (NULL si racine)
- `filename` — Nom du fichier/dossier
- `path` — Chemin complet (ex: `/architecture/01-vue-ensemble.md`)
- `storage_key` — Clé dans Supabase Storage (NULL pour les dossiers)
- `status` — `active`, `archived`, ou `trashed`
- `tags` — Array de tags

**Cycle de vie :**
1. Création → `status: active`
2. Mise en corbeille → `status: trashed`, `trashed_at: now()`
3. Restauration → `status: active`, `trashed_at: NULL`
4. Suppression définitive → DELETE (CASCADE les versions)

## Version

Chaque modification d'un document peut créer une version dans `sc_document_versions`. Permet :
- Historique complet des changements
- Restauration vers une version antérieure
- Comparaison (diff)

**Note :** Le versioning n'est pas automatique à chaque sauvegarde (sinon coût de storage). Il est créé explicitement via un endpoint dédié ou lors de milestones.

## Studio

Panneau de génération de documents via **pipelines AI multi-étapes**.

**Pipelines disponibles (v1) :**

1. **Résumé exécutif** (4 étapes) — Extraction → Hiérarchisation → Rédaction → Formatage
2. **Présentation** (4 étapes) — Extraction → Plan slides → Rédaction → Formatage
3. **Rapport professionnel** (5 étapes) — Extraction → Plan → Rédaction → Révision → Export PDF
4. **Compte-rendu de rencontre** (3 étapes) — Extraction → Rédaction → Formatage
5. **Proposition d'amélioration** (4 étapes) — Extraction → Analyse → Rédaction → Formatage

**Flux :**
1. L'utilisateur sélectionne 1+ documents comme sources
2. Clique sur un generator (résumé, présentation, etc.)
3. L'orchestrateur exécute chaque étape du pipeline séquentiellement
4. Chaque étape est un appel Claude avec un prompt spécialisé
5. Le résultat final est sauvegardé dans `/_studio/` dans le workspace
6. Streaming SSE permet de voir la progression en temps réel

## MCP Server

Endpoint HTTP qui expose les fonctionnalités de SomCraft via le protocole MCP (Model Context Protocol). Permet aux agents externes (Claude Code, Copilot, etc.) d'interagir avec une instance SomCraft.

**Endpoint :** `POST {instance-url}/api/mcp/http`

**Authentification :** Header `Authorization: Bearer {api_key}` où `api_key` est la valeur de `sc_workspaces.api_key`.

**Note :** Une API key est scopée à UN workspace. Pour accéder à plusieurs workspaces, il faut une API key par workspace.

## Sync Engine

Package `@somcraft/sync` — CLI pour synchroniser un dossier local avec un workspace SomCraft.

```bash
npx @somcraft/sync --workspace <id> --dir ./docs
```

- `pull` : Télécharge tous les documents du workspace dans `./docs`
- `push` : Watch le dossier local et upload les changements
- Résolution de conflits : newest-wins (dernier modifié gagne)
