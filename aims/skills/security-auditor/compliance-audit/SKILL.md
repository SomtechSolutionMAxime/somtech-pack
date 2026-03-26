---
name: compliance-audit
description: >
  Audit de conformité pour le silo AIMS : RLS policies, encryption at-rest/in-transit,
  détection PII, conformité Loi 25 du Québec (P-39.1), registre des traitements,
  consentement, droits d'accès et incidents. Ce skill s'exécute mensuellement
  et à la demande, générant un rapport de conformité structuré avec recommendations
  de remédiation. Utiliser ce skill avant chaque audit externe, après chaque
  changement de schéma DB, ou en réponse à une demande client/légale.
---

# Compliance Audit

L'audit de conformité va plus loin que les vulnérabilités techniques — il vérifie que le silo respecte les régulations légales et les bonnes pratiques de protection des données. En tant que silo Supabase avec données utilisateur, AIMS est soumis à la Loi 25 du Québec (Protection des renseignements personnels).

## Frameworks de conformité

| Framework | Applicabilité | Vérification |
|-----------|---------------|-------------|
| **Loi 25 (P-39.1) Québec** | Oui — données utilisateurs québécoises | Consentement, registre, incidents, droits d'accès |
| **PIPEDA (Canada)** | Partiellement — si données fédérales | Similaire à Loi 25 mais portée pan-canadienne |
| **GDPR (UE)** | Non immédiat — sauf si clients EU | Encryption, consentement, Data Processing Agreements |
| **OWASP Top 10** | Oui — sécurité application | RLS, injection SQL, XSS, CSRF |
| **PCI-DSS (si paiements)** | Selon le modèle — si stockage cartes | Crypto, tokenization, logging |

Focus principal : **Loi 25 du Québec**.

## Checklist RLS

Vérifier que toutes les tables contenant des données liées à un utilisateur (user_id, email, phone, etc.) ont des Row Level Security policies.

### Scan des tables

```sql
-- 1. Identifier toutes les tables avec colonnes user_id ou données sensibles
SELECT
  t.table_name,
  string_agg(c.column_name, ', ') as sensitive_columns,
  (SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_name = t.table_name AND constraint_type = 'PRIMARY KEY') as has_pk,
  (SELECT COUNT(*) FROM pg_policies
   WHERE tablename = t.table_name) as policy_count
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND (c.column_name IN ('user_id', 'email', 'phone', 'ssn', 'address', 'date_of_birth')
       OR t.table_name LIKE '%user%'
       OR t.table_name LIKE '%profile%')
GROUP BY t.table_name;

-- 2. Vérifier que RLS est activé sur ces tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE '%user%' OR tablename LIKE '%profile%');

-- 3. Lister toutes les policies existantes
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Pattern RLS obligatoire pour tables user_data

```sql
-- Chaque table avec user_id DOIT avoir cette policy minimum

-- Pour SELECT (lire ses propres données)
CREATE POLICY "Users can read own data" ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Pour UPDATE (modifier ses propres données)
CREATE POLICY "Users can update own data" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pour DELETE (supprimer ses propres données)
CREATE POLICY "Users can delete own data" ON user_profiles
  FOR DELETE
  USING (auth.uid() = user_id);
```

### Violations critiques

| Violation | Impact | Fix |
|-----------|--------|-----|
| **Table user_data sans RLS** | N'importe qui peut lire les données de n'importe qui | `ALTER TABLE X ENABLE ROW LEVEL SECURITY; CREATE POLICY ...` |
| **RLS activé mais aucune policy** | RLS activé mais aucune policy définie = accès refusé même aux propriétaires | Créer policies pour SELECT/UPDATE/DELETE |
| **Policy sans `auth.uid()`** | La policy se base sur un autre critère (ex: un paramètre client) | Revoir la logique, utiliser `auth.uid()` ou `auth.user_id()` |
| **Policy permissive (USING/WITH CHECK vide)** | Accès ouvert à tous les rôles | Ajouter condition explicite dans USING et WITH CHECK |

### Template de rapport RLS

```json
{
  "audit_section": "rls_policies",
  "timestamp": "2026-03-06T10:00:00Z",
  "status": "non_compliant",
  "findings": [
    {
      "finding_id": "comp-rls-001",
      "table": "user_profiles",
      "check": "RLS_ENABLED",
      "result": "PASS",
      "severity": null
    },
    {
      "finding_id": "comp-rls-002",
      "table": "invoices",
      "check": "RLS_ENABLED",
      "result": "FAIL",
      "severity": "critical",
      "current_state": "RLS is disabled",
      "remediation": "ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;"
    },
    {
      "finding_id": "comp-rls-003",
      "table": "audit_logs",
      "check": "HAS_AUTH_UID_POLICY",
      "result": "FAIL",
      "severity": "high",
      "current_policies": ["read_by_admin"],
      "issue": "Policy 'read_by_admin' does not use auth.uid()",
      "remediation": "Create policy that restricts access by auth.uid()"
    }
  ],
  "summary": {
    "tables_scanned": 24,
    "tables_compliant": 23,
    "tables_non_compliant": 1,
    "policies_compliant": 34,
    "policies_non_compliant": 1
  }
}
```

## Détection PII (Personally Identifiable Information)

Identifier toutes les colonnes contenant des données personnelles (Loi 25 = données à caractère personnel).

### Types de PII au Québec

| Type | Exemples | Protection | Loi 25 |
|------|----------|-----------|--------|
| **Identificateurs directs** | Nom complet, email, téléphone, SSN | Chiffrement + accès restreint | Oui |
| **Identificateurs quasi-directs** | Date de naissance, code postal + sexe | Accès restreint | Oui |
| **Données financières** | Numéro compte bancaire, historique crédit | Chiffrement (PCI-DSS si applicable) | Oui |
| **Données de santé** | Conditions médicales, prescriptions | Chiffrement + audit strict | Oui (sensible) |
| **Données biométriques** | Photos faciales, empreintes, iris | Chiffrement + consentement explicite | Oui (sensible) |

### Scan PII dans la base

```sql
-- Identifier toutes les colonnes qui pourraient contenir du PII
SELECT
  table_name,
  column_name,
  data_type,
  CASE
    WHEN column_name LIKE '%email%' THEN 'Email'
    WHEN column_name LIKE '%phone%' THEN 'Phone'
    WHEN column_name LIKE '%name%' THEN 'Name'
    WHEN column_name LIKE '%ssn%' OR column_name LIKE '%sin%' THEN 'SSN/SIN'
    WHEN column_name LIKE '%address%' THEN 'Address'
    WHEN column_name LIKE '%birth%' OR column_name LIKE '%dob%' THEN 'Date of Birth'
    WHEN column_name LIKE '%card%' OR column_name LIKE '%credit%' THEN 'Card/Payment'
    WHEN data_type = 'bytea' THEN 'Binary (possibly encrypted)'
  END as pii_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name LIKE '%email%'
    OR column_name LIKE '%phone%'
    OR column_name LIKE '%name%'
    OR column_name LIKE '%ssn%'
    OR column_name LIKE '%sin%'
    OR column_name LIKE '%address%'
    OR column_name LIKE '%birth%'
    OR column_name LIKE '%card%'
    OR column_name LIKE '%credit%'
  )
ORDER BY table_name, column_name;
```

### Encryption requis pour PII

| PII Type | At-Rest | In-Transit | Audit Access |
|----------|---------|-----------|--------------|
| Email | Optionnel (Supabase hache déjà) | TLS 1.3 | Oui (Loi 25) |
| Téléphone | Chiffrement recommandé | TLS 1.3 | Oui (Loi 25) |
| SSN/SIN | **Chiffrement obligatoire** | TLS 1.3 | Oui (Loi 25) |
| Adresse | Chiffrement recommandé | TLS 1.3 | Oui (Loi 25) |
| Carte bancaire | **PCI-DSS (chiffrement + tokenization)** | TLS 1.3 | Audit strict |
| Date de naissance | Chiffrement recommandé | TLS 1.3 | Oui (Loi 25) |

### Template de rapport PII

```json
{
  "audit_section": "pii_detection",
  "timestamp": "2026-03-06T10:00:00Z",
  "status": "compliant",
  "pii_inventory": [
    {
      "finding_id": "pii-001",
      "table": "users",
      "column": "email",
      "pii_type": "Email",
      "row_count": 1247,
      "encryption": "database_level_hash",
      "rls_policy": "user_can_read_own",
      "compliance": "PASS"
    },
    {
      "finding_id": "pii-002",
      "table": "user_profiles",
      "column": "phone",
      "pii_type": "Phone",
      "row_count": 987,
      "encryption": "none",
      "rls_policy": "user_can_read_own",
      "compliance": "WARN",
      "recommendation": "Add pgcrypto encryption for phone column"
    },
    {
      "finding_id": "pii-003",
      "table": "kyc_data",
      "column": "ssn",
      "pii_type": "SSN/SIN",
      "row_count": 156,
      "encryption": "pgcrypto_aes",
      "rls_policy": "kyc_read_by_admin_and_owner",
      "compliance": "PASS"
    }
  ],
  "summary": {
    "total_pii_columns": 12,
    "encrypted": 8,
    "unencrypted": 4,
    "recommended_actions": [
      "Encrypt phone column in user_profiles",
      "Add audit logging for access to kyc_data",
      "Review address column encryption"
    ]
  }
}
```

## Conformité Loi 25 (P-39.1) — Registre des traitements

Loi 25 oblige à tenir un **registre des activités de traitement** (registre de conformité).

### Registre obligatoire — Sections

| Section | Contenu | Vérification |
|---------|---------|-------------|
| **Identificateurs du traitement** | Nom, responsable, date | Présent dans documentation |
| **Finalités** | Pourquoi on collecte ? (ex: facturation, support) | Documenté dans privacy policy |
| **Catégories de données** | Email, phone, adresse, etc. | Inventaire PII ci-dessus |
| **Catégories de destinataires** | Qui accède ? (admin, api, support) | RLS policies documentées |
| **Durée de conservation** | Combien de temps garder ? | Politique de rétention définie |
| **Mesures de sécurité** | Chiffrement, RLS, audit | Détails techniques documentés |

### Template du registre

```json
{
  "registre_activites_traitement": [
    {
      "traitement_id": "TAR-001",
      "nom": "Gestion des comptes utilisateurs",
      "responsable": "Somtech Solutions",
      "date_debut": "2026-01-01",
      "finalites": [
        "Authentication et gestion des sessions",
        "Support technique et résolution d'incidents",
        "Facturation et gestion des paiements"
      ],
      "categories_donnees": [
        "Nom complet",
        "Adresse email",
        "Numéro de téléphone",
        "Adresse physique (pour facturation)",
        "Historique de connexion"
      ],
      "categories_destinataires": [
        "Administrateurs système (accès RLS complet)",
        "Support client (accès restreint via RLS)",
        "Processeur de paiement (données chiffrées)"
      ],
      "duree_conservation": "Actif + 12 mois après fin d'abonnement",
      "mesures_securite": {
        "encryption_at_rest": "Pgcrypto pour colonnes sensibles",
        "encryption_in_transit": "TLS 1.3",
        "access_control": "RLS policies + role-based access",
        "audit_logging": "Tous les accès logés dans audit_trail"
      },
      "base_legale": "Contrat de service, consentement explicite"
    }
  ]
}
```

### Consentement explicite (Loi 25)

Loi 25 oblige le consentement **explicite** (opt-in) pour le traitement de données personnelles. Pas de consentement implicite.

```json
{
  "audit_section": "consent_management",
  "status": "compliant",
  "findings": [
    {
      "finding_id": "consent-001",
      "user_action": "Sign up",
      "consent_required": "Email, account creation",
      "mechanism": "Checkbox + email verification",
      "documented": true,
      "compliance": "PASS"
    },
    {
      "finding_id": "consent-002",
      "user_action": "Marketing emails",
      "consent_required": "YES (marketing is secondary use)",
      "mechanism": "Explicit opt-in checkbox",
      "documented": true,
      "compliance": "PASS"
    },
    {
      "finding_id": "consent-003",
      "user_action": "Third-party integrations",
      "consent_required": "YES",
      "mechanism": "OAuth + consent screen",
      "documented": true,
      "compliance": "PASS"
    }
  ]
}
```

## Droits d'accès (Loi 25)

Loi 25 donne à chaque personne le droit d'accéder à ses données stockées. L'application doit permettre :

1. **Droit d'accès** : Télécharger ses données
2. **Droit de rectification** : Corriger ses données
3. **Droit à l'oubli** : Demander suppression complète
4. **Droit à la portabilité** : Exporter ses données en format standard

### Implémentation requise

```sql
-- Fonction de déexport des données utilisateur (GDPR/Loi 25 compliance)
CREATE OR REPLACE FUNCTION export_user_data(user_id uuid)
RETURNS jsonb AS $$
DECLARE
  export_json jsonb;
BEGIN
  SELECT jsonb_build_object(
    'user_profile', row_to_json(p),
    'invoices', (SELECT jsonb_agg(row_to_json(i)) FROM invoices i WHERE i.user_id = $1),
    'support_tickets', (SELECT jsonb_agg(row_to_json(t)) FROM tickets t WHERE t.user_id = $1),
    'export_timestamp', NOW(),
    'export_notice', 'This export contains all your personal data. Do not share.'
  ) INTO export_json
  FROM user_profiles p
  WHERE p.user_id = $1;

  -- Log this access in audit_trail
  INSERT INTO audit_trail (agent, event_type, resource_type, resource_id, reason)
  VALUES ('system', 'access.granted', 'user_data_export', $1, 'User-initiated data export per Loi 25');

  RETURN export_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Checklist de conformité — Droits

| Droit | Implémentation | Vérification |
|-------|-----------------|-----------|
| **Droit d'accès** | Endpoint `/api/user/export-data` | Fonction `export_user_data()` existe et fonctionne |
| **Droit de rectification** | Endpoint `/api/user/update` avec validation | Utilisateur peut modifier ses données |
| **Droit à l'oubli** | Endpoint `/api/user/delete-account` (soft delete + purge après 30j) | Processus de suppression documenté |
| **Droit à la portabilité** | Export en JSON/CSV depuis `/api/user/export-data` | Format standard, complet, machine-lisible |

## Incidents de sécurité (Loi 25)

Loi 25 oblige à rapporter les incidents de sécurité (fuites, accès non autorisé) aux autorités **dans les 30 jours**.

### Registre des incidents

```sql
CREATE TABLE compliance_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  incident_type text NOT NULL, -- 'data_breach', 'unauthorized_access', 'loss_of_data', 'ransomware', etc.
  severity text NOT NULL, -- 'critical', 'high', 'medium', 'low'
  description text NOT NULL,
  pii_affected boolean, -- Affecte des données personnelles ?
  pii_categories text[], -- Email, phone, ssn, etc.
  affected_count int, -- Nombre de personnes affectées
  discovered_at timestamptz NOT NULL,
  root_cause text,
  remediation_steps text[],
  remediation_completed_at timestamptz,
  reported_to_cnil_at timestamptz,
  reporter_notes text,
  is_notifiable boolean DEFAULT true -- Loi 25 : doit être signalé ?
);
```

### Checklist incident

| Item | Status | Action |
|------|--------|--------|
| Incident détecté et documenté | [ ] | Créer entrée dans `compliance_incidents` |
| Cause déterminée | [ ] | Investiguer et documenter |
| Affectation PII confirmée | [ ] | Vérifier quelles données exposées |
| Nombre de personnes affectées | [ ] | Compter les users impactés |
| Remédiation en cours | [ ] | Arrêter l'accès non autorisé |
| **Report dans les 30 jours** | [ ] | **Notifier autorités (CNIL/CAI Québec)** |
| Notification utilisateurs | [ ] | Email à tous les affected users |
| Documentation complète | [ ] | Audit trail, logs, communications |

## Template du rapport complet

```json
{
  "compliance_audit_report": {
    "report_date": "2026-03-06",
    "audit_period": "2026-02-01 to 2026-03-06",
    "silo": "AIMS",
    "overall_status": "compliant_with_findings",
    "sections": [
      {
        "section": "rls_policies",
        "status": "compliant",
        "findings_count": 0
      },
      {
        "section": "pii_detection",
        "status": "compliant",
        "findings_count": 0
      },
      {
        "section": "encryption",
        "status": "compliant_with_recommendations",
        "findings_count": 2,
        "findings": [
          {
            "issue": "Phone column not encrypted",
            "severity": "medium",
            "remediation": "Add pgcrypto encryption",
            "target_date": "2026-03-20"
          }
        ]
      },
      {
        "section": "loi25_consent",
        "status": "compliant",
        "findings_count": 0
      },
      {
        "section": "loi25_rights",
        "status": "compliant",
        "findings_count": 0
      },
      {
        "section": "incidents",
        "status": "no_incidents",
        "findings_count": 0,
        "last_12_months_incidents": 0
      }
    ],
    "open_action_items": [
      {
        "action": "Encrypt phone column",
        "priority": "high",
        "assigned_to": "dev-workers",
        "target_date": "2026-03-20",
        "task_id": "COMPLIANCE-001"
      }
    ],
    "certification": {
      "auditor": "security-auditor",
      "next_audit": "2026-04-06",
      "valid_until": "2026-04-06"
    }
  }
}
```

## Anti-patterns

- **Certifier "compliant" sans audit RLS** : RLS est la base. Sans vérifier les policies, on ne peut pas dire "conforme".
- **Oublier le consentement utilisateur** : Loi 25 demande consentement **explicite**. "Continuing use = consent" n'est pas valide.
- **Registre des traitements inexistant** : Loi 25 oblige ce registre. Le négliger c'est non-conforme automatiquement.
- **Incidents not reported** : Un incident de sécurité non rapporté aux autorités dans les 30 jours = violation Loi 25 (amendes jusqu'à $25K).
- **PII encryption non planifié** : Documenter qu'une colonne n'est pas chiffrée sans plan de remédiation = non-conforme.
- **Audit trail non auditable** : Si l'audit trail lui-même n'a pas de RLS ou peut être modifié, il ne sert à rien.
