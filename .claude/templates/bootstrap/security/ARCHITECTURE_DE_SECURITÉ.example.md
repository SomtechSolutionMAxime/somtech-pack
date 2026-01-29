# Architecture de Sécurité

**Version** : 1.6
**Date** : 2026-01-25
**Statut** : Document d'Architecture  
**Référence (gestion utilisateurs)** : `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md`

---

## Table des Matières

1. [Quick Reference (pour Claude)](#quick-reference-pour-claude)
2. [Vue d'Ensemble](#vue-densemble)
3. [Architecture de Sécurité en Couches](#architecture-de-sécurité-en-couches)
4. [Authentification](#authentification)
5. [Autorisation - Niveau 1 (Accès Modules)](#autorisation---niveau-1-accès-modules)
6. [Autorisation - Niveau 2 (Rôles et Permissions)](#autorisation---niveau-2-rôles-et-permissions)
   - [Permissions Génératives (ABAC)](#permissions-génératives-abac)
7. [Row Level Security (RLS)](#row-level-security-rls)
8. [RLS Templates](#rls-templates)
9. [Sécurité Frontend](#sécurité-frontend)
10. [Patterns de Sécurité](#patterns-de-sécurité)
11. [Anti-Patterns (À Éviter)](#anti-patterns-à-éviter)
12. [Audit et Traçabilité](#audit-et-traçabilité)
13. [Checklist Pré-Déploiement](#checklist-pré-déploiement)
14. [Bonnes Pratiques](#bonnes-pratiques)
15. [Documentation de Sécurité](#documentation-de-sécurité)

---

## Quick Reference (pour Claude)

> **Cette section est un résumé rapide pour Claude.** Consulter les sections détaillées pour plus d'informations.

### Checklist nouvelle table

```
☐ ALTER TABLE xxx ENABLE ROW LEVEL SECURITY;
☐ Politique SELECT avec (select auth.uid())
☐ Politique INSERT séparée
☐ Politique UPDATE séparée
☐ Politique DELETE séparée
☐ Index sur colonnes RLS (user_id, department_id, etc.)
☐ Guard frontend correspondant (ModuleAccessGuard, PermissionGuard)
☐ Tests RLS avec différents rôles
```

### Patterns RLS essentiels (copier-coller)

**Owner pattern** — L'utilisateur voit ses propres données
```sql
CREATE POLICY "owner_select" ON table_name
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "owner_insert" ON table_name
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "owner_update" ON table_name
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "owner_delete" ON table_name
FOR DELETE USING ((select auth.uid()) = user_id);
```

**Team pattern** — Manager voit son équipe
```sql
CREATE POLICY "team_select" ON table_name
FOR SELECT USING (
  (select auth.uid()) = user_id
  OR public.is_manager_of((select auth.uid()), user_id)
);
```

**Admin pattern** — Admin voit tout
```sql
CREATE POLICY "admin_select" ON table_name
FOR SELECT USING (
  (select auth.uid()) = user_id
  OR public.is_admin((select auth.uid()))
);
```

### Règles d'or

| Règle | Explication |
|-------|-------------|
| **Toujours `(select auth.uid())`** | Jamais `auth.uid()` seul (performance) |
| **Jamais `FOR ALL`** | Toujours séparer SELECT/INSERT/UPDATE/DELETE |
| **RLS = source de vérité** | Frontend = UX, Backend = sécurité |
| **SECURITY DEFINER pour helpers** | Évite récursion RLS |
| **Soft-delete préféré** | `revoked_at` ou `is_active` au lieu de DELETE |

### Guards frontend (ordre d'imbrication)

```tsx
<ProtectedRoute>                           {/* 1. Authentifié? */}
  <ModuleAccessGuard moduleId="mon-module"> {/* 2. Accès module? */}
    <PermissionGuard permission="edit">     {/* 3. Permission? */}
      <MonComposant />
    </PermissionGuard>
  </ModuleAccessGuard>
</ProtectedRoute>
```

---

## Vue d'Ensemble

### Objectif

Ce document décrit l'architecture de sécurité de l'application Construction Gauthier, un système multi-modules basé sur Supabase Auth et PostgreSQL avec Row Level Security (RLS).

**Référence** : Ce document s'appuie sur `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md` pour la structure utilisateurs (tables, relations, incohérences historiques) et formalise l'architecture de sécurité (auth, autorisation, RLS, guards frontend).

### Principes de Sécurité Fondamentaux

1. **Défense en profondeur** : Sécurité à plusieurs niveaux (authentification, autorisation DB, autorisation frontend)
2. **Principe du moindre privilège** : Chaque utilisateur n'a accès qu'aux données nécessaires à son rôle
3. **Séparation des responsabilités** : Authentification séparée de l'autorisation, autorisation niveau 1 séparée du niveau 2
4. **Source de vérité unique** : `auth.users` pour l'identité, tables de profil pour les données applicatives
5. **Audit complet** : Toutes les actions critiques sont journalisées
6. **Modèle hybride RBAC + ABAC** : RBAC (Role-Based Access Control) pour les gros blocs d'autorisation (accès modules, rôles macro), ABAC (Attribute-Based Access Control) pour les permissions contextuelles calculées à la volée à partir d'attributs, contexte et relations

### Portée

Ce document couvre :
- Architecture d'authentification (Supabase Auth, Azure AD)
- Architecture d'autorisation à deux niveaux (accès modules, rôles/permissions)
- Politiques Row Level Security (RLS) sur toutes les tables
- Gardes frontend et protection des routes
- Patterns de sécurité et bonnes pratiques

---

## Architecture de Sécurité en Couches

L'architecture de sécurité est organisée en cinq couches distinctes :

```
┌─────────────────────────────────────────────────────────────┐
│          COUCHE AUTHENTIFICATION (SOURCE DE VÉRITÉ)         │
│  auth.users (Supabase Auth - modifiable via API Admin)      │
│    - Identité : id, email, phone (auth SMS)                 │
│    - Métadonnées : raw_user_meta_data->>'full_name'          │
│    - Sessions et tokens JWT gérés par Supabase               │
└─────────────────────────────────────────────────────────────┘
                          ↓ (FK par ID)
┌─────────────────────────────────────────────────────────────┐
│              COUCHE PROFIL APPLICATIF                        │
│  user_profiles (champs applicatifs manquants)                │
│    - is_admin, is_active, is_employee, last_login_at       │
│    - RLS : Lecture propre profil, admins peuvent tout       │
└─────────────────────────────────────────────────────────────┘
                          ↓ (FK par ID)
┌─────────────────────────────────────────────────────────────┐
│              COUCHE AUTORISATION NIVEAU 1                    │
│  module_access (accès aux modules)                          │
│    - Référence auth.users.id                                │
│    - RLS : Lecture propres accès, admins peuvent gérer       │
│    - Soft-delete via revoked_at                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              COUCHE AUTORISATION NIVEAU 2                    │
│  module_roles + user_module_roles (rôles/permissions)       │
│    - Référence auth.users.id                                │
│    - Modèles hiérarchique et plat                           │
│    - Permissions stockées (RBAC) ou calculées (ABAC)        │
│    - Calcul via fonctions SECURITY DEFINER                  │
└─────────────────────────────────────────────────────────────┘
                          ↓ (FK par ID)
┌─────────────────────────────────────────────────────────────┐
│              COUCHE PROFILS MÉTIERS                          │
│  employee_profiles (Ma Place RH)                             │
│    - Référence auth.users.id                                │
│    - RLS : Managers voient équipe, admins voient tout        │
│  autres_profiles (futur : profils par module)               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              COUCHE FRONTEND (GUARDS)                        │
│  ProtectedRoute, ModuleAccessGuard, PermissionGuard         │
│    - Vérification authentification                          │
│    - Vérification accès module                              │
│    - Vérification permissions                               │
└─────────────────────────────────────────────────────────────┘
```

**Principe fondamental** :
- ✅ `auth.users` = Source de vérité pour email, phone (auth), display name
- ✅ `user_profiles` = Ajoute seulement les champs manquants (is_admin, etc.)
- ✅ Tables de profil référencent `auth.users.id` directement
- ✅ Pas de duplication : utiliser `auth.users` pour ce qui existe déjà
- ✅ Modifications via API Admin : `supabase.auth.admin.updateUser()`

---

## Authentification

### Système d'Authentification Principal

**Supabase Auth** est le système d'authentification principal de l'application.

#### Table `auth.users` (Supabase Auth)

**Rôle** : **SOURCE DE VÉRITÉ** pour l'identité utilisateur

**Champs disponibles** :
- `id` (UUID) : Identifiant unique (clé primaire)
- `email` (TEXT) : Email de l'utilisateur - **Modifiable via `supabase.auth.admin.updateUser({ email })`**
- `phone` (TEXT) : Numéro de téléphone pour authentification SMS/OTP - **Modifiable via API Admin**
- `raw_user_meta_data` (JSONB) : Métadonnées utilisateur - **Modifiable via API Admin**
  - `full_name` ou `name` : Display name - **Modifiable via `supabase.auth.admin.updateUser({ user_metadata: { full_name } })`**
  - `avatar_url` : URL de l'avatar
  - Autres métadonnées personnalisées
- `user_metadata` (JSONB) : Métadonnées publiques
- `email_confirmed_at`, `phone_confirmed_at` : Dates de confirmation
- `created_at`, `updated_at` : Timestamps
- `encrypted_password` : Mot de passe chiffré (géré par Supabase)
- Métadonnées OAuth, sessions, tokens (gérés par Supabase)

**Modification via API Admin** :
```typescript
// Modifier email
await supabase.auth.admin.updateUser(userId, { email: 'nouveau@email.com' })

// Modifier phone
await supabase.auth.admin.updateUser(userId, { phone: '+1234567890' })

// Modifier display name
await supabase.auth.admin.updateUser(userId, { 
  user_metadata: { full_name: 'Nouveau Nom' } 
})
```

**Règles** :
- ✅ **Source de vérité** : Email, phone (auth), display name sont dans `auth.users` uniquement
- ✅ **Pas de duplication** : Ne pas copier ces champs dans les tables de profil
- ✅ **Modifications via API** : Utiliser `supabase.auth.admin.updateUser()` pour modifier

### Intégration Azure AD

Pour les utilisateurs avec domaine `@constructiongauthier.com`, l'authentification se fait via **Azure AD SSO**.

**Processus** :
1. Détection automatique du domaine Azure AD lors de la création
2. Création dans `auth.users` sans mot de passe (via API Admin)
3. Email confirmé automatiquement (`email_confirm: true`)
4. L'utilisateur se connecte via Azure AD SSO

**Edge Function** : `create-employee-user` gère la création d'utilisateurs Azure AD vs standard.

### Gestion des Sessions

**Sessions gérées par Supabase Auth** :
- Tokens JWT générés et validés automatiquement
- Refresh tokens pour renouvellement automatique
- Révocation de session via invalidation du token
- Table `sessions` (optionnelle) pour tracking des sessions actives

**Sécurité des sessions** :
- Expiration automatique des tokens
- Validation côté serveur à chaque requête
- Support MFA (Multi-Factor Authentication) via Supabase Auth

---

## Autorisation - Niveau 1 (Accès Modules)

### Principe

L'autorisation niveau 1 contrôle **l'accès aux modules** de l'application. Un utilisateur doit avoir un accès explicite à un module pour pouvoir l'utiliser.

**Évolution (2026-01)** : l’accès à un module est désormais considéré comme un “bootstrap” :
- Le **global** décide *si* un utilisateur a accès à un module (Niveau 1).
- Le module décide *ce qu’il peut faire* via ses rôles/permissions (Niveau 2), mais **un rôle par défaut doit être attribué automatiquement lors du grant** afin de garantir un comportement cohérent et éviter les accès “vides”.

Référence : `security/PROPOSITION_REVISION_ROLES_PAR_MODULE.md`

### Table `module_access`

**Schéma** :
```sql
CREATE TABLE module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,  -- Évolution : FK vers un registre des modules d'accès (ex: access_modules.module_id TEXT)
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, module_id)
);
```

**Règles métier** :
- Un accès module est indépendant du fait d'être employé
- Un employé peut avoir accès à plusieurs modules
- Un non-employé peut avoir accès à un module
- Soft-delete via `revoked_at` (l'accès est révoqué, pas supprimé)
- Référence `auth.users.id` directement

**Index pour performance** :
- `idx_module_access_user_id` sur `user_id`
- `idx_module_access_module_id` sur `module_id`
- `idx_module_access_active` sur `(user_id, module_id) WHERE revoked_at IS NULL`

### Politiques RLS sur `module_access`

**SELECT** :
- Les utilisateurs peuvent lire leurs propres accès
- Les administrateurs peuvent lire tous les accès

**INSERT/UPDATE/DELETE** :
- Seuls les administrateurs peuvent gérer les accès

**Référence** : `user_id` référence `auth.users.id` directement.

### Vérification d'Accès Module

**Frontend** : `ModuleAccessGuard` vérifie l'accès avant de rendre une route.

**Logique** :
1. Vérifier `module_access` pour l'utilisateur (`auth.users.id`) et le module
2. Vérifier que `revoked_at IS NULL` (accès actif)
3. Rediriger vers une page d'erreur si pas d'accès

**Implémentation** :
```typescript
<ModuleAccessGuard moduleId="ma-place-rh">
  <MaPlaceRHPage />
</ModuleAccessGuard>
```

### Révocation d'Accès

**Processus** :
- Mise à jour de `module_access.revoked_at` (soft-delete)
- Mise à jour de `module_access.revoked_by`
- Le profil métier (`employee_profiles`) n'est **PAS** supprimé
- L'utilisateur existe toujours mais ne peut plus accéder au module

### Cohérence et Détection d'Accès Fantômes

**Problème** : Un accès révoqué (`revoked_at IS NOT NULL`) combiné à un utilisateur inactif (`is_active = false`) et des rôles encore présents dans `user_module_roles` crée un **accès fantôme** administrativement gênant. Les rôles restent assignés alors que l'utilisateur n'a plus accès au module.

**Solution architecturale** : Mécanisme de cohérence automatique qui, lors de la révocation d'accès module ou de la désactivation d'utilisateur, **révoque** (soft-delete) ou supprime automatiquement tous les rôles applicatifs associés au module (ex: `user_module_roles`), incluant le **rôle par défaut** attribué lors du grant.

**Déclencheurs** :
- Modification de `module_access.revoked_at` (passage de `NULL` à une date)
- Modification de `user_profiles.is_active` (passage de `true` à `false`)

**Composants architecturaux** :
- **Edge Function** : `cleanup-module-roles-on-revocation` pour nettoyage asynchrone avec journalisation
- **Alternative** : Trigger PostgreSQL `AFTER UPDATE` sur `module_access` pour nettoyage synchrone
- **Journalisation** : Toutes les suppressions de rôles sont enregistrées dans `auth_events`

**Bonnes pratiques** :
- Exécuter le nettoyage de manière asynchrone pour ne pas bloquer la révocation d'accès
- Journaliser toutes les suppressions de rôles dans `auth_events`
- Vérifier périodiquement la cohérence avec une fonction de maintenance

---

## Autorisation - Niveau 2 (Rôles et Permissions)

### Principe

L'autorisation niveau 2 contrôle les **rôles et permissions granulaires** à l'intérieur d'un module. Un utilisateur peut avoir différents rôles dans différents modules.

**Frontière de responsabilité (2026-01)** :
- Le **module** est propriétaire des rôles, responsabilités, actions et permissions qu’il expose.
- L’admin global ne gère pas les rôles fins : il accorde l’accès au module et déclenche l’attribution du **rôle par défaut** du module.

Cette séparation permet :
- d’éviter de centraliser des règles métier propres à un module dans l’administration globale,
- de garder la logique d’autorisation fine au plus près de la réalité métier du module (RLS/ABAC/RBAC),
- de standardiser l’expérience (accès module ⇒ rôle minimal).

### Tables `module_roles` et `user_module_roles`

**Schéma** :
```sql
CREATE TABLE module_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_role_id UUID REFERENCES module_roles(id),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  access_level TEXT NOT NULL DEFAULT 'employee'
    CHECK (access_level IN ('employee', 'superviseur', 'directeur')),
  archived_at TIMESTAMPTZ,
  UNIQUE(module_id, name)
);

CREATE TABLE user_module_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES module_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id)
);
```

**Source de vérité des rôles (2026-01)** :
- Les `module_roles` pour `ma-place-rh` correspondent aux **titres d'emploi réels** (Compagnon, Apprenti 1, Contremaître, Chargé de projet, Directeur des opérations, Directeur général, etc.)
- Chaque titre a un `access_level` qui détermine les permissions système :
  - `employee` : niveau de base (tout le monde)
  - `superviseur` : gestion d'équipe, approbation des congés
  - `directeur` : accès complet au module
- Les niveaux sont **cumulatifs** : un Directeur général a aussi les permissions superviseur et employee
- Les futurs modules peuvent lire les rôles depuis `user_module_roles WHERE module_id = 'ma-place-rh'`

**Tables legacy dépréciées** :
- `user_roles` (table multi-rôles employee/manager/direction) → ne plus lire
- `users.role` (colonne scalaire) → ne plus lire

**Modèles supportés** :
- **Modèle plat** : Rôles indépendants (défaut)
- **Modèle hiérarchique** : Rôles avec parent (`parent_role_id`), permissions héritées

**Relations** :
- `user_id` référence `auth.users.id` directement
- Un utilisateur peut avoir plusieurs rôles dans un module
- Un utilisateur peut avoir des rôles différents dans différents modules

### Vérification de Permissions

**Modèle hybride RBAC + ABAC** : Le système utilise un modèle hybride où certaines permissions sont **stockées** (RBAC via `user_module_roles`) et d'autres sont **calculées à la volée** (ABAC via fonctions SECURITY DEFINER). Voir la section [Permissions Génératives (ABAC)](#permissions-génératives-abac) pour plus de détails.

**Frontend** : `PermissionGuard` vérifie une permission spécifique avant de rendre un composant.

**Logique** :
1. Vérifier `user_module_roles` pour l'utilisateur (`auth.users.id`) et le module (permissions RBAC stockées)
2. Vérifier les permissions calculées via fonction RPC `get_user_effective_permissions()` (permissions ABAC génératives)
3. Vérifier que le rôle a la permission requise ou que la permission générative est accordée
4. Masquer le composant si pas de permission

**Implémentation** :
```typescript
<PermissionGuard moduleId="ma-place-rh" permission="create_employee">
  <CreateEmployeeButton />
</PermissionGuard>
```

**Backend** : Fonction RPC `get_user_module_permissions()` calcule toutes les permissions d'un utilisateur dans un module, en tenant compte du modèle hiérarchique ou plat (RBAC). Fonction RPC `get_user_effective_permissions()` calcule également les permissions génératives (ABAC) basées sur les attributs, contexte et relations.

### Permissions Génératives (ABAC)

**Principe** : Au lieu de stocker toutes les permissions dans des rôles, certaines permissions sont **calculées à la volée** à partir d'attributs utilisateur, du contexte et des relations (département, équipe, etc.). C'est une approche **ABAC (Attribute-Based Access Control)** légère adaptée au contexte de l'application.

**Modèle hybride RBAC + ABAC** :
- **RBAC (squelette)** : Rôles macro stockés dans `module_roles` et `user_module_roles` pour les gros blocs d'autorisation (accès modules, rôles de base)
- **ABAC (cerveau)** : Permissions génératives calculées via fonctions SECURITY DEFINER pour les droits contextuels fins basés sur les attributs et relations

**Exemple conceptuel** :
Au lieu de créer un rôle `RH_MANAGER_CAN_APPROVE_LEAVE`, une règle générative calcule :
"Un utilisateur peut approuver une demande de congé si :
- son `access_level` est `superviseur` ou `directeur` (via `get_user_access_level()` qui lit `user_module_roles` + `module_roles`)
- et il est manager de l'employé (via `employee_profiles.manager_id`) ou dans le même département
- et la demande est en statut `pending`
- et il a `module_access` pour `ma-place-rh`"

La permission n'est pas stockée, elle est **générée** par la logique métier de la fonction.

**Composants architecturaux** :
- **Fonctions SECURITY DEFINER** : `can_update_user()`, `can_view_employee()`, `can_approve()` qui calculent les permissions à partir d'attributs et contexte (voir section [Pattern SECURITY DEFINER](#pattern-security-definer))
- **Politiques RLS USING** : Utilisation de ces fonctions dans les politiques RLS pour contrôle d'accès contextuel
- **Fonction RPC** : `get_user_effective_permissions(module_id)` qui renvoie les permissions calculées à la volée (RBAC + ABAC) pour le frontend

**Avantages** :
- Moins de rôles qui s'accumulent pour chaque nuance métier
- Règles métier versionnées dans le code (SQL/fonctions), testées et relues
- Expression de règles fines sans multiplier les rôles
- Réponse à des questions contextuelles précises : "Est-ce que ce manager peut approuver ce cas précis ?"
- Flexibilité pour gérer des cas complexes sans créer de nouveaux rôles

**Risques et limites** :
- Plus puissant donc plus facile à mal coder
- Nécessite des tests automatiques sur les permissions (scénarios de sécurité)
- Peut être plus difficile à expliquer aux utilisateurs non techniques : "pourquoi lui a accès et pas moi ?"
- Performance : calcul à la volée peut être plus coûteux que lecture d'une table

**Bonnes pratiques** :
- Garder RBAC pour les gros blocs (accès module, rôles macro)
- Utiliser ABAC pour les permissions contextuelles fines
- Documenter clairement les règles génératives dans les fonctions
- Tester systématiquement les fonctions de permissions génératives (voir section [Tests et Validation des Fonctions SECURITY DEFINER](#tests-et-validation-des-fonctions-security-definer))
- Fournir une vue `get_user_effective_permissions()` pour le frontend qui explique les permissions calculées
- Éviter la sur-ingénierie : utiliser RBAC quand c'est suffisant

**Références** : Les fonctions `is_manager_or_direction()` et `can_update_user()` décrites dans la section [Pattern SECURITY DEFINER](#pattern-security-definer) sont des exemples concrets de permissions génératives (ABAC).

### Gestion du Cache et Invalidation

**Problème** : Les hiérarchies dynamiques dans PostgreSQL peuvent causer des incohérences si le frontend fait trop confiance au cache React Query. Un changement de hiérarchie (ajout d'un rôle parent, modification de `parent_role_id`) ou l'ajout/retrait d'un rôle utilisateur peut invalider les permissions calculées, mais le cache peut continuer à servir des données obsolètes.

**Solution architecturale** : Stratégie de cache avec TTL court (recommandé : 5 minutes) combinée à un mécanisme de réinvalidation forcée dès qu'un rôle est ajouté/retiré ou qu'une hiérarchie est modifiée.

**Déclencheurs de réinvalidation** :
- Ajout/retrait de rôle dans `user_module_roles` (INSERT/DELETE)
- Modification de hiérarchie dans `module_roles` (UPDATE de `parent_role_id` ou `is_hierarchical`)
- Modification de `module_access.revoked_at` (révocation d'accès module)

**Composants architecturaux** :
- **TTL court** : Cache React Query avec `staleTime` de 5 minutes maximum
- **Réinvalidation manuelle** : Fonction `invalidateQueries` appelée après chaque modification de rôles
- **Réinvalidation automatique** : Trigger PostgreSQL `AFTER INSERT/UPDATE/DELETE` sur `user_module_roles` avec notification webhook (`pg_notify`) pour synchronisation multi-onglets
- **Synchronisation temps réel** : Webhook ou notification pour invalidation automatique du cache sur tous les clients connectés

**Bonnes pratiques** :
- TTL court (5 minutes) pour les permissions hiérarchiques
- Réinvalidation manuelle après chaque modification de rôles
- Webhook ou notification en temps réel pour synchronisation multi-onglets
- Ne jamais faire confiance uniquement au cache pour les vérifications critiques

---

## Row Level Security (RLS)

### Principe Fondamental

**RLS est activé sur toutes les tables** de l'application. Chaque table a des politiques RLS qui contrôlent qui peut lire, créer, modifier et supprimer les données.

### Architecture RLS

**Activation** :
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
-- ... toutes les tables
```

**Politiques** : Chaque table a des politiques séparées pour SELECT, INSERT, UPDATE, DELETE (pas de `FOR ALL`).

### Politiques RLS par Table

#### `user_profiles`

**SELECT** :
- Les utilisateurs peuvent lire leur propre profil (`auth.uid() = id`)
- Les administrateurs peuvent lire tous les profils

**UPDATE** :
- Les utilisateurs peuvent mettre à jour leur propre profil (champs applicatifs)
- Les administrateurs peuvent tout mettre à jour

**INSERT** :
- Seuls les administrateurs peuvent créer des profils (via fonction RPC ou trigger)

**DELETE** :
- Seuls les administrateurs peuvent supprimer des profils (soft-delete via `is_active = false`)

**Note** : Les modifications d'email, phone ou display name se font via `supabase.auth.admin.updateUser()` sur `auth.users`, pas sur `user_profiles`.

#### `module_access`

**SELECT** :
- Les utilisateurs peuvent lire leurs propres accès (`user_id = auth.uid()`)
- Les administrateurs peuvent lire tous les accès

**INSERT/UPDATE/DELETE** :
- Seuls les administrateurs peuvent gérer les accès

**Référence** : `user_id` référence `auth.users.id` directement.

#### `employee_profiles`

**SELECT** :
- Les managers peuvent lire les employés de leur équipe (même `department_id`)
- Les administrateurs peuvent lire tous les employés

**INSERT** :
- Les managers peuvent créer des profils employés dans leur équipe
- Les administrateurs peuvent créer tous les profils

**UPDATE** :
- Les managers peuvent mettre à jour les profils employés de leur équipe
- Les administrateurs peuvent tout mettre à jour
- Utilisation de fonctions SECURITY DEFINER pour éviter récursion RLS :
  - `is_manager_or_direction()` : Vérifie si l'utilisateur est manager ou direction
  - `can_update_user()` : Vérifie si un utilisateur peut mettre à jour un autre utilisateur

**DELETE** :
- Seuls les administrateurs peuvent supprimer des profils employés (soft-delete via `status = 'inactive'`)

### Pattern SECURITY DEFINER

**Problème** : Les politiques RLS peuvent créer des récursions infinies si elles lisent la même table qu'elles protègent.

**Solution** : Utiliser des fonctions `SECURITY DEFINER` avec `SET search_path` fixe pour éviter la récursion.

**Fonctions helper typiques** :
- `get_user_access_level(user_id)` : Retourne le plus haut `access_level` (directeur > superviseur > employee) depuis `user_module_roles` + `module_roles`
- `is_manager(user_id)` : Retourne TRUE si `access_level IN ('superviseur', 'directeur')`
- `is_direction(user_id)` : Retourne TRUE si `access_level = 'directeur'`
- `is_manager_or_direction(user_id)` : Alias de `is_manager()` pour compatibilité
- `can_update_user(target_user_id)` : Vérifie si l'utilisateur actuel peut mettre à jour un autre utilisateur (directeur : tous, superviseur : équipe directe, employee : soi-même)

**Note** : Ces fonctions sont des exemples de **permissions génératives (ABAC)** : elles calculent les permissions à partir d'attributs (rôle, département) et de contexte plutôt que de les lire depuis une table de rôles. Voir la section [Permissions Génératives (ABAC)](#permissions-génératives-abac) pour plus de détails sur ce modèle.

**Utilisation dans politique RLS** :
```sql
CREATE POLICY "Managers and direction can update team profiles" 
ON public.users 
FOR UPDATE 
USING (public.can_update_user(id))
WITH CHECK (public.can_update_user(id));
```

### Tests et Validation des Fonctions SECURITY DEFINER

**Problème** : L'évolution du schéma peut casser silencieusement les fonctions SECURITY DEFINER. Par exemple, si une colonne référencée est renommée ou supprimée, la fonction peut échouer silencieusement ou retourner des résultats incorrects, compromettant la sécurité RLS.

**Solution** : Tests unitaires automatisés dédiés aux politiques et fonctions SECURITY DEFINER. Les migrations DB doivent systématiquement déclencher ces tests pour détecter les régressions.

**Exigences architecturales** :
- Tests unitaires pour chaque fonction SECURITY DEFINER avec différents scénarios (manager, direction, employé)
- Tests d'intégration pour chaque politique RLS utilisant ces fonctions avec différents rôles utilisateurs
- Exécution automatique des tests après chaque migration DB dans le pipeline CI/CD
- Alertes en cas d'échec de test pour prévenir les régressions silencieuses

**Composants architecturaux** :
- **Suite de tests unitaires** : `tests/unit/rls_functions_test.sql` pour valider le comportement des fonctions SECURITY DEFINER
- **Suite de tests d'intégration** : `tests/integration/rls_policies_test.sql` pour valider les politiques RLS avec différents contextes utilisateur
- **Pipeline CI/CD** : Workflow GitHub Actions qui exécute automatiquement les tests après chaque migration DB
- **Documentation des dépendances** : Chaque fonction SECURITY DEFINER doit documenter ses dépendances de schéma pour faciliter la maintenance

**Bonnes pratiques** :
- Tester chaque fonction SECURITY DEFINER avec différents scénarios
- Tester les politiques RLS avec différents rôles utilisateurs
- Exécuter les tests après chaque migration DB
- Documenter les dépendances de schéma dans les fonctions SECURITY DEFINER
- Utiliser `SET search_path` fixe pour éviter les problèmes de résolution de schéma

### Performance RLS

**Optimisation** : Utiliser `(select auth.uid())` au lieu de `auth.uid()` pour permettre au planificateur PostgreSQL de mettre en cache le résultat.

**Exemple** :
```sql
-- ✅ Optimisé
USING ((select auth.uid()) = user_id)

-- ⚠️ Moins performant
USING (auth.uid() = user_id)
```

**Index** : Toujours indexer les colonnes utilisées dans les politiques RLS pour améliorer les performances.

---

## RLS Templates

> **Templates SQL prêts à copier-coller.** Adapter `table_name` et les colonnes selon le contexte.

### Template 1 : Table avec propriétaire (Owner Pattern)

```sql
-- ============================================
-- RLS: Table avec propriétaire unique
-- Utiliser pour: documents, préférences, données personnelles
-- ============================================

-- 1. Activer RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Index pour performance
CREATE INDEX IF NOT EXISTS idx_table_name_user_id ON table_name(user_id);

-- 3. Policies séparées
CREATE POLICY "Users can view own data"
ON table_name FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own data"
ON table_name FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own data"
ON table_name FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own data"
ON table_name FOR DELETE
USING ((select auth.uid()) = user_id);
```

### Template 2 : Table avec hiérarchie (Team Pattern)

```sql
-- ============================================
-- RLS: Table avec visibilité hiérarchique
-- Utiliser pour: employés, congés, évaluations
-- ============================================

-- 1. Activer RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Index pour performance
CREATE INDEX IF NOT EXISTS idx_table_name_user_id ON table_name(user_id);
CREATE INDEX IF NOT EXISTS idx_table_name_department_id ON table_name(department_id);

-- 3. Helper function (SECURITY DEFINER pour éviter récursion)
CREATE OR REPLACE FUNCTION public.can_view_in_team(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    -- Soi-même
    (select auth.uid()) = target_user_id
    -- Ou manager direct
    OR EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = target_user_id
      AND manager_id = (select auth.uid())
    )
    -- Ou même département avec rôle superviseur+
    OR EXISTS (
      SELECT 1 FROM employee_profiles ep
      JOIN user_module_roles umr ON umr.user_id = (select auth.uid())
      JOIN module_roles mr ON mr.id = umr.role_id
      WHERE ep.id = target_user_id
      AND ep.department_id = (
        SELECT department_id FROM employee_profiles WHERE id = (select auth.uid())
      )
      AND mr.access_level IN ('superviseur', 'directeur')
    )
  );
END;
$$;

-- 4. Policies
CREATE POLICY "Team members can view"
ON table_name FOR SELECT
USING (public.can_view_in_team(user_id));

CREATE POLICY "Owners can insert"
ON table_name FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Team managers can update"
ON table_name FOR UPDATE
USING (public.can_view_in_team(user_id))
WITH CHECK (public.can_view_in_team(user_id));
```

### Template 3 : Table admin-only

```sql
-- ============================================
-- RLS: Table accessible uniquement aux admins
-- Utiliser pour: configuration, audit, logs sensibles
-- ============================================

-- 1. Activer RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = check_user_id
    AND is_admin = true
    AND is_active = true
  );
END;
$$;

-- 3. Policies
CREATE POLICY "Admins can view all"
ON table_name FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can insert"
ON table_name FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update"
ON table_name FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete"
ON table_name FOR DELETE
USING (public.is_admin());
```

### Template 4 : Table avec accès module

```sql
-- ============================================
-- RLS: Table liée à un module spécifique
-- Utiliser pour: données spécifiques à un module (ma-place-rh, etc.)
-- ============================================

-- 1. Activer RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.has_module_access(
  check_user_id UUID,
  check_module_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM module_access
    WHERE user_id = check_user_id
    AND module_id = check_module_id
    AND revoked_at IS NULL
  );
END;
$$;

-- 3. Policies (exemple pour module 'ma-place-rh')
CREATE POLICY "Module users can view"
ON table_name FOR SELECT
USING (
  public.has_module_access((select auth.uid()), 'ma-place-rh')
  AND (select auth.uid()) = user_id
);
```

### Template 5 : Soft-delete pattern

```sql
-- ============================================
-- RLS: Table avec soft-delete
-- Utiliser pour: données qui ne doivent jamais être supprimées physiquement
-- ============================================

-- 1. Ajouter colonne soft-delete si absente
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index pour exclure les supprimés
CREATE INDEX IF NOT EXISTS idx_table_name_active
ON table_name(user_id) WHERE deleted_at IS NULL;

-- 3. Policies (n'affichent que les non-supprimés)
CREATE POLICY "Users can view own active data"
ON table_name FOR SELECT
USING (
  (select auth.uid()) = user_id
  AND deleted_at IS NULL
);

-- 4. "Delete" = soft-delete (UPDATE au lieu de DELETE)
CREATE POLICY "Users can soft-delete own data"
ON table_name FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id
  -- Seul changement autorisé: mettre deleted_at
);

-- 5. Bloquer DELETE physique (sauf admin)
CREATE POLICY "Only admins can hard delete"
ON table_name FOR DELETE
USING (public.is_admin());
```

---

## Sécurité Frontend

### Principe de Défense en Profondeur

La sécurité frontend complète la sécurité backend (RLS) avec des gardes à plusieurs niveaux :

1. **Niveau Route** : `ProtectedRoute` vérifie l'authentification
2. **Niveau Module** : `ModuleAccessGuard` vérifie l'accès module
3. **Niveau Composant** : `PermissionGuard` vérifie les permissions spécifiques
4. **Niveau Logique** : Hooks pour vérifications conditionnelles

### Gardes Frontend

#### `ProtectedRoute`

**Rôle** : Vérifier qu'un utilisateur est authentifié avant de rendre une route.

**Implémentation** :
```typescript
<Route
  path="/rh"
  element={
    <ProtectedRoute>
      <RHPage />
    </ProtectedRoute>
  }
/>
```

**Logique** :
- Vérifier que `useAuth().user` existe
- Rediriger vers la page de login si non authentifié

#### `ModuleAccessGuard`

**Rôle** : Vérifier qu'un utilisateur a accès à un module avant de rendre une route.

**Implémentation** :
```typescript
<ModuleAccessGuard moduleId="ma-place-rh">
  <MaPlaceRHPage />
</ModuleAccessGuard>
```

**Logique** :
- Vérifier `module_access` pour l'utilisateur (`auth.users.id`) et le module
- Vérifier que `revoked_at IS NULL` (accès actif)
- Rediriger vers une page d'erreur si pas d'accès

#### `PermissionGuard`

**Rôle** : Vérifier qu'un utilisateur a une permission spécifique avant de rendre un composant.

**Implémentation** :
```typescript
<PermissionGuard moduleId="ma-place-rh" permission="create_employee">
  <CreateEmployeeButton />
</PermissionGuard>
```

**Logique** :
- Vérifier `user_module_roles` pour l'utilisateur (`auth.users.id`) et le module (permissions RBAC stockées)
- Vérifier les permissions calculées via fonction RPC `get_user_effective_permissions()` (permissions ABAC génératives)
- Vérifier que le rôle a la permission requise ou que la permission générative est accordée
- Masquer le composant si pas de permission

**Note** : `PermissionGuard` peut vérifier à la fois les permissions RBAC (stockées dans `user_module_roles`) et les permissions ABAC (calculées à la volée via fonctions SECURITY DEFINER). Voir la section [Permissions Génératives (ABAC)](#permissions-génératives-abac) pour plus de détails.

### Hooks de Sécurité

**`useAuth()`** : Hook principal pour l'authentification
- Retourne l'utilisateur actuel (`auth.users`)
- Gère l'état de connexion
- Fournit les méthodes de connexion/déconnexion

**`useModuleAccess(moduleId)`** : Vérifier l'accès à un module
- Retourne `true` si l'utilisateur a accès au module
- Utilise React Query pour le cache

**`usePermissions(moduleId)`** : Obtenir les permissions dans un module
- Retourne la liste des permissions de l'utilisateur
- Prend en compte le modèle hiérarchique ou plat

---

## Patterns de Sécurité

### Pattern "Propriétaire"

**Principe** : Un utilisateur peut accéder à ses propres données.

**Principe RLS** : Politique `USING ((select auth.uid()) = created_by)` pour permettre l'accès aux données créées par l'utilisateur.

**Utilisation** : Tables avec `created_by` référençant `auth.users.id`

### Pattern "Équipe/Manager"

**Principe** : Un manager peut accéder aux données de son équipe.

**Principe RLS** : Politique combinant vérification de département (`department_id IN (...)`) et vérification admin (`EXISTS (SELECT 1 FROM user_profiles WHERE is_admin = true)`).

**Utilisation** : Tables avec hiérarchie (`manager_id`, `department_id`)

### Pattern "Admin"

**Principe** : Les administrateurs ont accès complet.

**Principe RLS** : Politique `EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND is_admin = true)` pour accès complet aux administrateurs.

**Utilisation** : Fonctions SECURITY DEFINER pour éviter récursion RLS

### Pattern "Permissions Génératives (ABAC)"

**Principe** : Calcul de permissions à partir d'attributs utilisateur, contexte et relations plutôt que de les stocker dans des tables de rôles.

**Composants** :
- **Fonctions SECURITY DEFINER** : `can_update_user()`, `can_view_employee()`, `can_approve()` qui calculent les permissions à partir d'attributs (rôle, département) et contexte (statut ressource, propriétaire)
- **Politiques RLS USING** : Utilisation de ces fonctions dans les politiques RLS pour contrôle d'accès contextuel
- **Fonction RPC** : `get_user_effective_permissions()` qui agrège permissions RBAC (stockées) et ABAC (calculées)

**Exemples** :
- `can_update_user(target_user_id)` : Calcule si l'utilisateur peut mettre à jour un autre utilisateur basé sur son rôle et département
- `can_approve_leave_request(request_id)` : Calcule si l'utilisateur peut approuver une demande de congé basé sur son rôle, département de l'employé, et statut de la demande

**Utilisation** : Pour les permissions contextuelles fines qui dépendent de plusieurs facteurs (rôle + département + statut ressource + propriétaire). Complément du RBAC pour les gros blocs d'autorisation.

### Pattern "Soft-delete"

**Principe** : Les données ne sont jamais supprimées physiquement, mais marquées comme supprimées.

**Colonnes utilisées** :
- `revoked_at` : Date de révocation (ex: `module_access`)
- `is_active` : Flag actif/inactif (ex: `user_profiles`)
- `status` : Statut avec valeurs enum (ex: `employee_profiles.status = 'inactive'`)

**Filtres typiques** :
- Accès actif : `WHERE revoked_at IS NULL`
- Utilisateurs actifs : `WHERE is_active = true`
- Employés actifs : `WHERE status = 'active'`

### Pattern "Performance"

**Principe** : Optimiser les politiques RLS pour la performance.

**Technique** : Utiliser `(select auth.uid())` pour permettre le cache initPlan.

**Technique d'optimisation** : Utiliser `(select auth.uid())` au lieu de `auth.uid()` pour permettre au planificateur PostgreSQL de mettre en cache le résultat (`initPlan`).

**Index** : Toujours indexer les colonnes utilisées dans les politiques RLS.

---

## Anti-Patterns (À Éviter)

> **Cette section liste les erreurs courantes de sécurité.** Ne jamais faire ces choses.

### ❌ Anti-Pattern 1 : `FOR ALL` dans les policies

```sql
-- ❌ MAUVAIS : Policy unique pour toutes les opérations
CREATE POLICY "all_access" ON table_name
FOR ALL
USING ((select auth.uid()) = user_id);

-- ✅ BON : Policies séparées par opération
CREATE POLICY "select_own" ON table_name FOR SELECT USING (...);
CREATE POLICY "insert_own" ON table_name FOR INSERT WITH CHECK (...);
CREATE POLICY "update_own" ON table_name FOR UPDATE USING (...) WITH CHECK (...);
CREATE POLICY "delete_own" ON table_name FOR DELETE USING (...);
```

**Pourquoi** : `FOR ALL` cache des comportements différents selon l'opération et rend le debug difficile.

---

### ❌ Anti-Pattern 2 : `auth.uid()` sans `select`

```sql
-- ❌ MAUVAIS : Pas de cache du résultat
CREATE POLICY "bad_perf" ON table_name
FOR SELECT USING (auth.uid() = user_id);

-- ✅ BON : Cache via subquery
CREATE POLICY "good_perf" ON table_name
FOR SELECT USING ((select auth.uid()) = user_id);
```

**Pourquoi** : Sans `(select ...)`, PostgreSQL réexécute `auth.uid()` pour chaque ligne. Avec le select, le planificateur met en cache le résultat (initPlan).

---

### ❌ Anti-Pattern 3 : Récursion RLS

```sql
-- ❌ MAUVAIS : La policy lit la même table qu'elle protège
CREATE POLICY "recursive_disaster" ON users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users  -- ← RÉCURSION!
    WHERE id = (select auth.uid()) AND is_admin = true
  )
);

-- ✅ BON : Utiliser une fonction SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true);
$$ LANGUAGE sql;

CREATE POLICY "no_recursion" ON users
FOR SELECT USING (public.is_admin());
```

**Pourquoi** : Lire la table protégée dans sa propre policy crée une boucle infinie.

---

### ❌ Anti-Pattern 4 : Faire confiance au frontend seul

```tsx
// ❌ MAUVAIS : Sécurité uniquement côté frontend
function DeleteButton({ canDelete }) {
  if (!canDelete) return null;
  return <button onClick={deleteItem}>Supprimer</button>;
}

// ✅ BON : Frontend + Backend (RLS)
// Frontend: UX (cacher le bouton)
// Backend: RLS (empêcher la requête même si le bouton est forcé)
```

**Pourquoi** : Un utilisateur malveillant peut contourner le frontend. La RLS est la vraie sécurité.

---

### ❌ Anti-Pattern 5 : DELETE physique sans soft-delete

```sql
-- ❌ MAUVAIS : Suppression définitive
DELETE FROM important_data WHERE id = '...';

-- ✅ BON : Soft-delete avec traçabilité
UPDATE important_data
SET deleted_at = now(), deleted_by = (select auth.uid())
WHERE id = '...';
```

**Pourquoi** : Les suppressions physiques sont irréversibles et perdent l'historique d'audit.

---

### ❌ Anti-Pattern 6 : Stocker des secrets dans le code

```typescript
// ❌ MAUVAIS : Secrets en dur
const supabaseKey = "eyJhbGciOiJIUzI1NiIs...";

// ✅ BON : Variables d'environnement
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

**Pourquoi** : Les secrets en dur sont exposés dans le repo Git et les builds.

---

### ❌ Anti-Pattern 7 : Ignorer les index RLS

```sql
-- ❌ MAUVAIS : Policy sans index correspondant
CREATE POLICY "slow_query" ON big_table
FOR SELECT USING (department_id = get_user_department());
-- Pas d'index sur department_id = scan complet!

-- ✅ BON : Créer l'index AVANT la policy
CREATE INDEX idx_big_table_dept ON big_table(department_id);
CREATE POLICY "fast_query" ON big_table
FOR SELECT USING (department_id = get_user_department());
```

**Pourquoi** : Sans index, chaque requête scanne toute la table.

---

### ❌ Anti-Pattern 8 : `SECURITY DEFINER` sans `SET search_path`

```sql
-- ❌ MAUVAIS : Vulnérable au search_path hijacking
CREATE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
AS $$ ... $$;

-- ✅ BON : search_path fixe
CREATE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$ ... $$;
```

**Pourquoi** : Un attaquant peut créer un schéma malveillant et détourner les fonctions.

---

### ❌ Anti-Pattern 9 : Permissions trop larges sur service_role

```typescript
// ❌ MAUVAIS : Utiliser service_role côté client
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Service role bypass TOUTES les RLS!

// ✅ BON : Utiliser anon/authenticated côté client
const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// RLS appliquées normalement
```

**Pourquoi** : `service_role` contourne toutes les RLS. Réservé aux Edge Functions serveur.

---

### ❌ Anti-Pattern 10 : Oublier WITH CHECK sur UPDATE

```sql
-- ❌ MAUVAIS : UPDATE sans WITH CHECK
CREATE POLICY "update_own" ON table_name
FOR UPDATE USING ((select auth.uid()) = user_id);
-- L'utilisateur peut changer user_id pour s'approprier les données d'un autre!

-- ✅ BON : USING + WITH CHECK
CREATE POLICY "update_own" ON table_name
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);
-- Bloque le changement de propriétaire
```

**Pourquoi** : `USING` vérifie AVANT l'update, `WITH CHECK` vérifie APRÈS. Sans les deux, on peut modifier des données pour les voler.

---

## Audit et Traçabilité

### Table `auth_events`

**Rôle** : Journaliser tous les événements d'authentification et changements d'accès pour audit et sécurité.

**Schéma** :
```sql
CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,  -- 'user_created', 'access_granted', 'access_revoked', etc.
  module_id TEXT,  -- Évolution : FK vers un registre des modules d'accès (ex: access_modules.module_id TEXT)
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Événements journalisés** :
- Création d'utilisateur
- Attribution/révocation d'accès module
- Changement de rôle/permission
- Invitation envoyée
- Échec de synchronisation
- Changement de statut (actif/inactif)
- Connexion/déconnexion
- Changements administratifs

**Utilisation** :
- Audit de sécurité
- Traçabilité des actions
- Détection d'anomalies
- Conformité réglementaire

### Gestion de la Volumétrie et Performance

**Problème** : La table `auth_events` va grossir très vite avec l'utilisation de l'application. Sans gestion appropriée, les performances des requêtes d'audit se dégraderont, les index souffriront, et l'espace disque sera rapidement saturé.

**Solutions à implémenter** :

#### 1. Partitionnement temporel par mois

**Principe** : Diviser la table `auth_events` en partitions mensuelles pour améliorer les performances des requêtes et faciliter la maintenance.

**Composants architecturaux** :
- **Table parent** : `auth_events` avec partitionnement `PARTITION BY RANGE (created_at)`
- **Partitions mensuelles** : `auth_events_YYYY_MM` créées automatiquement
- **Fonction de création automatique** : `create_auth_events_partition()` pour créer les partitions futures
- **Trigger automatique** : `BEFORE INSERT` sur `auth_events` pour créer la partition si elle n'existe pas

#### 2. Purge automatisée avec rolling window

**Principe** : Supprimer automatiquement les événements plus anciens qu'une fenêtre glissante (12-24 mois) pour maintenir une taille de table raisonnable.

**Composants architecturaux** :
- **Fonction de purge** : `purge_old_auth_events(retention_months)` qui supprime les événements plus anciens que la fenêtre de rétention
- **Job planifié** : Cron job (via `pg_cron` ou Edge Function planifiée) exécuté mensuellement le 1er du mois
- **Fenêtre de rétention** : Configurable (recommandé : 24 mois pour conformité, 12 mois pour performance)

#### 3. Stockage froid optionnel (bucket chiffré)

**Principe** : Archiver les événements anciens dans un bucket de stockage objet (S3, GCS) chiffré avant de les supprimer de la base de données, pour conservation à long terme et conformité.

**Composants architecturaux** :
- **Edge Function d'archivage** : `archive-auth-events` qui exporte les événements vers S3/GCS avec chiffrement (`AES256`)
- **Format d'archivage** : JSON compressé (`json.gz`) avec clé `auth-events/{partition}-{date}.json.gz`
- **Processus** : Archivage → Vérification → Suppression de la base de données

**Impact sur les index** :
- **Index locaux** : Chaque partition a ses propres index (`user_id`, `event_type`, `created_at`)
- **Index global** : Index optionnels sur la table parent pour requêtes cross-partition
- **Performance** : Les requêtes temporelles bénéficient du partitionnement et des index locaux

**Bonnes pratiques** :
- Partitionner dès le départ pour éviter la migration ultérieure
- Automatiser la création de partitions futures
- Purger régulièrement avec une fenêtre de rétention claire (12-24 mois)
- Archiver avant suppression pour conformité réglementaire
- Monitorer la taille des partitions et les performances des requêtes
- Documenter la politique de rétention et d'archivage

---

## Checklist Pré-Déploiement

> **À valider AVANT chaque déploiement.** Cocher chaque item ou documenter pourquoi non-applicable.

### Base de données

```
☐ Toutes les nouvelles tables ont RLS activé
   → Vérifier: SELECT tablename FROM pg_tables WHERE schemaname = 'public'
              AND tablename NOT IN (SELECT tablename FROM pg_policies);

☐ Chaque table a des policies séparées (SELECT, INSERT, UPDATE, DELETE)
   → Pas de FOR ALL

☐ Toutes les policies utilisent (select auth.uid()) et non auth.uid()
   → Performance critique

☐ Les fonctions SECURITY DEFINER ont SET search_path = public
   → Sécurité critique

☐ Index créés sur toutes les colonnes utilisées dans les policies RLS
   → user_id, department_id, manager_id, etc.

☐ Pas de récursion RLS (table lisant elle-même dans sa policy)
   → Utiliser des fonctions helper

☐ Soft-delete implémenté pour les données sensibles
   → deleted_at, revoked_at, is_active
```

### Migrations

```
☐ Migration testée en local avec supabase db reset
☐ Migration testée sur environnement de staging
☐ Rollback possible (migration down fonctionnelle)
☐ Pas de DROP TABLE sans backup
☐ Pas de ALTER TABLE sur colonnes critiques en production sans maintenance window
```

### Tests de sécurité

```
☐ Tests RLS exécutés avec différents rôles:
   - Utilisateur standard (voit ses données uniquement)
   - Manager (voit son équipe)
   - Admin (voit tout)
   - Utilisateur sans accès module (accès refusé)

☐ Tests de tentative d'escalade de privilèges:
   - Modifier user_id dans une UPDATE
   - Accéder aux données d'un autre département
   - Appeler une RPC sans permission

☐ Tests de fonctions SECURITY DEFINER après migration
   → Aucune régression silencieuse
```

### Frontend

```
☐ Guards implémentés dans l'ordre correct:
   1. ProtectedRoute (authentification)
   2. ModuleAccessGuard (accès module)
   3. PermissionGuard (permissions spécifiques)

☐ Pas de logique de sécurité uniquement côté frontend
   → Toute restriction UI a un équivalent RLS

☐ Gestion des erreurs 403 (Forbidden) gracieuse
   → Message clair à l'utilisateur
```

### Secrets et configuration

```
☐ Aucun secret en dur dans le code
   → Rechercher: grep -r "eyJ" --include="*.ts" --include="*.tsx"

☐ Variables d'environnement documentées
   → .env.example à jour

☐ service_role utilisé uniquement dans Edge Functions serveur
   → Jamais côté client

☐ CORS configuré correctement
   → Domaines autorisés explicites
```

### Audit

```
☐ Actions critiques journalisées dans auth_events:
   - Création/suppression utilisateur
   - Attribution/révocation accès module
   - Changement de rôle
   - Connexion/déconnexion

☐ Logs ne contiennent pas de données sensibles (mots de passe, tokens)
```

### Documentation

```
☐ ARCHITECTURE_DE_SECURITÉ.md mis à jour si nouvelles tables/policies
☐ Changelog de sécurité documenté
☐ Nouvelles fonctions SECURITY DEFINER documentées avec leurs dépendances
```

---

## Bonnes Pratiques

### Base de Données

1. **Toujours activer RLS** sur nouvelles tables
   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   ```

2. **Utiliser SECURITY DEFINER avec `SET search_path` fixe**
   ```sql
   CREATE FUNCTION my_function()
   SECURITY DEFINER
   SET search_path = public
   AS $$ ... $$;
   ```

3. **Éviter récursion RLS** avec fonctions helper
   - Utiliser des fonctions SECURITY DEFINER pour vérifications admin/manager
   - Ne pas lire la même table dans une politique RLS

4. **Indexer colonnes utilisées dans politiques RLS**
   ```sql
   CREATE INDEX idx_table_user_id ON table(user_id);
   CREATE INDEX idx_table_department_id ON table(department_id);
   ```

5. **Séparer les politiques** par opération (SELECT, INSERT, UPDATE, DELETE)
   - Ne pas utiliser `FOR ALL`
   - Une politique par opération pour clarté et maintenabilité

6. **Utiliser `(select auth.uid())`** pour performance
   - Permet au planificateur PostgreSQL de mettre en cache le résultat
   - Améliore les performances des requêtes avec RLS

### Permissions Génératives (ABAC)

1. **Garder RBAC pour les gros blocs, ABAC pour les permissions contextuelles**
   - Utiliser RBAC pour accès modules et rôles macro (EMPLOYEE, MANAGER, DIRECTION)
   - Utiliser ABAC pour permissions fines dépendant de contexte (département, statut ressource, propriétaire)

2. **Documenter clairement les règles génératives**
   - Chaque fonction SECURITY DEFINER doit documenter ses critères de calcul
   - Expliquer quels attributs et relations sont utilisés
   - Documenter les dépendances de schéma

3. **Tester systématiquement les fonctions de permissions génératives**
   - Tests unitaires pour chaque fonction avec différents scénarios
   - Tests d'intégration pour valider les politiques RLS utilisant ces fonctions
   - Voir section [Tests et Validation des Fonctions SECURITY DEFINER](#tests-et-validation-des-fonctions-security-definer)

4. **Fournir une vue `get_user_effective_permissions()` pour le frontend**
   - Agrège permissions RBAC (stockées) et ABAC (calculées)
   - Permet au frontend d'afficher les permissions effectives
   - Facilite le débogage et l'explication aux utilisateurs

5. **Éviter la sur-ingénierie**
   - Utiliser RBAC quand c'est suffisant (permissions simples, peu de contexte)
   - Ne pas créer de fonctions ABAC pour des cas qui peuvent être gérés par RBAC
   - Évaluer le coût de performance du calcul à la volée vs lecture de table

### Frontend

1. **Défense en profondeur** : Multi-niveaux (route + composant)
   - `ProtectedRoute` pour authentification
   - `ModuleAccessGuard` pour accès module
   - `PermissionGuard` pour permissions spécifiques

2. **Ne jamais faire confiance au frontend seul**
   - Les gardes frontend sont pour l'UX, pas pour la sécurité
   - La sécurité réelle est dans les politiques RLS

3. **Utiliser React Query** pour cache des vérifications
   - Évite les requêtes répétées
   - Améliore les performances

4. **Gérer les erreurs d'accès** gracieusement
   - Rediriger vers page d'erreur appropriée
   - Afficher messages clairs aux utilisateurs

### Général

1. **Principe du moindre privilège** : Donner le minimum d'accès nécessaire

2. **Séparation des concepts** : Distinguer authentification, autorisation niveau 1, autorisation niveau 2

3. **Source de vérité unique** : `auth.users` pour identité, tables de profil pour données applicatives

4. **Pas de duplication** : Ne pas copier `email`, `phone`, `display_name` dans les tables de profil

5. **Modifications via API Admin** : Utiliser `supabase.auth.admin.updateUser()` pour modifier `auth.users`

6. **Audit complet** : Journaliser toutes les actions critiques dans `auth_events`

---

## Documentation de Sécurité

### Référence au Plan de Documentation

L'architecture de sécurité décrite dans ce document respecte le **Plan de Documentation de Sécurité** défini dans [`security/PLAN_DOCUMENTATION_SECURITY.md`](security/PLAN_DOCUMENTATION_SECURITY.md).

Ce plan organise la documentation de sécurité en plusieurs niveaux de détail selon le public cible :

1. **Vue Globale** : `ARCHITECTURE_DE_SECURITÉ.md` (ce document) — Vue d'ensemble de l'architecture
2. **Vue Métier** : (à créer) `security/MODELE_ACCES_GLOBAL.md` — Matrices d'accès fonctionnelles
3. **Vue Technique DB** : (à créer) `security/RLS_INVENTORY.md` — Inventaire détaillé des politiques RLS
4. **Vue API/RPC** : (à créer) `security/RPC_PERMISSIONS.md` — Permissions et règles d'accès des fonctions RPC

Pour plus de détails sur la structure, le contenu et les mécanismes de synchronisation automatique de la documentation de sécurité, consulter le [Plan de Documentation de Sécurité](security/PLAN_DOCUMENTATION_SECURITY.md).

---

## Références

- **Référence (structure utilisateurs)** : `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md` — Analyse complète de la structure utilisateurs et recommandations
- **Plan de Documentation** : `security/PLAN_DOCUMENTATION_SECURITY.md` — Plan de documentation de sécurité organisé en plusieurs niveaux
- **Guidelines RLS** : `.cursor/rules/create-rls-policies.mdc` — Guidelines pour création de politiques RLS
- **Documentation Supabase** : [Supabase Auth](https://supabase.com/docs/guides/auth) — Documentation officielle Supabase Auth
- **Documentation PostgreSQL RLS** : [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — Documentation officielle PostgreSQL RLS

---

## Changelog

### Version 1.5 (2026-01-24)

### Version 1.6 (2026-01-25)

- **Ajout** : Colonne `role_type` sur `module_roles` — distinction entre `job_title` (titre d'emploi) et `permission_group` (groupe d'accès fonctionnel)
- **Ajout** : Table `module_role_inheritance` — héritage à un niveau (job_title → permission_group) avec trigger de validation
- **Ajout** : Helper `has_module_permission(user_id, module_id, permission_key)` — booléen pour usage dans les policies RLS
- **Mise à jour** : `get_user_module_permissions()` réécriture avec résolution d'héritage (permissions directes + héritées via module_role_inheritance)
- **Mise à jour** : `get_user_access_level()` filtre maintenant `role_type = 'job_title'` pour empêcher les permission_groups de polluer le calcul d'access_level
- **Migration RLS** : Toutes les policies RLS migrent de `is_manager()` vers `has_module_permission()` (news_items, surveys, evaluations, leave_requests)
- **Seed** : 4 rôles fonctionnels par défaut (Gestion 2x4, Approbation congés, Gestion évaluations, Gestion sondages) avec 11 permission_keys
- **Seed** : Héritage par défaut — superviseur/directeur héritent de tous les permission_groups (rétrocompatibilité)
- **Frontend** : `usePermissionCheck` réécrit pour utiliser RPC `get_user_module_permissions` (résolution héritage côté serveur)
- **Frontend** : Composantes évaluations, sondages et congés utilisent maintenant les permission checks granulaires

### Version 1.5 (2026-01-24)

- **BREAKING** : Unification du système de rôles — `user_module_roles` (ma-place-rh) est maintenant la **source de vérité unique** pour les rôles métier
- **Ajout** : Colonne `access_level` sur `module_roles` — 3 niveaux système cumulatifs : `employee`, `superviseur`, `directeur`
- **Ajout** : Les `module_roles` pour ma-place-rh sont maintenant les **titres d'emploi réels** (22 titres) au lieu de rôles génériques
- **Ajout** : Helper `get_user_access_level()` — retourne le plus haut niveau d'accès depuis `user_module_roles`
- **Mise à jour** : Helpers `is_manager()`, `is_direction()`, `user_has_role()`, `can_update_user()` réécrits pour lire depuis `user_module_roles` + `module_roles.access_level`
- **Mise à jour** : RPCs `approve_leave_request()` et `reject_leave_request()` utilisent `get_user_access_level()` + vérification `check_module_access()`
- **Mise à jour** : `get_user_module_permissions()` corrigée pour lire `permission_model` depuis `access_modules` (pas `modules`)
- **Dépréciation** : Tables `user_roles` et colonne `users.role` ne sont plus lues (conservées pour backward compat)
- **Sécurité** : Policies RLS sur `sessions` resserrées (`auth.uid() = user_id OR is_admin`)
- **Sécurité** : `PermissionGuard` et `usePermissionCheck` ajoutent bypass admin global (`is_admin`) et dev (`isAuthBypassEnabled`)
- **Ajout** : Seed des 4 départements (Construction, Gestion de projet, Estimation, Administration)

### Version 1.4 (2026-01-19)

- **Mise à jour** : Clarification de la frontière **Global (accès module)** vs **Module (rôles/permissions)**.
- **Ajout** : Principe de **rôle par défaut** lors de l’attribution d’un accès à un module, pour cohérence produit et défense en profondeur.
- **Référence** : Ajout du document de proposition `security/PROPOSITION_REVISION_ROLES_PAR_MODULE.md`.
- **Correction** : Références de documentation de sécurité alignées sur le dossier `security/` (les fichiers “inventaires” restent à créer).

### Version 1.3 (2025-02-04)

- **Ajout** : Section "Documentation de Sécurité" expliquant comment l'architecture respecte le plan de documentation
  - Structure de documentation en 4 documents complémentaires
  - Alignement de chaque document avec les sections de l'architecture
  - Mécanismes de synchronisation et validation automatique
  - Mapping Architecture ↔ Documentation pour traçabilité
- **Mise à jour** : Section "Références" avec ajout du plan de documentation
- **Mise à jour** : Table des matières avec ajout de la section "Documentation de Sécurité"

### Version 1.2 (2025-02-04)

- **Ajout** : Principe de sécurité fondamental sur le modèle hybride RBAC + ABAC
- **Ajout** : Section "Permissions Génératives (ABAC)" dans Autorisation Niveau 2
  - Principe des permissions calculées à la volée
  - Modèle hybride RBAC (squelette) + ABAC (cerveau)
  - Composants architecturaux (fonctions SECURITY DEFINER, politiques RLS USING, fonction RPC)
  - Avantages et risques/limites
- **Ajout** : Pattern "Permissions Génératives (ABAC)" dans Patterns de Sécurité
- **Mise à jour** : Section "Vérification de Permissions" pour clarifier le modèle hybride
- **Mise à jour** : Section "Pattern SECURITY DEFINER" avec référence aux permissions génératives
- **Mise à jour** : Section "PermissionGuard" pour mentionner les permissions RBAC et ABAC
- **Mise à jour** : Diagramme "Architecture en Couches" avec note sur permissions stockées/calculées
- **Ajout** : Sous-section "Permissions Génératives (ABAC)" dans Bonnes Pratiques
- **Ajustements de cohérence** : Références croisées entre sections pour modèle hybride unifié

### Version 1.1 (2025-02-04)

- **Ajout** : Section "Cohérence et Détection d'Accès Fantômes" dans Autorisation Niveau 1
  - Edge Function pour nettoyage automatique des rôles lors de révocation d'accès
  - Détection et prévention des accès fantômes
- **Ajout** : Section "Gestion du Cache et Invalidation" dans Autorisation Niveau 2
  - Stratégies d'invalidation de cache pour rôles hiérarchiques
  - TTL court et réinvalidation forcée
  - Webhooks pour synchronisation temps réel
- **Ajout** : Section "Tests et Validation des Fonctions SECURITY DEFINER" dans RLS
  - Tests unitaires automatisés pour fonctions SECURITY DEFINER
  - Tests d'intégration pour politiques RLS
  - Intégration CI/CD pour validation des migrations
- **Ajout** : Section "Gestion de la Volumétrie et Performance" dans Audit
  - Partitionnement temporel par mois pour `auth_events`
  - Purge automatisée avec rolling window (12-24 mois)
  - Archivage dans stockage froid chiffré (S3/GCS)

### Version 1.0 (2025-02-04)

- Création du document d'architecture de sécurité
- Description complète de l'architecture en couches
- Documentation des politiques RLS par table
- Description des gardes frontend
- Patterns de sécurité et bonnes pratiques
- Aligné avec `RAPPORT_ANALYSE_STRUCTURE_UTILISATEURS.md` pour la structure utilisateurs et les tables de référence

---

**Fin du Document d'Architecture de Sécurité**

