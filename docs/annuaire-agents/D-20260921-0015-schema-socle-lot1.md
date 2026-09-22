# Annuaire des agents — schéma socle (lot 1)

**Statut : FIGÉ.** Validé par l'architecte (Lionel) contre STD-032, ajustement status/degraded intégré (cf. §« Décisions de l'architecte, intégrées »). L'amendement STD-032 peut suivre.

Demande : D-20260921-0015 (lot 1/3). Chantier : J-20260814-0002. Coordonné par batiscan.

## Périmètre du lot 1

Le socle et le format de l'annuaire : l'entité `agents[]`, les champs d'Agent Card, la relation agent → session. **Hors scope** : la première charge des 21 agents (lot 2), la self-registration (lot 3), le métier des orchestrateurs.

## Fait fondateur

Sur 8 panes vérifiés dans l'inventaire de lot 2, 2 étaient morts (`wE:p13`, `w6:pW`), relevés 15-20 septembre — jusqu'à six jours d'écart. **L'identité (nom, rôle) est stable. Le pane et l'adresse sont volatils.** Un schéma qui grave le volatil sur l'agent ment dès sa mise en service.

`infra-ops` porte trois adresses de messagerie pour un seul agent (trois sessions vues) : preuve que l'adresse n'est pas un attribut de l'agent, mais de la session.

## Les trois contraintes de l'architecte, absorbées

1. **Rattachement au tableau `sessions[]` existant** (STD-032 §2.4, déjà présent, toujours `[]` côté clients) — pas de seconde structure. Chaque session référence son agent par **nom** (`sessions[].agent_name`), jamais l'inverse.
2. **`agents[].url` et `agents[].agent_card_url` passent d'obligatoires à optionnels.** L'adresse vit sur la session (`sessions[].address`). Bump `isomorphic_version` → `"1.1"`.
3. **Aucun champ propre à Somtech dans `agents[]`.** Un bloc d'extension optionnel et nommé (`agents[].extensions.somtech`, clé isomorphe) accueille les champs propres à Somtech — contenu défini par l'architecte, cf. §« Décisions de l'architecte, intégrées ».

## Schéma proposé

### `agents[]` — entité agent (Agent Card, A2A v1.0 + assouplissement STD-032 §2.3)

| Champ | Type | Oblig. | Changement vs 1.0 | Description |
|---|---|---|---|---|
| `name` | string | ✅ | inchangé | Identifiant de l'agent (`{secteur}-{role}` ou nom propre herdr, ADR-030 §2) |
| `sector` | enum | ✅ | inchangé | `ing` / `ops` / `rh` / `vente` |
| `url` | URL | ⬜ **optionnel** | 🔴 était obligatoire | URL HTTPS de l'agent, si joignable en HTTP |
| `agent_card_url` | URL | ⬜ **optionnel** | 🔴 était obligatoire | URL du `/.well-known/agent-card.json`, si exposé |
| `status` | enum | ✅ (sortie) | 🔴 **calculé, jamais stocké — DEUX mécanismes concurrents (ajusté)** | Voir §« Décisions de l'architecte, intégrées » |
| `last_seen` | ISO 8601 | ✅ (sortie) | 🔴 **calculé, jamais stocké** | `agent_card_url` présent → dernier pull réussi ; sinon `max(sessions[].last_seen)` pour cet agent. Absent si aucune des deux sources n'existe. |
| `extensions.somtech` | object | ⬜ optionnel | 🆕 nouveau | Bloc nommé, isomorphe, hors standard A2A — contenu défini par l'architecte, cf. §« Décisions de l'architecte, intégrées » |

`status` et `last_seen` restent dans la réponse agrégée pour la compatibilité des consommateurs existants, mais ne sont **plus une source** : ils n'existent dans aucune configuration ni base d'agent, uniquement dérivés (par pull ou par `sessions[]` selon l'agent) au moment de la génération.

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

## Décisions de l'architecte, intégrées

**`status` — deux mécanismes concurrents, pas un remplacement.** STD-032 I7 définit déjà un calcul par **pull** (`degraded` après 1 échec, `offline` après 3 échecs consécutifs) pour les agents qui exposent `agent_card_url`. La version précédente de ce projet faisait de `sessions[]` la seule source — ça écrasait ce mécanisme au lieu de le compléter. Réglé ainsi :

- **Agent avec `agent_card_url`** → `status` calculé par **pull** (STD-032 §2.8/I7, inchangé) : `online` / `degraded` (1 échec) / `offline` (3 échecs consécutifs).
- **Agent sans `agent_card_url`** (cas herdr/pane, sans endpoint HTTP) → `status` calculé depuis **`sessions[]`** : `online` si ≥ 1 session `state=live` avec `last_seen` dans le TTL, sinon `offline`.
- `degraded` reste **atteignable uniquement par le mécanisme de pull** — `sessions[].state` (`live`/`closed`) ne cherche pas à le produire. Un agent sans `agent_card_url` n'a donc que deux états possibles (`online`/`offline`), ce qui est cohérent : sans pull, il n'y a pas de notion de « répond mais dégradé ».

**Rétro-compatibilité** — lecture (a) retenue : un payload 1.0 valide reste valide en 1.1 (assouplissement de deux champs obligatoires). Aucun consommateur externe réel aujourd'hui ; `isomorphic_version` est l'échappatoire prévue par STD-032 §6. Pas de double-publication.

**`extensions.somtech`** — contenu défini par l'architecte, tous les champs optionnels :

| Champ | Type | Description |
|---|---|---|
| `mandate` | string? | `D-…` / `P-…` / `J-…` — chantier actif (décision du dirigeant, 21 sept.) |
| `repo` | string? | Dépôt du chantier (STD-028) |
| `application_id` | string? | Pointeur vers l'application ServiceDesk (D-20260921-0018) |
| `born_at` | ISO 8601? | Naissance de l'agent |
| `closed_at` | ISO 8601? | Fermeture de l'agent |

## Hors de ce lot (rappel)

Ne sont pas dans ce projet : la première charge des 21 agents avec leurs valeurs réelles (lot 2, dépend de la validation de ce schéma) ; le mécanisme de self-registration qui écrira `sessions[]` à la naissance et à la fermeture (lot 3) ; toute décision sur le métier des orchestrateurs.
