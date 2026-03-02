---
description: Générer les correctifs Loi 25 (P-39.1) après un audit
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(find:*, wc:*, ls:*)
argument-hint: [rapport-audit.md]
---

Générer des correctifs concrets pour les constats identifiés dans un rapport d'audit Loi 25. Charger d'abord le skill `loi-25-compliance`.

> Références : Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1)

## Prérequis

Lire le rapport d'audit le plus récent :
1. Si un argument est fourni, lire @$1
2. Sinon, chercher le fichier `audit-loi25-rapport-*.md` le plus récent dans le projet

Extraire tous les constats non conformes et les trier par sévérité (CRITIQUE d'abord).

## Correctifs à générer

### Pour les constats CRITIQUES — Chiffrement au repos (art. 10, 12 al. 2)

Si des champs de Catégorie 1 (sensibles au sens de l'art. 12 al. 2) sont stockés en clair, générer une migration SQL :

```sql
-- Migration: YYYYMMDDHHMMSS_encrypt_sensitive_fields.sql
-- Réf: art. 10 (mesures de sécurité), art. 12 al. 2 (données sensibles)

-- 1. Activer pgcrypto si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Ajouter les colonnes chiffrées
ALTER TABLE employees ADD COLUMN IF NOT EXISTS [champ]_encrypted BYTEA;

-- 3. Migrer les données existantes (nécessite la clé de chiffrement)
-- ATTENTION: Exécuter manuellement avec la clé configurée
-- UPDATE employees SET [champ]_encrypted = pgp_sym_encrypt([champ]::text, current_setting('app.encryption_key'))
-- WHERE [champ] IS NOT NULL;

-- 4. Créer une vue sécurisée pour la lecture
CREATE OR REPLACE FUNCTION decrypt_sensitive_field(encrypted_value BYTEA)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_value, current_setting('app.encryption_key'));
EXCEPTION WHEN OTHERS THEN
  RETURN '[CHIFFRÉ]';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Lister chaque champ à chiffrer et demander confirmation avant de créer la migration.

### Pour les constats MAJEURS — Audit trail (art. 3.5, 3.8, 10)

Si l'audit trail est absent, générer une migration :

```sql
-- Migration: YYYYMMDDHHMMSS_create_audit_trail.sql
-- Réf: art. 3.5 (incidents), art. 3.8 (registre), art. 10 (mesures de sécurité)

-- Table d'audit des accès aux données personnelles
CREATE TABLE IF NOT EXISTS pii_access_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'SELECT', 'UPDATE', 'DELETE', 'ANONYMIZE'
  table_name TEXT NOT NULL,
  record_id UUID,
  fields_accessed TEXT[], -- liste des champs consultés
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_pii_access_log_user ON pii_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_pii_access_log_table ON pii_access_log(table_name);
CREATE INDEX IF NOT EXISTS idx_pii_access_log_date ON pii_access_log(created_at);

-- RLS : seuls les admins et RH peuvent consulter les logs (art. 20)
ALTER TABLE pii_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON pii_access_log FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users u
  WHERE u.id = auth.uid()
  AND u.access_level >= 5
));

-- Registre des incidents de confidentialité (art. 3.8)
-- Communicable à la CAI sur demande
CREATE TABLE IF NOT EXISTS confidentiality_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_date TIMESTAMPTZ NOT NULL,
  discovery_date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  affected_tables TEXT[],
  affected_records_count INTEGER,
  risk_assessment TEXT, -- art. 3.7 : sensibilité, conséquences, probabilité
  risk_level TEXT CHECK (risk_level IN ('low', 'serious')),
  cai_notified BOOLEAN DEFAULT false, -- art. 3.5 al. 2
  cai_notification_date TIMESTAMPTZ,
  persons_notified BOOLEAN DEFAULT false, -- art. 3.5 al. 2
  persons_notification_date TIMESTAMPTZ,
  measures_taken TEXT, -- art. 3.5 al. 1
  reported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE confidentiality_incidents ENABLE ROW LEVEL SECURITY;
```

### Pour les constats MAJEURS — Rétention et anonymisation (art. 23)

Générer une fonction d'anonymisation conforme à l'art. 23 al. 3 (irréversible, meilleures pratiques) :

```sql
-- Réf: art. 23 (destruction/anonymisation quand finalité accomplie)
-- L'anonymisation doit être irréversible (art. 23 al. 3)
CREATE OR REPLACE FUNCTION anonymize_employee(p_employee_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE employees SET
    first_name = 'Anonyme',
    last_name = 'Employé-' || LEFT(gen_random_uuid()::text, 8),
    email = 'anonyme-' || LEFT(gen_random_uuid()::text, 8) || '@anonymized.local',
    phone = NULL,
    personal_email = NULL,
    address = NULL,
    city = NULL,
    province = NULL,
    postal_code = NULL,
    country = NULL,
    birth_date = NULL,
    birth_year = NULL,
    gender = NULL,
    emergency_contact_name = NULL,
    emergency_contact_phone = NULL,
    emergency_contact_2_name = NULL,
    emergency_contact_2_phone = NULL,
    allergies = NULL,
    secondary_phone = NULL,
    work_phone = NULL,
    tshirt_size = NULL,
    hoodie_size = NULL
  WHERE id = p_employee_id;

  -- Logger l'anonymisation (art. 10 - traçabilité)
  INSERT INTO pii_access_log (user_id, action, table_name, record_id, fields_accessed)
  VALUES (auth.uid(), 'ANONYMIZE', 'employees', p_employee_id, ARRAY['ALL']);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Note :** On utilise `gen_random_uuid()` au lieu de l'ID original pour garantir l'irréversibilité (art. 23 al. 3).

### Pour les constats MODÉRÉS — Masquage frontend (art. 10, 20)

Générer un fichier utilitaire TypeScript :

```typescript
// utils/pii-masking.ts
// Réf: art. 10 (mesures de sécurité), art. 20 (qualité pour connaître)

export const maskPhone = (phone: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '***';
  return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
};

export const maskEmail = (email: string | null): string => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
};

export const maskAddress = (city: string | null, province?: string | null): string => {
  if (!city) return '';
  return province ? `${city}, ${province}` : city;
};

export const maskBirthDate = (date: string | null): string => {
  if (!date) return '';
  return new Date(date).getFullYear().toString();
};

export const maskNAS = (): string => '***-***-***'; // JAMAIS affiché (art. 12 al. 2)

export const PIIField: React.FC<{
  value: string | null;
  maskFn: (v: string | null) => string;
  canViewFull: boolean;
}> = ({ value, maskFn, canViewFull }) => {
  const [showFull, setShowFull] = React.useState(false);

  if (canViewFull && showFull) {
    return <span onClick={() => setShowFull(false)}>{value}</span>;
  }
  return <span onClick={() => canViewFull && setShowFull(true)}>{maskFn(value)}</span>;
};
```

### Pour les constats MODÉRÉS — Portabilité des données (art. 27 al. 3)

Générer une Edge Function Supabase pour l'export :

```typescript
// supabase/functions/export-my-data/index.ts
// Réf: art. 27 al. 3 — Droit à la portabilité
// La personne peut demander ses renseignements dans un format
// technologique structuré et couramment utilisé
```

### Pour les constats MAJEURS — Confidentialité par défaut (art. 9.1)

Si des paramètres de partage/visibilité sont activés par défaut, générer les corrections :

```typescript
// Réf: art. 9.1 — Paramètres de confidentialité au plus haut niveau par défaut
// Corriger tout useState(true) ou defaultValue={true} pour les paramètres de partage
```

### Pour les constats MAJEURS — Décisions automatisées (art. 12.1)

Si le chatbot prend des décisions automatisées sans transparence, générer :

```typescript
// Réf: art. 12.1 — Information sur les décisions automatisées
// Ajouter un disclaimer et un mécanisme de révision humaine
```

## Processus

1. Lire le rapport d'audit
2. Pour chaque constat, proposer le correctif approprié en citant l'article P-39.1 pertinent
3. Demander confirmation avant de créer chaque fichier
4. Créer les fichiers dans l'ordre : migrations SQL → backend → frontend → documentation
5. Générer un résumé des correctifs appliqués avec les références légales
