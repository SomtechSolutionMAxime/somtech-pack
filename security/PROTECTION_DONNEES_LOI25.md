# Protection des données personnelles — Loi 25 (P-39.1)

> Ce document définit les bonnes pratiques de développement logiciel pour la conformité à la **Loi sur la protection des renseignements personnels dans le secteur privé** (CQLR c P-39.1), modernisée par la **Loi 25** (LQ 2021, c 25). Il est une **source de vérité** pour tous les projets Somtech.

---

## Documents de référence officiels

| Document | Source | URL | Copie locale |
|----------|--------|-----|-------------|
| Loi P-39.1 (texte codifié, à jour au 11 déc. 2025) | LégisQuébec | https://www.legisquebec.gouv.qc.ca/fr/document/lc/p-39.1 | `security/references/P-39.1.pdf` |
| Loi 25 (texte modificatif) | CanLII | https://www.canlii.org/fr/qc/legis/loisa/lq-2021-c-25/derniere/lq-2021-c-25.html | — |
| Principaux changements Loi 25 | CAI du Québec | https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25 | — |
| Guide EFVP (v3.1, avril 2024) | CAI du Québec | https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_GU_EFVP.pdf | `security/references/CAI_GU_EFVP.pdf` |
| Règlement sur l'anonymisation | Gazette officielle | https://www.fasken.com/en/knowledge/2024/05/data-anonymization-under-law-25 | — |
| Responsable protection RP | CAI du Québec | https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/responsable-protection-renseignements-personnels-entreprise | — |

---

## Principes fondamentaux

La Loi 25 impose aux entreprises du secteur privé au Québec un cadre strict pour la collecte, l'utilisation, la communication, la conservation et la destruction des renseignements personnels (RP). L'entrée en vigueur est complète depuis le **22 septembre 2024**.

Les sanctions peuvent atteindre **10 M$** ou **2 % du chiffre d'affaires mondial** (le plus élevé des deux).

### Obligations clés pour le développement logiciel

1. **Confidentialité par défaut** — les paramètres de confidentialité doivent offrir le plus haut niveau de protection sans intervention de l'utilisateur (art. 9.1)
2. **Évaluation des facteurs relatifs à la vie privée (EFVP)** — obligatoire pour tout projet d'acquisition, de développement ou de refonte d'un système d'information impliquant des RP
3. **Consentement éclairé** — demandé distinctement pour chaque finalité, en termes simples et clairs
4. **Droit à la portabilité** — communication des RP dans un format structuré et couramment utilisé
5. **Droit à l'effacement** — cessation de diffusion et désindexation sur demande
6. **Anonymisation encadrée** — selon le Règlement sur l'anonymisation (mai 2024)
7. **Notification d'incident** — signalement à la CAI et aux personnes concernées en cas d'incident de confidentialité présentant un risque sérieux de préjudice

---

## Classification des données

### Définition : Renseignement personnel (RP)

Tout renseignement qui concerne une personne physique et permet de l'identifier directement ou indirectement (art. 2, P-39.1).

### Catégories à identifier en développement

| Catégorie | Exemples | Niveau de sensibilité |
|-----------|----------|----------------------|
| **Identifiants directs** | Nom, prénom, courriel, téléphone, adresse | Élevé |
| **Identifiants indirects** | Date de naissance, code postal, genre, occupation | Moyen à Élevé |
| **Données financières** | Numéro de carte, compte bancaire, revenus | Critique |
| **Données de santé** | Diagnostics, traitements, numéro d'assurance maladie | Critique |
| **Identifiants gouvernementaux** | NAS, permis de conduire, passeport | Critique |
| **Données biométriques** | Empreintes, reconnaissance faciale | Critique |
| **Données de localisation** | Géolocalisation, historique de déplacements | Élevé |
| **Données comportementales** | Historique de navigation, préférences, logs d'activité | Moyen |
| **Données de mineurs** | Tout RP d'une personne de moins de 14 ans | Critique (consentement parental requis) |

---

## Règles de développement — Bonnes pratiques obligatoires

### 1. Identification systématique des PII

**RÈGLE : Tout champ de données doit être évalué comme PII ou non-PII dès la conception.**

À chaque création ou modification d'une entité dans l'ontologie ou le schéma de base de données :

- Annoter chaque champ avec `pii: true|false` dans l'ontologie
- Documenter la finalité de collecte pour chaque champ PII
- Valider que chaque champ PII a une base légale de collecte (consentement, exécution de contrat, obligation légale)

```yaml
# Exemple dans l'ontologie
entites:
  contact:
    champs:
      nom:
        type: string
        pii: true
        finalite: "Identification du client pour la gestion du contrat"
        base_legale: "execution_contrat"
      courriel:
        type: string
        pii: true
        finalite: "Communication avec le client"
        base_legale: "consentement"
      note_interne:
        type: text
        pii: false
```

### 2. Chiffrement des données PII

**RÈGLE : Toute donnée identifiée comme PII doit être chiffrée au repos et en transit.**

#### En transit
- TLS 1.2+ obligatoire sur toutes les connexions
- HSTS activé sur tous les domaines
- Pas de transmission de PII via des paramètres d'URL (query strings)

#### Au repos (base de données)
- Les colonnes contenant des PII de niveau **Critique** doivent utiliser le chiffrement au niveau colonne (column-level encryption) via `pgcrypto` ou Supabase Vault
- Les colonnes de niveau **Élevé** doivent être chiffrées au minimum au niveau du disque (encryption at rest fournie par Supabase/AWS)
- Les backups doivent être chiffrés

```sql
-- Exemple : chiffrement avec pgcrypto pour un NAS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Stockage chiffré
UPDATE contacts
SET nas_encrypted = pgp_sym_encrypt(nas, current_setting('app.encryption_key'))
WHERE nas IS NOT NULL;

-- Lecture déchiffrée (seulement pour les rôles autorisés)
SELECT pgp_sym_decrypt(nas_encrypted, current_setting('app.encryption_key')) as nas
FROM contacts
WHERE id = $1;
```

#### Clés de chiffrement
- Les clés ne doivent **jamais** être dans le code source, les migrations ou les logs
- Utiliser les variables d'environnement ou un gestionnaire de secrets (Supabase Vault, AWS Secrets Manager)
- Rotation des clés planifiée selon la politique de sécurité du client

### 3. Masquage des données dans l'interface (UI)

**RÈGLE : Les données PII doivent être masquées par défaut dans l'interface et nécessiter une action explicite de l'utilisateur pour être révélées.**

#### Patterns de masquage obligatoires

| Type de donnée | Affichage masqué | Affichage révélé |
|----------------|------------------|------------------|
| Courriel | `m***@domain.com` | `maxime@domain.com` |
| Téléphone | `(514) ***-**89` | `(514) 555-1289` |
| NAS | `***-***-789` | `123-456-789` |
| Carte de crédit | `**** **** **** 4532` | Jamais affiché en entier |
| Adresse | `123 Rue ***` | `123 Rue Saint-Denis` |
| Date de naissance | `****-**-15` | `1990-03-15` |

#### Implémentation frontend

```tsx
// Composant réutilisable de masquage PII
interface MaskedFieldProps {
  value: string;
  type: 'email' | 'phone' | 'sin' | 'address' | 'dob';
  canReveal?: boolean; // basé sur le rôle de l'utilisateur
}

function MaskedField({ value, type, canReveal = false }: MaskedFieldProps) {
  const [revealed, setRevealed] = useState(false);

  const maskedValue = useMemo(() => maskPII(value, type), [value, type]);

  return (
    <span>
      {revealed ? value : maskedValue}
      {canReveal && (
        <button
          onClick={() => {
            setRevealed(!revealed);
            // OBLIGATOIRE : logger l'action de révélation
            auditLog('pii_reveal', { field_type: type });
          }}
          aria-label={revealed ? 'Masquer' : 'Révéler'}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      )}
    </span>
  );
}
```

#### Règles UI strictes

- Les données PII ne sont **jamais** pré-remplies dans des formulaires accessibles publiquement
- Les champs PII utilisent `autocomplete="off"` quand approprié
- Les données PII ne doivent **jamais** apparaître dans les URL, les titres de page ou les breadcrumbs
- Les exports (CSV, PDF) contenant des PII doivent afficher un avertissement et logger l'export

### 4. Audit des modifications de données sensibles

**RÈGLE : Toute opération de lecture, modification ou suppression sur des données PII doit être journalisée.**

#### Table d'audit obligatoire

```sql
CREATE TABLE audit_pii (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL CHECK (action IN (
    'create', 'read', 'update', 'delete',
    'export', 'reveal', 'consent_given', 'consent_withdrawn',
    'portability_request', 'erasure_request'
  )),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  field_name text,               -- champ spécifique touché
  old_value_hash text,           -- hash SHA-256 de l'ancienne valeur (jamais en clair)
  new_value_hash text,           -- hash SHA-256 de la nouvelle valeur
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- RLS : seuls les admins peuvent lire l'audit
ALTER TABLE audit_pii ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON audit_pii
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- IMPORTANT : personne ne peut supprimer ou modifier les logs d'audit
-- Aucune policy INSERT/UPDATE/DELETE pour les utilisateurs réguliers
```

#### Trigger automatique

```sql
-- Trigger générique pour auditer les modifications PII
CREATE OR REPLACE FUNCTION audit_pii_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Identifier les colonnes PII de la table (convention: préfixe ou config)
  INSERT INTO audit_pii (
    user_id, action, table_name, record_id, metadata
  ) VALUES (
    auth.uid(),
    TG_OP,  -- INSERT, UPDATE, DELETE
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'changed_fields', (
        SELECT jsonb_object_agg(key, 'modified')
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW) ->> key IS DISTINCT FROM to_jsonb(OLD) ->> key
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Ce qui doit être audité

- Toute **création** d'un enregistrement contenant des PII
- Toute **lecture** de PII sensibles (niveau Critique) — via le bouton "Révéler" en UI
- Toute **modification** de PII
- Toute **suppression** de PII
- Tout **export** contenant des PII (CSV, PDF, API)
- Toute **demande de portabilité** ou **d'effacement**
- Tout **consentement** donné ou retiré

### 5. Consentement et gestion du cycle de vie

**RÈGLE : Le consentement doit être granulaire, explicite et révocable.**

#### Stockage du consentement

```sql
CREATE TABLE consents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  purpose text NOT NULL,          -- 'marketing', 'analytics', 'third_party_share'
  granted boolean NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  ip_address inet,
  consent_text text NOT NULL,     -- texte exact présenté à l'utilisateur
  version integer NOT NULL,       -- version du texte de consentement
  created_at timestamptz DEFAULT now()
);
```

#### Règles de consentement

- Le consentement doit être demandé **séparément pour chaque finalité**
- Le texte doit être en **termes simples et clairs**
- L'utilisateur doit pouvoir **retirer son consentement** aussi facilement qu'il l'a donné
- Conserver l'**historique complet** (donné, retiré, redonné)
- Pour les **mineurs de moins de 14 ans** : consentement du titulaire de l'autorité parentale obligatoire

### 6. Droit à la portabilité

**RÈGLE : L'utilisateur peut demander ses données dans un format structuré et couramment utilisé.**

- Implémenter un endpoint ou une fonctionnalité d'export des RP de l'utilisateur
- Format recommandé : JSON ou CSV
- Délai de réponse : raisonnable (la loi ne fixe pas de délai précis, mais la CAI recommande 30 jours)
- Logger toute demande de portabilité dans `audit_pii`

### 7. Droit à l'effacement (droit à l'oubli)

**RÈGLE : L'utilisateur peut demander la cessation de diffusion et la désindexation de ses RP.**

- Implémenter un processus de suppression ou d'anonymisation des RP sur demande
- La suppression doit être **propagée** à tous les systèmes (backups exclus si chiffrés avec rotation)
- L'anonymisation doit respecter le **Règlement sur l'anonymisation** (mai 2024)
- Logger toute demande d'effacement dans `audit_pii`

### 8. Confidentialité par défaut (Privacy by Default)

**RÈGLE : Les paramètres par défaut doivent offrir le plus haut niveau de confidentialité.**

En pratique dans nos projets :

- Les profils utilisateurs sont **privés par défaut**
- Les partages de données sont **désactivés par défaut**
- Les cookies non essentiels sont **refusés par défaut**
- Les notifications contenant des PII sont **désactivées par défaut**
- Les intégrations tierces n'ont **aucun accès aux PII par défaut**

### 9. Évaluation des facteurs relatifs à la vie privée (EFVP)

**RÈGLE : Une EFVP doit être réalisée avant tout nouveau projet ou toute refonte impliquant des RP.**

L'EFVP doit être **proportionnelle** à la sensibilité des renseignements, leur quantité et leur distribution. Elle suit le processus en 7 étapes défini par la CAI (Guide EFVP v3.1, avril 2024).

Référence locale : `security/references/CAI_GU_EFVP.pdf`

#### Quand une EFVP est-elle obligatoire ? (art. 3.3, 17, 21 P-39.1)

L'EFVP est **légalement requise** dans les 5 situations suivantes :

1. **Communication de RP à l'extérieur du Québec** (art. 17) — avant toute communication ou conservation de RP hors Québec, l'entreprise doit réaliser une EFVP
2. **Acquisition, développement ou refonte d'un système d'information** impliquant des RP (art. 3.3) — c'est le cas le plus courant pour Somtech
3. **Communication de RP à des fins de recherche** sans consentement (art. 21)
4. **Collecte de RP par un organisme public** pour le compte d'un autre (art. 64, Loi sur l'accès)
5. **Communication de RP par un organisme public** sans consentement (art. 68, Loi sur l'accès)

> **Pour Somtech** : Toute nouvelle application, tout nouveau module ou refonte majeure traitant des RP déclenche obligatoirement une EFVP (situation 2). Si l'hébergement ou un fournisseur est hors Québec (ex. AWS US, Supabase cloud), la situation 1 s'applique aussi.

#### Les 7 étapes de la démarche EFVP

**Étape 1 — Déterminer si une évaluation est requise**

Dès la phase d'avant-projet, vérifier si le projet correspond à l'une des 5 situations ci-dessus. En cas de doute, procéder à l'EFVP par précaution. Le responsable de la protection des RP doit être consulté dès cette étape.

**Étape 2 — Définir le projet et l'objet de l'évaluation**

Documenter clairement le projet : objectifs, contexte, parties prenantes, RP impliqués, technologies utilisées, et périmètre de l'évaluation. Inclure une description des flux de données (collecte → traitement → conservation → destruction).

**Étape 3 — Préparer l'évaluation**

Cette étape comprend trois volets :

- **Inventaire des RP** : identifier et classifier tous les RP traités (voir la section « Classification des données » ci-dessus), leur source, leur format, et les personnes qui y ont accès
- **Parcours des RP** : cartographier le cycle de vie complet de chaque RP (collecte, utilisation, communication, conservation, destruction/anonymisation)
- **Évaluer l'ampleur** : déterminer la sensibilité des RP, le volume de personnes concernées, et l'étendue de la distribution

**Étape 4 — Évaluer les facteurs relatifs à la vie privée**

Analyser les risques selon les facteurs suivants et adopter les stratégies de mitigation appropriées :

| Facteur | Questions clés | Stratégie |
|---------|---------------|-----------|
| Nécessité et proportionnalité | La collecte est-elle limitée au strict nécessaire ? La finalité est-elle légitime ? | Minimisation des données |
| Transparence | Les personnes sont-elles informées clairement ? | Politique de confidentialité, avis de collecte |
| Consentement | Le consentement est-il libre, éclairé, spécifique ? | Formulaires granulaires, opt-in |
| Accès et rectification | Les personnes peuvent-elles exercer leurs droits ? | Endpoints portabilité/effacement |
| Conservation | La durée est-elle justifiée et limitée ? | Politique de rétention, purge automatique |
| Sécurité | Les mesures techniques sont-elles adéquates ? | Chiffrement, RLS, audit, masquage |
| Communication à des tiers | Les transferts sont-ils encadrés ? | Contrats, EFVP spécifique hors-QC |

**Étape 5 — Rédiger le rapport d'EFVP**

Le rapport doit contenir au minimum :

- Description du projet et de son contexte
- Inventaire des RP et parcours des données
- Analyse des risques identifiés
- Mesures de mitigation adoptées ou recommandées
- Risques résiduels acceptés (avec justification)
- Recommandations et plan d'action
- Avis du responsable de la protection des RP

> **Template Somtech** : Utiliser le gabarit `security/templates/EFVP_TEMPLATE.md` (à créer par projet) pour assurer la cohérence entre les projets.

**Étape 6 — Maintenir l'évaluation à jour**

L'EFVP n'est pas un exercice ponctuel. Elle doit être **révisée** lorsque :

- Le projet subit des modifications significatives (nouvelle fonctionnalité, nouveau type de RP)
- Un incident de confidentialité survient
- L'environnement légal change
- Un nouveau fournisseur ou sous-traitant est ajouté
- Périodiquement, selon le calendrier de révision défini dans le rapport

**Étape 7 — Particularités selon la situation**

- **Communication hors Québec (art. 17)** : l'EFVP doit évaluer le cadre juridique du territoire de destination et les mesures de protection applicables. Cela concerne tout hébergement cloud hors QC (AWS, GCP, Azure US/EU)
- **Services électroniques** : pour les applications web/mobile, porter une attention particulière aux cookies, traceurs, analytiques et géolocalisation
- **Recherche** : encadrement spécifique pour la communication de RP à des fins de recherche sans consentement

#### Intégration EFVP dans le workflow Somtech

| Phase projet | Action EFVP |
|-------------|-------------|
| Avant-projet / Découverte | Étapes 1-2 : Déterminer l'obligation et définir le périmètre |
| Conception / Architecture | Étape 3 : Inventaire et cartographie des RP |
| Développement | Étape 4 : Implémenter les mesures de mitigation identifiées |
| Pré-déploiement | Étape 5 : Rédiger et faire approuver le rapport |
| Production | Étape 6 : Maintenir à jour selon les changements |
| Toute la durée | Étape 7 : Appliquer les particularités selon le contexte |

---

## Checklist développeur — Conformité Loi 25

À valider pour **chaque feature** impliquant des renseignements personnels :

### Conception
- [ ] Les champs PII sont identifiés et annotés dans l'ontologie
- [ ] La finalité de collecte est documentée pour chaque champ PII
- [ ] La base légale de collecte est identifiée (consentement, contrat, obligation légale)
- [ ] Une EFVP a été réalisée si le projet est nouveau ou en refonte majeure

### Base de données
- [ ] Les colonnes PII critiques sont chiffrées (pgcrypto / Vault)
- [ ] Les triggers d'audit sont en place sur les tables contenant des PII
- [ ] Les RLS policies limitent l'accès aux PII selon les rôles
- [ ] Les clés de chiffrement sont dans un gestionnaire de secrets (pas dans le code)

### Interface utilisateur
- [ ] Les PII sont masquées par défaut (composant `MaskedField`)
- [ ] La révélation des PII est protégée par rôle et journalisée
- [ ] Les PII n'apparaissent pas dans les URL, titres ou breadcrumbs
- [ ] Les exports contenant des PII affichent un avertissement et sont journalisés
- [ ] Les formulaires de consentement sont granulaires et en langage clair

### API / Backend
- [ ] TLS 1.2+ sur toutes les connexions
- [ ] Pas de PII dans les paramètres d'URL
- [ ] Les endpoints de portabilité et d'effacement sont implémentés
- [ ] Les incidents de confidentialité sont détectables et notifiables

### Processus
- [ ] Le responsable de la protection des RP est identifié
- [ ] La politique de conservation et de destruction est documentée
- [ ] Le processus de notification d'incident est en place
- [ ] Le registre des incidents de confidentialité est maintenu

---

## Intégration avec l'architecture de sécurité existante

Ce document complète `ARCHITECTURE_DE_SECURITÉ.md` en ajoutant la couche spécifique à la protection des renseignements personnels. Les principes de moindre privilège, séparation des responsabilités et traçabilité définis dans l'architecture de sécurité s'appliquent intégralement ici.

La conformité Loi 25 est vérifiable via le skill `audit-loi25` qui audite automatiquement le code du projet.

---

## Sanctions (Division VII, §4.1 et §5, P-39.1)

La Loi 25 a considérablement renforcé les sanctions. Il existe trois niveaux de conséquences :

### Sanctions administratives pécuniaires (art. 90.1 à 90.17)

Imposées par la CAI sans poursuite pénale, notamment pour les manquements suivants : défaut d'informer les personnes concernées (art. 7-8), collecte/utilisation/communication non conforme, défaut de signaler un incident de confidentialité, mesures de sécurité insuffisantes (art. 10), ou défaut d'informer lors de décisions automatisées (art. 12.1).

| Personne en défaut | Montant maximal |
|--------------------|----------------|
| Personne physique | 50 000 $ (art. 90.12) |
| Entreprise | **10 000 000 $** ou **2 % du chiffre d'affaires mondial** (le plus élevé) (art. 90.12) |

La CAI doit publier un cadre général pour l'application des pénalités, incluant des critères comme la nature et la gravité du manquement, la sensibilité des RP, le nombre de personnes touchées et la coopération de l'entreprise (art. 90.2).

### Sanctions pénales (art. 91 à 92.3)

Pour les infractions plus graves (collecte/utilisation illégale, entraver une enquête, non-respect d'une ordonnance de la CAI, tentative de ré-identification, etc.) :

| Personne en défaut | Amende |
|--------------------|--------|
| Personne physique | 5 000 $ à 100 000 $ (art. 91) |
| Entreprise | **15 000 $ à 25 000 000 $** ou **4 % du chiffre d'affaires mondial** (le plus élevé) (art. 91) |

En cas de **récidive**, les amendes sont **doublées** (art. 92.1). Les poursuites pénales doivent être intentées dans les 5 ans de la commission de l'infraction (art. 92.2). Les administrateurs et dirigeants qui ont ordonné ou autorisé l'infraction sont personnellement passibles des mêmes peines (art. 93).

### Dommages punitifs (art. 93.1)

Toute atteinte illicite à un droit conféré par la loi qui cause un préjudice et résulte d'une faute intentionnelle ou lourde entraîne l'attribution de **dommages punitifs d'au moins 1 000 $** par le tribunal.

### Impact pour Somtech et ses clients

Ces sanctions s'appliquent tant à Somtech (comme développeur et sous-traitant) qu'aux clients (comme responsables du traitement). La conformité dès la conception (privacy by design) et la documentation rigoureuse (EFVP, registre d'incidents, politiques) sont les meilleures protections contre ces risques.
