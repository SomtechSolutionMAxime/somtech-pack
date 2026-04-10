# RAG Service — {{CLIENT}}

> Configuration du RAG Service pour ce projet.
> Consultez le skill `rag` pour la documentation complète du service.

## URLs par environnement

| Env | URL | Supabase project_ref | Déployé le |
|-----|-----|---------------------|------------|
| dev | {{DEV_URL}} | {{DEV_PROJECT_REF}} | {{DEV_DATE}} |
| staging | {{STAGING_URL}} | {{STAGING_PROJECT_REF}} | {{STAGING_DATE}} |
| prod | {{PROD_URL}} | {{PROD_PROJECT_REF}} | {{PROD_DATE}} |

## Snippet `.mcp.json`

Ajouter ces entrées dans le `.mcp.json` du projet selon l'environnement en cours :

```json
{
  "mcpServers": {
    "rag-dev": {
      "type": "http",
      "url": "{{DEV_URL}}/mcp"
    },
    "rag-staging": {
      "type": "http",
      "url": "{{STAGING_URL}}/mcp"
    },
    "rag-prod": {
      "type": "http",
      "url": "{{PROD_URL}}/mcp"
    }
  }
}
```

## Installation du client SDK

```bash
npm install @somtech/rag-client
```

Exemple d'utilisation :

```typescript
import { RagClient } from '@somtech/rag-client'

const rag = new RagClient({
  url: '{{DEV_URL}}',
  token: userJwt
})

const { answer, sources } = await rag.search('ma question')
```

## Tools MCP disponibles

- `rag_search(query, options?)` — recherche + génération
- `rag_push_document(document_id, content_md, title)` — indexer un doc
- `rag_delete_document(document_id)` — retirer un doc
- `rag_list_documents()` — lister les docs indexés

## Documentation complète

Voir le skill `rag` (plugin `somtech-rag`) pour :
- Architecture du service
- Cohabitation avec Somcraft
- Seuils de confiance et debugging
- Quand utiliser le RAG vs autre chose
