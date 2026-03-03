# Somtech — Configuration globale Claude Code

> Ce fichier va dans `~/.claude/CLAUDE.md` sur ta machine.
> Claude Code le lit automatiquement dans TOUS les projets.

---

## Skills globaux

### /somtech-pack-install — Installer le somtech-pack dans le projet courant

**Triggers** : installe le pack, install somtech, somtech-pack install, bootstrap somtech, init somtech

Quand le développeur demande d'installer ou de bootstrapper le somtech-pack dans le projet courant :

#### Prérequis
- Le projet courant doit être un repo git initialisé
- Accès réseau à GitHub

#### Procédure

1. **Vérifier que le projet n'a pas déjà le pack**
```bash
if [ -d ".claude/skills" ] && [ -f ".claude/CLAUDE.md" ]; then
  echo "⚠️  Le somtech-pack semble déjà installé (.claude/ existe)."
  echo "→ Utilise /somtech-pack-maj pour mettre à jour."
fi
```
Si déjà installé, proposer `/somtech-pack-maj` plutôt.

2. **Cloner le pack dans un dossier temporaire**
```bash
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch main https://github.com/SomtechSolutionMAxime/somtech-pack.git "$WORKDIR/somtech-pack"
```

3. **Prévisualiser les changements (dry-run)**
```bash
"$WORKDIR/somtech-pack/scripts/install_somtech_pack.sh" --target "$(pwd)" --dry-run
```
Afficher le résumé et **attendre la confirmation** de l'utilisateur.

4. **Installer**
```bash
"$WORKDIR/somtech-pack/scripts/install_somtech_pack.sh" --target "$(pwd)"
```

5. **Nettoyer**
```bash
rm -rf "$WORKDIR"
```

6. **Post-installation**
- Rappeler de personnaliser `.claude/CLAUDE.md` (sources de vérité, stack du projet)
- Rappeler de remplacer les placeholders `{{...}}` dans `.cursor/rules/`
- Proposer de commiter :
```bash
git add .claude/ .cursor/ features/ scripts/ docs/ modules/
git commit -m "chore: bootstrap somtech-pack"
```

#### Options
L'utilisateur peut demander une installation partielle :
- "installe seulement les skills" → `--no-rules --no-commands --no-docs`
- "installe sans les docs" → `--no-docs`
- "installe seulement les commandes Somtech" → `--somtech-only`
- "dry-run" → ajouter `--dry-run`

#### Règles
- **Toujours** faire un dry-run et montrer le résumé avant d'installer
- **Ne jamais** commiter sans confirmation explicite
- **Ne jamais** écraser un `.claude/CLAUDE.md` personnalisé sans avertir

---

### /somtech-pack-maj — Mettre à jour le pack

**Triggers** : maj pack, update pack, sync pack, mettre à jour somtech

Si le projet a déjà le pack installé, utiliser le script de pull :

```bash
./scripts/somtech_pack_pull.sh --target .
```

Ou si le script n'est pas présent localement :
```bash
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch main https://github.com/SomtechSolutionMAxime/somtech-pack.git "$WORKDIR/somtech-pack"
"$WORKDIR/somtech-pack/scripts/somtech_pack_pull.sh" --target "$(pwd)"
rm -rf "$WORKDIR"
```

---

## Conventions Somtech

- **Git** : Jamais de push sur `main`. Branches : `feat/*`, `fix/*`, `chore/*`, `proto/*`
- **Commits** : `type(scope): description`
- **Stack** : Next.js 14+ / React / TypeScript / Tailwind / Supabase
- **RLS** : Obligatoire sur toute table avec données utilisateur
