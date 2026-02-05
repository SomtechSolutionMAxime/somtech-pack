# Audio, Transcription & Analyse — APIs & Fournisseurs externes

## Vue d'ensemble

La feature utilise trois fournisseurs externes :

| Fournisseur | Service | Usage | Cout approximatif |
|-------------|---------|-------|-------------------|
| **AssemblyAI** | Speech-to-Text | Transcription + diarisation | ~$0.37/heure d'audio |
| **Anthropic (Claude)** | LLM | Generation d'analyses structurees | ~$3-15/million tokens (selon modele) |
| **OpenAI** | Embeddings | Vectorisation pour RAG | ~$0.02/million tokens |

---

## 1. AssemblyAI — Transcription Speech-to-Text

### Pourquoi AssemblyAI

- **Prix competitif** par rapport a Google STT, AWS Transcribe, et OpenAI Whisper
- **Diarisation native** (identification des locuteurs) integree dans l'API standard
- **Detection automatique de la langue**
- **API REST simple** avec pattern asynchrone standard (submit + poll)

### Configuration

**Variable d'environnement** : `ASSEMBLYAI_API_KEY`

**URL de base** : `https://api.assemblyai.com/v2`

### API Endpoints utilises

#### Soumettre une transcription

```
POST https://api.assemblyai.com/v2/transcript
Authorization: {ASSEMBLYAI_API_KEY}
Content-Type: application/json
```

**Body** :

```json
{
  "audio_url": "https://supabase-url.com/storage/v1/object/sign/audio-files/...",
  "language_detection": true,
  "speaker_labels": true
}
```

**Reponse** :

```json
{
  "id": "transcript_abc123",
  "status": "queued",
  "audio_url": "...",
  "language_detection": true,
  "speaker_labels": true
}
```

**Notes** :
- `audio_url` doit etre une URL **publiquement accessible**. C'est pourquoi on utilise une URL signee Supabase Storage (1h d'expiration).
- `language_detection: true` detecte automatiquement la langue (francais, anglais, etc.)
- `speaker_labels: true` active la diarisation (identification des locuteurs)

#### Verifier le statut / Recuperer le resultat

```
GET https://api.assemblyai.com/v2/transcript/{transcript_id}
Authorization: {ASSEMBLYAI_API_KEY}
```

**Reponse (en cours)** :

```json
{
  "id": "transcript_abc123",
  "status": "processing"
}
```

**Reponse (terminee)** :

```json
{
  "id": "transcript_abc123",
  "status": "completed",
  "text": "Bonjour, comment puis-je vous aider ? ...",
  "confidence": 0.94,
  "language_code": "fr",
  "utterances": [
    {
      "speaker": "A",
      "text": "Bonjour, comment puis-je vous aider ?",
      "start": 0,
      "end": 3500,
      "confidence": 0.95
    },
    {
      "speaker": "B",
      "text": "J'aimerais discuter du projet de renovation.",
      "start": 4000,
      "end": 7200,
      "confidence": 0.92
    }
  ]
}
```

**Reponse (erreur)** :

```json
{
  "id": "transcript_abc123",
  "status": "error",
  "error": "Audio file could not be processed"
}
```

### Statuts possibles

| Statut | Description | Action |
|--------|-------------|--------|
| `queued` | En file d'attente | Continuer le polling |
| `processing` | En cours de traitement | Continuer le polling |
| `completed` | Termine avec succes | Recuperer les resultats |
| `error` | Echec | Afficher l'erreur, proposer un retry |

### Temps de traitement typiques

- Audio < 5 min : ~30-60 secondes
- Audio 5-30 min : ~1-3 minutes
- Audio 30-60 min : ~3-5 minutes
- Audio > 60 min : ~5-10 minutes

### Alternatives a AssemblyAI

| Fournisseur | Avantages | Inconvenients |
|-------------|-----------|---------------|
| **OpenAI Whisper API** | Bonne qualite, prix bas | Pas de diarisation native, synchrone (timeout sur longs audios) |
| **Google Speech-to-Text** | Tres bonne qualite, multilingue | API plus complexe, pricing par 15s |
| **AWS Transcribe** | Scalable, bonne diarisation | Setup AWS complexe, pricing opaque |
| **Deepgram** | Rapide, prix competitif | Moins connu, qualite variable |

### Gotchas et bonnes pratiques

1. **URL signee obligatoire** : AssemblyAI ne peut pas acceder aux buckets prives Supabase. Generer une URL signee d'au moins 1h.
2. **Timestamps en millisecondes** : AssemblyAI retourne `start` et `end` en ms. Ne pas confondre avec des secondes.
3. **Speaker IDs generiques** : Les speakers sont nommes "A", "B", "C"... par AssemblyAI. L'utilisateur doit renommer manuellement.
4. **Pas de webhook fiable** : Le pattern polling est recommande plutot que les webhooks pour eviter les dependances d'infrastructure.

---

## 2. Anthropic Claude API — Generation d'analyses

### Configuration

**Variable d'environnement** : `ANTHROPIC_API_KEY`

**Modele utilise** : `claude-sonnet-4-20250514` (ou equivalent recent)

### Usage

L'API Claude est appelee pour generer des analyses structurees a partir de transcripts. Le prompt est construit dynamiquement a partir des templates en base de donnees.

#### Appel API

```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: options.max_output_tokens || 4096,
    messages: [
      {
        role: 'user',
        content: interpolatedPrompt,
      }
    ],
    system: 'Tu es un assistant qui analyse des transcriptions. Reponds UNIQUEMENT en JSON valide selon le schema fourni.',
  }),
})
```

### Construction du prompt

Le prompt est construit en 3 etapes :

1. **Formater le transcript** avec timestamps et noms de speakers
2. **Interpoler le template** (remplacer `{{transcript}}`, `{{speaker_names}}`, conditions)
3. **Ajouter les instructions JSON** (schema de sortie attendu)

**Exemple de prompt interpole** :

```
Analyse la transcription suivante et genere un resume structure.

## Transcription

[0:00] Maxime: Bonjour, merci d'avoir accepte cette reunion.
[0:05] Client: Bonjour, je suis ravi de discuter du projet.
...

## Speakers

- Maxime (A)
- Client (B)

## Instructions

Reponds en JSON conforme au schema suivant:
{
  "title": "string",
  "overview": "string",
  "context": "string",
  "key_points": ["string"],
  "conclusions": ["string"]
}
```

### Nettoyage de la reponse

Le LLM peut retourner du JSON entoure de blocs Markdown :

```typescript
function cleanJsonResponse(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?\s*```$/i, '')
    .trim()
}
```

### Alternatives a Claude

| Fournisseur | Avantages | Inconvenients |
|-------------|-----------|---------------|
| **OpenAI GPT-4** | Large ecosysteme, bon JSON mode | Plus cher, moins stable sur JSON non-standard |
| **Google Gemini** | Prix competitif, contexte long | API moins mature |
| **Mistral** | Prix bas, open-source | Qualite inferieure sur JSON structure |

### Bonnes pratiques

1. **JSON strict** : Toujours demander du JSON et valider avec le `output_schema` du template
2. **System prompt minimal** : L'instruction de format doit etre claire et non ambigue
3. **Fallback** : Si le JSON est invalide, stocker la reponse brute dans `summary_text`
4. **Max tokens** : Configurable par template via `options.max_output_tokens`

---

## 3. OpenAI Embeddings — Vectorisation pour RAG

### Configuration

**Variable d'environnement** : `OPENAI_API_KEY`

**Modele** : `text-embedding-3-small` (1536 dimensions)

### Usage

Les embeddings sont generes pour les chunks d'analyses (opt-in RAG). Ils permettent la recherche semantique dans les analyses.

#### Appel API

```typescript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: chunkTexts,  // Array de strings (max 100 par batch)
  }),
})
```

**Reponse** :

```json
{
  "data": [
    {
      "embedding": [0.023, -0.012, ...],  // 1536 dimensions
      "index": 0
    }
  ],
  "usage": {
    "total_tokens": 245
  }
}
```

### Optimisations implementees

| Optimisation | Description | Gain |
|-------------|-------------|------|
| **Batching** | Jusqu'a 100 textes par appel API | -99% appels API |
| **Hash SHA-256** | Skip si le contenu n'a pas change | Idempotence |
| **Parallelisme** | Updates DB via `Promise.all` | Vitesse d'ecriture |
| **Retry** | 3 tentatives, 1s de delai | Resilience |

### Alternatives

| Fournisseur | Modele | Dimensions | Prix |
|-------------|--------|------------|------|
| **OpenAI** | text-embedding-3-small | 1536 | $0.02/M tokens |
| **OpenAI** | text-embedding-3-large | 3072 | $0.13/M tokens |
| **Cohere** | embed-multilingual-v3 | 1024 | $0.10/M tokens |
| **Voyage AI** | voyage-2 | 1024 | $0.12/M tokens |

### Note sur pgvector

Le stockage des embeddings necessite l'extension PostgreSQL `pgvector` :

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Le type `VECTOR(1536)` correspond aux 1536 dimensions de `text-embedding-3-small`.

---

## Resume des cles API requises

| Variable d'environnement | Fournisseur | Ou l'obtenir | Edge Function |
|--------------------------|-------------|-------------|---------------|
| `ASSEMBLYAI_API_KEY` | AssemblyAI | https://www.assemblyai.com/dashboard | transcribe-audio |
| `ANTHROPIC_API_KEY` | Anthropic | https://console.anthropic.com | generate-analysis |
| `OPENAI_API_KEY` | OpenAI | https://platform.openai.com/api-keys | generate-analysis-chunk-embeddings |

**Securite** : Ces cles sont stockees en tant que **secrets Supabase** (Edge Function environment variables). Elles ne sont jamais exposees au client frontend.

```bash
# Configurer les secrets Supabase
supabase secrets set ASSEMBLYAI_API_KEY=your_key
supabase secrets set ANTHROPIC_API_KEY=your_key
supabase secrets set OPENAI_API_KEY=your_key
```
