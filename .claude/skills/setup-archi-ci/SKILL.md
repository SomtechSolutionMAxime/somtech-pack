---
name: setup-archi-ci
description: |
  Installe dans le repo applicatif COURANT la CI du modèle vivant (STD-031 §2.7) :
  récolte architecture.yaml depuis les sources (tables + endpoints + config), gate de
  complétude committé vs récolté en CI (jamais dans /merge), et vues ERD Mermaid.
  TRIGGERS : setup-archi-ci, CI du modèle vivant, gate architecture.yaml, manifeste
  architecture CI, doc archi toujours à jour, installer la CI d'architecture, D-20260715-0004
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# /setup-archi-ci — CI du modèle vivant (doc d'architecture toujours à jour)

Installe, dans le **repo applicatif courant**, une CI GitHub Actions qui tient
`architecture.yaml` fidèle au code : elle **récolte** le manifeste depuis les sources
réelles, le **compare** au fichier committé (gate de complétude), et **publie** les vues
(ERD Mermaid). Cadre : **STD-031 §2.7** (modèle vivant) · règle d'or **n°9** (manifeste à
jour dans la même PR que le code).

> **Pourquoi en CI et pas dans `/merge`** : un gate dans un skill n'est pas opposable
> (un `git merge` manuel, l'UI GitHub, un autre agent le contournent) et arrive trop tard.
> Le seul niveau opposable est **CI + branch protection**.

> ⚠️ **Règle d'or n°7** — ce skill n'agit que sur le **repo du répertoire courant**.
> Il n'ouvre pas de PR sur un autre repo. Les récolteurs sont distribués par le pack
> (`npx @somtech-solutions/pack …`), source canonique côté `architecture`.

---

## Déroulé

### 0. Pré-flight

```bash
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Pas un repo git"; exit 1; }
git branch --show-current   # STOP si main/staging → créer une branche dédiée d'abord
ls .github/workflows/ 2>/dev/null
test -f architecture.yaml && echo "manifeste déjà présent" || echo "amorçage requis"
test -f .architecture/ci.yaml && echo "déjà équipé (idempotent : on met à jour)"
```

- Si branche = `main`/`staging` → créer `feat/<D|P-…>-setup-archi-ci` avant tout (règle branche).
- **Idempotent** : si le repo est déjà équipé, on met à jour le workflow/scripts **sans
  écraser** `architecture.yaml` ni le `mode` de `.architecture/ci.yaml`.

### 1. Déterminer le slug d'application

Le slug = racine de namespace du manifeste (unicité cross-repo, STD-031).

- S'il existe déjà : lire `app:` dans `architecture.yaml` ou `.architecture/ci.yaml`.
- Sinon : le demander / le déduire (slug ServiceDesk de l'app, ex. `construction-gauthier`).
  **Ne jamais inventer** un slug — vérifier via `mcp__servicedesk__applications` (action `list`) au besoin.

### 2. Détecter les sources récoltables

Annoncer ce qui est trouvé et ce qui manque (dégradation propre — un grain absent n'est
**jamais** traité comme « conforme ») :

```bash
test -d supabase/migrations && echo "✓ tables (Supabase)"        || echo "· pas de migrations Supabase"
{ ls app/**/route.* src/app/**/route.* pages/api/** src/pages/api/** 2>/dev/null | head -1 >/dev/null && echo "✓ endpoints (Next.js)"; } || echo "· pas de routes Next.js évidentes"
{ test -f fly.toml || test -f netlify.toml || test -f .mcp.json; } && echo "✓ config/topologie" || echo "· pas de config d'infra évidente"
```

### 3. Récolter l'amorçage du manifeste

Utiliser le pack (mêmes récolteurs que la CI) pour produire un `architecture.yaml` récolté,
**à relire** (rien d'inventé : tout vient des sources ; la topologie cross-repo est la seule
partie écrite à la main, à marquer). `<SLUG>` = slug de l'étape 1.

```bash
mkdir -p .architecture/_boot docs/architecture
[ -d supabase/migrations ] && npx -y @somtech-solutions/pack harvest-supabase supabase/migrations --app <SLUG> --out .architecture/_boot/10-tables.yaml
npx -y @somtech-solutions/pack harvest-config . --app <SLUG> --out .architecture/_boot/20-config.yaml
npx -y @somtech-solutions/pack harvest-routes . --app <SLUG> --out .architecture/_boot/30-routes.yaml
npx -y @somtech-solutions/pack merge-manifests .architecture/_boot/*.yaml --app <SLUG> --out architecture.yaml
npx -y @somtech-solutions/pack validate-manifest architecture.yaml
npx -y @somtech-solutions/pack generate-erd architecture.yaml --out docs/architecture/erd.md
rm -rf .architecture/_boot
```

- **Si `architecture.yaml` existe déjà** : NE PAS l'écraser. Le récolter dans un fichier
  temporaire et présenter le `diff-manifest` à l'humain pour qu'il complète à la main.
- Relire le manifeste amorcé : corriger `kind`/`name` de la racine, qualifier les FK
  cross-repo (`depends_on … à qualifier`), régler `audience` (défaut `internal`, Loi 25).

### 4. Déposer le workflow + la config

Copier les templates du skill dans le repo courant (le workflow est **verbatim** ; la config
porte le slug + le mode) :

```bash
mkdir -p .github/workflows .architecture
cp "<CHEMIN_DU_SKILL>/templates/architecture-manifest.yml" .github/workflows/architecture-manifest.yml
# ci.yaml : substituer le slug, garder mode: warn (ou le mode existant si déjà équipé)
sed "s/__APP_SLUG__/<SLUG>/" "<CHEMIN_DU_SKILL>/templates/ci.yaml" > .architecture/ci.yaml
```

- `<CHEMIN_DU_SKILL>` = dossier de ce skill (`.claude/skills/setup-archi-ci`, ou sa copie
  globale `~/.claude/skills/setup-archi-ci`). Trouver via `Glob` si besoin.
- **Idempotent** : si `.architecture/ci.yaml` existe, préserver son `mode` (ne pas rétrograder
  un `strict` déjà durci).
- Ajouter au `.gitignore` : `.architecture/_harvest/` (artefacts CI éphémères).

### 5. Ouvrir la PR d'amorçage (règle PR-tôt)

```bash
echo ".architecture/_harvest/" >> .gitignore
git add architecture.yaml docs/architecture/erd.md .github/workflows/architecture-manifest.yml .architecture/ci.yaml .gitignore
git commit -m "chore(archi): CI du modèle vivant + amorçage manifeste (STD-031 §2.7)"
git push -u origin HEAD
gh pr create --draft --title "chore(archi): modèle vivant — amorçage manifeste + CI" \
  --body "Amorçage architecture.yaml récolté (à relire) + gate CI en mode **warn**. STD-031 §2.7 / D-20260715-0004."
```

### 6. Guider la suite (à annoncer, pas à exécuter)

1. **Relire la PR d'amorçage** — le manifeste est récolté, pas inventé ; vérifier la racine,
   les FK cross-repo, l'`audience`.
2. La CI tourne en **`warn`** : elle poste le drift en commentaire de PR sans bloquer.
3. Quand `architecture.yaml` est fidèle au code → passer `.architecture/ci.yaml` en
   **`mode: strict`** et activer la **branch protection** sur le job `manifest` (rend le
   gate opposable, STD-031).

---

## Prérequis opérationnels (à signaler)

- **Accès au package** : la CI fait `npm install -g @somtech-solutions/pack`. Le package
  (GitHub Packages privé) doit **accorder l'accès en lecture à ce repo** (page Packages du
  package → Manage access). Sans ça, l'install échoue en CI.
- **Python 3 + PyYAML** : fournis par le workflow (`setup-python` + `pip install pyyaml`).
- **Récolteurs V1** : tables (Supabase), endpoints (Next.js App Router / Pages API / Express),
  config (fly/netlify/mcp/env). Un framework non reconnu est **signalé**, jamais deviné — le
  grain reste « non vérifié » (ni conforme, ni en drift).

## Ce que le skill NE fait pas (YAGNI, STD-031)

- Pas de fragment Likec4 component-level ici : il est produit par le **curateur**
  (`ing-curateur-architecture`) qui agrège tous les manifestes. Le repo n'émet que **son**
  manifeste.
- Pas de règles métier (hors champ, I17). Pas de diagrammes de séquence.
- Ne touche ni `/merge` ni `/pousse` : le gate vit en CI.
