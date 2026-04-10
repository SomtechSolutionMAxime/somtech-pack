---
description: Déployer le Somtech RAG Service pour un client × environnement donné. Provisionne Fly.io, applique la migration Supabase via MCP, set les secrets, déploie, vérifie le health check, et génère/met à jour RAG.md dans le projet client.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: "[client] [env] [--version X.Y.Z]"
---

# /deploy-rag — Déploiement RAG Service par client

Ce slash command provisionne une instance complète du Somtech RAG Service pour un **client** + **environnement** donné. Il est idempotent : ré-exécuter sur un déploiement existant met à jour sans casser.

**Ce que fait ce command :**

1. Collecte les paramètres (client, env, Supabase, Fly.io org, clés API)
2. Applique la migration RAG sur le Supabase du client (via MCP)
3. Provisionne Fly.io (create app, set secrets, deploy)
4. Vérifie le health check
5. Génère/met à jour `RAG.md` dans le projet client
6. Affiche un récapitulatif

**Pré-requis :**

- Le repo `ragservice` doit être cloné localement (par défaut : `~/GitRepo.nosync/ragservice`)
- `fly` CLI installé et authentifié (`fly auth whoami`)
- MCP Supabase configuré avec accès au project_ref du client
- Clés OpenAI et Anthropic (soit partagées Somtech dans `~/.claude/memory/somtech-api-keys.env`, soit fournies à la demande)

---

## Étape 1 — Collecte des paramètres

### Paramètres

| Paramètre | Requis | Source | Défaut |
|-----------|--------|--------|--------|
| `client` | oui | argument ou question | — |
| `env` | oui | argument ou question | — (dev/staging/prod) |
| `supabase_project_ref` | oui | question | — |
| `fly_org` | non | question | `somtech` |
| `openai_api_key` | non | fichier ou question | clé Somtech partagée |
| `anthropic_api_key` | non | fichier ou question | clé Somtech partagée |
| `client_project_path` | non | question | `~/GitRepo.nosync/<client>` |
| `version` | non | argument `--version X.Y.Z` | `latest` en dev/staging ; demandé pour prod |

### Logique

**Si l'utilisateur a passé des arguments** (ex: `/deploy-rag acme dev`), utiliser :
- Premier argument positionnel = `client`
- Deuxième argument positionnel = `env`
- Flag `--version <X.Y.Z>` = version de l'image à déployer (optionnel)

**Détermination de la version** :
- Si `--version` est passé → utiliser cette version (ex: `0.1.0`)
- Sinon si `env` = `dev` ou `staging` → utiliser `latest`
- Sinon si `env` = `prod` → demander à l'utilisateur : "Version à déployer (défaut: latest, recommandé: pinner une version précise comme 0.1.0)"

**Sinon**, demander interactivement avec `AskUserQuestion` :

1. Nom du client (ex: `acme`, `construction-gauthier`)
2. Environnement : multi-choice dev / staging / prod
3. Supabase project_ref pour cet environnement
4. Fly.io org (défaut `somtech`, possibilité d'override)

**Pour les clés API** :

- Lire `~/.claude/memory/somtech-api-keys.env` s'il existe
- Si le fichier n'existe pas, demander à l'utilisateur OpenAI et Anthropic
- Offrir d'override les clés Somtech si le client a ses propres clés

**Format du fichier `somtech-api-keys.env`** :

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Validation

Avant de continuer, valider que :

- Le `client` est un identifiant valide (minuscules, tirets, pas d'espaces)
- `env` ∈ {dev, staging, prod}
- Le `supabase_project_ref` ressemble à un ref Supabase (20 caractères alphanumériques)
- `fly auth whoami` retourne un utilisateur valide

Si une validation échoue, afficher l'erreur et demander à nouveau.

---

## Étape 2 — Appliquer la migration RAG

### Vérifier si la table existe déjà

Utiliser `mcp__supabase__list_tables` avec le `project_ref` du client :

```
mcp__supabase__list_tables(
  project_id: "<supabase_project_ref>",
  schemas: ["public"]
)
```

Si `document_chunks` est dans la liste → **skip** cette étape, afficher "Migration RAG déjà appliquée".

### Lire le contenu de la migration

Lire le fichier `supabase/migrations/00001_document_chunks.sql` depuis le repo `ragservice` (par défaut `~/GitRepo.nosync/ragservice/supabase/migrations/00001_document_chunks.sql`).

### Appliquer via MCP

```
mcp__supabase__apply_migration(
  project_id: "<supabase_project_ref>",
  name: "rag_document_chunks",
  query: "<contenu du fichier SQL>"
)
```

### Gestion d'erreurs

- Si l'erreur contient "already exists" → c'est OK, continuer
- Si l'erreur contient "permission denied" → escalader : le project_ref est mauvais ou le MCP Supabase n'a pas les droits
- Toute autre erreur → afficher l'erreur complète et demander confirmation avant de continuer

---

## Étape 3 — Provisionner Fly.io

### Récupérer la clé anon Supabase

```
mcp__supabase__get_publishable_keys(
  project_id: "<supabase_project_ref>"
)
```

Extraire la `anon_key` du résultat.

### Créer l'app Fly.io

```bash
fly apps create rag-<client>-<env> --org <fly_org>
```

**Gestion d'erreurs :**
- Si l'erreur contient `already exists` ou `name is already taken` → OK, continuer
- Sinon → escalader

### Set les secrets

```bash
fly secrets set \
  SUPABASE_URL="https://<supabase_project_ref>.supabase.co" \
  SUPABASE_ANON_KEY="<anon_key>" \
  OPENAI_API_KEY="<openai_key>" \
  ANTHROPIC_API_KEY="<anthropic_key>" \
  --app rag-<client>-<env>
```

**Important** : Ne jamais logger les valeurs des clés. Afficher seulement `"Secrets set for rag-<client>-<env>"`.

### Deploy depuis l'image GHCR

```bash
fly deploy --app rag-<client>-<env> \
  --image ghcr.io/somtech-solutions/ragservice:<version>
```

Où `<version>` est `latest` par défaut ou la version spécifiée par `--version`.

**Pas de build local** : Fly.io pull l'image publique depuis GitHub Container Registry. Le déploiement prend ~10-30 secondes au lieu de ~2 minutes (vs l'ancien flux avec build).

Si Fly.io retourne une erreur de pull (image introuvable), vérifier :
- Que le package `ragservice` est bien public sur GHCR (`github.com/orgs/Somtech-Solutions/packages`)
- Que le tag existe (`docker pull ghcr.io/somtech-solutions/ragservice:<version>`)

Attendre la fin du déploiement. Si échec, afficher `fly logs -a rag-<client>-<env>` et escalader.

---

## Étape 4 — Vérifier le health check

Attendre 5 secondes après le déploiement, puis :

```bash
curl -f https://rag-<client>-<env>.fly.dev/rag/health
```

Réponse attendue :
```json
{"status":"ok","timestamp":"..."}
```

**Si échec** : retry 2 fois avec 5s d'intervalle. Si toujours échec après 3 tentatives, afficher les logs et escalader.

---

## Étape 5 — Générer/mettre à jour `RAG.md` dans le projet client

### Déterminer le chemin

Par défaut : `~/GitRepo.nosync/<client>/RAG.md`

Si le dossier n'existe pas, demander à l'utilisateur le chemin correct.

### Lire le template

Lire `templates/RAG.md.tpl` depuis ce plugin (chemin relatif au plugin : `../templates/RAG.md.tpl`).

### Logique de génération

**Cas 1 — `RAG.md` n'existe pas** :

Créer le fichier à partir du template avec les placeholders remplis pour l'environnement courant. Les autres environnements gardent les placeholders `—` et `⏳`.

Placeholders à remplacer :
- `{{CLIENT}}` → nom du client
- `{{DEV_URL}}`, `{{STAGING_URL}}`, `{{PROD_URL}}` → URL ou `—`
- `{{DEV_PROJECT_REF}}`, `{{STAGING_PROJECT_REF}}`, `{{PROD_PROJECT_REF}}` → project_ref ou `—`
- `{{DEV_DATE}}`, `{{STAGING_DATE}}`, `{{PROD_DATE}}` → date ou `⏳`

Pour l'environnement courant, remplir avec les vraies valeurs. Pour les autres envs, mettre `—` pour les URL/ref et `⏳` pour la date.

**Cas 2 — `RAG.md` existe déjà** :

Lire le fichier existant. Identifier la ligne du tableau correspondant à l'environnement courant.

Remplacer uniquement cette ligne (URL, project_ref, date) en gardant les autres lignes intactes.

**Règle** : ne jamais écraser une section autre que le tableau des environnements et le snippet `.mcp.json`.

### Format de la date

Utiliser la date du jour au format `YYYY-MM-DD`.

---

## Étape 6 — Output final

Afficher un récapitulatif formaté :

```
✅ RAG Service déployé avec succès

Client    : <client>
Env       : <env>
URL       : https://rag-<client>-<env>.fly.dev
Supabase  : <project_ref>
Fly.io    : rag-<client>-<env> (org: <fly_org>)

📋 Prochaines étapes :

  1. Copier le snippet .mcp.json dans ton projet client
  2. Vérifier que le Somcraft du client a la v2 avec l'intégration RAG
     (colonnes rag_status, bouton "Pousser au RAG")
  3. Tester une indexation : rag_push_document via MCP

📄 Détails complets dans : <client_project_path>/RAG.md
📘 Documentation : skill `rag` (plugin somtech-rag)
```

---

## Idempotence

Ce command doit être **100 % idempotent**. Lancer deux fois de suite la même commande doit :

- Skip la migration si la table existe
- Skip la création de l'app Fly.io si elle existe
- Update les secrets (ok, c'est idempotent)
- Redeploy
- Mettre à jour la ligne correspondante dans `RAG.md` sans toucher les autres

Lancer sur des environnements différents du même client doit ajouter les lignes sans écraser les autres.

---

## Gestion d'erreurs — Philosophie

**Préférer escalader à l'utilisateur plutôt que retry indéfiniment.**

Pour chaque erreur :

1. Afficher un message clair indiquant ce qui a échoué
2. Afficher la commande manuelle pour reproduire / diagnostiquer
3. Demander à l'utilisateur comment procéder (retry, skip, abort)

Ne **jamais** :

- Logger des clés API ou secrets
- Continuer silencieusement après une erreur critique
- Écraser des fichiers du projet client hors `RAG.md`

---

## Sécurité

- Les clés API (OpenAI, Anthropic) ne sont jamais loggées ni affichées
- Le fichier `~/.claude/memory/somtech-api-keys.env` doit avoir permissions `600`
- Le `RAG.md` généré ne contient pas de secrets
- Les secrets Fly.io sont set via `fly secrets set` (pas visibles dans `fly.toml`)
