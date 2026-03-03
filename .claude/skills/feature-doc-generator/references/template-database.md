# Template : Base de données (database.md)

Structure à suivre pour le fichier `database.md`.

---

```markdown
# [Nom de la feature] — Base de données

## Schéma de données

### Diagramme des entités

```
[Table1] 1───* [Table2] *───1 [Table3]
```

### Tables

#### `[table_name]`

**Rôle :** [Description]

| Colonne | Type | Nullable | Default | Description |
|---------|------|----------|---------|-------------|
| `id` | UUID | Non | gen_random_uuid() | Clé primaire |
| `created_at` | TIMESTAMP | Non | NOW() | Création |
| `[column]` | [TYPE] | [Oui/Non] | [default] | [Description] |

**Index :** `idx_[table]_[column]` — [Type] — [Justification]

**Contraintes :** FK, CHECK, UNIQUE

## Migrations

[Approche : EF Core, Flyway, Prisma, etc.]

```sql
CREATE TABLE [table_name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  [column] [TYPE] [constraints],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Requêtes clés

### [Nom de la requête]
```sql
SELECT ... FROM ... WHERE ...
```

## Considérations de performance

- [Index, partitionnement, soft delete, etc.]

## Gotchas

- [Piège et solution]
```
