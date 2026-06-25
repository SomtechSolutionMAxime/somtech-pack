---
name: somtech-pack-global
description: |
  Mettre à jour l'installation GLOBALE du pack sur le poste (~/.claude) via npx setup.
  TRIGGERS : mets à jour le global, maj globale du pack, rafraîchir les skills globaux, somtech-pack global, update global, sync skills globaux, mettre à jour ~/.claude
  Lance `npx @somtech-solutions/pack setup`, montre le diff, applique après confirmation.
disable-model-invocation: false
allowed-tools: Read, Bash, Grep, Glob
---

# Somtech Pack — Mise à jour GLOBALE du poste (npx setup)

Met à jour ce qui est installé **globalement** dans `~/.claude` (et le shell) depuis la dernière version
publiée du pack, via `npx @somtech-solutions/pack setup` :

- **user-skills** globaux (ex. `somtech-pack-install`) ;
- **miroir de tous les skills du pack** dans `~/.claude/skills` (anti-drift des copies globales — ex. un
  `end-session` global périmé) ;
- bloc **claude-swt** (`~/.zshrc`) ;
- **hook de version** global (`~/.claude/settings.json`).

> ⚠️ **Projet vs global** — à ne pas confondre :
> - `/somtech-pack-maj` (= `npx … update`) met à jour le pack **dans le projet courant** (`.claude/` versionné).
> - **Ce skill** (`/somtech-pack-global` = `npx … setup`) met à jour l'installation **du poste** (`~/.claude`, global).

## Garanties de sécurité (à rappeler à l'utilisateur)

1. **Skills perso hors-pack préservés** : `assemblyai`, `brand`, `graphify`, `slides`, etc. ne sont **jamais**
   dans le pack → jamais écrits ni supprimés. Le moteur ne supprime **rien**.
2. **Skill du pack que tu as modifié à la main** en global = **divergent** → **NON écrasé** sans `--force`.
3. **Backup anti-perte** : avec `--force`, chaque fichier écrasé est d'abord sauvegardé en `<fichier>.somtech.bak`.
   La perte est donc impossible.

## Prérequis

```bash
command -v npx >/dev/null 2>&1 || { echo "❌ npx (Node) requis."; exit 1; }
```

> **Registre (une fois par poste)** : package privé GitHub Packages. `~/.npmrc` doit contenir
> `@somtech-solutions:registry=https://npm.pkg.github.com` + un token `read:packages`. Sinon `npx` échoue — le signaler.

## Phase 1 — Aperçu (dry-run, OBLIGATOIRE)

```bash
npx @somtech-solutions/pack@latest setup --dry-run
```

**Afficher le rapport** : user-skills + **skills du pack (global)** avec créés / maj / inchangés / **divergents**.
**Attendre la confirmation** avant d'appliquer.

## Phase 2 — Appliquer

Après confirmation :

```bash
npx @somtech-solutions/pack@latest setup --yes
```

- `--yes` = consentement explicite (setup écrit dans ta config perso `~/.claude` et `~/.zshrc`).
- Les **divergents ne sont pas écrasés**. S'il y en a (ex. ton `end-session` global périmé), proposer à
  l'utilisateur :
  - prendre la version du pack pour **tous** les divergents : `npx @somtech-solutions/pack@latest setup --yes --force`
    (chaque écrasement crée un `.somtech.bak`) ;
  - ou, plus chirurgical : supprimer le skill divergent ciblé dans `~/.claude/skills/<skill>` puis relancer
    `setup --yes` (il sera recréé depuis le pack) ;
  - ou garder la version locale → ne rien faire.

## Options

| Demande | Commande |
|---------|----------|
| aperçu seul | `npx @somtech-solutions/pack@latest setup --dry-run` |
| appliquer | `npx @somtech-solutions/pack@latest setup --yes` |
| forcer les divergents (backup auto) | `npx @somtech-solutions/pack@latest setup --yes --force` |
| sans les skills (claude-swt + hook seulement) | `… setup --yes --no-skills` |
| sans claude-swt | `… setup --yes --no-claude-swt` |
| sans le hook de version | `… setup --yes --no-version-hook` |

## Règles critiques

1. **Toujours** le dry-run d'abord + confirmation avant d'appliquer.
2. **Ne jamais** `--force` sans expliquer qu'il prend la version du pack pour les divergents (avec backup `.somtech.bak`).
3. **Ne jamais** prétendre que des skills perso seraient touchés — ils ne le sont jamais.
4. C'est une opération **poste** (globale), pas projet : ne pas la confondre avec `/somtech-pack-maj`.
