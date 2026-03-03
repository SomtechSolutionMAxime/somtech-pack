# Template : Back-end (backend.md)

Structure à suivre pour le fichier `backend.md`.

---

```markdown
# [Nom de la feature] — Back-end

## Architecture back-end

[Pattern utilisé : Clean Architecture, CQRS, MVC, etc. Justifier le choix.]

## Structure des fichiers

```
src/
├── Controllers/
│   └── [Feature]Controller
├── Services/
│   ├── I[Feature]Service
│   └── [Feature]Service
├── Models/
│   ├── [Feature]Entity
│   └── [Feature]Dto
├── Repositories/
│   └── [Feature]Repository
└── Configuration/
    └── [Feature]Config
```

[Adapter selon le framework.]

## Endpoints API

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/[feature]` | [Description] | Oui/Non |
| GET | `/api/[feature]/{id}` | [Description] | Oui/Non |

### Détail des endpoints

#### POST `/api/[feature]`

**Request body :**
```json
{ "field1": "string", "field2": 123 }
```

**Response (201) :**
```json
{ "id": "uuid", "status": "created" }
```

**Codes d'erreur :** 400 (validation), 401 (auth), 500 (serveur)

## Logique métier

[Règles métier, validations, transformations de données.]

### Traitement asynchrone

[Si applicable : jobs background, queues, workers, retry policy.]

## Configuration

### Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `[FEATURE]_API_KEY` | Clé API fournisseur | `sk-...` |

### Injection de dépendances

```csharp
// Exemple .NET — adapter selon le framework
services.AddScoped<I[Feature]Service, [Feature]Service>();
```

## Packages / Dépendances

| Package | Version | Usage |
|---------|---------|-------|
| [Package] | [Version] | [Usage] |

## Gestion d'erreurs

[Exceptions customs, middleware, logging.]

## Tests

[Approche : unitaires, intégration, mocks.]

## Gotchas

- [Piège 1 et solution]
- [Piège 2 et solution]
```
