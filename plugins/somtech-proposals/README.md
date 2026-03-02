# Somtech Proposals

Plugin Claude Cowork pour la complétion de cahiers des charges et d'offres de services selon les gabarits officiels Somtech, avec vérification de cohérence des clauses juridiques contre le contrat cadre du client.

## Fonctionnalités

- **Complétion de cahiers des charges** à partir du gabarit Somtech intégré
- **Complétion d'offres de services** avec pré-remplissage intelligent basé sur le contrat cadre
- **Vérification de cohérence juridique** entre l'offre de services et le contrat cadre du client
- **Modes interactif et lot** : répondre question par question ou fournir un brief complet

## Gabarits Inclus

| Gabarit | Fichier |
|---------|---------|
| Cahier des charges | `templates/Gabarit-Cahier-des-charges-SomTech.docx` |
| Offre de services | `templates/OFFRE DE SERVICES - Somtech inc. (gabarit) V2.0.docx` |

Les gabarits sont utilisés automatiquement par les commandes — pas besoin de les fournir manuellement.

## Commandes

| Commande | Description |
|----------|-------------|
| `/complete-cahier [contrat-cadre.pdf]` | Compléter un cahier des charges à partir du gabarit Somtech intégré |
| `/complete-offre [contrat-cadre.pdf]` | Compléter une offre de services avec vérification optionnelle du contrat cadre |
| `/verifier-clauses [offre.docx] [contrat-cadre.pdf]` | Comparer les clauses d'une offre avec le contrat cadre pour détecter les incohérences |

## Skills

| Skill | Description |
|-------|-------------|
| `analyse-juridique` | Extraction et comparaison de clauses juridiques entre documents contractuels |
| `completion-documents` | Guide de complétion de cahiers des charges et offres de services |

## Utilisation

### Compléter un cahier des charges

1. Lancer `/complete-cahier` (le gabarit Somtech est utilisé automatiquement)
2. Optionnel : fournir le contrat cadre du client en pièce jointe
3. Choisir le mode interactif ou fournir un brief
4. Claude génère le document complété

### Compléter une offre de services

1. Lancer `/complete-offre` (le gabarit Somtech est utilisé automatiquement)
2. Optionnel : fournir le contrat cadre du client en pièce jointe
3. Claude analyse le contrat cadre et pose les questions nécessaires
4. Le document est généré avec les clauses alignées au contrat cadre

### Vérifier la cohérence des clauses

1. Fournir l'offre de services (.docx) et le contrat cadre (.pdf)
2. Lancer `/verifier-clauses offre.docx contrat-cadre.pdf`
3. Claude produit un rapport détaillé des incohérences avec recommandations

## Avertissement

L'analyse juridique fournie par ce plugin est un outil d'aide à la vérification et ne constitue pas un avis juridique. Il est recommandé de faire valider les points critiques par un professionnel du droit.
