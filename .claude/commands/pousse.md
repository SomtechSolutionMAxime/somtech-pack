# /pousse — Commit, PR et migrations Supabase

Tu es un assistant de déploiement. Exécute les étapes suivantes dans l'ordre, en t'arrêtant à la première erreur critique. Réponds toujours en français.

## Étape 1 : Commit des changements

1. Lance `git status` pour voir l'état du repo.
2. S'il n'y a aucun changement (ni staged, ni unstaged, ni untracked), informe l'utilisateur qu'il n'y a rien à commiter et passe directement à l'étape 2.
3. S'il y a des changements :
   - Lance `git diff` et `git diff --staged` pour analyser les modifications.
   - Lance `git log --oneline -5` pour voir le style des messages de commit récents.
   - Stage les fichiers pertinents avec `git add <fichier>` (fichiers spécifiques, jamais `git add .` ni `git add -A`).
   - Ne jamais commiter de fichiers sensibles (.env, credentials, secrets, clés API).
   - Génère un message de commit concis en français qui décrit le "pourquoi" des changements.
   - Le message de commit doit se terminer par : `Co-Authored-By: Claude <noreply@anthropic.com>`
   - Crée le commit.
   - Pousse sur la branche courante avec `git push`. Si la branche n'a pas d'upstream, utilise `git push -u origin <branche>`.

## Étape 2 : Gestion de la Pull Request

1. Identifie la branche courante avec `git branch --show-current`.
2. Si la branche courante est `main`, informe l'utilisateur qu'on ne crée pas de PR depuis main et passe à l'étape 3.
3. Vérifie s'il existe déjà une PR ouverte pour cette branche vers `main` :
   ```
   gh pr list --head $(git branch --show-current) --base main --state open --json number,title,url
   ```
4. **Si une PR existe** :
   - Affiche le numéro, le titre et le lien de la PR existante.
   - Informe que le push a mis à jour la PR automatiquement.
5. **Si aucune PR n'existe** :
   - Lance `git log main..HEAD --oneline` pour résumer tous les commits de la branche.
   - Crée une PR avec `gh pr create` :
     - Titre court et descriptif en français basé sur l'ensemble des commits.
     - Body structuré avec une section `## Résumé` contenant des bullet points des changements.
     - Branche cible : `main`.
   - Affiche le lien de la PR créée.

## Étape 3 : Vérification des migrations SQL Supabase

1. Détecte les fichiers de migration ajoutés ou modifiés dans cette branche par rapport à `main` :
   ```
   git diff main..HEAD --name-only -- supabase/migrations/
   ```
2. **Si aucune migration détectée** : Informe l'utilisateur qu'il n'y a pas de migration SQL à pousser en production. Fin du processus.
3. **Si des migrations sont détectées** :
   - Liste chaque fichier de migration détecté.
   - Affiche le contenu de chaque fichier de migration pour revue.
   - **DEMANDE OBLIGATOIREMENT CONFIRMATION à l'utilisateur** avant toute action. Exemple : "J'ai détecté X migration(s). Voulez-vous les appliquer en production via Supabase ?"
   - **Si l'utilisateur confirme** : Utilise le MCP Supabase pour appliquer les migrations (`supabase db push` ou l'outil MCP Supabase approprié).
   - **Si l'utilisateur refuse** : Informe que les migrations n'ont pas été poussées et pourront l'être ultérieurement.

## Règles de sécurité

- Ne jamais faire de `git push --force`.
- Ne jamais commiter de fichiers sensibles (.env, .credentials, secrets).
- En cas d'erreur git ou gh, afficher l'erreur clairement et proposer une solution.
- Ne jamais pousser de migrations en production sans confirmation explicite de l'utilisateur.

$ARGUMENTS
