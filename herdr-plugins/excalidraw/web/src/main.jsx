/**
 * Le canvas éditable. Deux responsabilités :
 *  - à chaque changement (débouncé), sauvegarder la scène ET pousser un PNG au pane ;
 *  - appliquer les scènes poussées par le serveur quand Claude modifie le fichier.
 */
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Excalidraw, exportToBlob, convertToExcalidrawElements } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { fontsToPreload } from './fonts.js'

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
  /** Éléments bruts de la scène initiale : reconvertis une fois les polices prêtes (anti-clip). */
  const rawInitial = useRef([])
  const [warning, setWarning] = useState(null)

  useEffect(() => {
    fetch('/api/scene')
      .then((r) => r.json())
      .then((scene) => {
        hydrated.current = (scene.elements ?? []).length === 0 // rien à perdre : un canvas vide l'est déjà
        rawInitial.current = scene.elements ?? [] // gardés bruts pour la re-mesure post-polices
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

  /**
   * Le rendu du dessin, poussé au serveur pour qu'un agent puisse le RELIRE.
   * Le navigateur est le seul à savoir dessiner un Excalidraw fidèlement.
   * Échelle 1 : cette version applique `exportScale` au dessin sans agrandir le
   * cadre — l'image sortirait rognée.
   */
  const pushRender = useCallback(async () => {
    if (!api) return
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
    }).catch(() => {})
  }, [api])

  /** La sauvegarde du fichier. Uniquement pour les changements venus d'ici. */
  const saveScene = useCallback(async () => {
    if (!api || loadFailed.current) return
    const elements = api.getSceneElements()

    // Excalidraw notifie aussi les changements de vue (zoom, scroll, sélection).
    // Réécrire le fichier pour ça produirait du bruit git et élargirait la
    // fenêtre de collision avec les écritures de l'agent.
    const signature = JSON.stringify(elements)
    if (signature === lastSaved.current) return pushRender()

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
    await pushRender()
  }, [api, pushRender])

  const onChange = useCallback(() => {
    clearTimeout(timer.current)
    // Une scène venue de l'agent ne doit pas être réécrite (boucle d'écho), mais son
    // rendu doit être rafraîchi : c'est ainsi que l'agent relit ce qu'il a dessiné.
    timer.current = setTimeout(applyingRemote.current ? pushRender : saveScene, SAVE_DEBOUNCE_MS)
  }, [saveScene, pushRender])

  // Un rendu dès l'ouverture : l'agent doit pouvoir relire un canvas qu'il n'a pas modifié.
  useEffect(() => {
    if (api && initial) pushRender()
  }, [api, initial, pushRender])

  // Anti-clip au premier rendu (T-20260721-0001).
  // `convertToExcalidrawElements` mesure la largeur des textes avec la police
  // COURANTE. Au tout premier rendu (cache froid), les web-fonts (Excalifont,
  // Nunito, …) ne sont pas encore chargées → largeurs sous-évaluées → texte
  // coupé à droite. Un zoom re-mesure et corrige, mais un chargement passif
  // reste coupé. Une fois les polices prêtes, on reconvertit la scène initiale
  // UNE fois pour re-mesurer — sauf si l'utilisateur a déjà modifié la scène
  // (on ne veut jamais écraser son travail).
  const remeasured = useRef(false)
  useEffect(() => {
    if (!api || !initial || remeasured.current) return
    if (!('fonts' in document)) return // navigateur sans Font Loading API : rien à faire
    remeasured.current = true
    let cancelled = false
    const baseline = api.getSceneElements().map((el) => el.id).join(',')
    ;(async () => {
      try {
        // Belt : forcer le chargement des polices de la scène au cas où
        // `fonts.ready` se résoudrait avant qu'Excalidraw ait lancé le leur.
        await Promise.all(
          fontsToPreload(rawInitial.current).map((spec) => document.fonts.load(spec).catch(() => {})),
        )
        await document.fonts.ready
      } catch {
        return // pas de re-mesure possible : on laisse le rendu initial tel quel
      }
      if (cancelled || loadFailed.current) return
      // Ne rien écraser : si la scène a changé depuis le montage, l'utilisateur a
      // édité → on renonce à la re-mesure (le clip se corrigera à la 1re interaction).
      if (api.getSceneElements().map((el) => el.id).join(',') !== baseline) return
      // Reconvertit avec les polices désormais chargées → largeurs correctes.
      // Marqué « remote » : pas une édition utilisateur, donc pas de réécriture fichier.
      applyingRemote.current = true
      api.updateScene({ elements: normalize(rawInitial.current) })
      setTimeout(() => (applyingRemote.current = false), SAVE_DEBOUNCE_MS + 100)
      pushRender()
    })()
    return () => { cancelled = true }
  }, [api, initial, pushRender])

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
