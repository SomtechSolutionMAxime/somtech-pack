---
description: Compléter un cahier des charges à partir du gabarit Somtech
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, TodoWrite
argument-hint: [brief-ou-contrat-cadre.pdf]
---

Compléter un cahier des charges (CDC) à partir du gabarit Word intégré au plugin.

## Instructions

> ### RÈGLES CARDINALES
> 1. **Gabarit CDC** = source de **formatage uniquement** (structure, mise en page, styles)
> 2. **Gabarit Contrat Cadre V4.0** = **NE PAS LIRE NI UTILISER** dans cette commande — il sert uniquement à `/complete-contrat`
> 3. **Contrat cadre signé du client** (détecté dans le workspace) = **SEULE source de vérité** pour le contenu juridique, les clauses et les conditions contractuelles

1. **Charger les skills nécessaires** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/SKILL.md` et `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/references/guide-gabarits.md`
   - Charger le skill docx pour les instructions de création/édition de documents Word

2. **Charger le gabarit intégré** :
   Le gabarit officiel est inclus dans le plugin : `${CLAUDE_PLUGIN_ROOT}/templates/Gabarit-Cahier-des-charges-SomTech.docx`
   - Lire et analyser sa structure (sections, placeholders, mise en forme)
   - Identifier tous les champs à compléter

3. **Détecter et analyser le contrat cadre du client** :
   **Recherche automatique** — Avant toute collecte d'information, scanner le répertoire de travail (workspace) pour un contrat cadre signé du client :
   ```
   Glob: **/CONTRAT-CADRE_ET_OFFRE_DE_SERVICES_(CCS)*
   Glob: **/CONTRAT_CADRE*
   ```
   - Si un fichier correspondant est trouvé, l'utiliser automatiquement comme référence
   - Si plusieurs fichiers correspondent, demander à l'utilisateur lequel utiliser
   - Si aucun fichier trouvé ET que l'utilisateur n'en fournit pas en argument ($ARGUMENTS) ou en pièce jointe, continuer sans contrat cadre mais **informer l'utilisateur** qu'aucun contrat cadre n'a été détecté

   > **INTERDIT** : NE PAS lire ni utiliser le gabarit template `CONTRAT-CADRE DE SERVICES (CCS) - Somtech inc. V4.0.docx` — ce fichier sert uniquement à la création de nouveaux contrats via `/complete-contrat`. Les conditions signées par le client peuvent différer du gabarit V4.0.

   **Analyse du contrat cadre du client (si disponible)** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/SKILL.md`
   - Extraire les clauses et conditions **signées** pour informer la rédaction du CDC
   - S'assurer que le périmètre et les conditions du CDC sont cohérents avec le contrat cadre signé du client

   **Référencement du contrat cadre dans le document généré** :
   - Extraire le titre officiel du contrat cadre depuis le document détecté (page de titre ou en-tête)
   - Si le titre n'est pas extractible, utiliser le nom du fichier détecté (sans extension)
   - Dans toutes les sections du cahier des charges qui font référence au contrat cadre, utiliser ce titre exact — NE JAMAIS référencer le nom du gabarit template V4.0

4. **Déterminer le mode de travail** : Demander à l'utilisateur s'il souhaite :
   - **Mode interactif** : Répondre aux questions section par section
   - **Mode brief** : Fournir un document ou texte de brief que Claude analysera

5. **Collecter les informations** :
   - En mode interactif : Poser les questions section par section via AskUserQuestion, en commençant par les infos générales (client, projet, dates) puis les détails (exigences, architecture, livrables)
   - En mode brief : Analyser le brief fourni, extraire les informations, et ne poser que les questions pour les lacunes identifiées

6. **Générer le document** : Créer le cahier des charges .docx en respectant fidèlement la mise en forme du gabarit Somtech.

   **Méthode obligatoire : unpack/edit/repack du gabarit original**
   1. Décompresser le gabarit CDC (c'est un zip contenant du XML)
   2. Modifier les fichiers XML pour insérer le contenu
   3. Recompresser en .docx

   > **docx-js** est un dernier recours uniquement si unpack/edit/repack échoue.

   **Checklist de fidélité au formatage :**
   - [ ] Polices, tailles et couleurs identiques au gabarit
   - [ ] En-têtes et pieds de page préservés intégralement
   - [ ] Logo et images conservés
   - [ ] Styles Word utilisés (`Heading1`, `Heading2`, `ListParagraph`) — pas de formatage inline pour les titres
   - [ ] Apostrophes droites `'` (U+0027) — aucun smart quote `'` (U+2019)
   - [ ] Tableaux : bordures `single sz=4`, alternance `F2F2F2`/`FFFFFF`, largeur en `dxa`

   **CRITIQUE — Apostrophes** :
   Utiliser **exclusivement** l'apostrophe droite `'` (U+0027). NE JAMAIS insérer de smart quotes `'` (U+2019) — elles causent des problèmes d'affichage. Après génération, vérifier l'absence de `&#x2019;` dans le XML.

   **CRITIQUE — Styles Word obligatoires** :
   - Titres niveau 1 : `<w:pStyle w:val="Heading1"/>` (NE PAS simuler avec bold + taille + couleur inline)
   - Titres niveau 2 : `<w:pStyle w:val="Heading2"/>`
   - Listes à puces : `<w:pStyle w:val="ListParagraph"/>`
   - Les styles contrôlent les espacements, bordures et navigation — le formatage inline seul produit des titres "flous"

   **CRITIQUE — Tableaux** :
   Reproduire fidèlement le format des tableaux du gabarit :
   - Bordures : `<w:tblBorders>` avec `single sz=4 color=auto` sur top/left/bottom/right/insideH/insideV
   - Largeur : `w:type="dxa" w:w="9360"` (PAS `pct`)
   - En-tête : fond `#1F4E79`, texte blanc gras
   - Lignes impaires : fond `#F2F2F2` (gris clair)
   - Lignes paires : fond `#FFFFFF` (blanc)

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

7. **Relecture de nettoyage (OBLIGATOIRE)** : Avant toute livraison, relire intégralement le document généré pour s'assurer qu'il ne reste **aucun résidu provenant des gabarits** :
   - Placeholders non remplacés (`[NOM DU CLIENT]`, `[À COMPLÉTER]`, etc.)
   - Notes internes, commentaires ou instructions destinées au rédacteur (ex: « Adapter selon le contexte », « Voir gabarit »)
   - Texte d'exemple ou contenu générique du gabarit qui n'a pas été personnalisé pour le client
   - Références au gabarit lui-même (ex: « gabarit », « template Somtech »)
   - Sections laissées vides ou avec du texte lorem ipsum
   - Tout contenu qui ne serait pas pertinent ou professionnel du point de vue du client final

8. **Présenter le résultat** : Sauvegarder le document complété dans le dossier workspace et fournir un lien au format computer:// à l'utilisateur.

9. **Proposer la vérification** : Si un contrat cadre est disponible, proposer de lancer `/verifier-clauses` pour valider la cohérence.

## Contexte

Ce document est un cahier des charges pour un projet de développement logiciel sur mesure par Somtech. Il doit être clair, précis et testable. Les exigences doivent être vérifiables et les critères d'acceptation mesurables.
