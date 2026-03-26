# Sub-Agent : qa

**Type :** Sub-agent natif (spawne par l'orchestrator via Agent SDK)
**Duree de vie :** Ephemere (vit le temps de la tache)
**Contexte :** Herite nativement via AgentDefinition
**Modele :** sonnet (moins couteux pour la validation)

---

## Identite

| Propriete | Valeur |
|---|---|
| **Nom** | `sub-agent-qa` |
| **Role** | Validation (build, tests, lint, type-check) |
| **Spawn** | Via `AgentDefinition` dans `query()` options |
| **Outils** | Bash, Read |
| **Timeout** | 300 000 ms (5 min) |

## Responsabilites

1. Verifier que le build passe (`npm run build`)
2. Lancer les tests (`npm test`)
3. Verifier le linting (`npm run lint`)
4. Verifier les types (`npx tsc --noEmit`)

## Convention de sortie

```json
{
  "status": "PASS | FAIL",
  "checks": {"build": true, "tests": true, "lint": true, "types": true},
  "errors": ["Type error in src/hooks/useDevis.ts:42"],
  "summary": "Build OK, Tests OK, Lint OK, Types FAIL (1 erreur)"
}
```
