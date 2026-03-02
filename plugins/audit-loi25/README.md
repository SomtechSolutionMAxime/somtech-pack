# audit-loi25

Plugin d'audit de conformité à la **Loi 25 du Québec** (Loi sur la protection des renseignements personnels dans le secteur privé, RLRQ c. P-39.1) pour les projets Supabase/React/TypeScript développés par Somtech.

## Fonctionnalités

### Commande `/audit-loi25`

Lance un audit complet du projet courant :

- **Inventaire des PII (art. 2, 12)** — Scanne les migrations SQL pour identifier tous les champs contenant des renseignements personnels, classifiés en 3 catégories (sensible, personnel, professionnel)
- **Vérification RLS (art. 20)** — Vérifie que chaque table PII a des politiques Row Level Security adéquates (principe du moindre privilège)
- **Chiffrement (art. 10, 12 al. 2)** — Détecte les données sensibles (Cat. 1) stockées en clair
- **Audit trail (art. 3.5, 3.8)** — Vérifie la présence d'un journal d'accès et d'un registre des incidents
- **Frontend (art. 9.1, 10, 12.1)** — Détecte l'affichage de PII sans masquage, le stockage dans localStorage, les PII dans les URL, la confidentialité par défaut
- **API/Logs (art. 4, 10, 17)** — Détecte les PII dans les logs serveur et les données transmises au LLM
- **Gouvernance (art. 3.1, 3.2, 3.3, 14, 23, 27)** — Vérifie le responsable désigné, les politiques, l'EFVP, la rétention, la portabilité, le consentement

Génère un rapport complet avec un score de conformité (0-100), les articles P-39.1 applicables, et un plan d'action priorisé.

### Commande `/audit-loi25-fix`

Après un audit, génère les correctifs concrets :

- Migrations SQL pour le chiffrement (pgcrypto) — art. 10
- Table d'audit trail et registre des incidents — art. 3.5, 3.8
- Fonction d'anonymisation irréversible des employés terminés — art. 23
- Utilitaire TypeScript de masquage des PII (`maskPhone`, `maskEmail`, etc.) — art. 10, 20
- Endpoint d'export pour la portabilité des données — art. 27 al. 3
- Correctifs pour la confidentialité par défaut — art. 9.1
- Transparence des décisions automatisées — art. 12.1

### Commande `/audit-loi25-pdf`

Génère un rapport PDF professionnel et livrable au client à partir du rapport Markdown :

- **Page couverture** avec logo Somtech, score de conformité visuel, nom du client et du projet
- **Table des matières** automatique avec numéros de pages
- **Sommaire exécutif** avec tableau des constats par catégorie et exposition aux sanctions
- **Sections détaillées** avec badges de sévérité colorés (CRITIQUE/MAJEUR/MODÉRÉ/MINEUR)
- **Plan d'action** priorisé avec effort estimé et échéances
- **Annexes** avec méthodologie, références légales et barème des sanctions

Utilise `reportlab` pour la génération PDF via le script `scripts/generate_pdf_report.py`.

### Hook préventif

Vérifie automatiquement chaque écriture/modification de code pour détecter les risques PII en temps réel : affichage sans masquage (art. 10), PII dans les logs (art. 10), tables sans RLS (art. 20), confidentialité par défaut (art. 9.1), décisions automatisées (art. 12.1), etc.

### Skill `loi-25-compliance`

Base de connaissances complète sur la Loi P-39.1 appliquée au développement logiciel :

- Classification des renseignements personnels (3 catégories, art. 2, 12 al. 2)
- Obligations de gouvernance (art. 3.1, 3.2, 3.3)
- Incidents de confidentialité (art. 3.5 à 3.8)
- Consentement (art. 14)
- Confidentialité par défaut (art. 9.1)
- Décisions automatisées (art. 12.1)
- Transfert international (art. 17)
- Mandataires (art. 18.3)
- Exigences techniques par couche (BD, API, Frontend)
- Patterns de détection dans le code
- Niveaux de sévérité et délais de correction

## Utilisation

```
/audit-loi25                    # Lancer un audit complet
/audit-loi25-fix                # Générer les correctifs du dernier audit
/audit-loi25-fix rapport.md     # Générer les correctifs d'un rapport spécifique
/audit-loi25-pdf                # Générer le PDF du dernier rapport
/audit-loi25-pdf rapport.md --client "Acme Inc." --projet "Portail RH"
```

## Stack supportée

- **Base de données** : Supabase (PostgreSQL)
- **Frontend** : React + TypeScript
- **Backend** : Edge Functions, chat-service (Node.js)
- **Déploiement** : Netlify

## Référence légale

- **P-39.1** — Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1)
- **Loi 25** — Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (2021, c. 25)
- **En vigueur** : Toutes dispositions depuis le 22 septembre 2024
- **Autorité** : Commission d'accès à l'information du Québec (CAI)

### Sanctions

| Type | Personne physique | Personne morale |
|------|-------------------|-----------------|
| Sanction administrative (art. 90.1, 90.12) | Max 50 000 $ | Max 10 000 000 $ ou 2 % CA mondial |
| Sanction pénale (art. 91) | 5 000 $ - 100 000 $ | 15 000 $ - 25 000 000 $ ou 4 % CA mondial |
| Récidive (art. 92.1) | Montants doublés | Montants doublés |
| Dommages punitifs (art. 93.1) | Min 1 000 $ | Min 1 000 $ |
| Prescription pénale (art. 92.2) | 5 ans | 5 ans |
| Responsabilité dirigeants (art. 93) | Personnelle | — |

## Version

- **v0.3.0** — Ajout de la commande `/audit-loi25-pdf` pour la génération de rapports PDF professionnels livrables au client. Page couverture Somtech, score visuel, badges de sévérité, plan d'action, annexes. Script Python `generate_pdf_report.py` basé sur reportlab.
- **v0.2.0** — Validation complète contre le texte officiel P-39.1 (à jour au 11 déc. 2025). Ajout des articles exacts, couverture des obligations de gouvernance (art. 3.1-3.3), incidents (art. 3.5-3.8), consentement (art. 14), confidentialité par défaut (art. 9.1), décisions automatisées (art. 12.1), mandataires (art. 18.3). Barème complet des sanctions.
- **v0.1.0** — Version initiale
