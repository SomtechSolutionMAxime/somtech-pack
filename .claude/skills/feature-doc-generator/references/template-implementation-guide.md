# Template : Guide d'implémentation (implementation-guide.md)

Ce fichier est le plus important : c'est celui qu'on pousse à Claude Code pour réimplémenter la feature.

---

```markdown
# [Nom de la feature] — Guide d'implémentation

## Résumé

[2-3 phrases décrivant la feature et ce que ce guide permet d'accomplir.]

## Prérequis

- [ ] [ex: Compte fournisseur X avec clé API]
- [ ] [ex: Base de données PostgreSQL]
- [ ] [ex: Node.js 18+]

## Étapes d'implémentation

### Étape 1 : Setup base de données

[Instructions. Référer à `database.md`.]

**Packages :** `[commande]`

### Étape 2 : Configuration fournisseur externe

[Instructions. Référer à `api-providers.md`.]

**Variables d'environnement :**
```env
[VARIABLE]=valeur
```

### Étape 3 : Back-end

[Instructions. Référer à `backend.md`.]

**Ordre de création :**
1. Modèles/Entités
2. Repository
3. Service
4. Controller
5. Configuration DI

### Étape 4 : Front-end

[Instructions. Référer à `frontend.md`.]

**Ordre de création :**
1. Types/Interfaces
2. Client API
3. Hooks
4. Composants UI
5. Routing

### Étape 5 : Tests

**Back-end :**
- [ ] Tests unitaires service
- [ ] Tests intégration endpoints
- [ ] Mock fournisseur externe

**Front-end :**
- [ ] Tests composants
- [ ] Tests hooks
- [ ] Tests e2e

### Étape 6 : Déploiement

- [ ] Variables d'environnement en production
- [ ] Migrations DB exécutées
- [ ] Clés API production
- [ ] Monitoring en place

## Estimation d'effort

| Étape | Effort |
|-------|--------|
| Base de données | [ex: 0.5 jour] |
| Fournisseur externe | [ex: 0.5 jour] |
| Back-end | [ex: 2-3 jours] |
| Front-end | [ex: 2-3 jours] |
| Tests | [ex: 1-2 jours] |
| **Total** | **[ex: 6-9 jours]** |

## Pièges courants

1. **[Piège]** — [Comment l'éviter]
2. **[Piège]** — [Comment l'éviter]

## Références

- `overview.md`, `backend.md`, `frontend.md`, `api-providers.md`, `database.md`
```
