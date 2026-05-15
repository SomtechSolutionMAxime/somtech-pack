# Pré-flight Checks Reference

Checklist détaillée de la Phase 0 du déploiement SomCraft.

## 1. Détection du client (`.somtech/app.yaml`)

**Source unique de vérité** : `.somtech/app.yaml` à la racine du projet, créé par le skill `/lier-app` (STD-027).

```bash
if [ ! -f .somtech/app.yaml ]; then
  echo "Erreur : .somtech/app.yaml absent. Ce repo n'est pas lié à une application Somtech."
  echo "Lancez /lier-app pour créer .somtech/app.yaml avant de relancer /deploy-somcraft."
  exit 1
fi
```

**Aucun fallback** : ne JAMAIS deviner le nom client depuis `CLAUDE.md`, un H1, ou en demandant à l'utilisateur. Si `.somtech/app.yaml` est absent, le seul chemin de récupération est d'exécuter `/lier-app`.

### Format attendu

```yaml
servicedesk:
  app_id: <APP_ID>
  app_name: <APP_NAME>
  app_slug: <APP_SLUG>
  client_id: <CLIENT_ID>
  client_name: <CLIENT_NAME>
somcraft:
  workspace_id: <WORKSPACE_ID_CLIENT>
  app_state_doc_id: <DOC_ID>
  app_state_doc_path: /operations/<APP_SLUG>/etat-app.md
```

### Extraction des valeurs

```bash
# Avec yq (recommandé) :
client_name=$(yq -r '.servicedesk.client_name' .somtech/app.yaml)
app_slug=$(yq -r '.servicedesk.app_slug' .somtech/app.yaml)
client_id=$(yq -r '.servicedesk.client_id' .somtech/app.yaml)

# Fallback grep si yq absent :
client_name=$(grep -E "^\s+client_name:" .somtech/app.yaml | head -1 | sed 's/.*client_name:\s*//' | tr -d '"')
app_slug=$(grep -E "^\s+app_slug:" .somtech/app.yaml | head -1 | sed 's/.*app_slug:\s*//' | tr -d '"')
```

Le `client-slug` utilisé dans les noms d'app Fly.io (`somcraft-{client-slug}-{env}`) et de bucket storage (`sc-{client-slug}`) est dérivé de `servicedesk.app_slug` :

```bash
client_slug="$app_slug"   # déjà en kebab-case et stable (cf. STD-027)
```

**Note** : `app_slug` est garanti stable dans le temps par `/lier-app` (même si `app_name` change). C'est précisément la raison d'être de STD-027 — pas de dérive du slug quand on renomme une app dans ServiceDesk.

## 2. Validation .mcp.json

Lire `.mcp.json`. Il doit contenir au moins :

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=XXX"
    }
  }
}
```

Extraire le `project_ref` de l'URL. Ce sera le project_ref pour l'environnement actuel (staging ou production).

**Important :** Le projet client peut avoir DEUX entrées MCP Supabase (staging + prod). Dans ce cas, utiliser celle qui correspond à l'environnement sélectionné.

## 3. Validation fly.toml

Lire `fly.toml` à la racine. Extraire :

```toml
app = "client-app-name"
primary_region = "yul"

[env]
NODE_ENV = "production"
```

Pour détecter l'organization Fly.io, exécuter :

```bash
fly apps list --org <unknown> 2>&1 | grep "$app_name" | awk '{print $2}'
```

Ou lire `fly.toml` si une section `[deploy]` contient `organization`.

## 4. Vérifications système

```bash
# Fly CLI authentifié
fly auth whoami || { echo "Erreur: fly auth login requis"; exit 1; }

# Git disponible
git --version || { echo "Erreur: git non installé"; exit 1; }

# jq disponible (pour parser JSON)
jq --version || { echo "Erreur: jq non installé"; exit 1; }

# openssl disponible (pour générer API keys)
openssl version || { echo "Erreur: openssl non installé"; exit 1; }
```

## 5. Sélection de l'environnement

Utiliser `AskUserQuestion` avec 2 options claires :

- `staging` : Environnement de dev/test
- `production` : Environnement de production client

**Règle :** Toujours demander explicitement. Ne JAMAIS supposer.

## 6. Confirmation finale

Après avoir détecté toutes les valeurs, afficher un résumé et demander confirmation :

```
Client détecté   : Construction Gauthier
Slug             : construction-gauthier
Environnement    : staging
Supabase project : abcdef1234
Fly app          : somcraft-construction-gauthier-staging
Fly org          : somtech-gauthier

Procéder ? (oui/non)
```

Si l'utilisateur répond "non", arrêter proprement.
