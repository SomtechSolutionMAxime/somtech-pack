---
name: maj-representant-client
description: |
  Rafraîchit un lieu de représentant DÉJÀ POSÉ chez un client (<dépôt du client>/.gestionnaire/<client>/) avec la dernière version du pack. CLAUDE.md — et tout ce que le pack y distribue — reprend TOUJOURS la version du pack (convergence, backup .somtech.bak) ; CONTEXTE.md, écrit à la main par le représentant, n'est JAMAIS touché (RA-REL-014).
  TRIGGERS : maj représentant, mettre à jour le représentant, rafraîchir le représentant client, le représentant est-il à jour, sync représentant, update représentant client, gestionnaire-client obsolète, représentant périmé, le métier du représentant a changé.
  Ne POSE aucun lieu neuf : si .gestionnaire/<client>/ n'existe pas encore chez ce client, c'est /gestionnaire-client (la compétence de pose) qu'il faut, pas celle-ci — elle refuse d'ailleurs de créer un lieu absent.
disable-model-invocation: false
allowed-tools: Read, Bash
---

# Mise à jour d'un représentant déjà posé

Un client installé en janvier ne doit pas garder le métier de janvier pour toujours, défauts compris. Cette compétence rafraîchit un lieu de représentant **déjà posé** avec la dernière version du pack — et rien d'autre.

**Deux dangers symétriques, et le second est le pire :**

1. **La divergence silencieuse** — `CLAUDE.md` reste périmé, sans que rien ne le signale.
2. **L'écrasement de ce qu'on sait du client** — `CONTEXTE.md` remplacé par erreur. Pire que la divergence : le client s'entend redemander ce qu'il a déjà expliqué.

`RA-REL-014` tranche : `CLAUDE.md` (et tout fichier que le pack distribue à ce lieu — aujourd'hui `CONTEXTE.md` à côté, demain `.mcp.json`/`settings.json`) appartient au pack et se **remplace intégralement** ; `CONTEXTE.md` appartient au client et n'est **jamais touché**, ni écrasé, ni recréé s'il manque.

## Phase 0 — Pré-vérifications

**Invoque cette compétence depuis la racine du dépôt du client** (celui qui contient `.gestionnaire/`) — pas depuis l'intérieur de `.gestionnaire/<client>/` lui-même. Si une session tourne déjà avec `.gestionnaire/<client>/` comme répertoire courant (c'est le cas de la session représentant elle-même), remonte de deux niveaux ou passe `--target ../..`.

```bash
git rev-parse --show-toplevel >/dev/null 2>&1 || echo "⚠️ Pas un repo git — vérifie que tu es bien dans le dépôt du client."
ls .gestionnaire/ 2>/dev/null || { echo "❌ Aucun .gestionnaire/ ici — rien à mettre à jour. Vérifie le répertoire, ou pose d'abord avec /gestionnaire-client."; exit 1; }
```

Détermine `<client>` :
- **Un seul sous-dossier sous `.gestionnaire/`** → c'est lui, pas besoin de le demander.
- **Plusieurs, ou aucun** → demande lequel à l'utilisateur (ne devine jamais).

**Reprends le nom tel qu'il est sur le disque**, majuscules comprises — `Charles-Olivier`, `Francois`, `Jacob`, `Zach` sont des noms de lieux parfaitement valides. La commande retrouve le lieu même si la casse tapée diffère (elle dit alors sous quel nom elle l'a trouvé), et elle **refuse** plutôt que de deviner si deux lieux ne diffèrent que par la casse. Ce qu'elle refuse toujours : un nom qui traverse un répertoire (`/`, `\`, `..`) — il écrirait hors du dépôt.

> Jusqu'à `T-20260814-0101`, elle exigeait un slug **en minuscules** pendant que la pose écrivait le nom **brut** : quatre lieux sur cinq étaient inatteignables, et macOS le masquait en ignorant la casse. Les deux gestes appliquent désormais la même règle, au même texte.

```bash
ls .gestionnaire/<client>/CLAUDE.md .gestionnaire/<client>/CONTEXTE.md 2>/dev/null \
  || { echo "❌ Lieu incomplet ou absent pour <client> — pose-le d'abord (/gestionnaire-client), ne le fabrique pas à moitié ici."; exit 1; }
```

## Phase 1 — Aperçu (dry-run, OBLIGATOIRE)

```bash
npx @somtech-solutions/pack@latest representant-update --client <client> --dry-run
```

**Afficher le rapport à l'utilisateur** : créés / convergés (dérive du pack) / inchangés / 🔒 préservés (toujours `CONTEXTE.md`, jamais écrasé) — **et la dernière ligne, celle de l'armement** (voir ci-dessous). **Attendre confirmation** avant d'appliquer — même règle que `/somtech-pack-maj`.

### La ligne d'armement se relaie TOUJOURS (T-20260818-0034)

La commande termine son rapport par l'état du garde d'ouverture de ligne dans ce lieu. **Cette ligne n'est pas un détail du rapport : c'est le seul endroit où un désarmement se voit.** Un lieu désarmé se lit exactement comme un lieu armé — mêmes fichiers, même structure — et l'agent qui l'habitera pourra travailler avant d'avoir ouvert sa ligne, sans que personne ne le sache.

| Ce que la commande dit | Ce que ça veut dire | Ce que tu fais |
|---|---|---|
| `🛡️ armé` | le garde est en place | rien, mais **dis-le** |
| `⚠️ DÉSARMÉ` | aucun garde : le lieu ne protège rien | **remonte-le comme un défaut**, ne referme pas dessus en silence |
| `⚠️ armement INCONNU` | le fichier de droits manque ou ne se lit pas | le lieu est posé **partiellement** — c'est la pose qu'il faut reprendre (Phase 0), pas l'armement |

En `--dry-run`, cette ligne décrit le lieu **tel qu'il est maintenant** : c'est ainsi qu'on demande à un lieu s'il est armé sans avoir à provoquer un blocage.

Si le rapport ne montre **aucune** convergence en attente, dis-le et arrête-toi : rien à faire.

## Phase 2 — Appliquer

Après confirmation :

```bash
npx @somtech-solutions/pack@latest representant-update --client <client>
```

- `CLAUDE.md` (et tout autre fichier que le pack distribue à ce lieu) **converge toujours** vers la version du pack — pas de mode « garder la divergence » ici, contrairement à `/somtech-pack-maj` : un `CLAUDE.md` de représentant divergent n'est jamais un choix délibéré du client, c'est de la dérive.
- Une dérive écrasée est **sauvegardée avant** (`CLAUDE.md.somtech.bak`, suffixé `.1`, `.2`… si déjà pris) — jamais perdue.
- `CONTEXTE.md` n'est **ni écrasé ni créé s'il manque**. S'il manque, le lieu est posé partiellement — c'est un signalement, pas une occasion de le fabriquer à sa place (voir Phase 0).

## Phase 3 — Vérifier la frontière, avant de refermer

**Ne clôture pas sans avoir confirmé, factuellement, que `CONTEXTE.md` n'a pas bougé** — un « ça a dû marcher » ne suffit pas :

```bash
git diff --stat .gestionnaire/<client>/CONTEXTE.md   # doit être VIDE
git diff --stat .gestionnaire/<client>/CLAUDE.md     # doit montrer la convergence, si elle a eu lieu
```

**Et ne clôture pas non plus sans avoir relayé l'état d'armement** rendu en Phase 2. Un rapport de convergence qui ne dit rien du garde laisse passer exactement ce que `T-20260818-0034` a fermé : le bon geste, fait correctement, qui retire une protection sans un mot.

Si `.gestionnaire/` n'est pas suivi par git dans ce dépôt, compare l'horodatage ou relis le fichier — mais **compare le contenu**, jamais seulement « le fichier existe encore ».

## Récupérer une sauvegarde (RA-DIS-003)

Toute dérive écrasée est récupérable :

```bash
mv .gestionnaire/<client>/CLAUDE.md.somtech.bak .gestionnaire/<client>/CLAUDE.md
```

## Ce que cette compétence ne fait pas

- **Elle ne pose aucun lieu neuf.** Si `.gestionnaire/<client>/` n'existe pas, ou existe sans `CLAUDE.md`/`CONTEXTE.md`, elle refuse plutôt que de compléter à sa place — c'est le rôle de `/gestionnaire-client`.
- **Elle ne touche jamais `CONTEXTE.md`** — ni pour l'écraser, ni pour le créer.
- **Elle ne modifie pas `/gestionnaire-client`** (la compétence invoquée en session, distincte des gabarits qu'elle distribue) — un chantier séparé, jamais son fichier.

## Options

| Demande | Commande |
|---------|----------|
| dry-run seul | `npx @somtech-solutions/pack@latest representant-update --client <client> --dry-run` |
| dépôt client différent du répertoire courant | `… representant-update --client <client> --target <chemin-du-dépôt-client>` |
| version épinglée | `npx @somtech-solutions/pack@<version> representant-update --client <client>` (sinon `@latest`) |

## Règles critiques

1. **Toujours** le dry-run d'abord + confirmation avant d'appliquer.
2. **Jamais** de commit sans confirmation explicite ; jamais sur `main`/`staging` du dépôt client.
3. **`CONTEXTE.md` ne se discute pas** : ni écrasé, ni fabriqué — contrairement à `.claude/settings.json` ailleurs dans le pack, ce n'est pas un choix « préservé mais recréable si absent ».
4. Un lieu absent ou incomplet est un **signalement à faire remonter**, pas un défaut à corriger silencieusement ici.
