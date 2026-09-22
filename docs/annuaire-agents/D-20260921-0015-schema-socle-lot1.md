# Annuaire des agents — projet de schéma (lot 1)

**Statut : PROJET, non figé.** Soumis à validation de l'architecte (Lionel) contre STD-032 avant fixation. Ne pas committer comme amendement au STD tant que non validé.

Demande : D-20260921-0015 (lot 1/3). Chantier : J-20260814-0002. Coordonné par batiscan.

## Périmètre du lot 1

Le socle et le format de l'annuaire : l'entité `agents[]`, les champs d'Agent Card, la relation agent → session. **Hors scope** : la première charge des 21 agents (lot 2), la self-registration (lot 3), le métier des orchestrateurs.

## Fait fondateur

Sur 8 panes vérifiés dans l'inventaire de lot 2, 2 étaient morts (`wE:p13`, `w6:pW`), relevés 15-20 septembre — jusqu'à six jours d'écart. **L'identité (nom, rôle) est stable. Le pane et l'adresse sont volatils.** Un schéma qui grave le volatil sur l'agent ment dès sa mise en service.

`infra-ops` porte trois adresses de messagerie pour un seul agent (trois sessions vues) : preuve que l'adresse n'est pas un attribut de l'agent, mais de la session.

## Les trois contraintes de l'architecte, absorbées

1. **Rattachement au tableau `sessions[]` existant** (STD-032 §2.4, déjà présent, toujours `[]` côté clients) — pas de seconde structure. Chaque session référence son agent par **nom** (`sessions[].agent_name`), jamais l'inverse.
2. **`agents[].url` et `agents[].agent_card_url` passent d'obligatoires à optionnels.** L'adresse vit sur la session (`sessions[].address`). Bump `isomorphic_version` → `"1.1"`.
3. **Aucun champ propre à Somtech dans `agents[]`.** Un bloc d'extension optionnel et nommé accueille `chantier`, `dépôt`, `application`, `né le` / `fermé le` — **son contenu est défini par l'architecte dans l'amendement**, ce projet ne fait que réserver l'emplacement (`agents[].extensions.somtech`, clé isomorphe).

## Schéma proposé

### `agents[]` — entité agent (Agent Card, A2A v1.0 + assouplissement STD-032 §2.3)

| Champ | Type | Oblig. | Changement vs 1.0 | Description |
|---|---|---|---|---|
| `name` | string | ✅ | inchangé | Identifiant de l'agent (`{secteur}-{role}` ou nom propre herdr, ADR-030 §2) |
| `sector` | enum | ✅ | inchangé | `ing` / `ops` / `rh` / `vente` |
| `url` | URL | ⬜ **optionnel** | 🔴 était obligatoire | URL HTTPS de l'agent, si joignable en HTTP |
| `agent_card_url` | URL | ⬜ **optionnel** | 🔴 était obligatoire | URL du `/.well-known/agent-card.json`, si exposé |
| `status` | enum | ✅ (sortie) | 🔴 **calculé, jamais stocké** | `online` si ≥ 1 session avec `state=live` et `last_seen` dans le TTL, sinon `offline`. Agrégé à la lecture depuis `sessions[]` filtré sur `agent_name = name`. |
| `last_seen` | ISO 8601 | ✅ (sortie) | 🔴 **calculé, jamais stocké** | `max(sessions[].last_seen)` pour cet agent. Absent si l'agent n'a aucune session. |
| `extensions.somtech` | object | ⬜ optionnel | 🆕 nouveau | Bloc nommé, isomorphe, hors standard A2A — **contenu à définir par l'architecte** (candidats relevés par l'inventaire : `chantier`, `depot`, `application`, `born_at`, `closed_at`) |

`status` et `last_seen` restent dans la réponse agrégée pour la compatibilité des consommateurs existants, mais ne sont **plus une source** : ils n'existent dans aucune configuration ni base d'agent, uniquement dérivés de `sessions[]` au moment de la génération.

### `sessions[]` — relation agent → session (existant, contenu jusqu'ici non spécifié)

| Champ | Type | Oblig. | Description |
|---|---|---|---|
| `agent_name` | string | ✅ | Référence `agents[].name` — clé de la relation, portée par la session |
| `address` | string | ✅ | Locator volatil pour joindre cette session précise (opaque au schéma : pane herdr, endpoint A2A, canal de messagerie…) |
| `transport` | string | ⬜ optionnel | Indice d'interprétation de `address` (ex. `herdr-pane`, `a2a-url`, `messaging-channel`) — n'engage pas le standard, documentaire |
| `started_at` | ISO 8601 | ✅ | Naissance de **cette session** (pas de l'agent — un agent a une identité stable, une session a une naissance) |
| `last_seen` | ISO 8601 | ✅ | Dernière preuve de vie de cette session précise |
| `state` | enum `live` \| `closed` | ✅ | Explicite plutôt qu'inféré du seul `last_seen` — une fermeture propre (self-registration, lot 3) écrit `closed` immédiatement, sans attendre l'expiration du TTL |

Un agent peut porter 0..N sessions (0 = déclaré mais jamais né ou totalement éteint ; N>1 = plusieurs sessions vivantes ou une histoire de renaissances, cf. `infra-ops`).

## Point non tranché, porté à l'architecte

**« Rétro-compatible »** (contrainte 2) a deux lectures : (a) un payload 1.0 valide reste valide en 1.1 — vrai, on ne fait qu'assouplir deux champs obligatoires ; (b) un consommateur 1.0 qui exigeait `url`/`agent_card_url` peut échouer sur un payload 1.1 qui les omet — ça, ce n'est pas couvert par l'assouplissement seul. Je retiens la lecture (a) par défaut (cohérente avec « bump mineur ») ; l'architecte tranche si (b) doit aussi être garantie (auquel cas il faudrait un champ de repli ou une période de double-publication).

Le nom de la clé d'extension (`extensions.somtech` proposé) et l'énumération de son contenu restent à sa main — ce projet ne les invente pas.

## Hors de ce lot (rappel)

Ne sont pas dans ce projet : la première charge des 21 agents avec leurs valeurs réelles (lot 2, dépend de la validation de ce schéma) ; le mécanisme de self-registration qui écrira `sessions[]` à la naissance et à la fermeture (lot 3) ; toute décision sur le métier des orchestrateurs.
