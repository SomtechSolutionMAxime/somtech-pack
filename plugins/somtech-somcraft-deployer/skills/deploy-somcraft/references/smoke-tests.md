# Smoke Tests Reference

Tests post-déploiement pour valider qu'une instance SomCraft fonctionne.

## Test 1 — Health check

```bash
APP_URL=$(fly info -a "$FLY_APP" --json | jq -r .Hostname)

RESPONSE=$(curl -sf "https://$APP_URL/api/health" || echo "FAILED")
if echo "$RESPONSE" | grep -q '"status":"ok"'; then
  echo "✓ Health check passed"
else
  echo "✗ Health check failed: $RESPONSE"
  exit 1  # Critique — arrêter
fi
```

Si `/api/health` n'existe pas dans SomCraft, utiliser `/` et vérifier un 200 :

```bash
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "https://$APP_URL/")
[ "$HTTP_CODE" = "200" ] && echo "✓ Root URL accessible" || echo "✗ Root URL returned $HTTP_CODE"
```

## Test 2 — MCP server

```bash
MCP_RESPONSE=$(curl -sf -X POST "https://$APP_URL/api/mcp/mcp" \
  -H "Authorization: Bearer $SOMCRAFT_MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' || echo "FAILED")

if echo "$MCP_RESPONSE" | grep -q "list_workspaces"; then
  echo "✓ MCP server responded with tools list"
else
  echo "✗ MCP server failed or didn't list tools"
  echo "Response: $MCP_RESPONSE"
fi
```

## Test 3 — Workspace accessible via REST API

```bash
WS_RESPONSE=$(curl -sf "https://$APP_URL/api/sc/workspaces" \
  -H "Authorization: Bearer $SOMCRAFT_MCP_API_KEY" || echo "FAILED")

if echo "$WS_RESPONSE" | grep -q "$WORKSPACE_ID"; then
  echo "✓ Initial workspace accessible via API"
else
  echo "✗ Workspace not accessible. Check RLS and API key."
fi
```

## Test 4 — Créer un document de test

```bash
DOC_RESPONSE=$(curl -sf -X POST "https://$APP_URL/api/sc/documents" \
  -H "Authorization: Bearer $SOMCRAFT_MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"filename\": \"smoke-test.md\",
    \"type\": \"file\"
  }" || echo "FAILED")

if echo "$DOC_RESPONSE" | grep -q '"id"'; then
  echo "✓ Test document created"
  DOC_ID=$(echo "$DOC_RESPONSE" | jq -r '.data.id // .id')

  # Cleanup : delete le document de test
  curl -sf -X DELETE "https://$APP_URL/api/sc/documents/$DOC_ID" \
    -H "Authorization: Bearer $SOMCRAFT_MCP_API_KEY" > /dev/null
else
  echo "✗ Failed to create test document"
fi
```

## Résumé et critères

- **Test 1 (health)** : Bloquant. Si échoue, abort.
- **Tests 2, 3, 4** : Warnings non bloquants. Afficher l'erreur, continuer.

À la fin, afficher un résumé :

```
Smoke tests:
  ✓ Health check
  ✓ MCP server
  ✓ Workspace REST API
  ✓ Document creation

Tous les tests passent.
```

Ou en cas d'échec partiel :

```
Smoke tests:
  ✓ Health check
  ✗ MCP server (erreur 401 — vérifier l'API key)
  ✓ Workspace REST API
  ✓ Document creation

2 tests ont échoué. Vérifiez les logs : fly logs -a $FLY_APP
```
