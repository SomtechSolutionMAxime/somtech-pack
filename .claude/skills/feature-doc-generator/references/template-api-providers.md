# Template : APIs et fournisseurs (api-providers.md)

Structure à suivre pour le fichier `api-providers.md`.

---

```markdown
# [Nom de la feature] — APIs et fournisseurs externes

## Vue d'ensemble des intégrations

| Fournisseur | Service | Rôle | Pricing |
|-------------|---------|------|---------|
| [ex: OpenAI] | [ex: Whisper API] | [ex: Transcription audio] | [ex: ~$0.006/min] |

## [Fournisseur 1]

### Pourquoi ce fournisseur

[Justification du choix.]

**Alternatives évaluées :**

| Fournisseur | Avantages | Inconvénients | Raison du rejet |
|-------------|-----------|---------------|-----------------|
| [Alternative 1] | [+] | [-] | [Raison] |

### Configuration

**Variables d'environnement :**
```env
[PROVIDER]_API_KEY=sk-...
[PROVIDER]_API_URL=https://api.provider.com/v1
[PROVIDER]_TIMEOUT=30000
```

### Utilisation de l'API

**Endpoint principal :**
```
POST https://api.provider.com/v1/[endpoint]
Authorization: Bearer {API_KEY}
```

**Request / Response :** [Exemples JSON]

### Client wrapper

```
class [Provider]Client {
  constructor(apiKey, options) { ... }
  async [mainMethod](input) {
    // 1. Valider input
    // 2. Appeler API avec retry
    // 3. Parser et retourner
  }
}
```

### Limites et contraintes

| Contrainte | Valeur | Impact |
|-----------|--------|--------|
| Rate limit | [ex: 50 req/min] | [Action] |
| Taille max | [ex: 25MB] | [Action] |
| Coût estimé | [ex: $X/unité] | [Budget] |

### Gestion des erreurs

| Code | Signification | Action |
|------|---------------|--------|
| 401 | Clé invalide | Vérifier config |
| 429 | Rate limit | Retry avec backoff |

### Gotchas

- [Piège et solution]
```
