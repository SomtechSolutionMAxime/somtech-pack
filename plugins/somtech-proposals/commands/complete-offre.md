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

3. **Détecter et analyser le contrat cadre** :
   **Recherche automatique** — Avant toute collecte d'information, scanner le répertoire de travail (workspace) pour un contrat cadre existant :
   ```
   Glob: **/CONTRAT-CADRE_ET_OFFRE_DE_SERVICES_(CCS)*
   Glob: **/CONTRAT_CADRE*
   ```
   - Si un fichier correspondant est trouvé, l'utiliser automatiquement comme référence
   - Si plusieurs fichiers correspondent, demander à l'utilisateur lequel utiliser
   - Si aucun fichier trouvé ET que l'utilisateur n'en fournit pas en argument ($ARGUMENTS) ou en pièce jointe, continuer sans contrat cadre mais **informer l'utilisateur** qu'aucun contrat cadre n'a été détecté

   **Analyse du contrat cadre (si disponible)** :
   - L'analyser en premier pour extraire les clauses et conditions existantes
   - Utiliser ces informations pour pré-remplir les sections pertinentes de l'offre
   - Marquer les sections qui doivent être cohérentes avec le contrat cadre

   **Référencement du contrat cadre dans le document généré** :
   - Extraire le titre officiel du contrat cadre depuis le document détecté (page de titre ou en-tête)
   - Si le titre n'est pas extractible, utiliser le nom du fichier détecté (sans extension)
   - Dans toutes les sections de l'offre qui font référence au contrat cadre, utiliser ce titre exact — NE JAMAIS référencer le nom du gabarit template ("V4.0")

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

   **CRITIQUE — Préservation des espaces dans les en-têtes et pieds de page** :
   - Lors du unpack/edit/repack, les fichiers `word/header*.xml` et `word/footer*.xml` contiennent des `<w:t>` fragmentés avec `xml:space="preserve"`
   - **NE JAMAIS** fusionner les éléments `<w:t>` dans les headers/footers — les espaces entre les runs sont significatifs
   - **NE JAMAIS** supprimer `xml:space="preserve"` des éléments `<w:t>`
   - Si tu utilises docx-js, vérifier que les espaces entre mots dans les en-têtes/pieds de page sont préservés
   - **Vérification obligatoire** : Après génération, extraire le texte des headers/footers et comparer avec le gabarit original pour détecter tout mot collé

   **CRITIQUE — Énumérations autonomes par section** :
   Chaque liste numérotée dans le document doit être **autonome** — la numérotation ne doit PAS continuer d'une section à l'autre.
   - Chaque énumération doit avoir son propre `<w:numId>` distinct dans `word/numbering.xml` ou un `<w:lvlOverride>` avec `<w:startOverride w:val="1"/>` pour redémarrer à 1
   - **NE JAMAIS** réutiliser le même `<w:numId>` pour des listes de sections différentes
   - Si tu utilises docx-js : chaque nouvelle liste dans une nouvelle section doit créer une nouvelle instance de numérotation avec restart
   - **Vérification obligatoire** : Après génération, vérifier que les énumérations de chaque section recommencent correctement

8. **Vérification automatique** : Si un contrat cadre a été fourni, exécuter automatiquement une vérification de cohérence des clauses et présenter le rapport à l'utilisateur avant la livraison finale.

9. **Livrer** : Sauvegarder le document dans le dossier workspace avec un lien computer://.

## Contexte

Ce document est une offre de services pour du développement logiciel sur mesure par Somtech inc. Il doit être professionnel, précis dans ses engagements, et cohérent avec le contrat cadre du client si existant.
