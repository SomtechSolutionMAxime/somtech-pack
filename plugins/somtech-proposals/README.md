# Somtech Proposals

Plugin Claude Cowork pour la complétion de contrats cadres, cahiers des charges et offres de services selon les gabarits officiels Somtech, avec vérification de cohérence des clauses juridiques et intégration MCP orbit-entreprise pour la récupération automatique des informations clients.

## Fonctionnalités

- **Complétion de contrats cadres de services (CCS)** avec récupération automatique des infos client via MCP orbit-entreprise
- **Complétion de cahiers des charges** à partir du gabarit Somtech intégré
- **Complétion d'offres de services** avec pré-remplissage intelligent basé sur le contrat cadre
- **Vérification de cohérence juridique** entre l'offre de services et le contrat cadre du client
- **Détection automatique du contrat cadre** dans le répertoire de travail (conventions `CONTRAT-CADRE_ET_OFFRE_DE_SERVICES_(CCS)*` et `CONTRAT_CADRE*`)
- **Modes interactif et lot** : répondre question par question ou fournir un brief complet

## Gabarits Inclus

| Gabarit | Fichier |
|---------|---------|
| Contrat cadre de services (CCS) | `templates/CONTRAT-CADRE DE SERVICES (CCS) - Somtech inc. V4.0.docx` |
| Cahier des charges | `templates/Gabarit-Cahier-des-charges-SomTech.docx` |
| Offre de services | `templates/OFFRE DE SERVICES - Somtech inc. (gabarit) V2.0.docx` |

Les gabarits sont utilisés automatiquement par les commandes — pas besoin de les fournir manuellement.

## Commandes

| Commande | Description |
|----------|-------------|
| `/complete-contrat [nom-du-client]` | Compléter un contrat cadre CCS en récupérant les infos client via MCP orbit |
| `/complete-cahier [contrat-cadre.pdf]` | Compléter un cahier des charges à partir du gabarit Somtech intégré |
| `/complete-offre [contrat-cadre.pdf]` | Compléter une offre de services avec vérification optionnelle du contrat cadre |
| `/verifier-clauses [offre.docx] [contrat-cadre.pdf]` | Comparer les clauses d'une offre avec le contrat cadre pour détecter les incohérences |

## Skills

| Skill | Description |
|-------|-------------|
| `analyse-juridique` | Extraction et comparaison de clauses juridiques entre documents contractuels |
| `completion-documents` | Guide de complétion de cahiers des charges et offres de services |

## Intégrations MCP

| MCP | Utilisation |
|-----|-------------|
| **orbit-entreprise** (contacts) | Récupération automatique des informations client (nom, adresse, contact) pour le contrat cadre |
| **orbit-entreprise** (projets) | Contexte projet pour les cahiers des charges et offres |

## Utilisation

### Compléter un contrat cadre

1. Lancer `/complete-contrat NomDuClient`
2. Claude recherche le client dans orbit-entreprise via MCP
3. Les placeholders sont remplis automatiquement (nom, adresse, représentant)
4. Claude demande les informations manquantes (montant assurance, etc.)
5. Le document est généré et nommé selon la convention

### Compléter un cahier des charges

1. Lancer `/complete-cahier` (le gabarit Somtech est utilisé automatiquement)
2. Le contrat cadre est détecté automatiquement dans le répertoire si existant
3. Choisir le mode interactif ou fournir un brief
4. Claude génère le document complété

### Compléter une offre de services

1. Lancer `/complete-offre` (le gabarit Somtech est utilisé automatiquement)
2. Le contrat cadre est détecté automatiquement dans le répertoire si existant
3. Claude analyse le contrat cadre et pose les questions nécessaires
4. Le document est généré avec les clauses alignées au contrat cadre

### Vérifier la cohérence des clauses

1. Fournir l'offre de services (.docx) et le contrat cadre (.pdf)
2. Lancer `/verifier-clauses offre.docx contrat-cadre.pdf`
3. Claude produit un rapport détaillé des incohérences avec recommandations

## Avertissement

L'analyse juridique fournie par ce plugin est un outil d'aide à la vérification et ne constitue pas un avis juridique. Il est recommandé de faire valider les points critiques par un professionnel du droit.
