# Architecture de sécurité (source de vérité)

Ce document est la **source de vérité** sécurité utilisée par le workflow `mockmig.*` (inventaire/validation/implémentation).

## Objectif

- Définir les règles minimales de sécurité à respecter lors de la migration d’une maquette vers un module produit.
- Servir de référence explicite pour les décisions du `02_validation_packet.md`.

## Principes (non négociables)

- **Moindre privilège** : accès par défaut fermé, ouverture explicite.
- **Séparation des responsabilités** : permissions par rôle + par scope (ex: organisation/projet).
- **Validation stricte des entrées** : côté client *et* côté serveur.
- **Traçabilité** : journaliser les actions sensibles sans exposer de secrets.
- **Secrets** : jamais en code, jamais en logs, jamais en artefacts mockmig.

## Données & accès

- **Données sensibles** : identifier (PII, finance, credentials, tokens, documents privés).
- **Scopes** : définir les frontières (ex: tenant / organisation / projet / dossier).
- **RLS / policies** : toute table exposée doit avoir des politiques claires (select/insert/update/delete).

## AuthN / AuthZ

- AuthN : mécanisme d’authentification du projet (SSO/Email/etc.).
- AuthZ : règles d’autorisation (RBAC/ABAC) à documenter dans le PRD module.
- **Contrôles obligatoires** :
  - lecture limitée au tenant
  - écriture limitée aux rôles autorisés
  - opérations destructrices protégées (confirmation, audit)

## API / Backend

- Erreurs : messages explicites mais non révélateurs (pas de stack/secret).
- Rate limiting / abuse : prévoir garde-fous si endpoints publics.
- Validation : schémas (types, formats, limites, dépendances).

## UI / Frontend

- Validation UI : états loading/erreur, messages, contraintes.
- Données : ne jamais afficher des champs non autorisés.
- **Après modif UI** : validation navigateur + console sans erreurs.

## Checklist mockmig (à copier dans `02_validation_packet.md`)

- [ ] Rôles identifiés + matrice d’accès (CRUD) par entité
- [ ] Scopes identifiés (tenant/org/projet) + règles de filtrage
- [ ] Validation entrées (client + serveur)
- [ ] RLS/policies (si DB exposée) + tests minimaux
- [ ] Pas de secrets dans les artefacts / logs

