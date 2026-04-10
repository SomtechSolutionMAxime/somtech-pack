# RAG Service — API Usage

Trois façons d'appeler le RAG Service : client SDK TypeScript, MCP, REST direct.

## 1. Client SDK `@somtech/rag-client` (recommandé pour TypeScript)

Publié sur GitHub Packages. Zero dépendance runtime (utilise `fetch` natif).

### Installation

```bash
npm install @somtech/rag-client
```

### Initialisation

```typescript
import { RagClient } from '@somtech/rag-client'

const rag = new RagClient({
  url: 'https://rag-acme-dev.fly.dev',
  token: userJwt  // JWT Supabase Auth du user courant
})
```

### Recherche avec génération

```typescript
const { answer, sources } = await rag.search('politique remboursement kilométrique')

console.log(answer)
// "Selon la Politique de remboursement, section 3.2, le taux approuvé est..."

console.log(sources)
// [{ chunk_id, document_id, heading, content, score, signed_url }]
```

### Recherche sans génération (chunks bruts)

```typescript
const { sources } = await rag.search('taux horaire', { generate: false })
// answer sera null, seulement les chunks sont retournés
```

### Options de recherche

```typescript
const result = await rag.search('ma question', {
  match_count: 5,              // nombre de résultats (défaut 10)
  similarity_threshold: 0.80,  // seuil (défaut 0.75)
  vector_weight: 0.7,          // poids vector (défaut 0.7)
  text_weight: 0.3,            // poids full-text (défaut 0.3)
  generate: true,              // générer une réponse (défaut true)
  filter_category: 'rh',       // filtrer par catégorie
})
```

### Indexer un document

```typescript
const result = await rag.push('doc-uuid', {
  content_md: '# Politique RH\n\n...',
  title: 'politique-rh.md',
  category: 'rh',
  original_storage_path: 'documents/politique-rh.pdf',
})

console.log(result)
// { document_id: 'doc-uuid', chunk_count: 12, version: 3 }
```

### Lister les documents indexés

```typescript
const docs = await rag.listDocuments()
// [{ document_id, title, chunk_count, version, indexed_at }]
```

### Supprimer un document

```typescript
await rag.deleteDocument('doc-uuid')
// { deleted: true, document_id: 'doc-uuid' }
```

### Gestion des erreurs

```typescript
import { RagError } from '@somtech/rag-client'

try {
  await rag.search('query')
} catch (err) {
  if (err instanceof RagError) {
    console.error(`RAG error ${err.code}: ${err.message}`)
  }
}
```

---

## 2. MCP (pour agents Claude Code)

Ajouter dans le `.mcp.json` du projet :

```json
{
  "mcpServers": {
    "rag-dev": {
      "type": "http",
      "url": "https://rag-acme-dev.fly.dev/mcp"
    }
  }
}
```

### Tools disponibles

| Tool | Paramètres |
|------|-----------|
| `rag_search` | `query`, `match_count?`, `generate?`, `filter_category?` |
| `rag_push_document` | `document_id`, `content_md`, `title`, `category?`, `original_storage_path?` |
| `rag_delete_document` | `document_id` |
| `rag_list_documents` | — |

### Exemple d'usage dans un agent

L'agent peut invoquer les tools directement :

```
rag_search(query: "politique remboursement kilométrique", match_count: 5)
```

---

## 3. REST API directe

Toutes les routes sont protégées par JWT Supabase Auth (sauf `/rag/health`).

### Health check

```bash
curl https://rag-acme-dev.fly.dev/rag/health
# {"status":"ok","timestamp":"..."}
```

### Indexer un document

```bash
curl -X POST https://rag-acme-dev.fly.dev/rag/documents/doc-uuid/push \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "content_md": "# Politique RH\n\n...",
    "title": "politique-rh.md",
    "category": "rh"
  }'
```

### Rechercher

```bash
curl -X POST https://rag-acme-dev.fly.dev/rag/search \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"query":"politique remboursement","match_count":5}'
```

### Lister les documents

```bash
curl -H "Authorization: Bearer <jwt>" \
  https://rag-acme-dev.fly.dev/rag/documents
```

### Supprimer un document

```bash
curl -X DELETE https://rag-acme-dev.fly.dev/rag/documents/doc-uuid \
  -H "Authorization: Bearer <jwt>"
```

---

## Format de réponse `search`

```json
{
  "answer": "Selon la Politique de remboursement, section Remboursement kilométrique, le taux approuvé est de 0,61$/km...",
  "sources": [
    {
      "chunk_id": "uuid",
      "document_id": "uuid",
      "heading": "Remboursement kilométrique",
      "content": "Le taux est de 0,61$/km...",
      "score": 0.89,
      "signed_url": "https://xxx.supabase.co/storage/v1/..."
    }
  ]
}
```
