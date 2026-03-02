---
description: Compléter une offre de services à partir du gabarit Somtech
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, TodoWrite
argument-hint: [contrat-cadre.pdf]
---

Compléter une offre de services à partir du gabarit Word intégré au plugin, avec vérification optionnelle contre le contrat cadre du client.

## Instructions

1. **Charger les skills nécessaires** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/SKILL.md` et `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/references/guide-gabarits.md`
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/SKILL.md`
   - Charger le skill docx pour la génération/édition Word

2. **Charger le gabarit intégré** :
   Le gabarit officiel est inclus dans le plugin : `${CLAUDE_PLUGIN_ROOT}/templates/OFFRE DE SERVICES - Somtech inc. (gabarit) V2.0.docx`
   - Lire et analyser sa structure (sections, placeholders, mise en forme)
   - Identifier tous les champs à compléter

3. **Analyser le contrat cadre (si fourni)** :
   Si l'utilisateur fournit un contrat cadre en argument ($ARGUMENTS) ou en pièce jointe :
   - L'analyser en premier pour extraire les clauses et conditions existantes
   - Utiliser ces informations pour pré-remplir les sections pertinentes de l'offre
   - Marquer les sections qui doivent être cohérentes avec le contrat cadre

4. **Déterminer le mode de travail** : Demander à l'utilisateur s'il souhaite :
   - **Mode interactif** : Répondre aux questions section par section
   - **Mode brief** : Fournir un document ou texte de brief

5. **Collecter les informations** :
   - Commencer par la compréhension du besoin et la solution proposée
   - Puis la méthodologie et le calendrier
   - Ensuite la proposition financière
   - Enfin les conditions juridiques et clauses

6. **Pour les clauses juridiques** :
   - Si un contrat cadre est fourni, proposer des clauses alignées avec celui-ci
   - Signaler toute divergence potentielle à l'utilisateur avant de finaliser
   - Utiliser la référence `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/references/clauses-types.md` pour la taxonomie

7. **Générer le document** : Créer l'offre de services .docx en respectant fidèlement la mise en forme du gabarit Somtech. Utiliser le skill docx (unpack/edit/repack du gabarit original ou docx-js).

8. **Vérification automatique** : Si un contrat cadre a été fourni, exécuter automatiquement une vérification de cohérence des clauses et présenter le rapport à l'utilisateur avant la livraison finale.

9. **Livrer** : Sauvegarder le document dans le dossier workspace avec un lien computer://.

## Contexte

Ce document est une offre de services pour du développement logiciel sur mesure par Somtech inc. Il doit être professionnel, précis dans ses engagements, et cohérent avec le contrat cadre du client si existant.
