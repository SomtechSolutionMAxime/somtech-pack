---
name: rag
description: >
  Connaissances sur le Somtech RAG Service — indexation de documents,
  recherche sémantique, génération de réponses sourcées. Utiliser quand
  on travaille avec le RAG Service, qu'on cherche comment l'appeler,
  comment déboguer, ou comment il cohabite avec Somcraft.
  TRIGGERS : RAG, document_chunks, rag_search, rag_push_document,
  hybrid search, embeddings, pgvector, somtech-rag-service, RagClient
version: 0.1.0
---

# Somtech RAG Service — Guide de référence

## 1. Vue d'ensemble

Le **Somtech RAG Service** est un service d'infrastructure qui permet à n'importe quel projet Somtech (Somcraft, Orbit, Cowork, agents Claude Code) d'interroger la base documentaire d'un client et d'obtenir des réponses sourcées.

**Ce qu'il fait :**
- Indexation : convertit des documents Markdown en chunks vectorisés
- Recherche : hybrid search (vector + full-text) sur les chunks
- Génération : Claude répond à une question en citant les sources

**Ce qu'il n'est pas :**
- Pas un module de Somcraft — c'est un service indépendant
- Pas multi-tenant centralisé — une instance par client × environnement
- Pas un remplaçant pour l'accès direct aux fichiers (ça reste Somcraft)

Stack : Fly.io, Node.js/TypeScript, Express, LangChain.js, pgvector, OpenAI embeddings, Claude pour la génération.

## 2. Architecture multi-client × multi-environnement

**Pattern : une instance Fly.io par client × environnement.**

Naming : `rag-<client>-<env>` où env ∈ {dev, staging, prod}.

Chaque instance :
- Tourne sur Fly.io avec son propre déploiement
- Se connecte au Supabase du client pour le même environnement
- N'a aucune notion de `tenant_id` — isolation par instance, pas par colonne

Exemple pour le client `acme` :

```
rag-acme-dev      → Supabase acme-dev
rag-acme-staging  → Supabase acme-staging
rag-acme-prod     → Supabase acme-prod
```

Les instances sont déployées via `/deploy-rag` qui provisionne tout automatiquement.

## 3. Comment trouver l'URL du RAG pour un projet

1. **Chercher `RAG.md`** à la racine du projet client — ce fichier est généré par `/deploy-rag` et contient un tableau avec toutes les URLs par environnement.
2. **Fallback via Fly.io** : `fly apps list --org somtech | grep rag-<client>`
3. **Dernière option** : demander à l'utilisateur.

Ne jamais deviner l'URL — toujours vérifier qu'elle existe.

## 4. Cohabitation avec Somcraft

Le RAG et Somcraft sont complémentaires, pas redondants.

| Somcraft | RAG Service |
|----------|-------------|
| Interface documentaire | Service d'indexation + recherche |
| Conversion PDF → Markdown | Chunking + embeddings |
| Édition, validation, versionnage | Hybrid search + génération |
| Stockage des fichiers originaux | Stockage des chunks vectorisés |

**Flux d'un document :** Somcraft convertit le PDF en `.md` → l'utilisateur clique "Pousser au RAG" → Somcraft appelle l'API REST du RAG Service → le RAG chunke, embed, et stocke → met à jour `documents.rag_status = 'indexed'`.

**Colonnes de Somcraft liées au RAG** (sur la table `documents`) :
- `rag_status` — `null | rag_ready | indexing | indexed | outdated`
- `rag_version`, `rag_indexed_at`, `rag_chunk_count`, `rag_notes`

## 5. Pour aller plus loin

Les détails approfondis sont dans les fichiers de référence :

- **`references/api-usage.md`** — Comment appeler le RAG (REST, MCP, client SDK TypeScript) avec exemples complets
- **`references/troubleshooting.md`** — Debug, seuils de confiance, erreurs courantes
- **`references/when-to-use.md`** — Quand utiliser le RAG vs Somcraft vs DB directe vs Claude direct

## 6. Choisir le bon environnement

Règle d'or : **ne jamais croiser les environnements**.

| Contexte | Utiliser |
|----------|----------|
| Développement local | `rag-<client>-dev` |
| Staging / QA | `rag-<client>-staging` |
| Production | `rag-<client>-prod` |

Un frontend en dev appelle un RAG en dev. Un frontend en prod appelle un RAG en prod. Jamais l'inverse.
