---
name: sync-app-state
description: |
  Synchronise le cache local .somtech/app-state.md avec le doc Somcraft /operations/<app-slug>/etat-app.md (source de vérité de la mémoire externe d'état d'app, STD-027).
  À utiliser quand le hook SessionStart signale un cache manquant ou stale (>7 jours), ou quand le doc Somcraft a été modifié hors Claude Code (par un humain ou un agent Orbit).
  DÉCLENCHEURS: /sync-app-state, sync app state, rafraîchir état app, refresh cache app state, sync mémoire app
---

# Sync App State — Rafraîchir le cache local (STD-027)

Ce skill rafraîchit `.somtech/app-state.md` (cache local) depuis le doc Somcraft `/operations/<app-slug>/etat-app.md` (source de vérité).

À utiliser quand :
- Le hook `SessionStart` a signalé que le cache local est **manquant**
- Le hook `SessionStart` a signalé que le cache est **stale** (> 7 jours)
- Tu sais que le doc Somcraft a été **modifié hors Claude Code** (humain dans Somcraft, agent Orbit, autre session)

## Pré-requis

- Le repo doit être lié (`.somtech/app.yaml` présent) — sinon, exécuter d'abord `/lier-app`
- `mcp__claude_ai_Somcraft__read_document` disponible

## Workflow

### 1. Vérifier le mapping local

Vérifier que `.somtech/app.yaml` existe :

```bash
test -f .somtech/app.yaml || { echo "Pas de mapping .somtech/app.yaml. Exécute d'abord /lier-app."; exit 1; }
```

Si absent : afficher le message ci-dessus et exit propre. Aucun fichier créé ou modifié.

### 2. Parser le mapping

Lire `.somtech/app.yaml` et extraire :
- `somcraft.workspace_id` (UUID du workspace **client**)
- `somcraft.app_state_doc_path` (par défaut `/operations/<app-slug>/etat-app.md`)
- `servicedesk.app_slug` et `app_name` (pour le résumé)

**Erreur** : si le YAML est mal formé ou si un champ obligatoire est manquant, afficher une erreur explicite avec la ligne fautive et exit. Ne pas modifier le cache.

### 3. Fetch depuis Somcraft

```
mcp__claude_ai_Somcraft__read_document
  workspace_id=<workspace_id>
  path=<app_state_doc_path>
```

**Erreurs gérées** :
- **Doc Somcraft introuvable** → afficher : « Doc Somcraft manquant à `<path>`. Exécute `/lier-app` pour le recréer (option « réinitialiser avec template »). »
- **MCP Somcraft indisponible** → afficher l'erreur reçue, **conserver le cache local inchangé** (pas d'écriture), exit en code d'erreur
- **Permissions insuffisantes** → afficher : « Permissions Somcraft insuffisantes sur le workspace `<id>`. Vérifie l'accès au workspace client. »

### 4. Écrire le cache local (overwrite)

Écrire le contenu reçu dans `.somtech/app-state.md` (overwrite complet).

**Discipline** : ne pas tenter de merger avec un cache existant — la source de vérité est Somcraft, point. Si une divergence locale existait, elle est perdue intentionnellement.

### 5. Résumé

Afficher à l'utilisateur :

```
✅ Cache .somtech/app-state.md rafraîchi

App         : <app_name> (<app_slug>)
Source      : Somcraft workspace <workspace_id> · <app_state_doc_path>
Taille      : <N> caractères (~<M> tokens estimés)
last_updated (frontmatter) : <valeur lue dans le doc>
updated_by  (frontmatter) : <valeur lue dans le doc>

Le hook SessionStart utilisera ce cache au prochain boot Claude Code.
```

## Erreurs gérées (récap)

| Cas | Comportement |
|---|---|
| `.somtech/app.yaml` absent | Message vers `/lier-app`, exit propre, aucune modif |
| YAML mal formé / champ obligatoire manquant | Erreur explicite avec ligne, exit, cache inchangé |
| Doc Somcraft introuvable au path indiqué | Message vers `/lier-app` pour recréer, cache inchangé |
| MCP Somcraft indisponible | Erreur réseau visible, cache inchangé, suggérer de relancer plus tard |
| Permissions Somcraft insuffisantes | Erreur explicite, cache inchangé |
| Doc Somcraft vide (0 octet) | Avertissement, écrit quand même (peut être intentionnel après reset) |

## Référence

- Convention : [STD-027](../../../../Architecture/standards/STD-027-memoire-externe-etat-app.md)
- Skills liés : `/lier-app` (provisioning), `/end-session` (étendu, écrit Somcraft + cache)
- Hook lié : `SessionStart` (`.claude/hooks/session-start-app-state.sh`) — appelle implicitement `/sync-app-state` via nudge à l'utilisateur quand cache stale ou manquant
- Demande parente : D-20260512-0004
- Story : T-20260512-0037 (epic E-20260512-0003)
