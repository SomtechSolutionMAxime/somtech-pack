---
description: Compléter un cahier des charges à partir du gabarit Somtech
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, TodoWrite
argument-hint: [brief-ou-contrat-cadre.pdf]
---

Compléter un cahier des charges (CDC) à partir du gabarit Word intégré au plugin.

## Instructions

1. **Charger les skills nécessaires** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/SKILL.md` et `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/references/guide-gabarits.md`
   - Charger le skill docx pour les instructions de création/édition de documents Word

2. **Charger le gabarit intégré** :
   Le gabarit officiel est inclus dans le plugin : `${CLAUDE_PLUGIN_ROOT}/templates/Gabarit-Cahier-des-charges-SomTech.docx`
   - Lire et analyser sa structure (sections, placeholders, mise en forme)
   - Identifier tous les champs à compléter

3. **Analyser le contrat cadre (si fourni)** :
   Si l'utilisateur fournit un contrat cadre en argument ($ARGUMENTS) ou en pièce jointe :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/SKILL.md`
   - Extraire les clauses et conditions pour informer la rédaction du CDC
   - S'assurer que le périmètre et les conditions du CDC sont cohérents avec le contrat cadre

4. **Déterminer le mode de travail** : Demander à l'utilisateur s'il souhaite :
   - **Mode interactif** : Répondre aux questions section par section
   - **Mode brief** : Fournir un document ou texte de brief que Claude analysera

5. **Collecter les informations** :
   - En mode interactif : Poser les questions section par section via AskUserQuestion, en commençant par les infos générales (client, projet, dates) puis les détails (exigences, architecture, livrables)
   - En mode brief : Analyser le brief fourni, extraire les informations, et ne poser que les questions pour les lacunes identifiées

6. **Générer le document** : Créer le cahier des charges .docx en respectant fidèlement la mise en forme du gabarit Somtech. Utiliser le skill docx (unpack/edit/repack du gabarit original ou docx-js) pour la génération.

7. **Présenter le résultat** : Sauvegarder le document complété dans le dossier workspace et fournir un lien au format computer:// à l'utilisateur.

8. **Proposer la vérification** : Si un contrat cadre est disponible, proposer de lancer `/verifier-clauses` pour valider la cohérence.

## Contexte

Ce document est un cahier des charges pour un projet de développement logiciel sur mesure par Somtech. Il doit être clair, précis et testable. Les exigences doivent être vérifiables et les critères d'acceptation mesurables.
