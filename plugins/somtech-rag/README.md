# somtech-rag

Plugin Claude Code pour déployer et documenter le **Somtech RAG Service** — un service d'indexation + recherche + génération basé sur LangChain.js, pgvector, et Claude.

## Fonctionnalités

### Command `/deploy-rag`

Provisionne une instance complète du RAG Service pour un client × environnement donné :

1. Collecte les paramètres (client, env, Supabase, Fly.io org, clés API)
2. Applique la migration RAG sur le Supabase du client (via MCP)
3. Crée l'app Fly.io et set les secrets
4. Déploie et vérifie le health check
5. Génère/met à jour `RAG.md` dans le projet client

**Idempotent** : relancer sur un déploiement existant met à jour sans casser.

### Skill `rag`

Skill de connaissance qui explique :
- Architecture du RAG Service
- Cohabitation avec Somcraft
- Comment appeler le service (REST, MCP, client SDK)
- Debug et troubleshooting
- Quand utiliser le RAG vs autre chose

Détails approfondis dans `skills/rag/references/` :
- `api-usage.md` — exemples complets pour les 3 modes d'appel
- `troubleshooting.md` — erreurs courantes et debug
- `when-to-use.md` — matrice de décision

## Usage

```bash
# Déployer un nouvel env dev pour le client acme
/deploy-rag acme dev

# Déployer staging (ajoute au RAG.md existant)
/deploy-rag acme staging

# Interactif (demande tout)
/deploy-rag
```

## Stack supporté

- **Runtime** : Fly.io (Montreal `yul`)
- **Base de données** : Supabase (pgvector)
- **Pipeline** : LangChain.js (MarkdownTextSplitter + OpenAIEmbeddings)
- **Génération** : Claude (Anthropic SDK)
- **MCP** : `@modelcontextprotocol/sdk`
- **Client SDK** : `@somtech/rag-client` (GitHub Packages)

## Pré-requis

- `fly` CLI authentifié (`fly auth whoami`)
- MCP Supabase configuré avec accès au project_ref du client
- Clés API : OpenAI, Anthropic (partagées Somtech ou propres au client)
- Repo `ragservice` cloné localement (`~/GitRepo.nosync/ragservice`)

## Architecture par client

```
Client "acme" :
  rag-acme-dev      → Supabase acme-dev       (Fly.io)
  rag-acme-staging  → Supabase acme-staging   (Fly.io)
  rag-acme-prod     → Supabase acme-prod      (Fly.io)
```

Une instance Fly.io par client × environnement, connectée au Supabase du client pour le même env. Pas de multi-tenant — isolation par instance.

## Version

- **v0.2.0** (2026-04-10) — `/deploy-rag` utilise l'image GHCR (`ghcr.io/somtech-solutions/ragservice`) au lieu de builder localement. Support du flag `--version` pour pinner une version spécifique. Ajout de commandes de diagnostic d'image dans `troubleshooting.md`.
- **v0.1.0** (2026-04-10) — Version initiale. `/deploy-rag` + skill `rag` avec références.

## Liens

- **Repo du service** : https://github.com/Somtech-Solutions/ragservice
- **Design spec** : `ragservice/docs/superpowers/specs/2026-04-09-rag-service-design.md`
- **Design du plugin** : `ragservice/docs/superpowers/specs/2026-04-10-deploy-rag-skill-design.md`
