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
  /** Chargement raté = on ne sait pas ce qu'il y avait : on n'écrit plus rien. */
  const loadFailed = useRef(false)
  /** Dernière scène écrite : évite de réécrire le fichier sur un simple zoom. */
  const lastSaved = useRef(null)
  const [warning, setWarning] = useState(null)

  useEffect(() => {
    fetch('/api/scene')
      .then((r) => r.json())
      .then((scene) => {
        hydrated.current = (scene.elements ?? []).length === 0 // rien à perdre : un canvas vide l'est déjà
        setInitial({ elements: normalize(scene.elements), appState: { viewBackgroundColor: '#ffffff' } })
      })
      .catch((err) => {
        // Afficher un canvas vide ici serait un piège : le premier trait de
        // l'utilisateur écraserait un fichier qu'on n'a jamais réussi à lire.
        loadFailed.current = true
        setWarning(`Canvas non chargé (${err.message}) — sauvegarde désactivée pour ne rien écraser.`)
        setInitial({ elements: [] })
      })
  }, [])

  // Écritures de Claude → appliquées sans réinitialiser la vue (zoom/scroll préservés).
  useEffect(() => {
    if (!api) return
    const socket = new WebSocket(`ws://${location.host}/ws?role=editor`)
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
    if (!api || loadFailed.current) return
    const elements = api.getSceneElements()

    // Excalidraw notifie aussi les changements de vue (zoom, scroll, sélection).
    // Réécrire le fichier pour ça produirait du bruit git et élargirait la
    // fenêtre de collision avec les écritures de l'agent.
    const signature = JSON.stringify(elements)
    if (signature === lastSaved.current) return pushPreview()

    // Tant que la scène chargée n'est pas montée, l'API renvoie une scène vide.
    // Sauvegarder à ce moment-là effacerait le dessin au premier rechargement.
    if (elements.length > 0) hydrated.current = true
    const allowEmpty = hydrated.current ? '?allowEmpty=1' : ''

    const res = await fetch(`/api/scene${allowEmpty}`, {
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
    }).catch((err) => ({ ok: false, statusText: err.message }))

    // Une sauvegarde refusée en silence, c'est un utilisateur qui croit que son
    // travail est enregistré alors qu'il ne l'est pas.
    if (!res.ok) {
      setWarning(`Sauvegarde refusée (${res.status ?? ''} ${res.statusText}) — le fichier n'a pas été modifié.`)
      return
    }
    setWarning(null)
    lastSaved.current = signature
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
    <>
      {warning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, padding: '8px 12px',
          background: '#ffec99', color: '#5f3f00', font: '13px system-ui', textAlign: 'center',
        }}>
          {warning}
        </div>
      )}
      <Excalidraw
      excalidrawAPI={setApi}
      initialData={initial}
      onChange={onChange}
      langCode="fr-FR"
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
