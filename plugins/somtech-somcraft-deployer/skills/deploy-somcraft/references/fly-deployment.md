# Fly.io Deployment Reference

Comment déployer l'image Docker SomCraft sur Fly.io.

## Image Docker

Le plugin déploie l'image publiée sur GitHub Container Registry :

```
ghcr.io/somtech-solutions/somcraft:X.Y.Z
```

où `X.Y.Z` est la `somcraftVersion` du plugin.

**Prérequis (externe au plugin)** : un pipeline CI dans le repo SomCraft qui publie cette image à chaque release tag `vX.Y.Z`. Si l'image n'existe pas, la commande échoue en Phase 4.

## Nom de l'app Fly

Convention :

- Staging : `somcraft-{client-slug}-staging`
- Production : `somcraft-{client-slug}` (sans suffixe)

## Génération du fly.toml

Template : `templates/fly-toml.tpl` (voir Task 7).

Substitutions :
- `{{APP_NAME}}` → `somcraft-{client-slug}-{env}`
- `{{PRIMARY_REGION}}` → `yul` (par défaut, ou lu depuis le `fly.toml` du client)
- `{{SOMCRAFT_VERSION}}` → version du plugin

Écrire dans `/tmp/fly-somcraft-{client-slug}-{env}.toml`.

## Créer l'app si nécessaire

```bash
FLY_APP="somcraft-{client-slug}-{env}"
FLY_ORG="{fly-org}"

if ! fly apps list | grep -q "$FLY_APP"; then
  fly apps create "$FLY_APP" --org "$FLY_ORG"
fi
```

## Configurer les secrets

Les secrets nécessaires :

| Secret                        | Source                                            |
|-------------------------------|---------------------------------------------------|
| `ANTHROPIC_API_KEY`           | Demandé à l'utilisateur ou lu depuis `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL`    | Construit depuis `project-ref`                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Demandé à l'utilisateur                         |
| `SUPABASE_SERVICE_ROLE_KEY`   | Demandé à l'utilisateur (sensible)                |
| `NEXTAUTH_SECRET`             | Généré : `openssl rand -base64 32`                |
| `SOMCRAFT_MCP_API_KEY`        | La clé générée en Phase 3                         |

```bash
fly secrets set \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  NEXT_PUBLIC_SUPABASE_URL="https://${PROJECT_REF}.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  SOMCRAFT_MCP_API_KEY="$SOMCRAFT_MCP_API_KEY" \
  -a "$FLY_APP"
```

**Important :** Pour récupérer les clés Supabase, lire `.env.local` du projet courant ou demander à l'utilisateur via `AskUserQuestion`. Ne JAMAIS les hardcoder.

## Déployer

```bash
fly deploy -a "$FLY_APP" \
  --image "ghcr.io/somtech-solutions/somcraft:$SOMCRAFT_VERSION" \
  --config "/tmp/fly-somcraft-{client-slug}-{env}.toml" \
  --strategy "immediate"
```

Le flag `--strategy immediate` évite les blue-green deploys longs en développement.

## Attendre que l'app soit healthy

```bash
MAX_RETRIES=12
RETRY_DELAY=10
for i in $(seq 1 $MAX_RETRIES); do
  STATUS=$(fly status -a "$FLY_APP" --json | jq -r '.Deployment.Status // "unknown"')
  if [ "$STATUS" = "successful" ]; then
    echo "App healthy après ${i}0s"
    break
  fi
  sleep $RETRY_DELAY
done
```

## Récupérer l'URL publique

```bash
APP_URL=$(fly info -a "$FLY_APP" --json | jq -r .Hostname)
echo "URL: https://$APP_URL"
```

## Gestion d'erreur

- Si `fly apps create` échoue, vérifier que l'org est correcte et que l'utilisateur a les permissions.
- Si `fly secrets set` échoue, afficher l'erreur (souvent un secret manquant).
- Si `fly deploy` échoue, Fly garde automatiquement la version précédente. Afficher un message : "Déploiement échoué. La version précédente reste active."
- Si l'app ne devient jamais healthy, afficher les logs : `fly logs -a "$FLY_APP" | tail -30`.
