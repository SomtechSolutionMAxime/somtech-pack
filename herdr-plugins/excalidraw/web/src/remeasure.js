/**
 * Re-mesure du texte après chargement des polices (T-20260721-0001).
 *
 * Excalidraw mesure la largeur des textes avec la police COURANTE. Au premier
 * rendu (cache froid), les web-fonts ne sont pas encore chargées → largeurs
 * sous-évaluées → texte coupé. Ce module porte la logique de re-mesure sous
 * forme pure/injectable (aucune dépendance React/Excalidraw/DOM) → testable
 * sous `node --test`. Le composant `main.jsx` ne fait que câbler les vraies
 * dépendances (document.fonts, l'API Excalidraw).
 */

/** Un élément déjà complet porte les champs internes d'Excalidraw. */
export const isComplete = (element) =>
  typeof element?.seed === 'number' && typeof element?.versionNonce === 'number'

/**
 * Signature de CONTENU de la scène : change dès qu'un élément est édité,
 * déplacé ou redimensionné (Excalidraw incrémente `version`/`versionNonce`).
 * Comparer les seuls ids ne suffit pas : une édition conserve l'id.
 */
export const sceneSignature = (elements) =>
  (elements ?? []).map((e) => `${e?.id}:${e?.version ?? ''}:${e?.versionNonce ?? ''}`).join('|')

/**
 * Seuls les squelettes texte INCOMPLETS sont mal mesurés avant le chargement
 * des polices (les éléments complets gardent leur width et ne sont pas
 * reconvertis). Inutile de re-mesurer s'il n'y en a aucun.
 */
export const hasIncompleteText = (rawElements) =>
  (rawElements ?? []).some((e) => e?.type === 'text' && !isComplete(e))

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Attend que TOUTES les polices `specs` soient réellement disponibles.
 * `fonts.ready` peut se résoudre trop tôt (Excalidraw n'a pas encore lancé le
 * chargement de ses FontFace), et `fonts.load(name)` est un no-op tant que la
 * FontFace n'est pas enregistrée. On vérifie donc `check()` et on réessaie un
 * court instant avant de renoncer.
 * @returns true si toutes chargées, false si timeout (on re-mesure quand même,
 *   au pire sans amélioration — jamais pire que l'état coupé initial).
 */
export async function waitForFonts(
  fontsApi,
  specs,
  { tries = 20, delayMs = 50, sleep = defaultSleep } = {},
) {
  if (!fontsApi || typeof fontsApi.check !== 'function') return false
  const specList = specs ?? []
  if (specList.length === 0) return true
  const kick = () => Promise.all(specList.map((s) => Promise.resolve(fontsApi.load?.(s)).catch(() => {})))
  await kick()
  try { if (fontsApi.ready) await fontsApi.ready } catch { /* ignore */ }
  for (let i = 0; i < tries; i++) {
    if (specList.every((s) => fontsApi.check(s))) return true
    await sleep(delayMs)
    await kick()
  }
  return specList.every((s) => fontsApi.check(s))
}

/**
 * Reconvertit la scène initiale une fois les polices prêtes, pour re-mesurer les
 * largeurs de texte. Renonce si :
 *  - il n'y a aucun squelette texte à re-mesurer ('no-text') ;
 *  - l'effet a été annulé entre-temps (StrictMode / démontage) ('cancelled') ;
 *  - l'utilisateur a édité la scène pendant le chargement ('user-edited') —
 *    garde anti-écrasement par signature de contenu.
 * Toutes les dépendances sont injectées → fonction testable sans DOM.
 * @returns 'no-text' | 'cancelled' | 'user-edited' | 'remeasured' | 'remeasured-fonts-timeout'
 */
export async function remeasureAfterFonts({
  rawElements,
  getSceneElements,
  normalize,
  updateScene,
  pushRender,
  waitForFonts: wait,
  isCancelled,
}) {
  if (!hasIncompleteText(rawElements)) return 'no-text'
  const baseline = sceneSignature(getSceneElements())
  const loaded = await wait()
  if (isCancelled?.()) return 'cancelled'
  if (sceneSignature(getSceneElements()) !== baseline) return 'user-edited'
  updateScene(normalize(rawElements))
  pushRender?.()
  return loaded ? 'remeasured' : 'remeasured-fonts-timeout'
}
