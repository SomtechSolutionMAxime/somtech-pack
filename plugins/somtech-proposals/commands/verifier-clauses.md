---
description: Vérifier la cohérence des clauses entre l'offre et le contrat cadre
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, TodoWrite
argument-hint: [offre.docx] [contrat-cadre.pdf]
---

Comparer les clauses juridiques d'une offre de services avec le contrat cadre du client pour détecter les incohérences.

## Instructions

1. **Charger le skill d'analyse juridique** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/SKILL.md`
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/references/clauses-types.md`

2. **Identifier les documents** :
   - Premier argument ($1) : L'offre de services .docx à vérifier
   - Deuxième argument ($2) : Le contrat cadre PDF du client
   - Si les arguments ne sont pas fournis, demander les fichiers à l'utilisateur

3. **Extraire les clauses du contrat cadre** :
   - Lire le PDF du contrat cadre
   - Identifier et extraire chaque clause juridique
   - Classifier par catégorie selon la taxonomie (PI, confidentialité, responsabilité, financier, portée, résiliation, litiges, assurances)

4. **Extraire les clauses de l'offre** :
   - Lire le document Word de l'offre de services
   - Identifier toutes les mentions de clauses, conditions et engagements
   - Classifier par catégorie correspondante

5. **Effectuer la comparaison** :
   - Comparer clause par clause entre les deux documents
   - Détecter : contradictions, omissions, divergences, ambiguïtés
   - Évaluer le niveau de risque pour chaque incohérence (élevé, moyen, faible)

6. **Produire le rapport** :
   Créer un rapport structuré en markdown avec :
   - Résumé exécutif : nombre de clauses analysées, nombre d'incohérences, risque global
   - Tableau des clauses alignées (✅)
   - Tableau des incohérences (⚠️ ou ❌) avec : catégorie, texte contrat cadre, texte offre, nature de l'incohérence, niveau de risque, recommandation
   - Liste des clauses manquantes dans l'offre

7. **Présenter les résultats** :
   - Afficher le rapport dans la conversation
   - Proposer de corriger automatiquement les incohérences dans l'offre de services
   - Rappeler que l'analyse est un outil d'aide et qu'un juriste devrait valider les points critiques

8. **Corrections (si demandé)** :
   - Proposer des corrections spécifiques pour chaque incohérence
   - Appliquer les corrections approuvées par l'utilisateur
   - Regénérer le document corrigé et le sauvegarder

## Avertissement

Toujours inclure cet avertissement dans le rapport : « Cette analyse est un outil d'aide à la vérification et ne constitue pas un avis juridique. Il est recommandé de faire valider les points critiques par un professionnel du droit. »
