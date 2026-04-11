# Pré-flight Checks Reference

Checklist détaillée de la Phase 0 du déploiement SomCraft.

## 1. Détection du client (CLAUDE.md)

Chercher le fichier CLAUDE.md dans l'ordre suivant (le premier trouvé gagne) :

1. **`.claude/CLAUDE.md`** — Emplacement standard Somtech (le pack `somtech-pack` installe le CLAUDE.md ici)
2. **`CLAUDE.md`** — Fallback à la racine du projet pour les projets non-Somtech

```bash
if [ -f .claude/CLAUDE.md ]; then
  CLAUDE_MD_PATH=".claude/CLAUDE.md"
elif [ -f CLAUDE.md ]; then
  CLAUDE_MD_PATH="CLAUDE.md"
else
  echo "Erreur: aucun CLAUDE.md trouvé (ni .claude/CLAUDE.md, ni CLAUDE.md à la racine)"
  exit 1
fi
```

Une fois le fichier trouvé, chercher le nom du client via les patterns suivants dans l'ordre :

1. Une ligne `# Client: {name}` ou `## Client — {name}`
2. Le premier titre H1 du document
3. Un champ YAML frontmatter `client: {name}`
4. Si rien trouvé, demander à l'utilisateur via `AskUserQuestion`

Générer le `client-slug` à partir du nom :

```bash
client_slug=$(echo "$client_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
```

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
