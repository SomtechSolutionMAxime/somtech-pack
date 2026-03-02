# Modèle de rapport d'audit Loi 25

Utiliser ce template pour générer le rapport d'audit. Remplir chaque section avec les constats trouvés.

> Références légales : Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1), à jour au 11 décembre 2025.

---

```markdown
# Rapport d'audit — Conformité Loi 25 (P-39.1)
**Projet** : [Nom du projet]
**Date** : [Date de l'audit]
**Auditeur** : Claude (audit-loi25 plugin v0.2.0)
**Référence légale** : Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1)

## Sommaire exécutif

| Catégorie | Critiques | Majeurs | Modérés | Mineurs |
|-----------|-----------|---------|---------|---------|
| Base de données | X | X | X | X |
| API / Backend | X | X | X | X |
| Frontend | X | X | X | X |
| Gouvernance | X | X | X | X |
| **Total** | **X** | **X** | **X** | **X** |

**Score de conformité** : X/100
- 90-100 : Conforme
- 70-89 : Partiellement conforme — corrections mineures requises
- 50-69 : Non conforme — corrections majeures requises
- 0-49 : Risque élevé — actions immédiates requises

**Exposition aux sanctions** :
- Sanctions administratives (art. 90.1, 90.12) : max 10 000 000 $ ou 2 % du CA mondial
- Sanctions pénales (art. 91) : max 25 000 000 $ ou 4 % du CA mondial
- Dommages punitifs (art. 93.1) : min 1 000 $ par atteinte intentionnelle/faute lourde

## 1. Inventaire des données personnelles

### 1.1 Champs PII identifiés (art. 2, 12 al. 2)

| Table | Colonne | Catégorie | Réf. art. | Chiffré | RLS | Masqué (UI) | Statut |
|-------|---------|-----------|-----------|---------|-----|-------------|--------|
| ... | ... | 1/2/3 | 10/12/20 | ✅/❌ | ✅/❌ | ✅/❌/N/A | ✅/⚠️/❌ |

### 1.2 Flux de données

Documenter comment les PII circulent dans le système :
```
Collecte (art. 4-8) → Stockage (art. 10) → Accès (art. 20) → Affichage (art. 10) → Suppression (art. 23)
[formulaire] → [Supabase] → [RLS policy] → [React component] → [anonymisation]
```

## 2. Constats — Base de données

### 2.1 Chiffrement au repos (art. 10, 12 al. 2)

**Niveau : [CRITIQUE/MAJEUR/MODÉRÉ/MINEUR/CONFORME]**

[Description du constat]

**Champs concernés :**
- [liste des champs]

**Recommandation :**
[Action corrective]

### 2.2 Politiques RLS (art. 20)

**Niveau : [CRITIQUE/MAJEUR/MODÉRÉ/MINEUR/CONFORME]**

[Pour chaque table PII, documenter la politique RLS ou son absence]

### 2.3 Audit trail (art. 3.5, 3.8, 10)

**Niveau : [CRITIQUE/MAJEUR/MODÉRÉ/MINEUR/CONFORME]**

### 2.4 Exactitude des renseignements (art. 11)

**Niveau : [CRITIQUE/MAJEUR/MODÉRÉ/MINEUR/CONFORME]**

### 2.5 Rétention et anonymisation (art. 23)

**Niveau : [CRITIQUE/MAJEUR/MODÉRÉ/MINEUR/CONFORME]**

### 2.6 Portabilité des données (art. 27 al. 3)

**Niveau : [CRITIQUE/MAJEUR/MODÉRÉ/MINEUR/CONFORME]**

## 3. Constats — API et Backend

### 3.1 Exposition de PII dans les endpoints (art. 4, 20)

### 3.2 PII dans les logs (art. 10)

### 3.3 PII transmises au LLM (art. 4, 10, 17)

### 3.4 Décisions automatisées (art. 12.1)

### 3.5 Tokens et authentification (art. 10)

### 3.6 Transfert international de données (art. 17)

### 3.7 Contrats mandataires (art. 18.3)

### 3.8 Gestion des incidents (art. 3.5 à 3.8)

## 4. Constats — Frontend

### 4.1 Masquage des PII à l'affichage (art. 10, 20)

### 4.2 PII dans le stockage navigateur (art. 10)

### 4.3 PII dans les URL (art. 10, 18)

### 4.4 Confidentialité par défaut (art. 9.1)

### 4.5 Décisions automatisées — UI (art. 12.1)

### 4.6 Contrôle d'accès UI (art. 20)

### 4.7 Requêtes select('*') (art. 4)

## 5. Constats — Gouvernance

### 5.1 Responsable de la protection des données (art. 3.1)

Art. 3.1 : La personne ayant la plus haute autorité est par défaut responsable. Ses coordonnées doivent être publiées sur le site Web.

### 5.2 Politiques et pratiques de gouvernance (art. 3.2)

Art. 3.2 : Des politiques et pratiques de gouvernance doivent être établies, proportionnées aux activités, et publiées sur le site Web en termes simples.

### 5.3 EFVP — Évaluation des facteurs relatifs à la vie privée (art. 3.3, 17)

Art. 3.3 : EFVP requise pour tout projet d'acquisition, développement ou refonte d'un système impliquant des PI. Art. 17 : EFVP requise avant tout transfert hors Québec.

### 5.4 Consentement (art. 14)

Art. 14 : Consentement manifeste, libre, éclairé, donné à des fins spécifiques. Consentement exprès requis pour les données sensibles.

### 5.5 Registre des incidents (art. 3.8)

Art. 3.8 : Registre communicable à la CAI sur demande.

### 5.6 Formation des employés

### 5.7 Politique de confidentialité publiée (art. 3.2)

## 6. Plan d'action recommandé

| # | Constat | Niveau | Réf. art. | Action corrective | Effort estimé | Échéance |
|---|---------|--------|-----------|-------------------|---------------|----------|
| 1 | ... | CRITIQUE | ... | ... | ... | Immédiat |
| 2 | ... | MAJEUR | ... | ... | ... | 30 jours |
| ... | ... | ... | ... | ... | ... | ... |

## 7. Annexes

### 7.1 Fichiers analysés
[Liste des fichiers scannés avec le nombre de constats par fichier]

### 7.2 Méthodologie
Audit automatisé basé sur :
- Scan des migrations SQL pour l'inventaire PII (art. 2, 12)
- Vérification des politiques RLS (art. 20)
- Analyse statique du code frontend et backend (art. 10)
- Vérification de la configuration des services tiers (art. 17, 18.3)
- Vérification de la gouvernance (art. 3.1, 3.2, 3.3)

### 7.3 Références légales
- **P-39.1** — Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1)
- **Loi 25** — Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (2021, c. 25)
- **CAI** — Commission d'accès à l'information du Québec
- **Guide EFVP** — Guide d'évaluation des facteurs relatifs à la vie privée (CAI)

### 7.4 Barème de sanctions (art. 90.1 à 93.1)

| Type | Personne physique | Personne morale |
|------|-------------------|-----------------|
| Sanction administrative (art. 90.1, 90.12) | Max 50 000 $ | Max 10 000 000 $ ou 2 % CA mondial |
| Sanction pénale (art. 91) | 5 000 $ - 100 000 $ | 15 000 $ - 25 000 000 $ ou 4 % CA mondial |
| Récidive (art. 92.1) | Montants doublés | Montants doublés |
| Dommages punitifs (art. 93.1) | Min 1 000 $ | Min 1 000 $ |
```
