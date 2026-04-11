---
name: somcraft
description: |
  Documentation de référence SomCraft — DMS Markdown-native avec AI, MCP server, et Studio.
  À consulter pour toute question sur l'architecture, les APIs, les concepts, ou l'exploitation d'une instance SomCraft.
  TRIGGERS : somcraft, dms, document management, workspace somcraft, studio somcraft, mcp somcraft, api somcraft
---

# SomCraft — Documentation de référence

SomCraft est un **Document Management System (DMS) Markdown-first** développé par Somtech Solutions. Ce skill documente son architecture, ses concepts, ses APIs, et les patterns d'exploitation.

Pour la doc spécifique à une instance client déployée, voir le skill `somcraft-{client}` dans le projet courant (s'il existe).

## Vue d'ensemble

**Ce que fait SomCraft :**
- Éditeur Markdown block-based (BlockNote)
- Gestion de fichiers multi-formats (Markdown, PDF, images, docs)
- Storage et versioning via Supabase
- AI-assisted authoring (Claude : chat, transforms, Studio de génération)
- MCP server pour agents externes
- Export PDF/DOCX
- Multi-tenant via workspaces

**Stack technique :**
- **Frontend** : Next.js 15 (App Router), React, TypeScript, Tailwind CSS v4
- **Éditeur** : BlockNote (wrapper React sur ProseMirror)
- **Backend** : Supabase (PostgreSQL, Auth, RLS, Storage)
- **AI** : Anthropic SDK (Claude Sonnet/Opus)
- **Export** : markdown-it → Puppeteer (PDF), docx library (DOCX)
- **Déploiement** : Docker sur Fly.io

**Structure monorepo :**

```
somcraft/
├── apps/
│   └── web/          # Next.js app principale
│       ├── app/      # Routes App Router
│       ├── lib/      # AI client, export, MCP server
│       └── middleware.ts
├── packages/
│   ├── core/         # Types, Supabase client, constants
│   ├── editor/       # Composant MarkdownEditor + AI Chat + Studio
│   ├── files/        # FileManager + hooks + store Zustand
│   ├── db/           # CLI migrations
│   └── sync/         # Sync engine filesystem ↔ Supabase
└── supabase/
    └── migrations/   # Schema PostgreSQL
```

## Concepts clés

Pour le détail, voir `references/concepts.md`.

- **Workspace** — Unité d'isolation multi-tenant. Chaque workspace a son propre storage bucket et ses membres.
- **Document** — Fichier ou dossier dans un workspace. Stocké en DB (métadonnées) + Supabase Storage (contenu).
- **Version** — Snapshot historique d'un document (table `sc_document_versions`).
- **Studio** — Panneau de génération de documents via pipelines AI multi-étapes (résumé exécutif, présentation, rapport, compte-rendu, proposition d'amélioration).
- **MCP Server** — Endpoint HTTP qui expose 9 tools pour agents externes (liste workspaces, lit/écrit documents, génère via Studio, etc.).

## Data Model

Pour le détail, voir `references/architecture.md`.

Tables principales :

- `sc_workspaces` — id, name, slug, storage_bucket, api_key, created_by
- `sc_documents` — id, workspace_id, parent_id, type (file|folder), filename, path, storage_key, status, tags, metadata
- `sc_document_versions` — id, document_id, version_number, storage_key, checksum, created_at
- `sc_workspace_members` — workspace_id, user_id, role (viewer|editor|admin)
- `sc_recent_activity` — activity log (viewed|edited|uploaded)

**RLS :** Toutes les tables `sc_*` ont des policies basées sur `auth.uid()` et la membership dans `sc_workspace_members`.

## API REST

Pour le détail, voir `references/api-reference.md`.

Endpoints principaux (tous sous `/api/sc/`) :

- `GET/POST /api/sc/workspaces` — Liste/créer workspaces
- `GET/POST /api/sc/documents?workspace_id=X` — Liste/créer documents
- `GET/PUT /api/sc/documents/{id}` — Lire/modifier un document
- `GET /api/sc/documents/{id}/content` — Contenu Markdown brut
- `GET /api/sc/documents/{id}/export?format=pdf` — Export PDF/DOCX
- `POST /api/sc/ai/chat` — Chat avec le document comme contexte
- `POST /api/sc/ai/transform` — Transformation ponctuelle (résumé, traduction, etc.)
- `POST /api/sc/studio/generate` — Pipeline Studio (SSE streaming)

**Format de réponse :** `{ "data": ... }` ou `{ "data": ..., "next_cursor": ... }` pour les listes.

**Auth :** Bearer token (Supabase JWT) dans le header `Authorization`, ou cookies Supabase pour les sessions navigateur.

## MCP Tools

Pour le détail, voir `references/api-reference.md`.

Endpoint : `POST /api/mcp/mcp` avec `Authorization: Bearer {api_key}` et `Accept: application/json, text/event-stream`.

9 tools disponibles :

1. `list_workspaces` — Lister les workspaces accessibles
2. `list_documents` — Lister documents dans un workspace (filtrable par parent, status)
3. `read_document` — Lire contenu + métadonnées
4. `write_document` — Créer/mettre à jour un .md (crée les dossiers parents si besoin)
5. `search_documents` — Recherche full-text
6. `create_folder` — Créer un dossier (récursif)
7. `move_document` — Déplacer un fichier/dossier
8. `export_document` — Export vers PDF/DOCX, retourne URL signée
9. `generate_document` — Pipeline Studio pour génération structurée

## Sécurité

Pour le détail, voir `references/security.md`.

- **RLS par workspace_id** sur toutes les tables `sc_*`
- **API keys MCP** stockées dans `sc_workspaces.api_key` (format `sk_live_<64-hex>`)
- **Storage policies** : chaque bucket est privé, accessible uniquement aux membres du workspace correspondant
- **Service role key** : uniquement utilisée côté serveur (Edge Functions, export PDF)
- **Anon key** : pour les clients (sessions auth)

## Troubleshooting

Pour le détail, voir `references/troubleshooting.md`.

Problèmes communs :

- **Workspace vide** → Vérifier RLS (`SELECT * FROM pg_policies WHERE tablename LIKE 'sc_%'`) et que le user est bien membre
- **Studio génère des fichiers vides** → Vérifier `ANTHROPIC_API_KEY`, vérifier les logs du pipeline
- **MCP server retourne 401** → Vérifier que l'API key est bien dans `sc_workspaces.api_key` et qu'elle est passée en `Bearer`
- **Export PDF échoue** → Vérifier que Puppeteer est disponible (pas de libs système manquantes sur Fly.io)
- **Sync MCP** → Vérifier que le MCP server est correctement configuré dans `.mcp.json`

## Opérations courantes

- **Créer un nouveau workspace** : INSERT dans `sc_workspaces` + créer bucket storage + INSERT membre admin
- **Régénérer une API key** : `UPDATE sc_workspaces SET api_key = 'sk_live_...' WHERE id = ...`
- **Voir les documents d'un workspace** : `SELECT * FROM sc_documents WHERE workspace_id = ? ORDER BY created_at DESC`
- **Restaurer un document de la corbeille** : `UPDATE sc_documents SET status = 'active' WHERE id = ? AND status = 'trashed'`

Pour des opérations spécifiques à un client déployé, utiliser le skill `somcraft-{client}` du projet courant.
