/**
 * Le canvas éditable. Deux responsabilités :
 *  - à chaque changement (débouncé), sauvegarder la scène ET pousser un PNG au pane ;
 *  - appliquer les scènes poussées par le serveur quand Claude modifie le fichier.
 */
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Excalidraw, exportToBlob, convertToExcalidrawElements } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

const SAVE_DEBOUNCE_MS = 400

/** Un élément déjà complet porte les champs internes d'Excalidraw. */
const isComplete = (element) =>
  typeof element?.seed === 'number' && typeof element?.versionNonce === 'number'

/**
 * Un agent écrit naturellement des éléments minimaux ({type, x, y, width, height}).
 * Excalidraw les affiche, mais les jette au rechargement suivant faute des champs
 * internes — le travail de l'agent disparaîtrait. On complète donc les squelettes.
 *
 * Élément par élément : passer un élément DÉJÀ complet dans le convertisseur le
 * dénature (il ressort filtré au chargement suivant), donc on n'y touche pas.
 */
const normalize = (elements) =>
  (elements ?? []).flatMap((element) =>
    isComplete(element) ? [element] : convertToExcalidrawElements([element]),
  )

function App() {
  const [api, setApi] = useState(null)
  const [initial, setInitial] = useState(null)
  const timer = useRef(null)
  /** Une scène poussée par le serveur ne doit pas être renvoyée au serveur. */
  const applyingRemote = useRef(false)
  /** Vrai dès qu'on a vu la scène montée : avant ça, une scène vide ne prouve rien. */
  const hydrated = useRef(false)

  useEffect(() => {
    fetch('/api/scene')
      .then((r) => r.json())
      .then((scene) => {
        hydrated.current = (scene.elements ?? []).length === 0 // rien à perdre : un canvas vide l'est déjà
        setInitial({ elements: normalize(scene.elements), appState: { viewBackgroundColor: '#ffffff' } })
      })
      .catch(() => setInitial({ elements: [] }))
  }, [])

  // Écritures de Claude → appliquées sans réinitialiser la vue (zoom/scroll préservés).
  useEffect(() => {
    if (!api) return
    const socket = new WebSocket(`ws://${location.host}/ws`)
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type !== 'scene:update') return
      applyingRemote.current = true
      api.updateScene({ elements: normalize(message.scene.elements) })
      // Levé APRÈS le débounce : le onChange déclenché par updateScene arrive plus
      // tard, et doit encore être reconnu comme « venu de l'agent ».
      setTimeout(() => (applyingRemote.current = false), SAVE_DEBOUNCE_MS + 100)
    }
    return () => socket.close()
  }, [api])

  /** L'aperçu du pane. Toujours régénéré, même quand la scène vient de l'agent. */
  const pushPreview = useCallback(async () => {
    if (!api) return
    // Échelle 1 : cette version d'Excalidraw applique `exportScale` au dessin sans
    // agrandir le cadre — l'image sortirait rognée sur son coin haut-gauche. Le
    // terminal met de toute façon l'image à l'échelle du pane.
    const blob = await exportToBlob({
      elements: api.getSceneElements(),
      appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false, exportScale: 1 },
      files: api.getFiles(),
      mimeType: 'image/png',
      exportPadding: 16,
    })
    await fetch('/api/preview', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: await blob.arrayBuffer(),
    })
  }, [api])

  /** La sauvegarde du fichier. Uniquement pour les changements venus d'ici. */
  const saveScene = useCallback(async () => {
    if (!api) return
    const elements = api.getSceneElements()

    // Tant que la scène chargée n'est pas montée, l'API renvoie une scène vide.
    // Sauvegarder à ce moment-là effacerait le dessin au premier rechargement.
    if (elements.length > 0) hydrated.current = true
    const allowEmpty = hydrated.current ? '?allowEmpty=1' : ''

    await fetch(`/api/scene${allowEmpty}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'excalidraw',
        version: 2,
        source: 'herdr-excalidraw',
        elements,
        appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor },
        files: api.getFiles(),
      }),
    })
    await pushPreview()
  }, [api, pushPreview])

  const onChange = useCallback(() => {
    clearTimeout(timer.current)
    // Une scène venue de l'agent ne doit pas être réécrite (boucle d'écho), mais
    // le pane doit quand même la refléter : on rafraîchit l'aperçu sans sauvegarder.
    const action = applyingRemote.current ? pushPreview : saveScene
    timer.current = setTimeout(action, SAVE_DEBOUNCE_MS)
  }, [saveScene, pushPreview])

  // Premier aperçu dès l'ouverture : le pane ne doit pas rester vide.
  useEffect(() => {
    if (api && initial) pushPreview()
  }, [api, initial, pushPreview])

  if (!initial) return null

  return (
    <Excalidraw
      excalidrawAPI={setApi}
      initialData={initial}
      onChange={onChange}
      langCode="fr-FR"
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
    />
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
