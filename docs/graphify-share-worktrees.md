# graphify — dossier de sortie partagé entre worktrees (D-20260716-0001)

Sans partage, chaque worktree `claude-swt` d'un repo a son propre `graphify-out/` et doit
**rebuild** le graphe graphify (~800k tokens d'extraction sémantique). Ce mécanisme donne
**un seul graphe par repo**, vu par tous ses worktrees.

## Mécanisme

- Dossier partagé unique **`~/graphify/<clé>/`** (hors git, survit aux worktrees éphémères).
- **`<clé>` = `<nom-repo>-<hash8 du chemin absolu du .git principal>`** — le hash évite la
  collision entre repos homonymes (deux `web`/`api` d'orgs différentes ne partagent PAS le
  graphe).
- Dans chaque worktree, **`graphify-out` est un symlink** → `~/graphify/<clé>`. Transparent
  pour le skill `/graphify`, le CLI et le MCP (tous lisent le chemin relatif
  `graphify-out/graph.json`).

> ⚠️ `~/graphify` est **LOCAL au poste** (il contient `.graphify_python`, un chemin
> d'interpréteur machine-local). Ne jamais le synchroniser (Drive/iCloud), comme les worktrees.

## Ce que le pack installe

| Élément | Où | Quand |
|---|---|---|
| `graphify-share-out.sh` | `~/.somtech/` | `pack setup` |
| Hook `SessionStart` global | `~/.claude/settings.json` (câblé idempotent) | `pack setup` |
| Appel share-out + MCP graphify (scope **local**) | dans `claude-swt`, à la naissance du worktree | à chaque `claude-swt` |
| `graphify-out` dans `.git/info/exclude` (local, non versionné) | worktree | à chaque `claude-swt` (idempotent) |
| `graphify-out` (sans slash) dans `.gitignore` versionné | repo | manuel / template (optionnel) |

- Le symlink `graphify-out` est auto-posé dans **tout** repo git à l'ouverture d'une session
  (auto-init). `claude-swt` l'ajoute à `.git/info/exclude` (exclusion **locale**, non
  versionnée) pour qu'un `git add -A` accidentel ne committe pas le lien absolu machine-local.
  Une session `claude` directe (hors claude-swt) n'a pas cette exclusion → ajouter
  `graphify-out` au `.gitignore` du repo si on veut la garantie côté versionné.
- Le **hook** ne fait **que** le symlink (pose/amorce, idempotent, jamais fatal). Pas de
  détection de fraîcheur (le `mtime` est réécrit par `git worktree add` → faux positifs). Le
  rafraîchissement reste **explicite** : `/graphify --update` (détection hash native).
- Le **MCP** est ajouté en **scope local** (`~/.claude.json`, non versionné) par `claude-swt`
  **avant** le lancement de claude — jamais dans le `.mcp.json` versionné (sinon tout
  clone/CI tenterait `graphify-mcp` au démarrage). Idempotent (`claude mcp add` est no-op si
  déjà présent). Une session lancée par `claude` direct (hors `claude-swt`) obtient le symlink
  via le hook mais **pas** le MCP auto — l'ajouter à la main au besoin.

## Prérequis

```bash
uv tool install "graphifyy[mcp]"
```
L'extra `[mcp]` est requis pour `graphify-mcp` (sans lui : `ImportError: mcp not installed`).
`pack setup` affiche ce rappel si le binaire est absent.

## Limites connues (non bloquantes)

- **Concurrence (M3)** : deux `/graphify --update` simultanés (ou un post-commit + une query)
  sur le même dossier partagé écrivent `graph.json` sans verrou → corruption possible. Usage
  mono-utilisateur = risque faible. Durcissement possible : `flock` autour des écritures.
  **Déconseillé** : le post-commit hook graphify en mode partagé (`.git/hooks` est commun aux
  worktrees → il s'activerait pour tous).
- **GC** : les `~/graphify/<clé>` de repos supprimés ne sont pas nettoyés (disque seulement).
  Une commande `pack` de nettoyage des clés orphelines reste à faire (dette suivie côté
  ServiceDesk).
