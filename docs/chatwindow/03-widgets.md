# 03 — Widgets (contrat, renderer, cookbook)

## Source de vérité

- Contrat canonique : `agentbuilder/WIDGETS_CONTRACT.md`
- Types : `src/types/chat.ts`
- Renderer : `src/components/chat/ChatWidget.tsx`
- Preview : `src/pages/WidgetPlayground.tsx`

## Contrat `ChatWidget`

Format canonique (transport SSE) :

```json
{ "type": "widget", "widget": { /* ChatWidget */ } }
```

Rappel : le frontend rend le widget **uniquement** si `widget.type` est supporté par le renderer.

## Types supportés (renderer actuel)

Supportés dans `src/components/chat/ChatWidget.tsx` :
- `button`
- `form`
- `select`
- `checkbox`
- `radio`
- `summary_confirm`

À noter :
- `input` existe dans les types TS mais **n’est pas rendu** actuellement.

## Données `data` attendues par type

### `button`

- `actions[]` : liste des boutons à afficher.

### `form`

`data` attend généralement :
- `description?: string`
- `fields: Array<{ name, type, label, required? }>`
- valeurs initiales possibles : clés au même niveau que `fields` (ex: `titre`, `description`, etc.)

Le renderer initialise `formData` à partir de `widget.data`.

### `select`

`data` :
- `options: Array<{ value, label }>`
- `value?: string` (optionnel)

Le renderer déclenche automatiquement l’unique action si `actions.length === 1`.

### `checkbox`

`data` :
- `options: Array<{ value, label }>`

`formData[option.value]` devient un bool.

### `radio`

`data` :
- `options: Array<{ value, label }>`
- `value?: string`

Comme `select`, auto-trigger si une seule action.

### `summary_confirm`

`data` :
- `title?: string`
- `understood?: string[]`
- `confirmation?: string`
- `next_step?: string`

Spécificité : le renderer envoie un contexte **minimal** à l’action (`{ widget_id: widget.id }`) pour éviter d’envoyer tout `widget.data`.

## Convention d’exécution des actions

Lorsqu’un utilisateur déclenche une action :
- `payload` (valeurs fixes) est fusionné avec `formData` (valeurs saisies)
- le frontend déclenche ensuite `triggerAction(action.action, mergedPayload)`

Recommandations :
- `action.action` = identifiant stable (`open_url`, `navigate`, `create_ticket`, `set_priority`, etc.)
- `payload` = valeurs immuables (ex: `{ path: "/requests/..." }`)

## Widget Playground (page de gestion)

Route : `/admin/widget-playground` (protégée).

Fonctions :
- prévisualiser les widgets
- copier le JSON du widget
- copier l’enveloppe SSE (“event”) attendue par le frontend
- déclencher des actions en mode “debug” (toast + `console.log`)

Fichier : `src/pages/WidgetPlayground.tsx`.

## Ajouter un nouveau type de widget (standard)

Checklist :
1. Étendre le type TS dans `src/types/chat.ts` (si besoin).
2. Implémenter le rendu dans `src/components/chat/ChatWidget.tsx`.
3. Ajouter un exemple dans `src/pages/WidgetPlayground.tsx`.
4. Mettre à jour le contrat dans `agentbuilder/WIDGETS_CONTRACT.md`.
5. Valider dans le Playground + bulle (console = 0 erreur).

## Cookbook (exemples)

Les exemples “copiables” sont déjà fournis dans :
- `agentbuilder/WIDGETS_CONTRACT.md`
- `src/pages/WidgetPlayground.tsx` (exemples UI)

Bonne pratique : maintenir **les deux** en cohérence (contrat = source de vérité ; playground = preuve UI).

