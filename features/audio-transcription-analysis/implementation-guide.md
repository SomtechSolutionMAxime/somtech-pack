# Audio, Transcription & Analyse — Guide d'implementation

## Pre-requis

Avant de commencer, assurez-vous d'avoir :

- [ ] Un projet Supabase (ou PostgreSQL + Storage equivalent)
- [ ] Un compte AssemblyAI avec cle API
- [ ] Un compte Anthropic avec cle API (pour les analyses)
- [ ] Un compte OpenAI avec cle API (pour les embeddings, optionnel)
- [ ] Un frontend React + TypeScript avec TanStack React Query
- [ ] shadcn/ui installe (ou equivalent de composants UI)

---

## Phase 1 : Base de donnees et stockage

### Etape 1.1 : Creer les tables de base

Executer les migrations dans cet ordre :

**1. Table `audio_files`**

```sql
CREATE TABLE audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- RLS
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_audio_files" ON audio_files
  USING (created_by = auth.uid());

CREATE POLICY "users_insert_audio_files" ON audio_files
  FOR INSERT WITH CHECK (created_by = auth.uid());
```

**2. Table `transcripts`** (adapter si votre concept pivot n'est pas "interaction")

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
  utterances JSONB DEFAULT '[]'::jsonb,
  speaker_names JSONB DEFAULT '{}'::jsonb,
  speaker_contacts JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes pour la diarisation
CREATE INDEX idx_transcripts_utterances ON transcripts USING GIN (utterances);
CREATE INDEX idx_transcripts_has_utterances ON transcripts
  ((utterances != '[]'::jsonb)) WHERE utterances != '[]'::jsonb;

-- RLS (adapter selon votre modele de permissions)
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
```

### Etape 1.2 : Creer le bucket Storage

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('audio-files', 'audio-files', FALSE, 104857600); -- 100MB limit

-- Policies Storage
CREATE POLICY "upload_own_audio" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "read_own_audio" ON storage.objects FOR SELECT USING (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "delete_own_audio" ON storage.objects FOR DELETE USING (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Etape 1.3 : Configurer les secrets

```bash
supabase secrets set ASSEMBLYAI_API_KEY=your_assemblyai_key
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_key
supabase secrets set OPENAI_API_KEY=your_openai_key
```

---

## Phase 2 : Edge Function de transcription

### Etape 2.1 : Creer l'Edge Function `transcribe-audio`

```bash
supabase functions new transcribe-audio
```

**Structure du fichier** :

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 2. Auth
  const supabaseClient = createClient(/* user client */)
  const { data: { user } } = await supabaseClient.auth.getUser()

  // 3. GET: Polling du statut
  if (req.method === 'GET') {
    // Voir backend.md pour le flux complet
  }

  // 4. POST: Nouvelle transcription ou retry
  if (req.method === 'POST') {
    // Voir backend.md pour le flux complet
  }
})
```

**Points cles de l'implementation** :

1. **Client admin pour les URLs signees** : Creer un second client Supabase avec `SUPABASE_SERVICE_ROLE_KEY` pour generer les URLs signees. Le client user ne peut pas generer des URLs signees pour des buckets prives dans une Edge Function.

2. **Retour immediat** : Ne pas attendre la fin de la transcription. Soumettre au fournisseur STT et retourner `status: processing` immediatement.

3. **Mise a jour atomique** : Quand le GET detecte `completed`, mettre a jour `transcripts`, `audio_files` (et optionnellement `documents`) dans la meme requete.

### Etape 2.2 : Deployer

```bash
supabase functions deploy transcribe-audio
```

---

## Phase 3 : Hook d'upload frontend

### Etape 3.1 : Hook `useAudioTranscription`

Creer un hook qui gere :
1. Validation du fichier (format + taille)
2. Upload vers Supabase Storage
3. Appel de l'Edge Function
4. Polling en arriere-plan

**Pattern cle — Polling en arriere-plan** :

```typescript
// Lancer le polling sans bloquer le retour
void pollStatus()
  .then((result) => {
    if (result?.status === 'completed') {
      toast({ title: 'Transcription terminee' })
    }
  })
  .catch((error) => {
    toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
  })

// Retourner immediatement
return { success: true, audio_file_id, transcription_status: 'processing' }
```

**Pattern cle — getTranscriptionStatus avec fallback** :

```typescript
async function getTranscriptionStatus(audioFileId: string) {
  try {
    // Essayer l'Edge Function GET (qui met aussi a jour la DB)
    const response = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio?audio_file_id=${audioFileId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey }
    })
    return await response.json()
  } catch {
    // Fallback: lire directement en DB
    const { data } = await supabase
      .from('audio_files')
      .select('transcription_status, transcription_error')
      .eq('id', audioFileId)
      .single()
    return { status: data.transcription_status, error: data.transcription_error }
  }
}
```

### Etape 3.2 : Hook `useAllAudios`

Creer un hook qui merge les donnees de 3 tables :

```
transcripts (WHERE audio_file_path IS NOT NULL)
  → interactions (par interaction_id)
    → entreprises (par client_id)
```

**Pattern** : 3 requetes sequentielles, puis merge en memoire pour eviter des JOIN complexes cote SQL.

### Etape 3.3 : Hook `useAudioFilters`

Filtrage purement cote client avec `useMemo` :
- Recherche textuelle multi-champs
- Filtre par entreprise, statut, plage de dates
- Groupement optionnel par entreprise

---

## Phase 4 : Interface de la bibliotheque audio

### Etape 4.1 : Layout split-panel

```
[Sidebar 320px] | [Panel detail flex-1]
```

La sidebar contient les filtres et la liste. Le panel droit affiche le detail de l'audio selectionne.

### Etape 4.2 : Upload dialog

Points d'attention :
- **Drag-and-drop** : Utiliser `onDragOver`, `onDrop` sur une zone d'upload
- **Deux modes** : "Nouvelle interaction" vs "Interaction existante"
- **Progression** : Afficher les etapes (upload → transcription) avec une barre de progression
- **Normalisation du nom de fichier** : Supprimer accents et caracteres speciaux avant upload

### Etape 4.3 : Player audio

Utiliser un element `<audio>` HTML5 natif avec un hook personalise :
- Controles : play/pause, seek, vitesse, volume
- Barre de progression cliquable
- Skip avant/arriere (10s)
- Vitesses : 0.5x a 2x

**Piege a eviter** : Preserver `playbackRate` et `volume` quand l'URL change (changement d'audio selectionne).

### Etape 4.4 : Affichage du transcript

Afficher les utterances avec :
- Timestamps cliquables (seek dans le player)
- Nom du speaker (ou ID si non renomme)
- Couleur differente par speaker

### Etape 4.5 : Edition des speakers

Dialog pour :
- Renommer les speakers (A → "Maxime", B → "Client")
- Associer les speakers a des contacts existants en DB

### Etape 4.6 : Enregistrement audio direct

**Pre-requis** : Phase 4.2 (upload dialog) terminee — le flux `uploadAndTranscribe` doit etre fonctionnel.

#### 4.6.1 : Migration base de donnees

Executer la migration pour ajouter la colonne `source` et le format WEBM :

```sql
ALTER TABLE audio_files
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';

ALTER TABLE audio_files
  ADD CONSTRAINT audio_files_source_check CHECK (source IN ('upload', 'recording'));

ALTER TABLE audio_files
  DROP CONSTRAINT IF EXISTS audio_files_format_check;

ALTER TABLE audio_files
  ADD CONSTRAINT audio_files_format_check CHECK (format IN ('MP3', 'WAV', 'M4A', 'OGG', 'WEBM'));

UPDATE audio_files SET source = 'upload' WHERE source IS NULL;
```

#### 4.6.2 : Hook `useAudioRecorder`

Creer un hook qui encapsule `MediaRecorder` :

1. **Demande de permission** : `navigator.mediaDevices.getUserMedia({ audio: true })`
2. **MediaRecorder** : Creer avec `mimeType: 'audio/webm;codecs=opus'` (avec fallback)
3. **Collecte chunks** : Via `ondataavailable`, accumuler les `Blob` fragments
4. **Timer** : `setInterval` chaque seconde, pause-aware (ne pas incrementer pendant pause)
5. **AnalyserNode** : Creer un `AudioContext` + `AnalyserNode` pour la visualisation de volume
6. **Assemblage** : Au `stop`, assembler les chunks en un seul `Blob`
7. **Conversion File** : Helper `getFile()` qui cree un `File` avec nom `recording_YYYYMMDD_HHmmss.webm`
8. **Cleanup** : Au unmount, arreter les tracks, revoquer Object URLs, fermer AudioContext

**Pieges a eviter** :
- `getUserMedia` est asynchrone et peut etre rejete — toujours `try/catch`
- L'`AudioContext` doit etre cree apres un geste utilisateur (pas au mount)
- `URL.createObjectURL` doit etre revoque pour eviter les fuites memoire
- Le timer doit etre pause-aware (ne pas utiliser `Date.now()` naif)
- Safari peut utiliser un codec different (MP4/AAC) — tester `isTypeSupported()`

#### 4.6.3 : Composant `AudioRecordDialog`

Dialog en 3 phases :

1. **Phase recording** : Boutons Start/Pause/Stop, timer, visualiseur de volume
2. **Phase review** : Player de relecture, bouton Recommencer, formulaire interaction (reutiliser le meme formulaire que `AudioUploadDialog`)
3. **Phase uploading** : Conversion Blob -> File, appel `uploadAndTranscribe()`, progression

**Integration avec le flux existant** :

```typescript
// Dans AudioRecordDialog, phase upload :
const file = recorder.getFile()
if (!file) return

await uploadAndTranscribe({
  file,
  interaction_id: interactionId,
  source: 'recording',  // Nouvelle propriete
})
```

**Point cle** : Le composant reutilise `useAudioTranscription` pour l'upload. Pas de nouveau hook d'upload.

#### 4.6.4 : Integration dans AudiosView

Ajouter un bouton "Enregistrer" a cote du bouton "Upload" dans le header de la bibliotheque audio :

```
[+ Upload]  [🎙 Enregistrer]
```

Le bouton ouvre `AudioRecordDialog`. Le callback `onSuccess` est identique a celui de `AudioUploadDialog` : invalidation du cache React Query.

#### 4.6.5 : Adapter `useAudioTranscription`

Modifications mineures :
- Accepter `source: 'upload' | 'recording'` dans `TranscribeAudioRequest`
- Transmettre `source` a l'Edge Function
- Accepter WEBM dans la validation de format cote client

```typescript
// Avant
const ALLOWED_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg']

// Apres
const ALLOWED_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/webm']
```

#### 4.6.6 : Adapter l'Edge Function `transcribe-audio`

Modifications mineures :
- Accepter le champ `source` dans le body POST
- Stocker `source` dans `audio_files` lors de la creation
- Ajouter WEBM dans la validation de format cote serveur

---

## Phase 5 : Systeme d'analyses (optionnel mais recommande)

### Etape 5.1 : Table et seed des templates

Creer la table `analysis_templates` et seeder les 4 templates systeme (summary, meeting-minutes, call-notes, cahier-des-charges). Voir `database.md` pour le schema complet.

### Etape 5.2 : Table `interaction_analyses`

Creer la table qui stocke les analyses generees avec :
- `template_slug` pour le routage du rendu
- `structured_output` (JSONB) pour la sortie structuree
- `combined_text_snapshot` pour figer le transcript

### Etape 5.3 : Edge Function `generate-analysis`

Implementer le flux :
1. Fetch transcript + template
2. Formater et interpoler le prompt
3. Appeler le LLM (Claude)
4. Parser le JSON, stocker le resultat

**Point cle** : Le moteur d'interpolation doit supporter `{{variable}}` et `{{#if condition}}...{{/if}}`.

### Etape 5.4 : Renderers specialises

Creer un composant router (`AnalysisView`) qui delegue a un renderer par `template_slug`. Chaque renderer connait la structure JSON et l'affiche de maniere appropriee.

### Etape 5.5 : Template Picker

Modal avec onglets par categorie pour selectionner un template et lancer la generation.

---

## Phase 6 : Pipeline RAG (optionnel)

### Etape 6.1 : Extension pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Etape 6.2 : Table `interaction_analysis_chunks`

Avec colonne `embedding VECTOR(1536)`.

### Etape 6.3 : Edge Function `chunk-analysis`

Decouper le `combined_text_snapshot` en chunks. Implementer le flag "frozen" pour l'idempotence.

### Etape 6.4 : Edge Function `generate-analysis-chunk-embeddings`

Generer les embeddings OpenAI en batch. Implementer le hash SHA-256 pour l'idempotence.

---

## Checklist de verification

### Fonctionnel

- [ ] Upload d'un fichier MP3 < 100MB
- [ ] Progression affichee pendant l'upload
- [ ] Transcription demarre automatiquement
- [ ] Polling du statut toutes les 5s
- [ ] Transcript affiche avec diarisation apres completion
- [ ] Speakers renommables
- [ ] Player audio fonctionnel (play, pause, seek, vitesse, volume)
- [ ] Filtres fonctionnels (recherche, entreprise, statut, dates)
- [ ] Groupement par entreprise
- [ ] Suppression cascade (analyses + transcript + fichier + audio_files)

### Enregistrement

- [ ] Bouton "Enregistrer" visible dans le header de la bibliotheque
- [ ] Permission microphone demandee a l'ouverture du dialog
- [ ] Message d'erreur clair si permission refusee
- [ ] Enregistrement demarre/pause/reprend/arrete correctement
- [ ] Timer affiche et pause-aware
- [ ] Visualiseur de volume reactif pendant l'enregistrement
- [ ] Relecture de l'audio enregistre avant envoi
- [ ] Bouton "Recommencer" fonctionnel (repart a zero)
- [ ] Formulaire interaction identique a AudioUploadDialog
- [ ] Upload + transcription demarre apres validation
- [ ] Fichier WEBM correctement transcrit par le fournisseur STT
- [ ] Colonne `source = 'recording'` renseignee en base
- [ ] Colonne `format = 'WEBM'` renseignee en base
- [ ] Cleanup correct au unmount (stream, AudioContext, Object URL)
- [ ] Fonctionne sur Chrome, Firefox, Edge
- [ ] Arret automatique apres 60 minutes

### Analyses

- [ ] Templates affiches par categorie dans le picker
- [ ] Generation d'une analyse "Resume" fonctionnelle
- [ ] Generation d'un "Compte-rendu de reunion" avec actions
- [ ] Sortie JSON parsee et affichee correctement
- [ ] Export PDF fonctionnel
- [ ] Export DOCX fonctionnel

### Securite

- [ ] RLS actif sur toutes les tables
- [ ] URLs signees (pas d'acces direct au bucket)
- [ ] Cles API en secrets Supabase (pas en code)
- [ ] Verification `created_by = auth.uid()` dans les Edge Functions
- [ ] Validation format et taille cote client ET serveur

### Performance

- [ ] Cache React Query (30s stale, 5min GC)
- [ ] Pas de requete inutile au changement d'onglet
- [ ] Polling arrete apres completion ou echec
- [ ] Timeout de 5 minutes sur le polling

---

## Adaptations selon le contexte

### Sans concept d'interaction

Si votre application n'a pas de concept "interaction", vous pouvez :
- Retirer la relation `transcripts.interaction_id`
- Lier directement `transcripts` a `audio_files` (1:1)
- Supprimer les filtres par entreprise

### Sans Supabase

Les Edge Functions peuvent etre remplacees par :
- **API Routes Next.js** (si deploye sur Vercel/Netlify)
- **Cloud Functions** (Google Cloud, AWS Lambda)
- **Express/Fastify** (serveur classique)

Le bucket Storage peut etre remplace par :
- **AWS S3** avec pre-signed URLs
- **Google Cloud Storage** avec signed URLs
- **Cloudflare R2**

### Sans AssemblyAI

Pour utiliser un autre fournisseur STT :
1. Adapter l'appel API dans l'Edge Function de transcription
2. Adapter le parsing des resultats (format des utterances, timestamps)
3. Adapter le polling (chaque fournisseur a son propre pattern async)

### Sans enregistrement

Vous pouvez ignorer l'Etape 4.6 et n'avoir que l'upload de fichiers. Il suffit de ne pas inclure le composant `AudioRecordDialog` et le hook `useAudioRecorder`. La colonne `source` et le format WEBM ne sont pas necessaires dans ce cas.

### Sans analyses

Vous pouvez implementer uniquement les Phases 1-4 et avoir un systeme audio/transcription fonctionnel sans la couche d'analyse LLM.

---

## Estimation de l'effort

| Phase | Complexite | Description |
|-------|-----------|-------------|
| Phase 1 : DB + Storage | Faible | Migrations SQL + config bucket |
| Phase 2 : Edge Function transcription | Moyenne | Orchestration STT + polling |
| Phase 3 : Hooks frontend | Moyenne | Upload, fetch, filters |
| Phase 4 : UI bibliotheque | Elevee | Split-panel, player, drag-drop, dialogs |
| Phase 5 : Analyses | Elevee | Templates, LLM, renderers specialises |
| Phase 6 : RAG | Moyenne | Chunking + embeddings (optionnel) |
