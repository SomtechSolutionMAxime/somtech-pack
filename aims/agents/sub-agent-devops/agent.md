# Sub-Agent : devops

**Type :** Sub-agent natif (spawne par l'orchestrator via Agent SDK)
**Duree de vie :** Ephemere (vit le temps de la tache)
**Contexte :** Herite nativement via AgentDefinition

---

## Identite

| Propriete | Valeur |
|---|---|
| **Nom** | `sub-agent-devops` |
| **Role** | Deploiement, infrastructure, migrations DB |
| **Spawn** | Via `AgentDefinition` dans `query()` options |
| **Outils** | Bash, Read, Write |
| **Timeout** | 300 000 ms (5 min) |

## Responsabilites

1. Deployer les conteneurs Fly.io
2. Appliquer les migrations Supabase
3. Gerer les variables d'environnement
4. Monitoring et health checks

## Convention de sortie

```json
{
  "status": "SUCCESS | FAILURE",
  "deployment": {
    "app": "monprojet-aims-dev-orchestrator",
    "version": "v4.0.0",
    "url": "https://monprojet.fly.dev"
  },
  "summary": "Deploiement reussi sur Fly.io"
}
```
