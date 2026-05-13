# Audio Transcription & Analyse

> Blueprint de feature réutilisable pour ajouter à un projet Somtech une capacité d'upload audio, transcription speech-to-text avec diarisation, et analyse LLM structurée.

## Statut

✅ **Actif** — feature utilisée comme référence d'implémentation par les projets Somtech qui ont besoin de traiter de l'audio (transcription, analyse de réunions, dictée, etc.).

Dernière mise à jour fonctionnelle : 2026-02 (référence stable). Pas de skill de déploiement automatisé associé à ce jour — l'implémentation se fait manuellement en suivant le guide.

## Stack visée

- **DB** : Supabase Postgres + Storage
- **Speech-to-Text** : AssemblyAI (transcription + diarisation, ~$0.37/heure)
- **LLM** : Anthropic Claude (analyses structurées)
- **Embeddings** (optionnel) : OpenAI
- **Frontend** : React + TypeScript + TanStack React Query + shadcn/ui

## Contenu du blueprint

| Fichier | Contenu |
|---------|---------|
| `implementation-guide.md` | Guide pas-à-pas complet (migrations DB, Edge Functions, frontend) |
| `database.md` | Schéma SQL des tables `audio_files`, `transcriptions`, `analyses`, RLS, indexes |
| `backend.md` | Edge Functions Supabase, patterns d'instrumentation, gestion d'état long-running |
| `frontend.md` | Composants React, hooks React Query, gestion d'upload progressive |
| `api-providers.md` | Comparatif AssemblyAI / Anthropic / OpenAI, coûts, limites, alternatives |

## Comment l'utiliser

1. Cloner ou pull le somtech-pack dans le projet cible : `/somtech-pack-maj` ou `./scripts/somtech_pack_pull.sh --target .`
2. Lire `implementation-guide.md` du début à la fin avant de coder
3. Suivre les phases dans l'ordre (Phase 1 : DB + Storage → Phase 2 : Backend → Phase 3 : Frontend)
4. Adapter les noms de tables / endpoints au domaine du projet client

## Projets qui consomment ce blueprint

(à compléter quand un projet client l'utilise pour permettre l'audit cross-repo)

## Pour aller plus loin

- Skill associé à créer (TODO) : `/deploy-audio-transcription` qui automatiserait la mise en place (migrations + Edge Functions + composants) — à mettre en demande ServiceDesk si le besoin se concrétise
- Voir aussi : `features/metering-billing/` pour facturer l'usage AssemblyAI/Anthropic au token
