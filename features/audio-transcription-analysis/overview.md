# Audio, Transcription & Analyse — Vue d'ensemble

## Description

Feature complète de gestion audio couvrant quatre couches fonctionnelles :

1. **Upload & stockage** — Upload de fichiers audio (MP3, WAV, M4A, OGG, WEBM) vers un bucket privé avec validation format/taille
2. **Transcription automatique** — Speech-to-text asynchrone avec identification des locuteurs (diarisation) via un fournisseur externe
3. **Analyse intelligente** — Génération d'analyses structurées (résumé, compte-rendu, notes d'appel, cahier des charges) via LLM, avec templates configurables et export PDF/DOCX
4. **Enregistrement direct** — Capture audio depuis le navigateur via MediaRecorder API, conversion en fichier et injection dans le flux d'upload existant

## Architecture globale

```
                                    +-----------------+
                                    |  Stockage privé |
                                    |  (bucket audio) |
                                    +--------+--------+
                                             ^
                                             |
              +------------------------------+------------------------------+
              |                                                             |
  +------------+     +-------------+    +----+----+    +------------------+ |
  |  Interface  | --> |   Hook      | -> | Edge Fn | -> | Fournisseur STT  | |
  |  Upload     |    | upload &    |    | transcr.|    | (Speech-to-Text) | |
  +------------+     | transcribe  |    +---------+    +------------------+ |
                      +------^------+         |                             |
                             |                | polling status              |
  +------------+     +------+------+          v                             |
  |  Interface  | --> |   Hook      |   +---------+                         |
  | Enregistrer |    | recorder    |   |   DB    |                         |
  | (micro)     |    | -> File ->  +-->| transcr.|                         |
  +------------+     | upload hook |   | + audio |                         |
                      +-------------+   +---------+                         |
                                              |                             |
                      +-------------+    +----v----+                        |
                      |  Interface  | <- |   DB    |                        |
                      |  Lecture &  |    | transcr.|                        |
                      |  Détail     |    | + audio |                        |
                      +------+------+    +---------+                        |
                             |                                              |
                      +------v------+    +---------+    +------------------+|
                      |  Template   | -> | Edge Fn | -> |   LLM Provider   ||
                      |  Picker     |    | analyse |    | (Claude/OpenAI)  ||
                      +-------------+    +----+----+    +------------------+|
                                              |                             |
                                              v                             |
                      +-------------+    +---------+                        |
                      | Vue analyse | <- | analyse |                        |
                      | structurée  |    |   DB    |                        |
                      +-------------+    +---------+                        |
                                              |                             |
                                         (optionnel)                        |
                                              v                             |
                                    +-----------------+                     |
                                    |  RAG Pipeline   |                     |
                                    |  chunks +       |                     |
                                    |  embeddings     |                     |
                                    +-----------------+                     |
```

**Point cle** : L'enregistrement direct ne cree pas de nouveau flux backend. Le hook `useAudioRecorder` capture l'audio via `MediaRecorder`, produit un `Blob` WEBM, le convertit en `File`, puis le passe au hook `useAudioTranscription.uploadAndTranscribe()` existant. Le backend est strictement identique.

## Stack technique

| Couche | Technologie | Role |
|--------|-------------|------|
| Frontend | React + TypeScript + Tailwind CSS | Interface utilisateur |
| State management | TanStack React Query | Cache, polling, mutations |
| UI Components | shadcn/ui | Composants de base (Dialog, ScrollArea, Tabs, etc.) |
| Enregistrement | MediaRecorder API (navigateur) | Capture audio micro |
| Stockage fichiers | Supabase Storage (bucket prive) | Fichiers audio |
| Base de donnees | PostgreSQL (Supabase) | Transcripts, analyses, templates |
| Edge Functions | Supabase Edge Functions (Deno) | Orchestration backend |
| Transcription | AssemblyAI API | Speech-to-text + diarisation |
| Analyse LLM | Anthropic Claude API | Generation d'analyses structurees |
| Embeddings | OpenAI API (text-embedding-3-small) | Vectorisation pour RAG |
| Export | pdf-lib + docx | Export PDF/DOCX |

## Modele de donnees (resume)

```
audio_files          1---1  transcripts          1---N  interaction_analyses
  - filename                  - utterances (JSONB)        - template_slug
  - file_path                 - speaker_names              - structured_output (JSONB)
  - format                    - speaker_contacts           - summary_text
  - source (upload|recording) - status                     - todos (JSONB)
  - transcription_status      - metadata                   - status
  - assemblyai_transcript_id
                              |                            |
                              v                            v
                         interactions               analysis_templates
                           - sujet                     - slug
                           - type                      - prompt_template
                           - client_id                 - output_schema (JSON Schema)
                           |                           - options
                           v
                        entreprises              interaction_analysis_chunks
                          - nom                    - content
                                                   - embedding (VECTOR 1536)
                                                   - chunk_index
```

## Flux principaux

### 1. Upload & Transcription

1. L'utilisateur selectionne un fichier audio (drag-and-drop ou file picker)
2. Il choisit de creer une nouvelle interaction ou d'en lier une existante
3. Le fichier est uploade vers le bucket prive Supabase Storage
4. Une Edge Function cree les enregistrements DB et soumet le fichier au fournisseur STT
5. Le fournisseur traite en asynchrone (1-5 minutes selon la duree)
6. Le client poll le statut via GET sur l'Edge Function
7. Quand termine : les utterances, speaker_names et metadata sont stockes dans `transcripts`

### 2. Lecture & Edition

1. L'utilisateur selectionne un audio dans la bibliotheque
2. Le player charge le fichier via URL signee temporaire (1h)
3. Le transcript s'affiche avec diarisation (speaker + timestamps)
4. L'utilisateur peut renommer les speakers et les associer a des contacts
5. Les proprietes de l'interaction (entreprise, sujet, type, date) sont editables

### 3. Analyse de transcript

1. L'utilisateur clique "Ajouter une analyse" sur un transcript
2. Un modal affiche les templates disponibles par categorie
3. L'utilisateur selectionne un template (ex: "Resume", "Compte-rendu de reunion")
4. L'Edge Function formate le transcript, interpole le prompt template, appelle le LLM
5. Le resultat structure (JSON) est stocke et affiche dans un renderer specialise
6. L'utilisateur peut exporter en PDF ou DOCX

### 4. Enregistrement direct

1. L'utilisateur clique "Enregistrer" dans la bibliotheque audio
2. Un dialog s'ouvre et demande l'acces au microphone (`navigator.mediaDevices.getUserMedia`)
3. L'utilisateur demarre l'enregistrement — un timer et un visualiseur de volume s'affichent
4. Il peut mettre en pause/reprendre l'enregistrement
5. A l'arret, le `MediaRecorder` produit un `Blob` au format WEBM (codec Opus)
6. Le blob est converti en `File` avec un nom genere (`recording_YYYYMMDD_HHmmss.webm`)
7. Le `File` est passe a `uploadAndTranscribe()` — meme flux que l'upload classique
8. La colonne `audio_files.source` est renseignee a `'recording'` (vs `'upload'` pour un fichier importe)

### 5. Pipeline RAG (optionnel)

1. L'utilisateur active le RAG sur une analyse
2. Le texte est decoupe en chunks
3. Chaque chunk recoit un embedding vectoriel (OpenAI)
4. Les chunks sont stockes pour la recherche semantique

## Decisions architecturales cles

### Traitement asynchrone avec polling

Le fournisseur STT traite en asynchrone. Plutot qu'un webhook (qui necesite une URL publique stable), le pattern retenu est le **polling client** :
- L'Edge Function retourne immediatement apres soumission
- Le client poll toutes les 5 secondes via GET
- L'Edge Function verifie le statut aupres du fournisseur et met a jour la DB si termine

**Pourquoi** : Plus simple a deployer, pas de dependance a une URL publique, fonctionne avec n'importe quel hebergement.

### URLs signees pour l'acces aux fichiers

Les fichiers audio sont dans un bucket **prive**. L'acces se fait via des URLs signees temporaires (1h d'expiration). Cela garantit que seuls les utilisateurs authentifies peuvent lire les fichiers.

### Templates d'analyse en base de donnees

Les templates ne sont pas hard-codes dans le code mais stockes en DB avec :
- Un `prompt_template` avec placeholders (`{{transcript}}`, `{{speaker_names}}`)
- Un `output_schema` (JSON Schema) pour valider la sortie du LLM
- Des `options` de configuration (timestamps, noms de speakers, tokens max)

**Pourquoi** : Permet d'ajouter/modifier des templates sans deploiement, et de laisser les utilisateurs creer leurs propres templates.

### Enregistrement via MediaRecorder sans nouveau flux backend

L'enregistrement direct reutilise le flux d'upload existant. Le `MediaRecorder` produit un `Blob` WEBM qui est converti en `File` et passe a `uploadAndTranscribe()`. Il n'y a pas d'Edge Function, d'endpoint ou de route specifique a l'enregistrement.

**Pourquoi** : Evite la duplication du flux backend. Le format WEBM/Opus est nativement supporte par les navigateurs modernes et par le fournisseur STT (AssemblyAI). L'ajout du format WEBM dans la contrainte CHECK de `audio_files.format` suffit.

**Compromis** : Le WEBM n'est pas un format audio universel (pas lu par tous les players natifs OS). Cependant, le player de l'application est un element `<audio>` HTML5 qui supporte WEBM nativement. Si l'export vers un player externe est necessaire, une conversion cote serveur pourrait etre ajoutee ulterieurement.

### Separation transcription / analyse

La transcription (STT) et l'analyse (LLM) sont deux etapes separees :
- Un audio peut exister sans analyse
- Plusieurs analyses peuvent etre generees a partir du meme transcript
- Les analyses sont liees au transcript via `interaction_id`, pas directement a `audio_files`

### Snapshot du transcript pour les analyses

Quand une analyse est generee, le texte du transcript est copie dans `combined_text_snapshot`. Cela fige le contenu au moment de l'analyse, meme si le transcript est modifie ensuite.

## Limites connues

- **Taille max fichier** : 100 MB
- **Formats supportes** : MP3, WAV, M4A, OGG, WEBM
- **Timeout polling** : 5 minutes max (60 tentatives x 5 secondes)
- **Expiration URL signee** : 1 heure (le player doit etre recharge pour les sessions longues)
- **Templates systeme** : Non modifiables par les utilisateurs (flag `is_system`)
- **Enregistrement** : Necessite un navigateur supportant `MediaRecorder` + codec Opus (Chrome, Firefox, Edge). Safari supporte MediaRecorder depuis la version 14.5 mais peut utiliser un codec different (MP4/AAC)

## Alternatives considerees

| Decision | Alternative | Raison du choix |
|----------|-------------|-----------------|
| AssemblyAI | OpenAI Whisper, Google STT, AWS Transcribe | Prix competitif, diarisation native de bonne qualite |
| Polling | Webhooks | Simplicite de deploiement, pas de dependance URL publique |
| Templates en DB | Templates hard-codes | Flexibilite, personnalisation utilisateur |
| Bucket prive + URLs signees | Bucket public | Securite des fichiers audio |
| Claude API pour analyses | GPT-4 | Meilleure adherence aux instructions structurees JSON |
| MediaRecorder (WEBM natif) | Conversion WAV cote client | Taille fichier 5-10x plus petite, pas de librairie tierce |
| Reutilisation flux upload | Endpoint dedie enregistrement | Zero code backend additionnel, meme pipeline |
