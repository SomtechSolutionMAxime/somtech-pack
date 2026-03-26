---
name: migration-runner
description: >
  Exécuter les migrations Supabase en production de manière sûre, valider
  l'intégrité des changements et documenter chaque étape. Ce skill guide
  l'agent devops-silo à travers le workflow complet : recevoir une demande
  de migration du dev-orchestrator, valider en local avec supabase db reset,
  appliquer via MCP Supabase (pas supabase db push), vérifier que les tables
  et RLS policies sont intactes, et notifier les dependents. Utiliser ce skill
  chaque fois qu'une migration doit être appliquée en production.
---

# Migration Runner

Les migrations Supabase sont le cœur du contrat entre le code et les données. Une mauvaise migration peut corrompre des données ou casser l'application en prod. Ce skill définit le workflow extrêmement stricte pour exécuter une migration : tester localement avec une BD vierge, appliquer directement en prod via MCP (jamais via le CLI incohérent), valider, et documenter.

## Philosophie

Une migration n'est pas "du code qui change la BD". C'est une transformation irréversible des données. Une fois appliquée en prod, elle ne peut pas être "push" à nouveau. Donc, chaque migration doit :

1. Passer sur une BD vierge (simuler la prod vierge)
2. Être appliquée directement en SQL (jamais via un intermédiaire GUI ou CLI)
3. Être vérifiée immédiatement après
4. Être documentée pour que quelqu'un d'autre puisse l'auditer

## Workflow de migration complet

```
Réception de migration.request (Desk)
         │
         ├─→ Pre-migration checks (OBLIGATOIRE)
         │   ├─→ Migration existe dans `supabase/migrations/`?
         │   ├─→ Filename respecte format YYYYMMDDHHMMSS_description.sql ?
         │   ├─→ Contenu validé par security-validator ?
         │   └─→ Backup Supabase préalable existe et est testable ?
         │
         ├─→ Test local sur BD vierge
         │   ├─→ Exécuter : supabase db reset
         │   ├─→ Vérifier que la migration passe sans erreur
         │   ├─→ Vérifier que les tables, indexes, RLS policies existent
         │   └─→ Si fail → STOPPER et escalader. Ne pas appliquer en prod.
         │
         ├─→ Notification à l'équipe
         │   └─→ "Migration XYZ appliquée en 45 secondes, vérification en cours..."
         │
         ├─→ Appliquer en production
         │   ├─→ Récupérer SQL brut de la migration
         │   ├─→ Exécuter directement via MCP Supabase (ou SQL direct)
         │   └─→ Monitorer les logs et erreurs en temps réel
         │
         ├─→ Post-migration verification
         │   ├─→ SELECT COUNT(*) sur les tables modifiées
         │   ├─→ Vérifier que les indexes existent
         │   ├─→ Vérifier que les RLS policies s'appliquent correctement
         │   ├─→ Vérifier qu'aucune colonne n'a été corrompue
         │   ├─→ Exécuter NOTIFY pgrst 'reload schema' pour recharger le cache
         │   └─→ Tester les endpoints impactés via API
         │
         ├─→ Publier migration.result success
         │   └─→ Notifier dev-orchestrator, dev-workers, tests unitaires qu'ils peuvent continuer
         │
         └─→ [Succès] Migration en prod
            [Échec] Créer migration corrective + escalade humaine
```

## Pre-migration Checks (OBLIGATOIRE)

Avant TOUTE exécution, valider ces points. Aucune exception, même si "le client est bloqué".

### Check 1 : Fichier de migration existe

```bash
# La migration doit exister dans supabase/migrations/
ls -la supabase/migrations/20260306120000_add_invoices_table.sql

# Doit exister : OUI
# Doit être un fichier texte SQL : OUI
# Taille > 0 : OUI
```

### Check 2 : Nommage respecte le format

```
Format : YYYYMMDDHHMMSS_description.sql
         ^^^ date    ^^^ heure        ^^^ description kebab-case

Exemple valide  : 20260306143200_add_invoices_table.sql   ✅
Exemple invalide: 2026-03-06_add_invoices_table.sql       ❌ (date avec tirets)
Exemple invalide: add_invoices_table.sql                  ❌ (pas de timestamp)
```

### Check 3 : Contenu sécurité validé

La migration contient-elle du code dangereux (DROP TABLE sans backup) ou des données sensibles ?

```bash
# Lecture du fichier
cat supabase/migrations/20260306120000_add_invoices_table.sql

# À chercher :
# ❌ DROP TABLE sans conditions (sauf si explicitement annoncé)
# ❌ DELETE FROM sans WHERE (wipe complet de données)
# ❌ ALTER COLUMN ... SET DEFAULT sans valeur par défaut
# ❌ Données hardcodées (emails, API keys, secrets)
```

### Check 4 : Backup Supabase existe et est testable

Avant d'appliquer une migration, le backup du jour doit exister et être accessible.

```bash
# Dans le Supabase Dashboard → Database → Backups
# Vérifier : Au moins un backup < 24h existe

# Si pas de backup : STOP. Créer un backup manuel d'abord.
supabase db push --linked  # ⚠️ INTERDIT EN PRODUCTION
# ✅ À la place : Créer un backup via Supabase Studio UI
```

### Format de validation Desk

```json
{
  "task_type": "migration.pre_check",
  "resource_id": "mig_uuid_xyz",
  "payload": {
    "migration_file": "20260306143200_add_invoices_table.sql",
    "migration_timestamp": "20260306143200",
    "migration_description": "add_invoices_table",
    "checks": {
      "file_exists": true,
      "filename_format_valid": true,
      "content_reviewed": true,
      "content_safe": true,
      "backup_available": true,
      "backup_testable": true
    },
    "all_checks_passed": true,
    "validated_by": "devops-silo",
    "validated_at": "2026-03-06T14:20:00Z"
  }
}
```

## Test local : supabase db reset

**CRITIQUE** : Une migration qui passe sur une BD neuve mais échoue sur une BD en prod avec des données anciennes = catastrophe.

```bash
# 1. S'assurer que supabase local est en route
supabase start

# 2. Exécuter le reset complet (SQL brut)
supabase db reset

# Résultat attendu :
# $ supabase db reset
# Resetting database...
# Seeding data...
# ✓ Reset complete
# ✓ Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres

# 3. Vérifier que la migration s'est appliquée correctement
psql -U postgres -h 127.0.0.1 -p 54322 -c "
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'invoices'
  );"

# Résultat attendu : t (TRUE — table existe)

# 4. Vérifier les colonnes
psql -U postgres -h 127.0.0.1 -p 54322 -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'invoices';"

# Résultat attendu :
#  column_name  │   data_type
# ──────────────┼──────────────
#  id           │ uuid
#  user_id      │ uuid
#  amount       │ numeric
#  created_at   │ timestamp with time zone
# ...

# 5. Vérifier les RLS policies
psql -U postgres -h 127.0.0.1 -p 54322 -c "
  SELECT polname, polcmd, qual
  FROM pg_policies
  WHERE tablename = 'invoices';"

# Résultat attendu : Au moins une policy par commande (SELECT, INSERT, UPDATE, DELETE)
#        polname       │ polcmd │               qual
# ──────────────────────────────┼────────────────────────────────────
#  select_own_invoices │ r      │ (user_id = auth.uid())
#  insert_own_invoices │ a      │ (user_id = auth.uid())
#  update_own_invoices │w      │ (user_id = auth.uid())
```

**Si la migration échoue** :

```bash
# Lire le message d'erreur complet
supabase db reset 2>&1 | tail -50

# Erreur typique : "column 'amount' already exists"
# → Vérifier si une migration antérieure a déjà ajouté la colonne
# → Soit modifier la migration (si pas encore mergée main)
# → Soit créer une migration corrective

# NE JAMAIS modifier une migration déjà mergée sur main.
```

## Exécution en production

**Une fois les tests locaux passés**, appliquer la migration en prod. **JAMAIS via `supabase db push --linked`** (interdit par le contrat Somtech). À la place, exécuter le SQL directement.

### Méthode 1 : Via MCP Supabase (RECOMMANDÉE)

```json
{
  "tool": "supabase.sql.execute",
  "project_ref": "aims_prod_uuid",
  "query": "-- Migration 20260306143200_add_invoices_table\nCREATE TABLE invoices (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n  amount numeric(12,2) NOT NULL,\n  created_at timestamp with time zone DEFAULT now(),\n  updated_at timestamp with time zone DEFAULT now()\n);\n\n-- RLS\nALTER TABLE invoices ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY select_own_invoices ON invoices\n  FOR SELECT\n  USING (user_id = auth.uid());\n\nCREATE POLICY insert_own_invoices ON invoices\n  FOR INSERT\n  WITH CHECK (user_id = auth.uid());\n\nCREATE POLICY update_own_invoices ON invoices\n  FOR UPDATE\n  USING (user_id = auth.uid())\n  WITH CHECK (user_id = auth.uid());\n\nCREATE POLICY delete_own_invoices ON invoices\n  FOR DELETE\n  USING (user_id = auth.uid());\n\n-- Indexes\nCREATE INDEX idx_invoices_user_id ON invoices(user_id);\n"
}
```

### Méthode 2 : Via Supabase SQL Editor (Web UI)

1. Aller à https://supabase.com/dashboard/project/[project-ref]/sql/new
2. Copier-coller le SQL brut de la migration
3. Cliquer "Run" (exécute immédiatement en prod)

### Méthode 3 : Via psql direct (Si accès SSH tunnel Supabase)

```bash
# Récupérer la connexion string prod
SUPABASE_PASSWORD="$(vault kv get secret/prod/supabase_password)"

psql postgresql://postgres:$SUPABASE_PASSWORD@db.aims.supabase.co:5432/postgres \
  -f supabase/migrations/20260306143200_add_invoices_table.sql

# Vérifier le statut
echo "Migration exit code: $?"
```

## Post-migration Verification

**IMMÉDIATEMENT** après l'exécution de la migration en prod, valider que tout s'est bien passé.

### Vérification 1 : Tables créées

```sql
-- Pour chaque table créée par la migration
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'invoices'
) AS table_exists;

-- Résultat attendu : true
```

### Vérification 2 : Colonnes et types

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Résultat attendu : toutes les colonnes avec les bons types
```

### Vérification 3 : Indexes existent

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'invoices';

-- Résultat attendu : au moins idx_invoices_user_id
```

### Vérification 4 : RLS policies sont applicables

```sql
SELECT schemaname, tablename, polname, polcmd, qual
FROM pg_policies
WHERE tablename = 'invoices';

-- Résultat attendu : 4 policies (SELECT, INSERT, UPDATE, DELETE)
```

### Vérification 5 : Pas de corruption de données

Pour une migration qui modifie des colonnes existantes :

```sql
-- Exemple : migration ajoute colonne status à table existante
-- Vérifier que les anciennes lignes ne sont pas cassées

SELECT COUNT(*) FROM invoices;  -- Nombre de lignes avant
SELECT COUNT(*) FROM invoices WHERE id IS NOT NULL;  -- Vérifier que les IDs sont intacts
SELECT COUNT(*) FROM invoices WHERE created_at IS NOT NULL;  -- Vérifier les timestamps
```

### Vérification 6 : Recharger le cache PostgREST

Supabase PostgREST cache le schéma. La migration est appliquée mais PostgREST ne la "voit" pas encore sans cette commande :

```sql
-- Exécuter après chaque migration
NOTIFY pgrst, 'reload schema';

-- Résultat : NOTIFY (pas de "résultat" attendu, juste un acknowledge)
```

### Vérification 7 : Tester les endpoints impactés

Une fois le schéma rechargé, tester que les endpoints API fonctionnent correctement :

```bash
# Exemple : migration ajoute table invoices
# Vérifier que GET /invoices répond correctement

curl -X GET https://api.aims.fly.dev/api/invoices \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -w "HTTP %{http_code}\n"

# Résultat attendu : HTTP 200 (ou 401 si pas authentifié, c'est normal)
# Pas de SQL error ou 500
```

### Format de verification Desk

```json
{
  "task_type": "migration.verification",
  "resource_id": "mig_uuid_xyz",
  "payload": {
    "migration_file": "20260306143200_add_invoices_table.sql",
    "applied_at": "2026-03-06T14:25:00Z",
    "verification_results": {
      "tables_created": {
        "invoices": true
      },
      "columns_correct": {
        "invoices": {
          "id": "uuid",
          "user_id": "uuid",
          "amount": "numeric",
          "created_at": "timestamp",
          "count": 5
        }
      },
      "indexes_created": {
        "idx_invoices_user_id": true
      },
      "rls_policies": {
        "invoices": {
          "select_own_invoices": true,
          "insert_own_invoices": true,
          "update_own_invoices": true,
          "delete_own_invoices": true
        }
      },
      "data_integrity": {
        "existing_rows_count": 0,
        "no_corruption": true
      },
      "schema_reloaded": true,
      "api_endpoints_tested": {
        "GET /api/invoices": "200 OK"
      }
    },
    "all_checks_passed": true,
    "verified_by": "devops-silo",
    "verified_at": "2026-03-06T14:27:00Z"
  }
}
```

## Rollback de migration

**Important** : On ne "rollback" jamais une migration en la supprimant du fichier. On crée une **nouvelle migration corrective**.

### Scenario 1 : Migration n'est pas encore en prod

Si la migration échoue localement et n'a pas encore été pushée en prod :

```bash
# Modifier la migration existante pour fixer l'erreur
vim supabase/migrations/20260306143200_add_invoices_table.sql

# Tester à nouveau
supabase db reset

# Si passé : pousser normalement
git add supabase/migrations/
git commit -m "fix(migration): correct invoice table schema"
```

### Scenario 2 : Migration est en prod, mais est cassée

**JAMAIS** supprimer la migration. Créer une migration corrective :

```bash
# Créer un nouveau fichier de migration
cat > supabase/migrations/20260306180000_fix_invoice_table.sql << 'EOF'
-- Rollback 20260306143200_add_invoices_table.sql
-- La colonne 'amount' ne peut pas être nulle mais pas de valeur par défaut

-- Solution : ajouter une valeur par défaut
ALTER TABLE invoices
  ALTER COLUMN amount SET DEFAULT 0.00;

-- Ou : supprimer la table et la recréer correctement
-- DROP TABLE invoices CASCADE;
-- CREATE TABLE invoices (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   amount numeric(12,2) NOT NULL DEFAULT 0.00,
--   ...
-- );
EOF

# Tester localement
supabase db reset

# Si succès : appliquer en prod
supabase db push  # ⚠️ INTERDIT EN PRODUCTION
# À la place : exécuter via MCP ou SQL Editor
```

### Scenario 3 : Décision d'affaires = "on ne veut plus cette feature"

Créer une migration "drop" qui supprime les tables/colonnes ajoutées :

```sql
-- Migration 20260307000000_drop_invoices_feature.sql
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
```

## Interdictions strictes (contrat Somtech)

### ❌ JAMAIS : `supabase db push --linked`

Cette commande est **explicitement interdite** par le contrat Somtech. Elle crée des états de migration incohérents.

```bash
# INTERDIT :
supabase db push --linked

# À la place : exécuter le SQL directement via MCP ou SQL Editor
```

### ❌ JAMAIS : Modifier une migration déjà mergée sur main

Si une migration a été mergée sur main et appliquée en prod, modifier le fichier causera une désynchronisation.

```bash
# MAUVAIS : Une migration en prod, on la modifie
vim supabase/migrations/20260306120000_add_invoices_table.sql
# → Localement : schema change
# → En prod : schema ne change pas (migration a déjà tourné)
# → Désync totale

# BON : créer une migration corrective
cat > supabase/migrations/20260306180000_fix_invoice_table.sql
```

### ❌ JAMAIS : Appliquer une migration sans `supabase db reset` localement d'abord

```bash
# MAUVAIS : créer une migration, la pusher en prod sans tester
git add supabase/migrations/20260306120000_new_table.sql
git push origin main
# → Déploiement automatique applique la migration
# → Erreur en prod, personne ne l'a testée localement

# BON : tester d'abord
supabase db reset
# Vérifier que ça passe
# Alors : pousser et déployer
```

## Anti-patterns

### Migration sans RLS
- **Risque** : Table créée sans Row Level Security = tous les utilisateurs voient toutes les données
- **Prévention** : TOUJOURS ajouter RLS à chaque nouvelle table utilisateur

### Migration avec DELETE sans WHERE
- **Risque** : Wipe accidentel de 10 000 lignes
- **Prévention** : Code review stricte par security-validator. DELETE devrait être rare.

### Migration modifiant une colonne NOT NULL sans valeur par défaut
- **Risque** : Les anciennes lignes n'ont pas de valeur → erreur d'intégrité
- **Prévention** : Toujours ajouter `SET DEFAULT` ou faire un UPDATE avant l'ALTER

### Migration sans index sur les colonnes de filtre
- **Risque** : Requête `WHERE user_id = $1` devient lente sur table énorme
- **Prévention** : Ajouter des indexes dès le départ

### Ignorer les erreurs de migration en logs
- **Risque** : Migration "passe" mais génère des avertissements qui deviennent critiques plus tard
- **Prévention** : Lire les logs en entier. Aucun WARNING, aucune erreur SQL.

### Oublier de recharger le schéma PostgREST
- **Risque** : Migration en place mais les endpoints API ne voient pas la nouvelle table
- **Prévention** : TOUJOURS exécuter `NOTIFY pgrst, 'reload schema';` après chaque migration
