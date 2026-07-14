/**
 * Le canvas éditable. Deux responsabilités :
 *  - à chaque changement (débouncé), sauvegarder la scène ET pousser un PNG au pane ;
 *  - appliquer les scènes poussées par le serveur quand Claude modifie le fichier.
 */
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

const SAVE_DEBOUNCE_MS = 400

function App() {
  const [api, setApi] = useState(null)
  const [initial, setInitial] = useState(null)
  const timer = useRef(null)
  /** Une scène poussée par le serveur ne doit pas être renvoyée au serveur. */
  const applyingRemote = useRef(false)

  useEffect(() => {
    fetch('/api/scene')
      .then((r) => r.json())
      .then((scene) => setInitial({ elements: scene.elements ?? [], appState: { viewBackgroundColor: '#ffffff' } }))
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
      api.updateScene({ elements: message.scene.elements })
      queueMicrotask(() => (applyingRemote.current = false))
    }
    return () => socket.close()
  }, [api])

  const persist = useCallback(async () => {
    if (!api) return
    const elements = api.getSceneElements()
    const appState = api.getAppState()
    const files = api.getFiles()

    await fetch('/api/scene', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'excalidraw',
        version: 2,
        source: 'herdr-excalidraw',
        elements,
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
        files,
      }),
    })

    // Le rendu du pane est produit ici : le navigateur est le seul à savoir
    // dessiner un Excalidraw fidèlement (mêmes polices, même trait).
    const blob = await exportToBlob({
      elements,
      appState: { ...appState, exportBackground: true, exportWithDarkMode: false },
      files,
      mimeType: 'image/png',
      exportPadding: 16,
      getDimensions: (width, height) => ({ width, height, scale: 2 }),
    })
    await fetch('/api/preview', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: await blob.arrayBuffer(),
    })
  }, [api])

  const onChange = useCallback(() => {
    if (applyingRemote.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(persist, SAVE_DEBOUNCE_MS)
  }, [persist])

  // Premier aperçu dès l'ouverture : le pane ne doit pas rester vide.
  useEffect(() => {
    if (api && initial) persist()
  }, [api, initial, persist])

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
