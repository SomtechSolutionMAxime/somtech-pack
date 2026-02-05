# Audio, Transcription & Analyse — Base de donnees

## Vue d'ensemble du schema

Le modele de donnees s'articule autour de 6 tables principales, reliees par des cles etrangeres. Le concept central est l'**interaction** (un evenement metier : appel, reunion, etc.) qui sert de pivot entre l'audio, le transcript et les analyses.

```
audio_files ──> transcripts ──> interactions ──> entreprises
                    │
                    └──> interaction_analyses ──> analysis_templates
                              │
                              └──> interaction_analysis_chunks
```

---

## Tables

### 1. `audio_files`

Stocke les metadonnees des fichiers audio uploades. Le fichier physique est dans le bucket Storage.

```sql
CREATE TABLE audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('MP3', 'WAV', 'M4A', 'OGG', 'WEBM')),
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'recording')),
  duration_seconds INTEGER,
  assemblyai_transcript_id TEXT,
  transcription_status TEXT DEFAULT 'pending'
    CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  transcription_error TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Colonne | Type | Description |
|---------|------|-------------|
| `file_path` | TEXT | Chemin dans le bucket Storage. Format: `{user_id}/{timestamp}_{filename}` |
| `format` | TEXT | Format audio valide (MP3, WAV, M4A, OGG, WEBM). WEBM est le format natif du `MediaRecorder` navigateur |
| `source` | TEXT | Origine du fichier : `upload` (fichier importe) ou `recording` (capture micro navigateur). Default: `upload` |
| `assemblyai_transcript_id` | TEXT | ID de transcription chez le fournisseur STT. Utilise pour le polling |
| `transcription_status` | TEXT | Cycle de vie: `pending` -> `processing` -> `completed` / `failed` |
| `transcription_error` | TEXT | Message d'erreur si `status = failed` |
| `document_id` | UUID | Lien optionnel vers un document (flux legacy sans interaction) |
| `created_by` | UUID | Proprietaire du fichier (utilisateur authentifie) |

**Notes** :
- `document_id` est utilise dans un flux alternatif ou l'audio genere un document Markdown. Dans le flux principal (interaction-based), ce champ est NULL.
- `assemblyai_transcript_id` est specifique au fournisseur. Adapter selon le provider choisi.

---

### 2. `transcripts`

Stocke le contenu transcrit, les utterances (diarisation) et le mapping des speakers.

```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL UNIQUE REFERENCES interactions(id),
  texte TEXT NOT NULL DEFAULT '',
  source TEXT CHECK (source IN ('audio', 'manuel')),
  audio_file_id UUID REFERENCES audio_files(id),
  audio_file_path TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  metadata JSONB,

  -- Diarisation
  utterances JSONB DEFAULT '[]'::jsonb,
  speaker_names JSONB DEFAULT '{}'::jsonb,
  speaker_contacts JSONB DEFAULT '{}'::jsonb,

  -- RAG
  rag_enabled BOOLEAN DEFAULT FALSE,
  rag_enabled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Colonne | Type | Description |
|---------|------|-------------|
| `interaction_id` | UUID (UNIQUE) | Relation 1:1 avec l'interaction. Un transcript par interaction |
| `texte` | TEXT | Texte brut complet de la transcription |
| `source` | TEXT | Origine: `audio` (automatique) ou `manuel` (saisi a la main) |
| `utterances` | JSONB | Array d'objets diarisation (voir structure ci-dessous) |
| `speaker_names` | JSONB | Mapping speaker_id -> nom affiche (`{"A": "Maxime", "B": "Client"}`) |
| `speaker_contacts` | JSONB | Mapping speaker_id -> UUID contact (`{"A": "uuid-123"}`) |
| `metadata` | JSONB | Metadonnees fournisseur (confidence, language, file_size_mb, speaker_count) |

**Structure d'une utterance** :

```json
{
  "speaker": "A",
  "text": "Bonjour, comment puis-je vous aider ?",
  "start": 0,
  "end": 3500,
  "confidence": 0.95
}
```

- `start` et `end` sont en **millisecondes**
- `speaker` est un identifiant attribue par le fournisseur STT (A, B, C...)
- `confidence` est optionnel (0-1)

**Indexes** :

```sql
-- Recherche full-text dans les utterances
CREATE INDEX idx_transcripts_utterances ON transcripts USING GIN (utterances);

-- Filtre rapide: transcripts avec diarisation
CREATE INDEX idx_transcripts_has_utterances ON transcripts
  ((utterances != '[]'::jsonb))
  WHERE utterances != '[]'::jsonb;
```

---

### 3. `analysis_templates`

Templates configurables pour generer des analyses structurees a partir des transcripts.

```sql
CREATE TABLE analysis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  prompt_template TEXT NOT NULL,
  output_schema JSONB,
  example_output JSONB,
  options JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  average_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Colonne | Type | Description |
|---------|------|-------------|
| `slug` | VARCHAR (UNIQUE) | Identifiant machine du template (ex: `summary`, `meeting-minutes`) |
| `category` | VARCHAR | Categorie pour le regroupement UI: `general`, `meeting`, `sales`, `support`, `interview` |
| `prompt_template` | TEXT | Prompt avec placeholders `{{transcript}}`, `{{speaker_names}}`, `{{#if var}}...{{/if}}` |
| `output_schema` | JSONB | JSON Schema definissant la structure de sortie attendue du LLM |
| `options` | JSONB | Configuration: `include_timestamps`, `include_speaker_names`, `max_output_tokens` |
| `is_system` | BOOLEAN | Templates systeme non modifiables par les utilisateurs |
| `usage_count` | INTEGER | Compteur d'utilisations pour analytics |

**Templates systeme fournis** :

| Slug | Nom | Categorie | Structure de sortie |
|------|-----|-----------|---------------------|
| `summary` | Resume | general | `{title, overview, context, key_points[], conclusions[]}` |
| `meeting-minutes` | Compte-rendu de reunion | meeting | `{title, actions[{assignee, task, deadline, priority}], decisions[], summary[], next_steps[]}` |
| `call-notes` | Notes d'appel | sales | `{summary, topics_discussed[], objections[], action_items[], follow_up{required, suggested_date, notes}}` |
| `cahier-des-charges` | Cahier des charges | sales | `{title, context{client_profile, needs[], objectives[]}, scope{features[], integrations[]}, constraints{technical[], budget, timeline}, success_criteria[]}` |

**RLS Policies** :

```sql
-- Lecture: templates systeme + publics + les siens
CREATE POLICY "select_templates" ON analysis_templates FOR SELECT USING (
  is_system = TRUE OR is_public = TRUE OR created_by = auth.uid()
);

-- Ecriture: seulement ses propres templates non-systeme
CREATE POLICY "insert_templates" ON analysis_templates FOR INSERT
  WITH CHECK (created_by = auth.uid() AND is_system = FALSE);

CREATE POLICY "update_templates" ON analysis_templates FOR UPDATE USING (
  created_by = auth.uid() AND is_system = FALSE
);

CREATE POLICY "delete_templates" ON analysis_templates FOR DELETE USING (
  created_by = auth.uid() AND is_system = FALSE
);
```

---

### 4. `interaction_analyses`

Stocke les analyses generees, liees a une interaction et un template.

```sql
CREATE TABLE interaction_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES interactions(id),
  transcript_scope TEXT CHECK (transcript_scope IN ('all', 'single')),
  transcript_id UUID REFERENCES transcripts(id),
  prompt_id UUID,
  template_id UUID REFERENCES analysis_templates(id),
  template_slug VARCHAR(100),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  combined_text_snapshot TEXT,
  summary_text TEXT,
  structured_output JSONB,
  todos JSONB,
  created_by UUID REFERENCES auth.users(id),
  rag_enabled BOOLEAN DEFAULT FALSE,
  rag_enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Colonne | Type | Description |
|---------|------|-------------|
| `transcript_scope` | TEXT | `all` = tous les transcripts de l'interaction, `single` = un seul |
| `template_slug` | VARCHAR | Slug du template utilise (denormalise pour queries rapides) |
| `combined_text_snapshot` | TEXT | Copie figee du transcript au moment de l'analyse |
| `structured_output` | JSONB | Sortie JSON structuree du LLM, conforme au `output_schema` du template |
| `summary_text` | TEXT | Resume en texte brut (extraction du structured_output) |
| `todos` | JSONB | Action items extraits (pour affichage rapide) |
| `rag_enabled` | BOOLEAN | Si TRUE, les chunks et embeddings ont ete generes |

---

### 5. `interaction_analysis_chunks`

Chunks decoupes a partir des analyses pour la recherche semantique (RAG).

```sql
CREATE TABLE interaction_analysis_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES interaction_analyses(id) ON DELETE CASCADE,
  interaction_id UUID NOT NULL REFERENCES interactions(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

| Colonne | Type | Description |
|---------|------|-------------|
| `chunk_index` | INTEGER | Ordre du chunk dans l'analyse |
| `content` | TEXT | Texte du chunk |
| `embedding` | VECTOR(1536) | Embedding OpenAI (text-embedding-3-small, 1536 dimensions) |
| `token_count` | INTEGER | Nombre de tokens du chunk |

**Note** : Necessite l'extension `pgvector` pour le type VECTOR.

---

### 6. Tables de support

#### `interactions`

Table pivot reliant l'audio a son contexte metier.

```sql
-- Colonnes cles
id UUID PRIMARY KEY,
sujet TEXT,
type TEXT,                    -- 'appel', 'courriel', 'rencontre', 'message texte', 'LinkedIn'
date_interaction DATE,
client_id UUID REFERENCES entreprises(id),
notes TEXT,
created_by UUID REFERENCES auth.users(id)
```

#### `entreprises`

Organisation cliente.

```sql
-- Colonnes cles
id UUID PRIMARY KEY,
nom TEXT NOT NULL,
email TEXT,
adresse TEXT,
code_postal TEXT,
province TEXT,
pays TEXT
```

#### `analysis_prompts`

Prompts personnalises (alternatif aux templates systeme).

```sql
id UUID PRIMARY KEY,
name TEXT NOT NULL,
type TEXT CHECK (type IN ('analysis', 'transcription')),
prompt_text TEXT NOT NULL,
is_active BOOLEAN DEFAULT TRUE,
created_by UUID REFERENCES auth.users(id)
```

---

## Bucket Storage

### `audio-files`

| Propriete | Valeur |
|-----------|--------|
| Type | **Prive** |
| Acces | URLs signees temporaires (1h) |
| Pattern chemin | `{user_id}/{timestamp}_{normalized_filename}` |
| Cache control | 3600 secondes |
| Formats | MP3, WAV, M4A, OGG, WEBM |
| Taille max | 100 MB par fichier |

**Creation du bucket** (si necessaire) :

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', FALSE);
```

**Policies Storage** :

```sql
-- Upload: utilisateur authentifie dans son dossier
CREATE POLICY "upload_audio" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Lecture: utilisateur authentifie pour ses fichiers
CREATE POLICY "read_audio" ON storage.objects FOR SELECT USING (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Suppression: utilisateur authentifie pour ses fichiers
CREATE POLICY "delete_audio" ON storage.objects FOR DELETE USING (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## Migrations suggerees (ordre d'execution)

```
001_create_audio_files.sql           -- Table audio_files + indexes
002_create_transcripts.sql           -- Table transcripts de base
003_add_transcript_utterances.sql    -- Colonnes utterances + speaker_names + indexes GIN
004_add_speaker_contacts.sql         -- Colonne speaker_contacts
005_create_analysis_templates.sql    -- Table templates + RLS
006_seed_analysis_templates.sql      -- Templates systeme (summary, meeting-minutes, etc.)
007_create_interaction_analyses.sql  -- Table analyses de base
008_update_analyses_templates.sql    -- Colonnes template_id, template_slug, structured_output
009_create_analysis_chunks.sql       -- Table chunks + embedding (necessite pgvector)
010_create_analysis_prompts.sql      -- Table prompts personnalises
011_create_storage_bucket.sql        -- Bucket audio-files + policies
012_add_audio_source_and_webm.sql    -- Colonne source + format WEBM (voir ci-dessous)
```

### Migration `012_add_audio_source_and_webm.sql`

```sql
-- Ajouter la colonne source pour distinguer upload vs enregistrement
ALTER TABLE audio_files
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';

ALTER TABLE audio_files
  ADD CONSTRAINT audio_files_source_check CHECK (source IN ('upload', 'recording'));

-- Elargir la contrainte format pour inclure WEBM
ALTER TABLE audio_files
  DROP CONSTRAINT IF EXISTS audio_files_format_check;

ALTER TABLE audio_files
  ADD CONSTRAINT audio_files_format_check CHECK (format IN ('MP3', 'WAV', 'M4A', 'OGG', 'WEBM'));

-- Marquer les fichiers existants comme 'upload'
UPDATE audio_files SET source = 'upload' WHERE source IS NULL;
```

---

## Patterns importants

### Normalisation des noms de fichiers

Les noms de fichiers uploades sont normalises pour eviter les problemes d'encodage :

```
1. Normalisation Unicode (NFD)
2. Suppression des accents
3. Remplacement des caracteres speciaux par underscore
4. Deduplication des underscores consecutifs
5. Suppression des underscores en debut/fin
```

### Relation Transcript-Interaction (1:1)

La contrainte `UNIQUE` sur `transcripts.interaction_id` garantit qu'une interaction n'a qu'un seul transcript. Si un retry de transcription est demande, le transcript existant est mis a jour (pas de duplication).

### Metadata JSONB

Le champ `transcripts.metadata` stocke les informations du fournisseur STT de maniere flexible :

```json
{
  "provider": "assemblyai",
  "confidence": 0.94,
  "language": "fr",
  "text_length": 12500,
  "file_size_mb": 4.2,
  "speaker_count": 2
}
```

Ce pattern permet de changer de fournisseur sans modifier le schema.
