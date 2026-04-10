# SomCraft API Reference

## REST API

Base URL : `https://{instance-url}/api/sc`

Authentification : `Authorization: Bearer {supabase-jwt}` OU cookies Supabase.

### Workspaces

#### `GET /api/sc/workspaces`

Liste les workspaces accessibles au user courant.

**Response 200 :**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Construction Gauthier",
      "slug": "construction-gauthier",
      "storage_bucket": "sc-construction-gauthier",
      "api_key": null,
      "created_by": "uuid",
      "created_at": "2026-04-07T..."
    }
  ]
}
```

#### `POST /api/sc/workspaces`

Crée un nouveau workspace.

**Body :**
```json
{
  "name": "Mon nouveau workspace",
  "slug": "mon-workspace"
}
```

### Documents

#### `GET /api/sc/documents?workspace_id={id}&parent_id={id|null}&status={active|trashed}`

Liste les documents d'un workspace.

**Query params :**
- `workspace_id` (required) — UUID du workspace
- `parent_id` (optional) — UUID du dossier parent, ou `null` pour la racine
- `status` (optional, default `active`) — `active`, `archived`, ou `trashed`
- `limit` (optional) — Pagination
- `cursor` (optional) — Pagination cursor

**Response 200 :**
```json
{
  "data": [...],
  "next_cursor": "uuid-or-null"
}
```

#### `POST /api/sc/documents`

Crée un document (file ou folder).

**Body :**
```json
{
  "workspace_id": "uuid",
  "parent_id": "uuid|null",
  "type": "file|folder",
  "filename": "example.md",
  "tags": ["tag1"]
}
```

#### `GET /api/sc/documents/{id}`

Lit les métadonnées d'un document.

#### `PATCH /api/sc/documents/{id}`

Met à jour les métadonnées (rename, tags, metadata).

#### `DELETE /api/sc/documents/{id}`

Soft delete (mise en corbeille).

#### `GET /api/sc/documents/{id}/content`

Retourne le contenu Markdown brut (`text/markdown`).

#### `PUT /api/sc/documents/{id}/content`

Met à jour le contenu Markdown.

**Body :** Le Markdown brut (content-type `text/markdown`).

#### `GET /api/sc/documents/{id}/export?format={pdf|docx}&ai={true|false}`

Export du document.

- `format` — `pdf` ou `docx`
- `ai` — Si `true`, reformate via Claude avant export

**Response :** Binary buffer avec le bon content-type.

#### `POST /api/sc/documents/{id}/restore`

Restaure un document de la corbeille.

### Search

#### `GET /api/sc/search?q={query}&workspace_id={id}`

Full-text search sur les documents (filename + contenu).

**Response 200 :**
```json
{
  "data": [
    {
      "id": "...",
      "filename": "...",
      "snippet": "...",
      "score": 0.8
    }
  ]
}
```

### AI

#### `POST /api/sc/ai/chat`

Chat avec un document comme contexte.

**Body :**
```json
{
  "message": "Résume ce document",
  "document_content": "...",
  "history": [],
  "model": "sonnet|opus"
}
```

**Response :**
```json
{
  "reply": "...",
  "action": { "type": "insert|replace", "content": "..." }
}
```

#### `POST /api/sc/ai/transform`

Transformation ponctuelle (résumer, traduire, corriger, etc.).

**Body :**
```json
{
  "content": "...",
  "instruction": "Traduis en anglais",
  "model": "sonnet"
}
```

**Response :**
```json
{
  "result": "..."
}
```

### Studio

#### `POST /api/sc/studio/generate`

Génère un document structuré via pipeline AI. Retourne un **SSE stream**.

**Body :**
```json
{
  "generator_id": "executive-summary",
  "source_ids": ["uuid1", "uuid2"],
  "workspace_id": "uuid",
  "config": { "tone": "professional", "length": "medium" }
}
```

**Response :** `text/event-stream` avec events :

```
data: {"type":"step","stepId":"extraction","status":"start"}
data: {"type":"step","stepId":"extraction","status":"done","durationMs":4200}
data: {"type":"step","stepId":"writing","status":"chunk","content":"Le document..."}
...
data: {"type":"complete","documentId":"...","path":"/_studio/..."}
```

## MCP Tools

Endpoint : `POST /api/mcp/http` avec `Authorization: Bearer {api_key}`.

Protocole : JSON-RPC 2.0 (MCP standard).

### `list_workspaces`

Liste les workspaces accessibles à cette API key.

### `list_documents`

**Params :**
- `workspace_id` (required)
- `parent_id` (optional)
- `status` (optional)
- `type` (optional, `file` ou `folder`)

### `read_document`

**Params :**
- `workspace_id`
- `document_id`

**Returns :** `{ content, metadata, path, filename }`

### `write_document`

Crée ou met à jour un fichier Markdown. Crée les dossiers parents si nécessaire.

**Params :**
- `workspace_id`
- `path` — Chemin complet (ex: `/specs/requirements.md`)
- `content` — Markdown
- `tags` (optional)

### `search_documents`

**Params :**
- `workspace_id`
- `query`

### `create_folder`

**Params :**
- `workspace_id`
- `path` — Chemin du dossier (crée les parents si besoin)

### `move_document`

**Params :**
- `workspace_id`
- `document_id`
- `new_path`

### `export_document`

**Params :**
- `workspace_id`
- `document_id`
- `format` (pdf|docx)
- `ai` (optional, boolean)

**Returns :** `{ download_url, expires_in }`

### `generate_document`

**Params :**
- `workspace_id`
- `generator_id`
- `source_ids[]`
- `config` (optional)

**Returns :** `{ document_id, path, filename, steps }`
