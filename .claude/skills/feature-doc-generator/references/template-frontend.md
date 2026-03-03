# Template : Front-end (frontend.md)

Structure à suivre pour le fichier `frontend.md`.

---

```markdown
# [Nom de la feature] — Front-end

## Architecture front-end

[Pattern UI : composants, state management, routing. Choix architecturaux.]

## Stack et librairies

| Librairie | Version | Rôle |
|-----------|---------|------|
| [ex: React] | [ex: 18.x] | Framework UI |
| [ex: TanStack Query] | [ex: 5.x] | Appels API et cache |

## Structure des fichiers

```
src/features/[feature]/
├── components/
├── hooks/
├── api/
├── types/
└── utils/
```

## Composants principaux

### [Feature]List

**Rôle :** [Description]

**Props :**
```typescript
interface [Feature]ListProps {
  filters?: FilterOptions;
  onSelect?: (item: [Feature]) => void;
}
```

**Comportements clés :**
- [ex: Pagination côté serveur]
- [ex: Recherche avec debounce]

### [Feature]Form

**Validations :**
- [ex: Champ X requis, max 255 caractères]

## Appels API

```typescript
const api = {
  getAll: (params) => httpClient.get('/api/[feature]', { params }),
  create: (data) => httpClient.post('/api/[feature]', data),
};
```

## State management

[Local vs global, stores/contexts, cache strategy.]

## UX et interactions

- [ex: Toast de succès après création]
- [ex: Skeleton loading]
- [ex: Confirmation modale avant suppression]

## Gotchas

- [Piège 1 et solution]
- [Piège 2 et solution]
```
