# /pousse — Commit, PR, migrations Supabase et déploiements Fly.io

Tu es un assistant de déploiement. Exécute les étapes suivantes dans l'ordre, en t'arrêtant à la première erreur critique. Réponds toujours en français.

## Étape 1 : Vérification de la branche

1. Vérifie la branche courante avec `git branch --show-current`.
2. Si la branche est `main`, **STOP** — informe l'utilisateur qu'on ne pousse jamais directement sur main et propose de créer une branche.
3. Vérifie la fraîcheur : `git log -1 --format="%cr" HEAD`. Si le dernier commit date de plus de 3 jours, signale que la branche est possiblement périmée et propose un rebase sur main avant de continuer.

## Étape 2 : Commit des changements

1. Lance `git status` pour voir l'état du repo.
2. S'il n'y a aucun changement (ni staged, ni unstaged, ni untracked), informe l'utilisateur qu'il n'y a rien à commiter et passe directement à l'étape 3.
3. S'il y a des changements :
   - Lance `git diff` et `git diff --staged` pour analyser les modifications.
   - Lance `git log --oneline -5` pour voir le style des messages de commit récents.
   - Stage les fichiers pertinents avec `git add <fichier>` (fichiers spécifiques, jamais `git add .` ni `git add -A`).
   - Ne jamais commiter de fichiers sensibles (.env, credentials, secrets, clés API).
   - Génère un message de commit concis, en français, qui décrit le "pourquoi" des changements, au format `type(scope): description`.
   - Le message de commit doit se terminer par : `Co-Authored-By: Claude <noreply@anthropic.com>`
   - Crée le commit.
   - Pousse sur la branche courante avec `git push`. Si la branche n'a pas d'upstream, utilise `git push -u origin <branche>`.

## Étape 3 : Gestion de la Pull Request

1. Vérifie s'il existe déjà une PR ouverte pour cette branche vers `main` :
   ```
   gh pr list --head $(git branch --show-current) --base main --state open --json number,title,url
   ```
2. **Si une PR existe** :
   - Affiche le numéro, le titre et le lien de la PR existante.
   - Informe que le push a mis à jour la PR automatiquement.
3. **Si aucune PR n'existe** :
   - Lance `git log main..HEAD --oneline` pour résumer tous les commits de la branche.
   - Crée une PR avec `gh pr create` :
     - Titre court et descriptif, en français, basé sur l'ensemble des commits.
     - Body structuré avec `## Résumé` (bullet points) et un footer `Generated with Claude Code`.
     - Branche cible : `main`.
   - Affiche le lien de la PR créée.

## Étape 4 : Vérification des migrations SQL Supabase

1. Détecte les fichiers de migration ajoutés ou modifiés dans cette branche par rapport à `main` :
   ```
   git diff main..HEAD --name-only -- supabase/migrations/
   ```
2. **Si aucune migration détectée** : Informe l'utilisateur qu'il n'y a pas de migration SQL à pousser en production, puis **passe à l'étape 5** — une branche sans migration peut très bien modifier une app Fly.io.
3. **Si des migrations sont détectées** :
   - Liste chaque fichier de migration détecté.
   - Affiche le contenu de chaque fichier de migration pour revue.
   - **DEMANDE OBLIGATOIREMENT CONFIRMATION à l'utilisateur** avant toute action. Exemple : "J'ai détecté X migration(s). Voulez-vous les appliquer en production via Supabase MCP ?"
   - **Si l'utilisateur confirme** : Utilise le MCP Supabase (`execute_sql` ou `apply_migration`) pour appliquer chaque migration. Ne jamais utiliser `supabase db push --linked`.
   - **Si l'utilisateur refuse** : Informe que les migrations n'ont pas été poussées et pourront l'être ultérieurement.

## Étape 5 : Détection et déploiement Fly.io

**Objectif** : Identifier toutes les applications Fly.io du repo qui sont impactées par les changements de la branche, pas seulement celles dont le `fly.toml` a changé.

### 5.1 — Inventaire des apps Fly.io du repo

Utiliser un agent (subagent_type: Explore) pour :

1. Trouver tous les `fly.toml` du repo :
   ```
   find . -name "fly.toml" -not -path "*/node_modules/*"
   ```
2. Pour chaque `fly.toml` trouvé, noter :
   - Le **répertoire** de l'app (le dossier contenant le `fly.toml`)
   - Le **nom de l'app** (champ `app` dans le `fly.toml`)
   - Le **build context** : lire le `fly.toml` pour identifier le `[build]` section (dockerfile, build path) et le `Dockerfile` associé s'il existe

Cela donne la liste complète des apps Fly.io deployables dans ce repo.

### 5.2 — Croiser avec les fichiers modifiés

1. Récupérer tous les fichiers modifiés dans la branche :
   ```
   git diff main..HEAD --name-only
   ```
2. Pour chaque app Fly.io trouvée en 5.1, vérifier si **au moins un fichier modifié** se trouve dans le répertoire de l'app (ou dans un sous-répertoire). Inclure :
   - Code source (`.ts`, `.js`, `.py`, `.go`, etc.)
   - Fichiers de config (`fly.toml`, `Dockerfile`, `docker-compose*.yml`, `package.json`, `deno.json`, etc.)
   - Dépendances (`package-lock.json`, `yarn.lock`, `requirements.txt`, etc.)
   - Tout autre fichier dans le répertoire de l'app

3. **Si aucune app impactée** : Informe l'utilisateur qu'il n'y a pas de déploiement Fly.io nécessaire. Fin du processus.

### 5.3 — Rapport et confirmation

Pour chaque app impactée, présenter un tableau :

```
| App Fly.io          | Répertoire                 | Fichiers modifiés | Type de changement |
|---------------------|----------------------------|-------------------|--------------------|
| core-comm           | orbit/core/comm/           | 3 fichiers        | Code + Config      |
| silo-acme-clientele | orbit/silo/acme/clientele/ | 1 fichier         | Code seulement     |
```

Types de changement :
- **Config seulement** : seul `fly.toml` est modifié (pas de rebuild d'image nécessaire, mais redeploy quand même)
- **Code seulement** : fichiers source modifiés, `fly.toml` inchangé → rebuild + deploy
- **Code + Config** : les deux → rebuild + deploy

**DEMANDE OBLIGATOIREMENT CONFIRMATION à l'utilisateur** : "J'ai détecté X app(s) Fly.io impactées par les changements. Voulez-vous les redéployer ?"

L'utilisateur peut :
- Confirmer tout
- Choisir quelles apps déployer
- Refuser tout

### 5.4 — Déploiement

Pour chaque app confirmée :

1. Se placer dans le répertoire de l'app
2. Exécuter : `fly deploy`
3. Vérifier le statut : `fly status`
4. Afficher le résultat (succès/échec + URL du service)

### Cas particuliers Fly.io

- **Secrets** : Si le diff du `fly.toml` montre de nouvelles variables dans `[env]`, elles seront deployées automatiquement. Pour les secrets (tokens, clés API), rappeler à l'utilisateur de les setter manuellement via `fly secrets set KEY=value -a <app-name>`.
- **Plusieurs apps impactées** : Proposer un ordre logique de déploiement (core d'abord, puis silos) ou laisser l'utilisateur choisir.
- **Rollback** : En cas d'échec, proposer `fly releases -a <app-name>` pour voir l'historique et `fly deploy --image <previous-image> -a <app-name>` pour rollback.
- **Dépendances partagées** : Si un fichier modifié est dans un dossier `lib/` ou `shared/` référencé par plusieurs apps, toutes ces apps doivent être signalées comme impactées.

## Règles de sécurité

- Ne jamais faire de `git push --force`.
- Ne jamais commiter de fichiers sensibles (.env, .credentials, secrets, clés API).
- Ne jamais utiliser `supabase db push --linked` — toujours passer par le MCP Supabase.
- Ne jamais déployer sur Fly.io sans confirmation explicite de l'utilisateur.
- En cas d'erreur git, gh ou fly, afficher l'erreur clairement et proposer une solution.
- Ne jamais pousser de migrations en production sans confirmation explicite de l'utilisateur.
- Ordre de déploiement recommandé : migrations Supabase d'abord (étape 4), puis Fly.io (étape 5).

$ARGUMENTS
