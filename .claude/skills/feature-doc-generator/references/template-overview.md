# Template : Overview (overview.md)

Structure à suivre pour le fichier `overview.md` de chaque feature documentée.

---

```markdown
# [Nom de la feature]

## Description

[1-2 paragraphes décrivant ce que la feature fait, le problème qu'elle résout, et la valeur apportée à l'utilisateur final.]

## Architecture globale

[Diagramme textuel ou description de l'architecture haut niveau.]

Exemple :
```
Utilisateur → Front-end (React) → API REST → Service métier → Fournisseur externe
                                                    ↓
                                              Base de données
```

## Stack technique

| Couche | Technologie | Version | Rôle |
|--------|------------|---------|------|
| Front-end | [ex: React] | [ex: 18.x] | [ex: Interface utilisateur] |
| Back-end | [ex: .NET 8] | [ex: 8.0] | [ex: API REST et logique métier] |
| Base de données | [ex: PostgreSQL] | [ex: 15] | [ex: Stockage des données] |
| Fournisseur externe | [ex: OpenAI Whisper] | [ex: v1] | [ex: Transcription audio] |

## Flux de données principal

[Décrire le flux de données de bout en bout.]

1. L'utilisateur [action]
2. Le front-end [traitement]
3. L'API [endpoint et traitement]
4. Le service [logique métier]
5. [Résultat retourné]

## Prérequis

- [Prérequis 1 : ex: Compte chez le fournisseur X avec clé API]
- [Prérequis 2 : ex: Base de données PostgreSQL configurée]

## Documents connexes

- `backend.md` — Détails back-end
- `frontend.md` — Détails front-end
- `api-providers.md` — Fournisseurs externes
- `database.md` — Schéma de données
- `implementation-guide.md` — Guide pas-à-pas
```
