# Audio, Transcription & Analyse — Frontend

## Vue d'ensemble

L'interface se compose de trois zones fonctionnelles :

1. **Bibliotheque audio** — Liste filtrable/groupable des fichiers audio
2. **Detail audio** — Player, transcript avec diarisation, edition des speakers
3. **Analyses** — Selection de template, affichage structure, export

```
+---------------------------+----------------------------------+
|   Sidebar (gauche)        |    Panel Detail (droite)         |
|                           |                                  |
|  [Filtres compacts]       |  [Player audio]                  |
|  [Liste des audios]       |  [Onglets: Transcript | Analyses]|
|    - par entreprise       |    [Transcript diarise]          |
|    - par statut           |    [Vue analyse structuree]      |
|    - par date             |  [Actions: Exporter, Supprimer]  |
+---------------------------+----------------------------------+
```

---

## Composants

### 1. AudiosView — Conteneur principal

**Role** : Orchestrer la bibliotheque audio avec un layout split-panel.

**Props** : Aucune (composant root)

**State** :
- `selectedAudio: AudioWithContext | null` — Audio actuellement selectionne
- Donnees via `useAllAudios()` hook

**Comportement** :
- Auto-selectionne le premier audio au chargement
- Valide que l'audio selectionne existe toujours apres filtrage
- Invalidation du cache React Query apres un upload reussi
- Affiche un placeholder si aucun audio

**Structure** :

```tsx
<div className="flex h-full">
  {/* Sidebar gauche */}
  <div className="w-80 border-r flex flex-col">
    <AudioLibraryFiltersCompact filters={...} />
    <AudioLibraryList
      audios={filteredAudios}
      selectedId={selectedAudio?.transcript_id}
      onSelect={setSelectedAudio}
    />
  </div>

  {/* Panel droit */}
  <div className="flex-1">
    {selectedAudio ? (
      <AudioDetailPanel audio={selectedAudio} onRefresh={refetch} />
    ) : (
      <EmptyState />
    )}
  </div>
</div>
```

---

### 2. AudioUploadDialog — Dialog d'upload

**Role** : Uploader un fichier audio et le lier a une interaction (nouvelle ou existante).

**Props** :
```typescript
interface AudioUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (result: TranscribeAudioResponse) => void
  defaultEntrepriseId?: string
}
```

**Fonctionnalites** :
- **Drag-and-drop** zone avec validation visuelle
- **Validation** : format (MP3/WAV/M4A/OGG), taille (<100MB)
- **Deux modes d'interaction** :
  - `new` : Creer une interaction a la volee (type, sujet, date)
  - `existing` : Lier a une interaction existante d'une entreprise
- **Progression** : Barre de progression multi-etapes (upload -> transcription)
- **Auto-remplissage** : Le nom du fichier remplit le champ titre

**Flux upload** :

```
1. Validation fichier (format + taille)
2. Si mode "new":
   a. Creer l'interaction via Supabase
   b. Utiliser l'interaction_id retourne
3. Appeler uploadAndTranscribe() du hook
4. Afficher progression (upload -> transcription)
5. Fermer le dialog et notifier le parent
```

---

### 3. AudioDetailPanel — Panel de detail

**Role** : Afficher le detail complet d'un audio : player, transcript, analyses.

**Props** :
```typescript
interface AudioDetailPanelProps {
  audio: AudioWithContext
  onRefresh?: () => void
}
```

**State interne** :
- `audioUrl: string | null` — URL signee pour le player (1h expiration)
- `localTranscript` — Transcript complet avec utterances et speakers
- `activeTabId: string` — Onglet actif (transcript ou analysis-{id})
- `isSpeakerEditorOpen` — Dialog d'edition des speakers
- `isTemplatePickerOpen` — Modal de selection de template
- `isPropertiesDialogOpen` — Dialog d'edition des proprietes

**Chargement des donnees** :

```typescript
// 1. URL signee pour le player
const { data: signedUrlData } = await supabase.storage
  .from('audio-files')
  .createSignedUrl(audio.audio_file_path, 3600) // 1h

// 2. Transcript complet
const { data: transcript } = await supabase
  .from('transcripts')
  .select('*')
  .eq('id', audio.transcript_id)
  .single()
```

**Structure UI** :

```
[Header: titre + badges statut + boutons action]
[Player audio]
[Tabs]
  ├─ Transcript (defaut)
  │   ├─ Utterances avec timestamps et speakers
  │   ├─ Bouton "Editer les speakers"
  │   └─ Bouton "Ajouter une analyse"
  └─ Analysis-{id} (un onglet par analyse)
      ├─ AnalysisView (rendu selon template_slug)
      └─ Boutons: Exporter, Supprimer
```

**Suppression** (cascade manuelle) :

```typescript
// 1. Supprimer les analyses liees
await supabase.from('interaction_analyses').delete().eq('interaction_id', ...)
// 2. Supprimer le transcript
await supabase.from('transcripts').delete().eq('id', ...)
// 3. Supprimer le fichier Storage
await supabase.storage.from('audio-files').remove([audio.audio_file_path])
// 4. Supprimer audio_files
await supabase.from('audio_files').delete().eq('id', ...)
```

---

### 4. AudioLibraryList — Liste sidebar

**Role** : Afficher la liste scrollable des audios avec groupement optionnel.

**Props** :
```typescript
interface AudioLibraryListProps {
  audios: AudioWithContext[]
  groupedAudios?: GroupedAudios[] | null
  selectedId?: string
  onSelect: (audio: AudioWithContext) => void
  isLoading?: boolean
}
```

**Fonctionnalites** :
- Groupement par entreprise (sections collapsibles)
- Auto-expand du groupe contenant l'audio selectionne
- Badge de statut colore par transcription_status
- Skeleton loading state
- ScrollArea pour le scroll interne

---

### 5. AudioLibraryFiltersCompact — Filtres sidebar

**Role** : Panneau de filtres compact pour la sidebar.

**Filtres disponibles** :
- **Recherche** : Texte libre (filename, sujet, entreprise)
- **Entreprise** : Dropdown avec les entreprises ayant des audios
- **Statut** : Select (pending, processing, completed, failed)
- **Plage de dates** : Calendar range picker
- **Groupement** : Checkbox pour activer le groupement par entreprise

**Pattern** : Section avancee collapsible pour les filtres secondaires.

---

### 6. AudioPropertiesDialog — Edition des proprietes

**Role** : Modifier les metadonnees de l'interaction liee a l'audio.

**Champs editables** :
- Entreprise (combobox searchable avec popover)
- Sujet (input texte)
- Type d'interaction (select: appel, courriel, rencontre, message texte, LinkedIn, notes)
- Date (calendar date picker)

**Pattern detection de changements** :

```typescript
const hasChanges = useMemo(() => {
  return formData.entrepriseId !== originalData.entrepriseId
    || formData.sujet !== originalData.sujet
    || formData.type !== originalData.type
    || formData.date !== originalData.date
}, [formData, originalData])
```

Le bouton "Sauvegarder" n'est actif que si des changements sont detectes.

---

### 7. AnalysisView — Router de vues d'analyse

**Role** : Afficher l'analyse structuree selon le `template_slug`, en delegant a un renderer specialise.

**Props** :
```typescript
interface AnalysisViewProps {
  analysis: InteractionAnalysis
  onExport?: (format: 'pdf' | 'docx') => void
}
```

**Router** :

```typescript
switch (analysis.template_slug) {
  case 'summary':           return <SummaryView data={analysis.structured_output} />
  case 'meeting-minutes':   return <MeetingMinutesView data={analysis.structured_output} />
  case 'call-notes':        return <CallNotesView data={analysis.structured_output} />
  case 'cahier-des-charges': return <CahierDesChargesView data={analysis.structured_output} />
  default:                  return <GenericAnalysisView data={analysis} />
}
```

**Renderers specialises** :

| Renderer | Sections affichees | Interactions specifiques |
|----------|-------------------|------------------------|
| SummaryView | Titre, Resume, Contexte, Points cles, Conclusions | Copie par section |
| MeetingMinutesView | Actions (avec priorite), Decisions, Resume chronologique, Prochaines etapes | Actions -> Taches (bouton conversion) |
| CallNotesView | Resume, Sujets discutes, Objections, Actions, Suivi | Date de suivi suggeree |
| CahierDesChargesView | Contexte client, Perimetre, Contraintes, Criteres de succes | Structure hierarchique |
| GenericAnalysisView | Affichage JSON brut | Fallback pour templates inconnus |

---

### 8. AudioRecordDialog — Dialog d'enregistrement

**Role** : Capturer de l'audio depuis le microphone du navigateur et l'injecter dans le flux d'upload existant.

**Props** :
```typescript
interface AudioRecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (result: TranscribeAudioResponse) => void
  defaultEntrepriseId?: string
}
```

**State interne** :
- Phase 1 : `recording` — Controles d'enregistrement (start, pause, resume, stop)
- Phase 2 : `review` — Relecture de l'audio enregistre + formulaire interaction
- Phase 3 : `uploading` — Progression upload + transcription (delegue a `useAudioTranscription`)

**Flux** :

```
1. Ouverture du dialog
2. Demande permission microphone (getUserMedia)
3. Si refuse: afficher message d'erreur avec lien vers les parametres navigateur
4. Si accorde: afficher interface d'enregistrement
   a. Bouton Start -> enregistrement demarre
   b. Timer + visualiseur de volume (AnalyserNode)
   c. Bouton Pause/Resume disponible
   d. Bouton Stop -> fin de capture
5. Phase review:
   a. Player de relecture de l'audio capture
   b. Bouton "Recommencer" pour refaire l'enregistrement
   c. Formulaire interaction (meme que AudioUploadDialog):
      - Mode: nouvelle interaction ou existante
      - Entreprise, sujet, type, date
   d. Bouton "Envoyer" pour lancer l'upload
6. Phase upload:
   a. Conversion Blob -> File (nom genere: recording_YYYYMMDD_HHmmss.webm)
   b. Appel uploadAndTranscribe() avec source = 'recording'
   c. Affichage progression (meme composant que AudioUploadDialog)
7. Fermeture et notification parent via onSuccess
```

**Structure UI** :

```
+-----------------------------------------------+
|  Enregistrer un audio                     [X]  |
|                                                |
|  Phase "recording":                            |
|  +-------------------------------------------+ |
|  |         ◉  02:34                          | |
|  |   [|||||||||||||||||||]  (visualiseur)     | |
|  |                                            | |
|  |   [⏸ Pause]    [⏹ Arreter]               | |
|  +-------------------------------------------+ |
|                                                |
|  Phase "review":                               |
|  +-------------------------------------------+ |
|  |  [▶ ━━━━━━━━━━━━━━━━━━━ 02:34]           | |
|  |  [🔄 Recommencer]                         | |
|  |                                            | |
|  |  Entreprise: [___________▼]                | |
|  |  Sujet:      [_______________]             | |
|  |  Type:       [Appel_________▼]             | |
|  |  Date:       [2026-02-05____]              | |
|  +-------------------------------------------+ |
|                                                |
|           [Annuler]    [Envoyer]               |
+-----------------------------------------------+
```

**Gestion des erreurs** :

| Erreur | Comportement |
|--------|-------------|
| Permission micro refusee | Message + lien parametres navigateur |
| MediaRecorder non supporte | Message + suggestion de navigateur compatible |
| Enregistrement trop court (<1s) | Toast d'avertissement, pas d'upload |
| Enregistrement trop long (>60min) | Arret automatique + notification |

---

### 9. TemplatePickerModal — Selection de template

**Role** : Modal permettant a l'utilisateur de choisir un template pour generer une analyse.

**Props** :
```typescript
interface TemplatePickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transcriptId: string
  onGenerated: (analysisId: string, templateSlug: string) => void
}
```

**Fonctionnalites** :
- Onglets par categorie : General, Reunion, Vente, Support, Entretien
- Cartes de template avec : nom, description, tags, compteur d'utilisations
- Badge "Systeme" pour les templates built-in
- Spinner de chargement pendant la generation
- Appel `generateAnalysis.mutateAsync()` au clic

---

## Hooks

### `useAllAudios(options?)`

Fetch et merge les donnees audio avec leur contexte (interaction + entreprise).

```typescript
interface UseAllAudiosOptions {
  entrepriseId?: string | null  // Filtre par entreprise
}
```

**Strategie de fetch** (3 requetes chainees) :

```
1. SELECT transcripts WHERE audio_file_path IS NOT NULL
2. SELECT interactions WHERE id IN (transcript.interaction_ids)
   └─ Si entrepriseId fourni: WHERE client_id = entrepriseId
3. SELECT entreprises WHERE id IN (interaction.client_ids)
4. Merge en AudioWithContext[]
```

**Caching** :
- `staleTime: 30000` (30s)
- `gcTime: 300000` (5min)

### `useAudioFilters(audios)`

Filtrage et groupement cote client.

**Retour** :
```typescript
{
  filters: AudioFilters
  filteredAudios: AudioWithContext[]
  groupedAudios: GroupedAudios[] | null
  groupByEntreprise: boolean
  setGroupByEntreprise: (v: boolean) => void
  activeFiltersCount: number
  uniqueEntreprises: { id: string; nom: string }[]
  updateFilter: (key, value) => void
  clearFilters: () => void
}
```

**Filtres** :
- `search` : Match partiel sur filename, sujet, entreprise_nom (case-insensitive)
- `entrepriseId` : Filtre exact par entreprise
- `status` : Filtre exact par statut de transcription
- `dateRange` : Plage de dates (from/to avec end-of-day pour `to`)

### `useAudioTranscription()`

Gere l'upload et la transcription.

**Retour** :
```typescript
{
  uploadAndTranscribe: (request: TranscribeAudioRequest) => Promise<TranscribeAudioResponse | null>
  getTranscriptionStatus: (audioFileId: string) => Promise<StatusResult | null>
  loading: boolean
  progress: { stage: 'upload' | 'transcription' | 'conversion' | 'completed'; percentage?: number } | null
}
```

**Etapes de progression** :

| Stage | Percentage | Description |
|-------|-----------|-------------|
| `upload` | 0 → 50 | Upload vers Storage |
| `transcription` | 0 → 100 | Soumission + polling STT |
| `completed` | 100 | Transcription terminee |

**Polling** : Toutes les 5 secondes via `getTranscriptionStatus()`, max 60 tentatives (5 minutes). Le polling est lance en arriere-plan via `void pollStatus()` et notifie via toast.

**Normalisation des noms de fichiers** :

```typescript
const normalizeFilename = (name: string) =>
  name
    .normalize('NFD')                       // Decomposition Unicode
    .replace(/[\u0300-\u036f]/g, '')        // Suppression accents
    .replace(/[^a-zA-Z0-9._-]+/g, '_')     // Caracteres speciaux -> underscore
    .replace(/_+/g, '_')                    // Deduplication underscores
    .replace(/^_+|_+$/g, '')               // Trim underscores
```

### `useAudioRecorder()`

Gere la capture audio depuis le microphone via l'API `MediaRecorder`.

**Retour** :
```typescript
{
  // State
  status: 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error'
  duration: number             // Duree en secondes (mise a jour chaque seconde)
  audioBlob: Blob | null       // Blob WEBM apres arret
  audioUrl: string | null      // Object URL pour relecture (revoke au cleanup)
  error: string | null         // Message d'erreur lisible
  analyserNode: AnalyserNode | null  // Pour visualisation volume

  // Controles
  startRecording: () => Promise<void>
  pauseRecording: () => void
  resumeRecording: () => void
  stopRecording: () => void
  resetRecording: () => void   // Retour a idle, liberation ressources

  // Helpers
  getFile: () => File | null   // Convertit le Blob en File avec nom genere
  isSupported: boolean          // MediaRecorder supporte par le navigateur
}
```

**Implementation interne** :

```typescript
// 1. Demande de permission + creation MediaRecorder
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus'  // Fallback: 'audio/webm' si opus non supporte
})

// 2. Collecte des chunks
const chunks: Blob[] = []
mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) chunks.push(e.data)
}

// 3. Assemblage a l'arret
mediaRecorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'audio/webm' })
  setAudioBlob(blob)
  setAudioUrl(URL.createObjectURL(blob))
}

// 4. Timer via setInterval (pause-aware)

// 5. AnalyserNode pour visualisation
const audioContext = new AudioContext()
const source = audioContext.createMediaStreamSource(stream)
const analyser = audioContext.createAnalyser()
source.connect(analyser)
```

**Conversion Blob -> File** :

```typescript
const getFile = (): File | null => {
  if (!audioBlob) return null
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss')
  return new File([audioBlob], `recording_${timestamp}.webm`, {
    type: 'audio/webm',
  })
}
```

**Cleanup** :

```typescript
// Au unmount ou au reset:
// 1. Arreter toutes les pistes du stream
stream.getTracks().forEach(track => track.stop())
// 2. Revoquer l'Object URL
if (audioUrl) URL.revokeObjectURL(audioUrl)
// 3. Fermer l'AudioContext
audioContext.close()
// 4. Clearner le timer
clearInterval(timerRef.current)
```

**Fallback mimeType** :

```typescript
const getMimeType = (): string => {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm'
}
```

**Duree max** : L'enregistrement s'arrete automatiquement apres 60 minutes via une verification dans le timer.

---

### `useAudioPlayer(audioUrl)`

Controle le player audio HTML5.

**State** :
```typescript
{
  isPlaying: boolean
  currentTime: number       // secondes
  duration: number
  playbackRate: number      // 0.5 - 2x
  volume: number            // 0 - 1
  isMuted: boolean
  isLoading: boolean
  error: string | null
}
```

**Controles** :
- `play()`, `pause()`, `togglePlay()`
- `seek(time)` — Positionner en secondes
- `setPlaybackRate(rate)` — Vitesses: 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2
- `setVolume(volume)` — 0 a 1
- `toggleMute()`
- `skipForward(seconds)`, `skipBackward(seconds)` — Default 10s

**Helpers** :
- `formatTime(seconds)` : `"1:23:45"` ou `"3:45"`
- `formatTimeMs(milliseconds)` : Millisecondes vers format temps

**Pattern** : Le hook cree un element `<audio>` via `useRef` et attache les event listeners. Il preserve `playbackRate` et `volume` quand l'URL change (changement d'audio).

### `useAnalysisTemplates(category?)`

Fetch les templates d'analyse actifs.

```typescript
const { data: templates, isLoading } = useAnalysisTemplates('meeting')
```

### `useAnalysisTemplatesGrouped()`

Retourne les templates groupes par categorie pour le TemplatePickerModal.

```typescript
const { grouped, categories, isLoading } = useAnalysisTemplatesGrouped()
// grouped = { general: [...], meeting: [...], sales: [...] }
// categories = ['general', 'meeting', 'sales']
```

### `useTranscriptAnalyses(transcriptId)`

Fetch les analyses pour un transcript specifique.

### `useGenerateAnalysis()`

Mutation React Query pour generer une analyse.

```typescript
const generateAnalysis = useGenerateAnalysis()
const result = await generateAnalysis.mutateAsync({
  transcript_id: 'uuid',
  template_slug: 'summary',
})
```

### `useDeleteAnalysis()`

Mutation React Query pour supprimer une analyse.

---

## Patterns UI

### Badges de statut

```typescript
const statusConfig = {
  pending:    { label: 'En attente',   color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  processing: { label: 'En cours',    color: 'bg-blue-100 text-blue-800',     icon: Loader2 },
  completed:  { label: 'Termine',     color: 'bg-green-100 text-green-800',   icon: CheckCircle },
  failed:     { label: 'Echoue',      color: 'bg-red-100 text-red-800',       icon: XCircle },
}
```

### Priorites (analyses meeting-minutes)

```typescript
const priorityColors = {
  high:   'text-red-600 bg-red-50',
  medium: 'text-yellow-600 bg-yellow-50',
  low:    'text-green-600 bg-green-50',
}
```

### Copie section

Chaque section d'une analyse a un bouton "Copier" qui copie le contenu en texte brut dans le presse-papier.

### Categories de templates

```typescript
const CATEGORY_LABELS = {
  general:   'General',
  meeting:   'Reunion',
  sales:     'Vente',
  support:   'Support',
  interview: 'Entretien',
}

const CATEGORY_ICONS = {
  general:   FileText,
  meeting:   Users,
  sales:     DollarSign,
  support:   HelpCircle,
  interview: UserCheck,
}
```

---

## Dependances frontend

| Package | Usage |
|---------|-------|
| `@tanstack/react-query` | Cache, mutations, polling |
| `@supabase/supabase-js` | Client Supabase (auth, storage, DB, functions) |
| `lucide-react` | Icones (Mic, MicOff, Square, Pause, Play, RotateCcw) |
| `date-fns` | Formatage de dates |
| shadcn/ui | Dialog, ScrollArea, Tabs, Slider, Popover, Calendar, Badge, Button, etc. |
