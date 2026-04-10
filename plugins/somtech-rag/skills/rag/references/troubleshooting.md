# RAG Service — Troubleshooting

Guide de debug pour les problèmes courants du RAG Service.

## Vérifier l'état du service

### Fly.io

```bash
# Statut de l'app
fly status -a rag-<client>-<env>

# Logs en temps réel
fly logs -a rag-<client>-<env>

# Redémarrer si bloqué
fly apps restart rag-<client>-<env>
```

### Health check

```bash
curl https://rag-<client>-<env>.fly.dev/rag/health
```

Si ce endpoint répond, le service Express tourne. Si `404`, le service n'est pas déployé ou le nom de l'app est faux. Si `timeout`, la machine Fly.io est arrêtée (auto_stop) — elle se réveille au premier requête.

## Vérifier ce qui est indexé

### Via MCP

```
rag_list_documents()
```

### Via REST

```bash
curl -H "Authorization: Bearer <jwt>" \
  https://rag-<client>-<env>.fly.dev/rag/documents
```

### Directement dans Supabase

```sql
SELECT document_id, title, version, count(*) as chunks
FROM document_chunks
GROUP BY document_id, title, version
ORDER BY title;
```

## Une recherche ne trouve rien

**Checklist :**

1. **Le document est-il indexé ?** Utiliser `rag_list_documents` pour vérifier.
2. **Le seuil est-il trop haut ?** Baisser `similarity_threshold` à 0.7 ou 0.6 temporairement.
3. **L'embedding a-t-il réussi ?** Regarder les logs pour erreurs OpenAI.
4. **La query fait-elle sens ?** Essayer une query plus simple d'abord.
5. **Les synonymes couvrent-ils le vocabulaire du client ?** Vérifier `src/search/synonyms.ts`.

## Seuils de confiance

| Score | Interprétation | Action |
|-------|---------------|--------|
| > 0.85 | Haute confiance — correspondance claire | Répondre |
| 0.80 – 0.85 | Bonne confiance | Répondre |
| 0.75 – 0.80 | Limite — pertinence incertaine | Répondre avec nuance |
| < 0.75 | Écarté — pas retourné | Informer "information non disponible" |

Le seuil par défaut est `0.75`. Configurable par requête via `similarity_threshold`.

## Erreurs courantes

### `401 Invalid token`

**Cause** : Le JWT est expiré, invalide, ou d'une autre instance Supabase.

**Solution** :
- Vérifier que le JWT est récent (pas expiré)
- Vérifier que le JWT vient du bon Supabase (celui du même environnement)
- Re-login côté client

### `401 Missing token`

**Cause** : Pas de header `Authorization` dans la requête.

**Solution** : Ajouter `Authorization: Bearer <jwt>` aux headers.

### `500 Failed to insert chunks`

**Cause** : La table `document_chunks` n'existe pas, ou RLS bloque l'insert, ou l'embedding a échoué.

**Solution** :
1. Vérifier que la migration est appliquée : `SELECT * FROM document_chunks LIMIT 1;`
2. Vérifier les logs Fly.io pour l'erreur précise
3. Vérifier que le JWT a bien le rôle `authenticated`

### `400 Document produced no chunks`

**Cause** : Le Markdown envoyé est vide ou trop court (moins de ~50 caractères).

**Solution** : Vérifier que `content_md` n'est pas vide dans la requête de push.

### Recherche retourne 0 sources (mais sans erreur)

**Cause** : Aucun chunk n'a un score ≥ 0.75, ou aucun document n'est indexé.

**Solution** :
- `rag_list_documents()` pour vérifier l'indexation
- Baisser `similarity_threshold` temporairement pour voir si des chunks existent
- Vérifier que la query est dans la bonne langue (le full-text est configuré pour le français)

### `fly deploy` échoue

**Cause courante** : clé API manquante, quota dépassé, build error.

**Solution** :
```bash
fly logs -a rag-<client>-<env>
fly status -a rag-<client>-<env>
fly secrets list -a rag-<client>-<env>
```

### MCP Server ne répond pas

**Cause** : Le transport MCP nécessite une initialisation. Vérifier que le client MCP supporte StreamableHTTP.

**Solution** :
- Tester le endpoint REST d'abord (`/rag/search`)
- Si REST marche mais MCP non, c'est un problème de transport MCP côté client
- Redémarrer l'agent Claude Code pour recharger `.mcp.json`

## Vérifier la qualité des chunks

Si les réponses sont imprécises ou hors-sujet :

```sql
-- Voir les chunks d'un document
SELECT chunk_index, heading, parent_heading, substring(content, 1, 100) as preview
FROM document_chunks
WHERE document_id = '<uuid>'
ORDER BY chunk_index;
```

Vérifier :
- Les chunks sont bien découpés par headings (pas au milieu d'une phrase)
- `parent_heading` est rempli quand il y a hiérarchie
- `full_context` inclut bien le chemin de headings
- Les tableaux ne sont pas coupés en plusieurs chunks

## Debugging avancé

### Voir un embedding brut

```sql
SELECT chunk_index, heading, array_length(embedding::real[], 1) as dim
FROM document_chunks
WHERE document_id = '<uuid>'
LIMIT 3;
```

Devrait retourner `dim = 1536` (text-embedding-3-small).

### Tester une similarité manuelle

```sql
SELECT
  chunk_index,
  heading,
  1 - (embedding <=> (SELECT embedding FROM document_chunks WHERE id = '<chunk_id>')) as similarity
FROM document_chunks
WHERE document_id = '<uuid>'
ORDER BY similarity DESC
LIMIT 10;
```

### Reset complet

Si tout est cassé et qu'on veut repartir de zéro pour un client :

```sql
DELETE FROM document_chunks;
```

Puis re-pousser tous les documents via Somcraft ou `/rag/documents/:id/push`.
