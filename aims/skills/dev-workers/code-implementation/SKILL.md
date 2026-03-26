---
name: code-implementation
description: >
  Implémenter du code selon les spécifications reçues du dev-orchestrator.
  Ce skill guide l'agent dev-worker dans la réception des tâches via Desk,
  la lecture de l'ontologie et des spécifications, le coding selon les patterns projet,
  et la validation avant submission pour review. Utiliser ce skill à chaque fois qu'une
  tâche task.assign arrive depuis le dev-orchestrator.
---

# Code Implementation

Coder, c'est transformer une spécification en code qui marche, qui dure, et que d'autres peuvent lire. Ce skill définit le workflow complet : recevoir la tâche, comprendre le contexte, implémenter sans surprises, valider, et passer aux autres.

## Quand ce skill s'active

- Le dev-orchestrator crée une tâche `task.assign` orientée dev-worker
- Une PR review demande des changements (`pr.review_request` avec action "modify")
- Un bug doit être fixé (`task.bug_fix`)
- Une nouvelle feature ou ajustement doit être implémenté

## Étape 1 — Réception et lecture de la tâche

### Lire depuis Desk

Dès qu'une tâche arrive, consulter la table `desk_tasks` :

```sql
SELECT task_id, task_type, priority, payload, assigned_to, created_at
FROM desk_tasks
WHERE assigned_to = 'dev-worker-1'  -- ou dev-worker-2
  AND status = 'pending'
ORDER BY priority DESC, created_at ASC;
```

### Parser le payload

Chaque `task.assign` contient :

```json
{
  "task_id": "uuid",
  "task_type": "task.assign",
  "priority": "P1|P2|P3",
  "assigned_to": "dev-worker-1",
  "payload": {
    "spec_id": "uuid",
    "feature_name": "invoicing-export",
    "description": "Export des factures en Excel avec filtres de période",
    "acceptance_criteria": [
      "Utilisateur sélectionne période",
      "Export déclenché depuis page Facturation",
      "Fichier contient : date, N° facture, montant TTC"
    ],
    "technical_scope": {
      "components": ["InvoiceExportButton", "ExportDialog"],
      "tables": ["invoices"],
      "policies_required": ["RLS sur invoices"],
      "edge_functions": ["export-to-excel"]
    },
    "constraints": {
      "max_rows": 10000,
      "must_respect_rls": true
    },
    "related_tickets": ["TK-150"]
  }
}
```

### Lister les tâches dépendantes

Vérifier s'il y a des dépendances :

```sql
SELECT task_id, feature_name, status
FROM desk_tasks
WHERE related_to_task_id = :task_id;
```

Si d'autres tâches dépendent de celle-ci, le dev-worker doit en être conscient pour bien prioriser.

## Étape 2 — Workflow d'implémentation

### Phase 1 : Lire les sources de vérité (NON OPTIONNEL)

Avant de coder, consulter :

| Document | Pourquoi |
|----------|----------|
| `/ontologie/02_ontologie.yaml` | Structure des entités et tables concernées |
| `/ontologie/01_ontologie.md` | Contexte métier et définitions |
| `/security/ARCHITECTURE_DE_SECURITÉ.md` | Règles RLS et patterns sécurité |
| `/memory/constitution.md` | Principes non-négociables du projet |
| `CLAUDE.md` du projet | Stack, conventions, anti-patterns |

Ne pas lire l'ontologie = risque de coder hors des patterns établis.

### Phase 2 : Understand before coding

Créer un ticket interne dans Desk (pour toi-même) :

```json
{
  "task_type": "internal.analysis",
  "from_agent": "dev-worker-1",
  "payload": {
    "task_id": "uuid",
    "analysis": {
      "user_story": "[Copier depuis la spec]",
      "affected_entities": ["invoices", "export_logs"],
      "new_tables_or_columns": ["export_logs.file_url"],
      "required_policies": [
        "RLS: invoices.user_id = auth.uid()",
        "RLS: export_logs.user_id = auth.uid()"
      ],
      "frontend_changes": [
        "InvoiceExportButton component",
        "ExportDialog with date picker"
      ],
      "backend_changes": [
        "Edge Function: export-to-excel",
        "Database trigger: log_export"
      ],
      "migration_required": "Yes — new table export_logs"
    }
  }
}
```

Log cet analyse dans `silo-logging` (skill transversal).

### Phase 3 : Implémenter par couche

#### Frontend (Next.js/React/Tailwind)

1. **Créer le composant** (PascalCase, kebab-case fichier)

```typescript
// app/invoicing/components/invoice-export-button.tsx
'use client';

import { useState } from 'react';
import { ExportDialog } from './export-dialog';
import { Button } from '@/components/ui/button';

export function InvoiceExportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Exporter en Excel
      </Button>
      <ExportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
```

2. **Typer strictement** (TypeScript strict activé)

```typescript
interface ExportRequest {
  startDate: Date;
  endDate: Date;
  includeDetails: boolean;
}

async function handleExport(params: ExportRequest): Promise<void> {
  // ...
}
```

3. **Appliquer Tailwind** selon le design system du projet
4. **Valider les entrées** côté client
5. **Implémenter error handling** (afficher à l'utilisateur)

#### Backend (Supabase/PostgreSQL)

1. **Créer la migration** (`supabase/migrations/YYYYMMDDHHMMSS_add_export_logs.sql`)

```sql
CREATE TABLE export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  export_type TEXT NOT NULL CHECK (export_type IN ('invoices', 'quotes')),
  filters JSONB,
  file_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  exported_at TIMESTAMPTZ
);

-- RLS (obligatoire)
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own exports"
  ON export_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports"
  ON export_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

2. **Implémenter l'Edge Function** (`supabase/functions/export-to-excel/index.ts`)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as XLSX from 'https://deno.land/x/xlsx@0.12.1/mod.ts';

serve(async (req) => {
  // Vérifier auth
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Parser le payload
  const { startDate, endDate } = await req.json();

  // Valider les paramètres
  if (!startDate || !endDate) {
    return new Response('Missing parameters', { status: 400 });
  }

  // Génère le fichier Excel
  const data = [
    ['Date', 'N° Facture', 'Montant TTC'],
    // ... données
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Factures');

  // Upload vers Storage et retourner l'URL
  return new Response(JSON.stringify({ file_url: 'https://...' }));
});
```

3. **Ajouter les indexes** si nécessaire

```sql
CREATE INDEX idx_export_logs_user_id ON export_logs(user_id);
CREATE INDEX idx_export_logs_created_at ON export_logs(created_at DESC);
```

## Patterns obligatoires

### 1. RLS sur toute table utilisateur

```sql
-- Chaque table avec user_id doit avoir une policy
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their own invoices"
  ON invoices
  FOR SELECT
  USING (auth.uid() = user_id);
```

Consulter `/security/ARCHITECTURE_DE_SECURITÉ.md` avant de créer une policy.

### 2. TypeScript strict

Tous les fichiers TypeScript doivent avoir :

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Aucune variable `any`**, même temporaire. Si tu es bloqué, escalade via `error-escalation`.

### 3. Kebab-case fichiers, PascalCase composants

```
✅ CORRECT
app/invoicing/components/invoice-export-button.tsx
export function InvoiceExportButton() { }

❌ INCORRECT
app/invoicing/components/InvoiceExportButton.tsx
app/invoicing/components/invoiceExportButton.tsx
```

### 4. Snake_case tables et colonnes PostgreSQL

```sql
✅ CORRECT
CREATE TABLE invoice_items (
  invoice_id UUID REFERENCES invoices(id),
  amount_ht DECIMAL
);

❌ INCORRECT
CREATE TABLE InvoiceItems (...);
CREATE TABLE invoice_items (amountHT ...);
```

### 5. SCREAMING_SNAKE_CASE pour les enums

```typescript
enum INVOICE_STATUS {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid'
}
```

### 6. Error handling structuré

Frontend :

```typescript
try {
  const response = await fetch('/api/export', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  // Logger + afficher UI
  console.error('Export error:', error);
  setError('Impossible d\'exporter. Veuillez réessayer.');
}
```

Backend :

```typescript
try {
  // opération
} catch (error) {
  console.error('Export error:', error);
  return new Response(
    JSON.stringify({ error: 'Export failed' }),
    { status: 500 }
  );
}
```

## Étape 3 — Validation avant submission

Avant de dire "c'est fait", exécuter cette checklist :

### Checklist technique

- [ ] **Lire l'ontologie** : Ai-je bien compris les entités affectées ?
- [ ] **Respecter RLS** : Chaque table user a une policy restrictive ?
- [ ] **TypeScript strict** : Aucune variable `any`, tous les types explicites ?
- [ ] **Nommage cohérent** : Fichiers kebab-case, composants PascalCase, tables snake_case ?
- [ ] **Pas de console.log débogue** : Logs structurés via `silo-logging` uniquement ?
- [ ] **Edge cases testés** : Utilisateur anonyme ? Données manquantes ? Permissions insuffisantes ?

### Checklist fonctionnelle

- [ ] **User story testée** : Ai-je vérifié chaque critère d'acceptation ?
- [ ] **Scenario nominal** : "Happy path" fonctionne du bout à l'bout ?
- [ ] **Erreurs gérées** : Essayer avec des données invalides, manquantes, invalides ?
- [ ] **Performance** : Pas de N+1 queries, pas de requête sans index sur grand dataset ?
- [ ] **UI validée** : Console = 0 erreur ? Layout correct sur mobile ?

### Checklist git

- [ ] **Commits atomiques** : Chaque commit fait une seule chose ?
- [ ] **Messages descriptifs** : `feat(invoicing): add export to Excel` (type(scope): description) ?
- [ ] **Branche nommée** : `feat/invoicing-export` (pas de main) ?
- [ ] **Pas de secrets** : Aucune clé API, token, ou credential en dur ?

### Validation console

```bash
# Depuis le répertoire du projet
npm run lint
npm run type-check
npm test  # Si tests existent pour cette feature
```

Zéro erreur avant de soumettre.

## Étape 4 — Soumettre pour review

Une fois validé, créer une PR et notifier l'autre dev-worker :

```json
{
  "task_type": "pr.review_request",
  "from_agent": "dev-worker-1",
  "to_agent": "dev-worker-2",
  "priority": "P2",
  "payload": {
    "pr_url": "https://github.com/...",
    "branch": "feat/invoicing-export",
    "spec_id": "uuid-de-la-spec",
    "summary": "Implémentation export Excel factures avec RLS et Edge Function",
    "checklist_done": [
      "✅ Ontologie lue",
      "✅ RLS configurée",
      "✅ TypeScript strict validé",
      "✅ Console: 0 erreur"
    ],
    "known_limitations": [],
    "test_instructions": "1. Naviguez vers /invoicing. 2. Cliquez 'Exporter en Excel'. 3. Sélectionnez 2026-01 à 2026-03. 4. Vérifiez fichier téléchargé avec 10 factures."
  }
}
```

## Métriques

Après chaque implémentation, enregistrer :

```json
{
  "task_type": "internal.metrics",
  "from_agent": "dev-worker-1",
  "payload": {
    "task_id": "uuid",
    "implementation_metrics": {
      "time_spent_minutes": 120,
      "lines_added": 385,
      "files_modified": 7,
      "migrations_created": 1,
      "edge_functions_created": 1,
      "components_created": 2,
      "rls_policies_added": 2
    },
    "quality_metrics": {
      "console_errors_before": 0,
      "console_errors_after": 0,
      "test_coverage_new": "85%",
      "type_errors": 0
    },
    "review_feedback_incorporated": false,
    "blockers_encountered": []
  }
}
```

## Anti-patterns

- **Coder sans lire l'ontologie** : Tu construis hors des patterns établis. Pire : tu vas duplique du travail.
- **Any everywhere** : `any` crée des bugs invisibles. Tu fermes juste les yeux sur les erreurs.
- **Skippy la validation** : "Ça marchait une fois sur ma machine" n'est pas un déploiement. Valider avant de pousser.
- **RLS optionnel** : Une table user sans RLS est une fuite de sécurité. JAMAIS de `policy`.
- **Edge cases oubliés** : "Et si l'utilisateur n'a pas de permission ?" "Et si le fichier existe déjà ?" Tester ces cas.
- **Logs console en prod** : Les `console.log` ne doivent pas partir en production. Utiliser `silo-logging`.
- **Migrations non testées** : Créer une migration, puis la tester immédiatement avec `supabase db reset`.
- **Ignorer les erreurs** : Un catch vide (`} catch (e) {}`) est une bombe. Toujours logger + escalader.
