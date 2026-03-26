---
name: pr-security-gate
description: >
  Revue de sécurité automatique et temps réel avant merge de PR dans le silo AIMS.
  Ce skill analyse le diff d'une PR pour détecter les problèmes de sécurité
  (secrets exposés, RLS manquant, SQL injection, XSS, dépendances non autorisées),
  génère un verdict (PASS/WARN/FAIL), et bloque ou approuve le merge selon la
  sévérité. Déclenché via task Desk (pr.security_check) par le dev-orchestrator,
  le résultat est enregistré dans la task (pr.security_result). Escalade automatique
  vers security-auditor si findings critiques détectés.
---

# PR Security Gate

Le PR Security Gate est le dernier rempart avant la production. Aucun code ne doit arriver en main sans passer cette gate. Ce skill analyse chaque PR en temps réel, détecte les problèmes de sécurité introduits, et génère un verdict automatisé.

## Déclenchement

Le security-validator est appelé par le dev-orchestrator quand une PR est prête à être mergée.

### Task Desk d'entrée : pr.security_check

```json
{
  "task_type": "pr.security_check",
  "from_agent": "dev-orchestrator",
  "to_agent": "security-validator",
  "priority": "high",
  "payload": {
    "pr_number": 47,
    "pr_title": "feat(invoices): add invoice generation workflow",
    "branch": "feat/invoicing",
    "target_branch": "main",
    "commit_range": "abc123..def456",
    "files_changed": 8,
    "lines_added": 250,
    "lines_deleted": 45,
    "author": "dev-worker-1",
    "review_status": "approved",
    "test_status": "all_passed",
    "comments": "Ready for security check"
  }
}
```

## Phase 1 : Analyse du diff

### Fichiers à examiner

```bash
# Récupérer le diff complet
git diff main..feat/invoicing > /tmp/pr.diff

# Fichiers modifiés par type
git diff --name-only main..feat/invoicing | grep -E '\.(ts|tsx|js|jsx)$' > /tmp/typescript-files.txt
git diff --name-only main..feat/invoicing | grep -E '\.sql$' > /tmp/sql-files.txt
git diff --name-only main..feat/invoicing | grep -E '\.json$' > /tmp/json-files.txt
```

### Extraction des sections critiques

```bash
# Sections SQL (migrations, functions)
git diff main..feat/invoicing -- '*.sql'

# Sections TypeScript sensibles (auth, queries)
git diff main..feat/invoicing -- 'src/**/*.{ts,tsx}'

# Dépendances (package.json, package-lock.json)
git diff main..feat/invoicing -- 'package*.json'

# Configuration (env, secrets, keys)
git diff main..feat/invoicing -- '.env*' 'supabase/config.toml'
```

## Phase 2 : Checklist de sécurité

### 1. Pas de secrets exposés (CRÍTICO)

Analyser chaque changement pour détecter les patterns de secrets.

```python
def scan_for_secrets(diff_content):
    patterns = {
        'aws_key': r'AKIA[0-9A-Z]{16}',
        'github_token': r'ghp_[A-Za-z0-9_]{36}',
        'supabase_key': r'sbp_[A-Za-z0-9]{40}',
        'private_key': r'-----BEGIN.*PRIVATE KEY-----',
        'password_literal': r'password\s*=\s*["\']([^"\']{8,})["\']',
        'api_key_env': r'[A-Z_]*API[_-]?KEY\s*=\s*["\']?[A-Za-z0-9]{20,}',
    }

    findings = []
    for line in diff_content.split('\n'):
        if line.startswith('+') and not line.startswith('+++'):
            for pattern_name, pattern_regex in patterns.items():
                if re.search(pattern_regex, line):
                    findings.append({
                        'type': pattern_name,
                        'line': line.strip(),
                        'severity': 'critical'
                    })

    return findings
```

### 2. RLS sur nouvelles tables (CRÍTICO si données user)

Vérifier que les migrations SQL qui créent de nouvelles tables ont des policies RLS.

```sql
-- Pattern à chercher dans les migrations
CREATE TABLE IF NOT EXISTS new_table (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  -- autres colonnes
);

-- DOIT être suivi par RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON new_table
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Checklist** :

- [ ] Si migration crée table avec `user_id` → vérifie RLS enable
- [ ] Chaque policy utilise `auth.uid()` ou role-based check
- [ ] Policies couvrent SELECT, UPDATE, DELETE (pas juste SELECT)

### 3. Pas d'injection SQL (CRÍTICO)

Vérifier que les queries utilisent des paramètres, pas de concaténation de strings.

```typescript
// ❌ MAUVAIS — injection SQL possible
const query = `SELECT * FROM users WHERE email = '${email}'`;
await supabase.rpc('execute_query', { query });

// ✅ BON — paramètres sécurisés
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', email);

// ✅ BON — prepared statements
const { data } = await supabase.rpc('get_user_by_email', { user_email: email });
```

**Pattern à détecter** :

```regex
# Chercher les patterns dangereux dans le diff TypeScript
\$\{.*\}.*sql|template.*sql|`.*SELECT.*\$|concatenate.*query
```

### 4. Pas de XSS (CRÍTICO frontend)

Vérifier que le contenu utilisateur n'est jamais rendu sans sanitization.

```typescript
// ❌ MAUVAIS — XSS possible
<div dangerouslySetInnerHTML={{ __html: userInput }} />
<p>{userInput}</p>  // Si userInput = "<img src=x onerror=alert()>"

// ✅ BON — React échappe automatiquement
<p>{userInput}</p>  // React encode < > " etc.

// ✅ BON — sanitization explicite (si HTML requis)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

**Pattern à détecter** :

```regex
dangerouslySetInnerHTML|innerHTML.*=|unsafeHTML
```

### 5. Dépendances à jour et autorisées (HIGH)

Vérifier que les packages ajoutés n'ont pas de vulnérabilités connues et ne sont pas blacklistés.

```json
{
  "dependencies_blacklist": [
    "eval",
    "exec",
    "unsafe-*",
    "backdoor-*"
  ],
  "allowed_security_scopes": {
    "npm": "@myorg/allowed-packages",
    "github": "https://github.com/safe-packages"
  }
}
```

**Checklist** :

- [ ] npm audit sur package.json ne retourne pas de CRITICAL
- [ ] npm audit sur package.json ne retourne pas > 5 HIGH
- [ ] Aucun package blacklisté ajouté
- [ ] Version spécifiée (pas `*` ou `latest`)

## Phase 3 : Analyse des changements d'accès

### Migrations d'accès (CRÍTICO)

Si la PR modifie des policies, des rôles, ou des permissions :

```sql
-- Vérifier les changements de policies
SELECT * FROM pg_policies
WHERE policyname LIKE '%new_migration%';

-- Vérifier les changements de roles
SELECT * FROM pg_roles
WHERE rolname LIKE '%new_role%';
```

**Questions clés** :

- La nouvelle policy est-elle trop permissive ? (ex: permettre accès sans auth.uid())
- Un rôle a-t-il gagné des permissions dangereuses ? (ex: SUPERUSER)
- Y a-t-il une raison documentée pour chaque changement ?

### Suppression de policies (CRÍTICO)

Si une policy est supprimée :

```sql
-- ❌ MAUVAIS
DROP POLICY "user_read" ON user_profiles;

-- ✅ BON (avec raison)
-- Migration: Consolidate read policies for performance
DROP POLICY "user_read" ON user_profiles;  -- Replaced by "user_read_optimized"
CREATE POLICY "user_read_optimized" ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);
```

## Phase 4 : Vérification de conformité

### Loi 25 / Données sensibles (HIGH)

Si la PR touche des colonnes PII (email, phone, ssn, address) :

- [ ] RLS activé et vérifiable
- [ ] Aucune donnée sensible en logs non chiffrés
- [ ] Accès audité dans audit_trail

### Audit trail (MEDIUM)

Si la PR modifie des données critiques (facturation, auth) :

- [ ] Un événement d'audit est créé pour chaque changement
- [ ] event_type est approprié (data.created, data.updated, security.change)
- [ ] decision_basis est rempli

## Phase 5 : Génération du verdict

### Verdict PASS

```json
{
  "verdict": "PASS",
  "security_score": 95,
  "message": "PR 47 passes all security checks. Ready to merge.",
  "findings": {
    "critical": [],
    "high": [],
    "medium": [],
    "low": []
  },
  "checks_passed": [
    "✓ No secrets detected",
    "✓ RLS enabled on all user tables",
    "✓ No SQL injection patterns",
    "✓ Dependencies up to date",
    "✓ No XSS vulnerabilities"
  ]
}
```

### Verdict WARN (Merge possible avec attention)

```json
{
  "verdict": "WARN",
  "security_score": 72,
  "message": "PR 47 has minor security concerns. Review recommendations before merging.",
  "findings": {
    "critical": [],
    "high": [],
    "medium": [
      {
        "finding_id": "sec-warn-001",
        "type": "unencrypted_pii",
        "file": "supabase/migrations/20260306_add_phone.sql",
        "line": 15,
        "issue": "Phone column added without encryption",
        "recommendation": "Add pgcrypto encryption or document why unencrypted is acceptable",
        "severity": "medium"
      }
    ]
  },
  "checks_passed": [
    "✓ No secrets detected",
    "✓ RLS enabled on new tables"
  ],
  "checks_warning": [
    "⚠ Phone column not encrypted (but acceptable if temporary)"
  ]
}
```

**Merge possible seulement si** :

- Développeur a commenté sur le finding WARN
- Une task de remédiation est créée (linked à la PR)
- Le finding n'est pas CRITICAL

### Verdict FAIL (Bloquer le merge)

```json
{
  "verdict": "FAIL",
  "security_score": 35,
  "message": "PR 47 is BLOCKED due to critical security issues. Fix required before merge.",
  "findings": {
    "critical": [
      {
        "finding_id": "sec-fail-001",
        "type": "sql_injection",
        "file": "src/queries.ts",
        "line": 42,
        "issue": "SQL query built with template literals - injection vulnerability",
        "code": "const query = `SELECT * FROM users WHERE email = '${email}'`;",
        "remediation": "Use Supabase client with parameterized queries: await supabase.from('users').select().eq('email', email)",
        "severity": "critical"
      },
      {
        "finding_id": "sec-fail-002",
        "type": "rls_missing",
        "file": "supabase/migrations/20260306_invoices.sql",
        "issue": "Table 'invoices' created with user_id but RLS not enabled",
        "remediation": "ALTER TABLE invoices ENABLE ROW LEVEL SECURITY; CREATE POLICY ...",
        "severity": "critical"
      }
    ],
    "high": [
      {
        "finding_id": "sec-fail-003",
        "type": "dependency_vulnerable",
        "package": "lodash",
        "current_version": "4.17.19",
        "issue": "CVE-2021-23337 - Prototype Pollution",
        "remediation": "npm install lodash@4.17.21",
        "severity": "high"
      }
    ]
  },
  "merge_blocked": true,
  "action_required": "Fix all CRITICAL and HIGH issues, then request re-review"
}
```

**Merge impossible jusqu'à** :

- Tous les findings CRITICAL sont résolus
- Tous les findings HIGH sont résolus ou expliqués
- Nouvelle revision demandée

## Template de résultat : pr.security_result

Le security-validator enregistre le résultat dans Desk :

```json
{
  "task_type": "pr.security_result",
  "from_agent": "security-validator",
  "to_agent": "dev-orchestrator",
  "priority": "high",
  "payload": {
    "pr_number": 47,
    "pr_title": "feat(invoices): add invoice generation workflow",
    "verdict": "PASS",
    "security_score": 95,
    "timestamp": "2026-03-06T14:23:00Z",
    "findings": {
      "critical": 0,
      "high": 0,
      "medium": 0,
      "low": 0
    },
    "summary": "All security checks passed. Ready for merge.",
    "checks_performed": [
      "secrets_scan",
      "rls_verification",
      "sql_injection_check",
      "xss_check",
      "dependency_audit",
      "policy_changes_review"
    ],
    "escalation": false,
    "can_merge": true,
    "audit_trail_event": "security.check_completed"
  }
}
```

## Escalade automatique vers security-auditor

Si des findings CRITICAL ou FAIL sont détectés, créer une task d'escalade immédiate :

```json
{
  "task_type": "escalation.security_finding",
  "from_agent": "security-validator",
  "to_agent": "security-auditor",
  "priority": "critical",
  "payload": {
    "original_task_id": "pr-security-check-47",
    "pr_number": 47,
    "verdict": "FAIL",
    "security_score": 35,
    "critical_findings": 2,
    "high_findings": 1,
    "summary": "SQL injection + RLS missing on new table. Merge blocked.",
    "required_action": "Manual review + potential code review escalation to senior engineer",
    "can_merge": false
  }
}
```

## Intégration avec audit-trail

Chaque PR security check génère un événement d'audit :

```json
{
  "event_type": "security.check",
  "resource_type": "pull_request",
  "resource_id": "pr-47",
  "reason": "Automated PR security gate before merge",
  "decision_basis": "6-point checklist: secrets, RLS, SQL injection, XSS, dependencies, policy changes",
  "after_state": {
    "verdict": "PASS",
    "security_score": 95,
    "can_merge": true
  },
  "meta": {
    "pr_number": 47,
    "branch": "feat/invoicing",
    "files_checked": 8,
    "findings_critical": 0,
    "findings_high": 0
  }
}
```

## Intégration avec silo-logging

Chaque vérification génère un log :

```json
{
  "timestamp": "2026-03-06T14:23:00Z",
  "log_level": "info",
  "log_type": "security_check",
  "agent": "security-validator",
  "action": "pr_security_gate_completed",
  "pr_number": 47,
  "verdict": "PASS",
  "duration_ms": 3200,
  "meta": {
    "files_scanned": 8,
    "patterns_checked": 42,
    "violations_found": 0
  }
}
```

## Anti-patterns

- **Ignorer les WARN** : Les avertissements accumulent. Une dépendance MEDIUM aujourd'hui devient CRITICAL dans 6 mois.
- **Merger sur FAIL avec dérogation** : Une déprogation "l'équipe vérifiée manuellement" bypasse le gate entièrement. Si on doit vraiment merger, documenter pourquoi et créer une task de remédiation obligatoire.
- **RLS check superficiel** : Vérifier que la table existe avec RLS ne suffit pas. Vérifier aussi que la policy est correcte (utilise `auth.uid()`, couvre SELECT/UPDATE/DELETE).
- **Oublier d'escalader** : Un FAIL qui n'est pas escaladé vers security-auditor ne sera jamais vu. Toujours escalader les critiques.
- **Faux négatifs sur secrets** : Les patterns de regex peuvent manquer les secrets si encodés (base64, hex). Utiliser aussi une entropy check — un string aléatoire de 40+ caractères alphanumériques est suspect.
- **Scan sans contexte du projet** : Une clé testnet d'un service mock n'a pas la même sévérité qu'une clé production. Avoir une whitelist de "test credentials" et les exclure du scan.
