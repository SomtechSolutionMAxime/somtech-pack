---
description: Auditer la conformité Loi 25 (P-39.1) du projet courant
allowed-tools: Read, Grep, Glob, Bash(find:*, wc:*, ls:*, mkdir:*, date:*)
---

Effectuer un audit complet de conformité à la **Loi sur la protection des renseignements personnels dans le secteur privé** (RLRQ, c. P-39.1), communément appelée « Loi 25 ». Charger d'abord le skill `loi-25-compliance` pour les règles de référence.

## Étapes d'audit

### Étape 1 — Découverte du projet

Identifier la structure du projet :
1. Lire le `CLAUDE.md` s'il existe pour comprendre la stack et l'architecture
2. Localiser les migrations SQL (typiquement `supabase/migrations/`)
3. Localiser le code frontend (typiquement `app/src/` ou `src/`)
4. Localiser le code backend/API (typiquement `chat-service/`, `api/`, `supabase/functions/`)
5. Localiser les fichiers de configuration (.env*, config.*)

### Étape 2 — Inventaire des PII en base de données (art. 2, 12 al. 2)

Scanner toutes les migrations SQL pour trouver les CREATE TABLE et ALTER TABLE. Pour chaque table :
1. Identifier les colonnes contenant des PII selon les patterns dans `references/regles-audit-db.md`
2. Classifier chaque champ trouvé en Catégorie 1 (sensible, art. 12 al. 2), 2 (personnel) ou 3 (professionnel)
3. Construire un tableau d'inventaire complet

### Étape 3 — Vérification RLS (art. 20)

Pour chaque table contenant des PII identifiée à l'étape 2 :
1. Vérifier que `ENABLE ROW LEVEL SECURITY` est présent
2. Vérifier les politiques SELECT, INSERT, UPDATE, DELETE
3. Évaluer si les politiques respectent le principe du moindre privilège (art. 20 : « qualité pour connaître »)
4. Documenter les tables sans RLS ou avec RLS insuffisant

### Étape 4 — Vérification du chiffrement (art. 10)

Chercher dans les migrations :
1. La présence de l'extension `pgcrypto`
2. L'utilisation de `pgp_sym_encrypt`, `pgp_sym_decrypt`, ou `encrypt`/`decrypt`
3. Identifier les champs de Catégorie 1 (art. 12 al. 2) stockés en clair (non chiffrés)

### Étape 5 — Audit trail (art. 3.5, 3.8, 10)

Chercher :
1. Une table d'audit (`audit_log`, `access_log`, `pii_access_log`, `activity_log`)
2. Des triggers de journalisation sur les tables PII
3. Des fonctions de logging d'accès
4. Un registre des incidents de confidentialité (art. 3.8)

### Étape 6 — Analyse du frontend (art. 9.1, 10, 12.1, 20)

Scanner les fichiers `.tsx`, `.ts` du frontend pour :
1. Affichage direct de PII sans masquage (patterns dans `references/regles-audit-frontend.md`) — art. 10
2. PII dans localStorage/sessionStorage — art. 10
3. PII dans les URL params — art. 10
4. PII dans console.log — art. 10
5. Utilisation de `select('*')` sur des tables PII — art. 4
6. Vérification du contrôle d'accès avant affichage — art. 20
7. Confidentialité par défaut (paramètres de partage, visibilité) — art. 9.1
8. Décisions automatisées sans transparence (chatbot, IA) — art. 12.1

### Étape 7 — Analyse du backend/API (art. 4, 10, 12.1, 17, 18.3)

Scanner les fichiers backend pour :
1. PII dans les logs (logger.info, logger.error, console.log) — art. 10
2. PII transmises à un LLM (dans les prompts) — art. 4, 10, 17
3. Exposition de PII dans les endpoints — art. 4, 20
4. Service role keys exposées côté client — art. 10
5. Vérifier les services tiers et leur localisation (transfert international) — art. 17
6. Contrats mandataires écrits avec sous-traitants — art. 18.3
7. Décisions automatisées côté serveur (chatbot actions) — art. 12.1

### Étape 8 — Gouvernance (art. 3.1, 3.2, 3.3, 3.5-3.8, 14, 27, 28)

Chercher dans le projet :
1. **Responsable désigné** (art. 3.1) — coordonnées publiées sur le site Web
2. **Politiques de gouvernance** (art. 3.2) — publiées en termes simples sur le site Web
3. **EFVP** (art. 3.3) — évaluation pour le projet et pour chaque transfert hors Québec (art. 17)
4. **Registre des incidents** (art. 3.8) — communicable à la CAI sur demande
5. **Procédure de gestion des incidents** (art. 3.5) — notification CAI + personnes touchées
6. **Consentement** (art. 14) — mécanisme de consentement manifeste, libre, éclairé, spécifique
7. Mécanisme de suppression/anonymisation (art. 23 — droit à l'effacement)
8. Mécanisme d'export de données (art. 27 al. 3 — droit à la portabilité)
9. **Droit d'accès et de rectification** (art. 27, 28) — mécanisme pour que la personne exerce ses droits
10. **Formation des employés** — programme de sensibilisation

### Étape 9 — Calcul des scores

Calculer **deux scores séparés** :

**Score Technique (Volet A)** — constats des étapes 2 à 7 :
- Démarrer à 100
- -15 par constat CRITIQUE
- -8 par constat MAJEUR
- -3 par constat MODÉRÉ
- -1 par constat MINEUR
- Minimum 0

**Score Gouvernance (Volet B)** — constats de l'étape 8 :
- Même barème que le volet technique

**Score Global** = (Score Technique × 0.60) + (Score Gouvernance × 0.40), arrondi à l'entier.

### Étape 10 — Génération du rapport

Utiliser le template dans `references/modele-rapport.md` pour générer le rapport complet.

1. Remplir chaque section avec les constats trouvés
2. Calculer les scores Technique, Gouvernance et Global
3. Référencer les articles P-39.1 exacts pour chaque constat
4. Générer le plan d'action séparé par volet avec les corrections priorisées

## Format de sortie et nomenclature

### Dossier de destination

Les rapports sont sauvegardés dans le dossier `security/audit/` du projet :

```bash
# Créer le dossier si inexistant
mkdir -p security/audit
```

### Nomenclature des fichiers

Format : `audit-loi25_YYYY-MM-DD_HHhMM.md`

Exemples :
- `security/audit/audit-loi25_2026-03-03_14h30.md`
- `security/audit/audit-loi25_2026-03-15_09h00.md`

```bash
# Générer le nom de fichier
FILENAME="security/audit/audit-loi25_$(date +%Y-%m-%d_%Hh%M).md"
```

### Résultat

Le rapport Markdown est sauvegardé dans `security/audit/` avec la nomenclature date-heure. Afficher un résumé dans le chat avec :
- Le score global et les deux sous-scores (Technique / Gouvernance)
- Le nombre de constats critiques par volet
- Le chemin du fichier généré
