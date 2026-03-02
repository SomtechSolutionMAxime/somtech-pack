# Règles d'audit — Base de données

> Références : Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1)

## Vérifications à effectuer

### 1. Inventaire des champs PII (art. 2, 12 al. 2)

Art. 2 : Est un renseignement personnel tout renseignement qui concerne une personne physique et permet de l'identifier. Art. 12 al. 2 : Un renseignement est sensible s'il est de nature médicale, biométrique ou autrement intime, ou s'il suscite un degré élevé d'attente raisonnable en matière de vie privée.

Scanner tous les fichiers de migration SQL (`supabase/migrations/*.sql`) pour identifier :

**Méthode de détection :**
```
Rechercher les CREATE TABLE et ALTER TABLE contenant des colonnes dont le nom correspond à :
```

| Pattern de nom | Catégorie | Réf. art. | Action requise |
|---------------|-----------|-----------|----------------|
| `allergies`, `medical_*`, `health_*` | 1-Sensible | 12 al. 2 | Chiffrement obligatoire (art. 10) |
| `salary*`, `wage*`, `pay_*`, `rrsp*`, `benefit*`, `hours_per_pay` | 1-Sensible | 12 al. 2 | Chiffrement obligatoire (art. 10) |
| `sin`, `nas`, `social_insurance*` | 1-Sensible | 12 al. 2 | Chiffrement obligatoire (art. 10) |
| `birth_date`, `date_of_birth`, `birth_year` | 2-Personnel | 2 | Masquage + RLS strict (art. 10, 20) |
| `gender`, `sex` | 2-Personnel | 2 | RLS strict (art. 20) |
| `phone`, `telephone`, `mobile`, `cell*`, `secondary_phone`, `work_phone` | 2-Personnel | 2 | Masquage + RLS (art. 10, 20) |
| `personal_email` | 2-Personnel | 2 | Masquage + RLS (art. 10, 20) |
| `address`, `street`, `city`, `province`, `postal_code`, `country` | 2-Personnel | 2 | Masquage + RLS (art. 10, 20) |
| `emergency_contact*`, `next_of_kin*` | 2-Personnel | 2 | RLS strict (art. 20) |
| `tshirt_size`, `hoodie_size` | 3-Pro | 2 | RLS basique (art. 20) |
| `email` (professionnel) | 3-Pro | 2 | RLS basique (art. 20) |

### 2. Vérification RLS (art. 20)

Art. 20 : « L'accès [...] aux renseignements personnels détenus par une personne qui exploite une entreprise est réservé à ses employés ou mandataires qui ont **qualité pour les connaître** dans l'exercice de leurs fonctions. »

Pour chaque table contenant des PII :

```
1. Vérifier que ALTER TABLE ... ENABLE ROW LEVEL SECURITY existe
2. Vérifier qu'au moins une politique SELECT existe
3. Vérifier que la politique implémente le principe du moindre privilège :
   - Employé → ses propres données seulement (auth.uid() = user_id)
   - Gestionnaire → équipe directe (via team_members ou manager_id)
   - RH → département ou organisation
   - Admin → accès global (mais avec audit log)
4. Vérifier que les politiques UPDATE/DELETE sont aussi restrictives que SELECT
```

### 3. Chiffrement au repos (art. 10)

Art. 10 : « Une personne qui exploite une entreprise doit prendre les **mesures de sécurité** propres à assurer la protection des renseignements personnels [...] contre l'accès, l'utilisation, la communication, la modification ou la destruction non autorisés. »

Pour les données de Catégorie 1 (sensibles au sens de l'art. 12 al. 2), le chiffrement au repos est une mesure de sécurité proportionnelle requise.

Vérifier la présence de :
- Extension `pgcrypto` activée
- Fonctions d'encryption/décryption pour les champs de Catégorie 1
- Clé de chiffrement gérée via variable d'environnement (pas hardcodée)

**Constat si absent :** CRITIQUE — Les données sensibles de Catégorie 1 (art. 12 al. 2) sont stockées en clair, contrevenant à l'obligation de mesures de sécurité de l'art. 10

### 4. Audit trail (art. 3.5, 3.7, 3.8, 10)

La traçabilité des accès est une mesure de sécurité (art. 10) essentielle pour :
- Détecter les incidents de confidentialité (art. 3.5)
- Évaluer le risque de préjudice (art. 3.7)
- Alimenter le registre des incidents (art. 3.8)

Vérifier la présence de :
- Table d'audit (`audit_log`, `access_log`, `pii_access_log`, ou similaire)
- Trigger ou fonction qui journalise les accès aux tables PII
- Champs minimum : user_id, action, table_name, record_id, timestamp

**Note :** La loi ne prescrit pas de durée spécifique de conservation des logs d'accès. Cependant, la prescription pénale est de 5 ans (art. 92.2), ce qui constitue un minimum raisonnable pour la conservation des logs d'audit.

**Constat si absent :** MAJEUR — Aucune traçabilité des accès aux données personnelles, compromettant la détection d'incidents (art. 3.5) et la tenue du registre (art. 3.8)

### 5. Exactitude des renseignements (art. 11)

Art. 11 : « Toute personne qui exploite une entreprise et qui utilise un renseignement personnel pour prendre une décision relative à la personne concernée doit s'assurer qu'il est **à jour et exact** au moment de la décision. »

Vérifier :
- Les renseignements utilisés dans les décisions (RH, paie, etc.) disposent d'un mécanisme de mise à jour
- Les renseignements sont conservés assez longtemps pour que la personne puisse exercer son droit d'accès (art. 27)

### 6. Politique de rétention et anonymisation (art. 23)

Art. 23 al. 1 : Lorsque les fins auxquelles un renseignement a été recueilli sont accomplies, l'entreprise doit le **détruire** ou l'**anonymiser** pour l'utiliser à des fins sérieuses et légitimes.

Art. 23 al. 3 : L'anonymisation doit se faire selon les **meilleures pratiques généralement reconnues** et selon les critères réglementaires. L'anonymisation doit être **irréversible**.

Art. 23 al. 4 : Il est interdit d'identifier une personne à partir de renseignements anonymisés.

Vérifier la présence de :
- Mécanisme de soft-delete (`deleted_at`, `archived_at`) sur les tables employés
- Fonction ou procédure d'anonymisation des données (irréversible)
- Documentation de la durée de conservation par catégorie de données
- L'anonymisation remplace TOUS les champs identifiants (pas seulement certains)

**Constat si absent :** MAJEUR — Aucun mécanisme de suppression/anonymisation conforme à l'art. 23, contrevenant au droit à l'effacement

### 7. Portabilité des données (art. 27 al. 3)

Art. 27 al. 3 : La personne peut demander la communication de ses renseignements dans un **format technologique structuré et couramment utilisé** (ex : JSON, CSV).

Vérifier la présence de :
- Fonction ou endpoint d'export des données personnelles d'un individu
- Format structuré (JSON ou CSV)
- Export limité aux renseignements recueillis auprès de la personne elle-même

**Constat si absent :** MODÉRÉ — Le droit à la portabilité (art. 27 al. 3, en vigueur depuis sept. 2024) n'est pas implémenté

## Niveaux de sévérité

| Niveau | Description | Réf. art. | Délai de correction |
|--------|-------------|-----------|-------------------|
| CRITIQUE | Données sensibles (Cat. 1) exposées sans protection | 10, 12 al. 2 | Immédiat |
| MAJEUR | Absence de mécanisme requis par la loi (audit trail, rétention, portabilité) | 3.5, 3.8, 23, 27 | 30 jours |
| MODÉRÉ | Protection insuffisante de données Cat. 2 (masquage absent, RLS incomplet) | 10, 20 | 90 jours |
| MINEUR | Bonnes pratiques non suivies (Cat. 3 sans RLS strict, documentation manquante) | 3.2 | Prochain sprint |
