# SomCraft Architecture Reference

## Data Model complet

### Table `sc_workspaces`

```sql
CREATE TABLE sc_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  storage_bucket TEXT NOT NULL,
  api_key TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Table `sc_documents`

```sql
CREATE TABLE sc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES sc_workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES sc_documents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  storage_key TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'trashed')),
  is_favorite BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  trashed_at TIMESTAMPTZ
);

CREATE INDEX idx_sc_documents_workspace ON sc_documents(workspace_id);
CREATE INDEX idx_sc_documents_parent ON sc_documents(parent_id);
CREATE INDEX idx_sc_documents_status ON sc_documents(status);
CREATE INDEX idx_sc_documents_path ON sc_documents(workspace_id, path);
```

### Table `sc_document_versions`

```sql
CREATE TABLE sc_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES sc_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  checksum TEXT,
  size_bytes BIGINT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, version_number)
);
```

### Table `sc_workspace_members`

```sql
CREATE TABLE sc_workspace_members (
  workspace_id UUID NOT NULL REFERENCES sc_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
```

## Monorepo structure détaillée

### `apps/web/`

```
apps/web/
├── app/
│   ├── api/
│   │   ├── sc/              # REST API (documents, workspaces, ai, studio)
│   │   └── mcp/             # MCP server HTTP endpoint
│   ├── documents/           # FileManager page
│   ├── auth/                # OAuth callbacks
│   └── login/
├── lib/
│   ├── ai/                  # Claude client, prompts
│   ├── export/              # Markdown→HTML, HTML→PDF, Markdown→DOCX
│   ├── mcp-tools/           # Implementation des 9 MCP tools
│   ├── studio/              # Generators + orchestrator Studio
│   ├── api-helpers.ts       # getAuthenticatedClient, jsonError
│   └── supabase-server.ts   # Service role + server client
└── middleware.ts            # Auth middleware
```

### `packages/`

- **`core/`** — Types TypeScript (`ScDocument`, `ScWorkspace`, `Generator`, etc.), constants (`TABLE`), Supabase client builders
- **`editor/`** — Composant `MarkdownEditor` avec BlockNote, `AiChatPanel`, `TocPanel`, `StudioPanel`, hooks (`useEditorContent`, `useAi`, `useStudio`, `useAutoSave`)
- **`files/`** — `FileManager` complet (sidebar, toolbar, liste, metadata panel, search dialog), store Zustand, hooks (`useDocuments`, `useWorkspace`, `useSearch`, `useUpload`), context auth
- **`db/`** — CLI pour migrations (dev local)
- **`sync/`** — Sync engine bidirectionnel filesystem ↔ Supabase (pour sync CLI)

## Dépendances clés

- `@blocknote/react` — Éditeur
- `@anthropic-ai/sdk` — Claude API
- `@supabase/supabase-js` — DB + auth + storage
- `puppeteer` — PDF export
- `docx` — DOCX export
- `markdown-it` — Markdown → HTML
- `zustand` — State management client
- `zod` — Validation schemas (notamment MCP tools)
- `mcp-handler` — MCP server helper

## Flux de données

### Édition d'un document

```
User edit → BlockNote → useAutoSave (debounce 2s)
         → PUT /api/sc/documents/{id}/content
         → supabase.storage.upload(bucket, key, markdown)
         → UPDATE sc_documents SET size_bytes, updated_at
```

### Lecture d'un document

```
GET /api/sc/documents/{id}/content
  → SELECT from sc_documents (RLS check)
  → supabase.storage.download(bucket, storage_key)
  → return text/markdown
```

### Export PDF

```
GET /api/sc/documents/{id}/export?format=pdf&ai=true
  → SELECT document metadata
  → Download markdown from storage
  → [Optional] Claude reformat via EXPORT_PRO_PROMPT
  → markdownToHtml (markdown-it)
  → htmlToPdf (Puppeteer)
  → Return PDF buffer
```

### Studio génération

```
POST /api/sc/studio/generate (SSE)
  → Fetch sources content from storage
  → runPipeline(generator, sources) — séquence d'appels Claude
  → For each step: stream chunks via SSE
  → Save result to /_studio/{filename}.md
  → Send 'complete' event
```
