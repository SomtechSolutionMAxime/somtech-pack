import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  isComplete,
  sceneSignature,
  hasIncompleteText,
  waitForFonts,
  remeasureAfterFonts,
} from '../web/src/remeasure.js'

// Régression T-20260721-0001 : ces tests verrouillent le CŒUR du fix
// (re-mesure post-polices), pas seulement le helper de polices.

const skeletonText = { type: 'text', x: 0, y: 0, text: 'coupé' } // pas de seed/versionNonce
const completeText = { type: 'text', id: 't1', seed: 1, versionNonce: 2, version: 1, width: 80 }

test('isComplete distingue squelette et élément complet', () => {
  assert.equal(isComplete(skeletonText), false)
  assert.equal(isComplete(completeText), true)
})

test('hasIncompleteText : vrai pour un squelette texte, faux sinon', () => {
  assert.equal(hasIncompleteText([skeletonText]), true)
  assert.equal(hasIncompleteText([completeText]), false) // déjà mesuré → rien à re-mesurer
  assert.equal(hasIncompleteText([{ type: 'rectangle' }]), false)
  assert.equal(hasIncompleteText([]), false)
})

test('sceneSignature change quand un élément est édité (id conservé)', () => {
  const before = [{ id: 'a', version: 1, versionNonce: 10 }]
  const movedSameId = [{ id: 'a', version: 2, versionNonce: 20 }] // déplacé : même id, version++
  assert.notEqual(sceneSignature(before), sceneSignature(movedSameId))
  assert.equal(sceneSignature(before), sceneSignature([{ id: 'a', version: 1, versionNonce: 10 }]))
})

// --- waitForFonts : retry jusqu'à disponibilité réelle ---

const immediateSleep = () => Promise.resolve()

test('waitForFonts : true quand toutes les polices passent check()', async () => {
  const api = { load: async () => {}, check: () => true, ready: Promise.resolve() }
  assert.equal(await waitForFonts(api, ['20px Excalifont'], { sleep: immediateSleep }), true)
})

test('waitForFonts : réessaie puis réussit (fonts.ready résolu trop tôt)', async () => {
  let calls = 0
  const api = {
    load: async () => {},
    ready: Promise.resolve(),
    check: () => ++calls >= 3, // pas prête aux 2 premiers check, prête ensuite
  }
  assert.equal(await waitForFonts(api, ['20px Excalifont'], { tries: 10, sleep: immediateSleep }), true)
})

test('waitForFonts : false après timeout si la police ne charge jamais', async () => {
  const api = { load: async () => {}, ready: Promise.resolve(), check: () => false }
  assert.equal(await waitForFonts(api, ['20px Excalifont'], { tries: 3, sleep: immediateSleep }), false)
})

test('waitForFonts : true immédiat si aucune police à charger', async () => {
  const api = { load: async () => {}, check: () => false }
  assert.equal(await waitForFonts(api, [], { sleep: immediateSleep }), true)
})

test('waitForFonts : false si Font Loading API absente', async () => {
  assert.equal(await waitForFonts(null, ['20px Excalifont']), false)
})

// --- remeasureAfterFonts : orchestration + gardes ---

const makeDeps = (over = {}) => {
  const calls = { updateScene: 0, pushRender: 0, normalized: null }
  return {
    calls,
    deps: {
      rawElements: [skeletonText],
      getSceneElements: () => [{ id: 'a', version: 1, versionNonce: 1 }],
      normalize: (els) => { calls.normalized = els; return [{ id: 'x', seed: 1, versionNonce: 1 }] },
      updateScene: () => { calls.updateScene++ },
      pushRender: () => { calls.pushRender++ },
      waitForFonts: async () => true,
      isCancelled: () => false,
      ...over,
    },
  }
}

test('remeasureAfterFonts : happy path → re-mesure et rend', async () => {
  const { calls, deps } = makeDeps()
  assert.equal(await remeasureAfterFonts(deps), 'remeasured')
  assert.equal(calls.updateScene, 1)
  assert.equal(calls.pushRender, 1)
  assert.equal(calls.normalized, deps.rawElements) // reconvertit bien la scène brute
})

test('remeasureAfterFonts : aucun texte incomplet → no-text, ne touche à rien', async () => {
  const { calls, deps } = makeDeps({ rawElements: [completeText] })
  assert.equal(await remeasureAfterFonts(deps), 'no-text')
  assert.equal(calls.updateScene, 0)
  assert.equal(calls.pushRender, 0)
})

test('remeasureAfterFonts : annulé (StrictMode/démontage) → cancelled, n\'écrase pas', async () => {
  const { calls, deps } = makeDeps({ isCancelled: () => true })
  assert.equal(await remeasureAfterFonts(deps), 'cancelled')
  assert.equal(calls.updateScene, 0)
})

test('remeasureAfterFonts : utilisateur a édité (même id, version changée) → user-edited, PAS d\'écrasement', async () => {
  let n = 0
  // 1er appel (baseline) puis 2e appel (après polices) : même id, version différente = édition
  const getSceneElements = () => (++n === 1
    ? [{ id: 'a', version: 1, versionNonce: 1 }]
    : [{ id: 'a', version: 2, versionNonce: 2 }])
  const { calls, deps } = makeDeps({ getSceneElements })
  assert.equal(await remeasureAfterFonts(deps), 'user-edited')
  assert.equal(calls.updateScene, 0) // le travail de l'utilisateur est préservé
})

test('remeasureAfterFonts : polices en timeout → re-mesure quand même (jamais pire que coupé)', async () => {
  const { calls, deps } = makeDeps({ waitForFonts: async () => false })
  assert.equal(await remeasureAfterFonts(deps), 'remeasured-fonts-timeout')
  assert.equal(calls.updateScene, 1)
})
