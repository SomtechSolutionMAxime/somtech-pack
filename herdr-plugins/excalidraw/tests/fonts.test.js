import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fontsToPreload, DEFAULT_FONT_FAMILY } from '../web/src/fonts.js'

// Régression T-20260721-0001 : au premier rendu, les web-fonts pas encore
// chargées → texte coupé. Il faut savoir QUELLES polices attendre avant de
// re-mesurer. Ces tests verrouillent cette déduction.

test('déduit Excalifont pour un texte en fontFamily 5', () => {
  const specs = fontsToPreload([{ type: 'text', fontFamily: 5, text: 'x' }])
  assert.deepEqual(specs, ['20px Excalifont'])
})

test('retombe sur Excalifont (défaut hand-drawn) quand fontFamily est absent', () => {
  const specs = fontsToPreload([{ type: 'text', text: 'x' }])
  assert.equal(DEFAULT_FONT_FAMILY, 5)
  assert.deepEqual(specs, ['20px Excalifont'])
})

test('collecte toutes les polices distinctes de la scène, dédupliquées', () => {
  const specs = fontsToPreload([
    { type: 'text', fontFamily: 5, text: 'a' },
    { type: 'text', fontFamily: 6, text: 'b' }, // Nunito
    { type: 'text', fontFamily: 5, text: 'c' }, // doublon Excalifont
  ])
  assert.deepEqual(specs, ['20px Excalifont', '20px Nunito'])
})

test('ignore les éléments non-texte (rectangles, flèches…)', () => {
  const specs = fontsToPreload([
    { type: 'rectangle', x: 0, y: 0 },
    { type: 'arrow', points: [[0, 0], [1, 1]] },
  ])
  assert.deepEqual(specs, [])
})

test('honore la taille de police demandée', () => {
  assert.deepEqual(fontsToPreload([{ type: 'text', fontFamily: 5 }], 16), ['16px Excalifont'])
})

test('tolère une entrée vide ou nulle', () => {
  assert.deepEqual(fontsToPreload(undefined), [])
  assert.deepEqual(fontsToPreload([]), [])
  assert.deepEqual(fontsToPreload([null]), [])
})
