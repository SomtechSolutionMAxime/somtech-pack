---
name: lier-app
description: |
  Lie le repo courant à une application Somtech (ServiceDesk + Somcraft) pour activer la mémoire externe d'état (STD-027).
  Crée .somtech/app.yaml dans le repo (versionné), crée le doc Somcraft /operations/<app-slug>/etat-app.md dans le workspace CLIENT si absent, et ajoute .somtech/app-state.md au .gitignore.
  DÉCLENCHEURS: /lier-app, lier app, associer app, lier app somcraft, mémoire externe app, setup app state
---

# Lier App — Provisioning de la mémoire externe d'état (STD-027)

Ce skill associe le repo courant à une application Somtech pour activer la **mémoire externe d'état d'app** définie par [STD-027](../../../../Architecture/standards/STD-027-memoire-externe-etat-app.md).

## Pré-requis

- Le repo courant doit être un projet Somtech (un repo client, un micro-service)
- L'application doit exister dans ServiceDesk avec un `client_id` renseigné
- Le **client** doit avoir un workspace Somcraft (convention : 1 workspace par client, toutes ses apps cohabitent en sous-dossiers `/operations/<app-slug>/`)

## Pré-requis MCP

- `mcp__servicedesk__applications` (action `list`, `get`, éventuellement `update`)
- `mcp__claude_ai_Somcraft__list_workspaces`
- `mcp__claude_ai_Somcraft__read_document`
- `mcp__claude_ai_Somcraft__write_document`

## Workflow

### 1. Vérifier qu'on n'est pas déjà lié

Si `.somtech/app.yaml` existe déjà :
- Afficher le contenu actuel
- Demander : « Ce repo est déjà lié à <app_name>. Re-lier (overwrite) ou annuler ? »
- Si annuler : exit propre.
- Si re-lier : continuer (le doc Somcraft existant sera demandé en étape 5).

### 2. Sélection de l'application ServiceDesk

```
mcp__servicedesk__applications action=list
```

Présenter la liste numérotée à l'utilisateur, demander un choix. Noter :
- `app_id` (UUID)
- `app_name` (ex: « ConstructionGauthier »)
- `client_id` (depuis la fiche de l'app)
- `client_name` (depuis la fiche client si dispo, sinon demander)

**Si la fiche application n'a pas de `client_id`** : demander à l'utilisateur de saisir le `client_id` correspondant. Optionnellement, proposer de mettre à jour la fiche app via `mcp__servicedesk__applications action=update`.

### 3. Demander/confirmer l'`app_slug`

L'`app_slug` est un identifiant **kebab-case court et stable** (ex: `cg-chatbot`, `mph-portail`, `actionprogex`). Il sert de namespace dans le path Somcraft `/operations/<app-slug>/`.

- Proposer un slug dérivé de `app_name` (ex: « Construction Gauthier — Chatbot » → `cg-chatbot`)
- Demander confirmation à l'utilisateur
- **Important** : le slug ne doit pas changer dans le temps (même si `app_name` change), sinon le path Somcraft change et le doc est perdu

### 4. Récupérer ou demander le workspace Somcraft du CLIENT

**Si l'entité Client de ServiceDesk a un champ `somcraft_workspace_id`** (cf. epic E-20260512-0004, future feature) :
- Lire directement cette valeur

**Sinon (cas par défaut MVP)** :
- Appeler `mcp__claude_ai_Somcraft__list_workspaces`
- Présenter la liste à l'utilisateur, demander le workspace correspondant au **client** (pas à l'app)
- Noter `workspace_id` (UUID)

**Erreur** : si le client n'a pas de workspace Somcraft, afficher :
> « Le client <client_name> n'a pas de workspace Somcraft. Créer le workspace d'abord (manuellement dans Somcraft ou via `/create-workspace` si dispo) puis relancer `/lier-app`. »

Sortie propre, aucun fichier créé.

### 5. Vérifier / créer le doc Somcraft `/operations/<app-slug>/etat-app.md`

```
mcp__claude_ai_Somcraft__read_document
  workspace_id=<workspace_id>
  path=/operations/<app-slug>/etat-app.md
```

**Si le doc existe** :
- Afficher : « Un doc d'état existe déjà à ce path. Conserver le doc existant ou réinitialiser avec le template vide ? »
- Si conserver : récupérer son ID, passer à l'étape 6.
- Si réinitialiser : avertir que le contenu actuel sera perdu, demander confirmation avant overwrite.

**Si le doc n'existe pas** : créer avec le template (étape 6).

### 6. Créer le doc Somcraft à partir du template

Lire le template depuis `Architecture/standards/templates/etat-app-template.md` (sync Somcraft) ou utiliser le template inliné en bas de ce skill si non disponible.

Remplacer les placeholders :
- `<APP_ID_SERVICEDESK>` → `app_id` sélectionné
- `<Nom court de l'app>` → `app_name`
- `<kebab-case-court>` → `app_slug`
- `<CLIENT_ID_SERVICEDESK>` → `client_id`
- `<Nom du client>` → `client_name`
- `last_updated` → ISO 8601 du jour à 00:00:00Z
- `updated_by` → `claude-lier-app` (ou `claude-session-<short_id>` si disponible)
- `current_branch` → résultat de `git rev-parse --abbrev-ref HEAD`
- `current_phase` → demander à l'utilisateur (build par défaut)

Le placeholder « `<2-3 phrases. Où on en est...>` » et les autres balises de section restent — la première utilisation de `/end-session` les remplira avec un état réel.

```
mcp__claude_ai_Somcraft__write_document
  workspace_id=<workspace_id>
  path=/operations/<app-slug>/etat-app.md
  content=<template rempli>
```

Noter l'`app_state_doc_id` retourné.

### 7. Créer `.somtech/app.yaml` dans le repo courant

```bash
mkdir -p .somtech
```

Créer `.somtech/app.yaml` avec :

```yaml
servicedesk:
  app_id: <APP_ID>
  app_name: <APP_NAME>
  app_slug: <APP_SLUG>
  client_id: <CLIENT_ID>
  client_name: <CLIENT_NAME>
somcraft:
  workspace_id: <WORKSPACE_ID_CLIENT>
  app_state_doc_id: <DOC_ID>
  app_state_doc_path: /operations/<APP_SLUG>/etat-app.md
```

**Aucun secret** — uniquement des IDs. Le fichier est versionné dans le repo.

### 8. Ajouter `.somtech/app-state.md` au `.gitignore`

Si `.gitignore` existe et ne contient pas déjà `.somtech/app-state.md`, ajouter ces lignes :

```
# Mémoire externe d'état d'app (STD-027) — cache local, source dans Somcraft
.somtech/app-state.md
```

Si `.gitignore` n'existe pas, le créer avec ce contenu.

**Important** :
- `.somtech/app.yaml` doit **rester versionné** (mapping pérenne, sans secret)
- Seul `.somtech/app-state.md` est gitignored (cache local volatile)

### 9. Premier fetch du cache local

Lire le doc Somcraft fraîchement créé :

```
mcp__claude_ai_Somcraft__read_document
  workspace_id=<workspace_id>
  path=/operations/<app-slug>/etat-app.md
```

Écrire le contenu dans `.somtech/app-state.md` (cache initial). Le hook `SessionStart` lira ce cache au prochain boot.

### 10. Résumé final

Afficher à l'utilisateur :

```
✅ App liée avec succès

ServiceDesk : <app_name> (<app_id>)
Client      : <client_name> (<client_id>)
Somcraft    : workspace <workspace_id> · /operations/<app_slug>/etat-app.md (<doc_id>)
Repo        : <chemin courant>

Fichiers créés/modifiés :
- .somtech/app.yaml (versionné)
- .somtech/app-state.md (cache local, gitignored)
- .gitignore (ajout)

Prochaines étapes :
1. git add .somtech/app.yaml .gitignore
2. git commit -m "chore: lier app à la mémoire externe d'état (STD-027)"
3. Lance /end-session à la fin de cette session pour la première écriture réelle de l'état d'app
4. Au prochain boot, le hook SessionStart injectera automatiquement le doc dans le contexte
```

## Erreurs gérées

| Cas | Comportement |
|---|---|
| MCP ServiceDesk indisponible | Afficher erreur, sortie propre, aucun fichier créé |
| MCP Somcraft indisponible | Afficher erreur, sortie propre, aucun fichier créé |
| Workspace client Somcraft introuvable | Afficher erreur explicite + suggérer création workspace, sortie propre |
| Permissions Somcraft insuffisantes | Erreur explicite, suggérer de vérifier les permissions du workspace client |
| Repo Git absent (`.git/` introuvable) | Avertissement, continuer (le `.somtech/app.yaml` sera créé mais pas versionné) |
| `client_id` absent sur la fiche app | Demander à l'utilisateur, optionnellement proposer MAJ via `applications action=update` |
| Doc Somcraft existant à reset | Confirmation explicite avant overwrite |

## Référence

- Convention : [STD-027](../../../../Architecture/standards/STD-027-memoire-externe-etat-app.md)
- Templates : `Architecture/standards/templates/`
- Skills liés : `/sync-app-state`, `/end-session` (étendu)
- Hook lié : `SessionStart` → `.claude/hooks/session-start-app-state.sh`
- Demande parente : D-20260512-0004
- Story : T-20260512-0031 (epic E-20260512-0003)
