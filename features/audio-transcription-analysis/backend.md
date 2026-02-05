# Audio, Transcription & Analyse — Backend

## Vue d'ensemble

Le backend repose sur des **Edge Functions** (Supabase / Deno) qui orchestrent les appels aux fournisseurs externes (STT, LLM, embeddings) et les mises a jour en base de donnees. Chaque Edge Function a une responsabilite unique.

```
Edge Functions
├── transcribe-audio     # Upload + transcription STT
├── generate-analysis    # Analyse LLM a partir de templates
├── analyze-interaction  # Analyse legacy (prompt custom)
├── chunk-analysis       # Decoupage en chunks pour RAG
├── generate-analysis-chunk-embeddings  # Embeddings vectoriels
└── export-analysis      # Export PDF/DOCX
```

---

## 1. `transcribe-audio` — Orchestration de la transcription

**Responsabilite** : Gerer le cycle de vie complet de la transcription audio (creation, soumission au fournisseur STT, polling du statut, stockage des resultats).

### Methode GET — Verification du statut

**Endpoint** : `GET /transcribe-audio?audio_file_id={id}`

**Flux** :

```
Client (polling)
  │
  ├─ Fetch audio_file par ID + user ownership
  │
  ├─ Si status == 'processing' && assemblyai_transcript_id existe:
  │   ├─ Appel GET au fournisseur STT pour le statut
  │   ├─ Si completed:
  │   │   ├─ Formater utterances (diarisation)
  │   │   ├─ Extraire speaker_names (mapping vide par defaut)
  │   │   ├─ Convertir en Markdown (optionnel, flux documents)
  │   │   ├─ UPDATE transcripts (texte, utterances, speaker_names, metadata, status)
  │   │   ├─ UPDATE documents (si document_id existe)
  │   │   └─ UPDATE audio_files (status = completed)
  │   ├─ Si error: UPDATE audio_files + transcripts (status = failed)
  │   └─ Si processing: Retourner status actuel
  │
  └─ Sinon: Retourner status actuel depuis la DB
```

**Reponse** :

```json
{
  "success": true,
  "transcription_status": "completed",
  "document_id": "uuid-or-null",
  "audio_file_id": "uuid",
  "transcript_id": "uuid-or-null"
}
```

### Methode POST — Nouvelle transcription

**Endpoint** : `POST /transcribe-audio`

**Deux modes** :

#### Mode 1 : Retry (si `audio_file_id` fourni dans le body)

Relance la transcription d'un fichier audio existant :
1. Verifie la propriete du fichier (`created_by = user.id`)
2. Retrouve le transcript lie (par `audio_file_path` ou `interaction_id`)
3. Genere une URL signee pour le fichier Storage
4. Remet `audio_files` et `transcripts` en `processing`
5. Soumet au fournisseur STT
6. Stocke l'ID de transcription du fournisseur

#### Mode 2 : Nouvelle transcription

**Body** :

```json
{
  "file_path": "user-id/1234567890_audio.mp3",
  "filename": "reunion-client.mp3",
  "file_size": 4500000,
  "format": "MP3",
  "interaction_id": "uuid-optional",
  "client_id": "uuid-optional",
  "title": "Reunion client - optional"
}
```

**Flux** :

```
1. Valider format (MP3/WAV/M4A/OGG) et taille (<100MB)
2. Verifier interaction_id si fourni
3. INSERT audio_files (status: pending)
4. INSERT transcripts (si interaction_id fourni)
5. Creer client admin Supabase (service_role_key)
6. Generer URL signee du fichier (1h)
7. Si pas d'interaction_id: creer un document placeholder (flux legacy)
8. UPDATE audio_files (status: processing)
9. POST au fournisseur STT avec:
   - audio_url: URL signee
   - language_detection: true
   - speaker_labels: true
10. Stocker l'ID de transcription du fournisseur
11. Retourner immediatement (processing)
```

### Helpers cles

#### `formatUtterancesForStorage(utterances)`

Normalise les utterances du fournisseur STT :

```typescript
function formatUtterancesForStorage(utterances) {
  return utterances.map(u => ({
    speaker: u.speaker || 'Unknown',
    text: u.text || '',
    start: u.start || 0,   // millisecondes
    end: u.end || 0,
    confidence: u.confidence,
  }))
}
```

#### `extractSpeakerNames(utterances)`

Cree un mapping vide pour chaque speaker detecte :

```typescript
function extractSpeakerNames(utterances) {
  const speakers = new Set()
  utterances.forEach(u => { if (u.speaker) speakers.add(u.speaker) })
  const mapping = {}
  speakers.forEach(s => { mapping[s] = '' }) // L'utilisateur renomme apres
  return mapping
}
```

#### `convertTranscriptToMarkdown(transcript)`

Convertit le transcript en Markdown structure (pour le flux documents) :

```markdown
# Transcription Audio

**[0:00]** Bonjour, comment puis-je vous aider ?

**[0:05]** J'aimerais discuter du projet...

---

*Confiance moyenne: 94.2%*
```

### Securite

- **Authentification** : JWT requis dans le header Authorization
- **Propriete** : `created_by = auth.uid()` verifie pour chaque operation
- **Client admin** : Le `service_role_key` est utilise uniquement pour generer les URLs signees (le client user n'a pas acces direct au storage via l'Edge Function)

### CORS

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
```

---

## 2. `generate-analysis` — Analyse LLM avec templates

**Responsabilite** : Generer une analyse structuree d'un transcript en utilisant un template et un LLM.

### Endpoint

`POST /generate-analysis`

### Body

```json
{
  "transcript_id": "uuid",
  "template_slug": "summary",
  "regenerate": false,
  "analysis_id": "uuid-optional"
}
```

### Flux

```
1. Authentifier l'utilisateur
2. Fetch transcript avec utterances + speaker_names
3. Fetch template par slug (prompt_template, output_schema, options)
4. Formater le transcript:
   - Inclure timestamps si options.include_timestamps
   - Inclure noms des speakers si options.include_speaker_names
   - Format: "[MM:SS] Speaker: texte"
5. Interpoler le template:
   - Remplacer {{transcript}} par le texte formate
   - Remplacer {{speaker_names}} par le mapping des noms
   - Evaluer {{#if has_speakers}}...{{/if}}
6. Creer/mettre a jour interaction_analyses (status: processing)
7. Copier le transcript dans combined_text_snapshot
8. Appeler le LLM (Claude) avec:
   - System prompt: instructions de format JSON
   - User prompt: template interpole
9. Parser la reponse JSON
10. Extraire summary_text et todos du structured_output
11. UPDATE interaction_analyses:
    - structured_output = JSON parse
    - summary_text = extraction
    - todos = extraction
    - status = completed
12. Incrementer usage_count du template
13. Retourner analysis_id + structured_output
```

### Interpolation de template

Le moteur de template supporte :

```
{{transcript}}              → Texte formate du transcript
{{speaker_names}}           → Mapping JSON des speakers
{{#if has_speakers}}...{{/if}}  → Bloc conditionnel
```

### Nettoyage de la reponse LLM

Le LLM peut retourner du JSON entoure de blocs Markdown. Le helper `cleanJsonResponse` nettoie :

```typescript
function cleanJsonResponse(text) {
  // Retire ```json ... ``` ou ``` ... ```
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '').trim()
}
```

### Formatage du transcript avec diarisation

```typescript
function formatTranscriptWithUtterances(transcript, options) {
  return transcript.utterances.map(u => {
    const timestamp = options.include_timestamps
      ? `[${formatTimestamp(u.start)}] `
      : ''
    const speaker = options.include_speaker_names
      ? `${transcript.speaker_names[u.speaker] || u.speaker}: `
      : ''
    return `${timestamp}${speaker}${u.text}`
  }).join('\n')
}
```

---

## 3. `analyze-interaction` — Analyse legacy (prompt custom)

**Responsabilite** : Generer une analyse avec un prompt personnalise (sans template structure).

### Endpoint

`POST /analyze-interaction`

### Body

```json
{
  "interaction_id": "uuid",
  "scope": "all",
  "transcript_id": "uuid-optional",
  "prompt_id": "uuid-optional"
}
```

### Differences avec `generate-analysis`

| Aspect | `generate-analysis` | `analyze-interaction` |
|--------|--------------------|-----------------------|
| Source du prompt | Template en DB | Prompt custom ou defaut |
| Sortie | JSON structure (structured_output) | Texte libre (summary_text) |
| Scope | Toujours single transcript | `all` ou `single` |
| Validation | JSON Schema | Aucune |

---

## 4. `chunk-analysis` — Decoupage pour RAG

**Responsabilite** : Decouper le `combined_text_snapshot` d'une analyse en chunks pour la recherche semantique.

### Endpoints

**GET** `/chunk-analysis?analysis_id={id}` — Statut des chunks

```json
{
  "success": true,
  "analysis_id": "uuid",
  "chunks_count": 5,
  "frozen": true,
  "status": "chunked"
}
```

**POST** `/chunk-analysis` — Creer les chunks

```json
{ "analysis_id": "uuid" }
```

### Comportement idempotent

Les chunks sont **geles** apres creation. Un second appel POST ne recree pas les chunks. Cela garantit la coherence des embeddings.

---

## 5. `generate-analysis-chunk-embeddings` — Embeddings vectoriels

**Responsabilite** : Generer les embeddings OpenAI pour les chunks d'une analyse.

### Endpoint

`POST /generate-analysis-chunk-embeddings`

```json
{ "analysis_id": "uuid" }
```

### Flux

```
1. Fetch les chunks de l'analyse
2. Calculer le hash SHA-256 de chaque chunk
3. Skip les chunks dont le hash n'a pas change (idempotence)
4. Batch les textes (max 100 par appel API OpenAI)
5. Appeler OpenAI text-embedding-3-small (1536 dimensions)
6. UPDATE chaque chunk avec son embedding en parallele
7. Retourner le nombre d'embeddings generes
```

### Optimisations

- **Batching** : Jusqu'a 100 textes par appel API (reduit les appels de 99%)
- **Hash SHA-256** : Evite de regenerer les embeddings pour un contenu inchange
- **Parallelisme** : Les updates DB sont en `Promise.all`
- **Retry** : 3 tentatives avec 1s de delai entre chaque

---

## 6. `export-analysis` — Export PDF/DOCX

**Responsabilite** : Exporter une analyse en format PDF ou DOCX.

### Endpoint

`POST /export-analysis`

```json
{
  "analysis_id": "uuid",
  "format": "pdf"
}
```

### Formats supportes

| Format | Librairie | Notes |
|--------|-----------|-------|
| PDF | `pdf-lib` | Layout personalise par type de template |
| DOCX | `docx` | Structure Word avec styles |

### Rendu par template

Chaque `template_slug` a un rendu specifique :
- `summary` : Sections titre, resume, points cles, conclusions
- `meeting-minutes` : Tableau d'actions avec priorites, decisions, prochaines etapes
- `call-notes` : Resume, sujets, objections, suivi
- `cahier-des-charges` : Contexte, perimetre, contraintes, criteres de succes

---

## Patterns transversaux

### Logging structure

Toutes les Edge Functions utilisent un logger JSON :

```typescript
function log(level: string, message: string, data?: any) {
  console.log(JSON.stringify({
    level,          // 'info', 'warn', 'error'
    message,
    timestamp: new Date().toISOString(),
    ...data,
  }))
}
```

### Client admin vs client user

```typescript
// Client USER (respecte RLS)
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_ANON_KEY'),
  { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
)

// Client ADMIN (bypass RLS — pour URLs signees)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

**Regle** : Le client admin n'est utilise que pour les operations necessitant un acces eleve (URLs signees Storage). Toutes les operations DB passent par le client user pour respecter le RLS.

### Gestion des erreurs

Pattern uniforme pour toutes les Edge Functions :

```typescript
try {
  // Logique principale
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
  log('error', 'Description de l\'erreur', { error: errorMessage })

  return new Response(
    JSON.stringify({ error: errorMessage }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    }
  )
}
```

### Variables d'environnement requises

| Variable | Usage | Edge Function |
|----------|-------|---------------|
| `SUPABASE_URL` | URL du projet Supabase | Toutes |
| `SUPABASE_ANON_KEY` | Cle anonyme Supabase | Toutes |
| `SUPABASE_SERVICE_ROLE_KEY` | Cle admin (URLs signees) | transcribe-audio |
| `ASSEMBLYAI_API_KEY` | Cle API AssemblyAI | transcribe-audio |
| `ANTHROPIC_API_KEY` | Cle API Claude | generate-analysis |
| `OPENAI_API_KEY` | Cle API OpenAI (embeddings) | generate-analysis-chunk-embeddings |
