---
description: Compléter une offre de services à partir du gabarit Somtech
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, TodoWrite
argument-hint: [contrat-cadre.pdf]
---

Compléter une offre de services à partir du gabarit Word intégré au plugin, avec vérification optionnelle contre le contrat cadre du client.

## Instructions

> ### RÈGLES CARDINALES
> 1. **Gabarit Offre V2.0** = source de **formatage uniquement** (structure, mise en page, styles)
> 2. **Gabarit Contrat Cadre V4.0** = **NE PAS LIRE NI UTILISER** dans cette commande — il sert uniquement à `/complete-contrat`
> 3. **Contrat cadre signé du client** (détecté dans le workspace) = **SEULE source de vérité** pour le contenu juridique, les clauses et les conditions contractuelles

1. **Charger les skills nécessaires** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/SKILL.md` et `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/references/guide-gabarits.md`
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/SKILL.md`
   - Charger le skill docx pour la génération/édition Word

2. **Charger le gabarit intégré** :
   Le gabarit officiel est inclus dans le plugin : `${CLAUDE_PLUGIN_ROOT}/templates/OFFRE DE SERVICES - Somtech inc. (gabarit) V2.0.docx`
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
   - L'analyser en premier pour extraire les clauses et conditions **signées**
   - Utiliser ces informations pour pré-remplir les sections pertinentes de l'offre
   - Marquer les sections qui doivent être cohérentes avec le contrat cadre du client

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
   - La source **UNIQUE** pour les clauses est le contrat cadre signé du client (détecté à l'étape 3) — NE PAS utiliser le gabarit V4.0
   - Proposer des clauses alignées avec le contrat signé du client
   - Signaler toute divergence potentielle à l'utilisateur avant de finaliser
   - Utiliser la référence `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/references/clauses-types.md` pour la taxonomie

7. **Générer le document** : Créer l'offre de services .docx en respectant fidèlement la mise en forme du gabarit Offre V2.0.

   **Méthode obligatoire : unpack/edit/repack du gabarit original**
   1. Décompresser le gabarit V2.0 (c'est un zip contenant du XML)
   2. Modifier les fichiers XML pour insérer le contenu
   3. Recompresser en .docx

   > **docx-js** est un dernier recours uniquement si unpack/edit/repack échoue.

   **Checklist de fidélité au formatage :**
   - [ ] Polices, tailles et couleurs identiques au gabarit V2.0
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
   Reproduire fidèlement le format des tableaux du gabarit V2.0 :
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

8. **Relecture de nettoyage (OBLIGATOIRE)** : Avant toute livraison, relire intégralement le document généré pour s'assurer qu'il ne reste **aucun résidu provenant des gabarits** :
   - Placeholders non remplacés (`[NOM DU CLIENT]`, `[À COMPLÉTER]`, etc.)
   - Notes internes, commentaires ou instructions destinées au rédacteur (ex: « Adapter selon le contexte », « Voir gabarit »)
   - Texte d'exemple ou contenu générique du gabarit qui n'a pas été personnalisé pour le client
   - Références au gabarit lui-même (ex: « gabarit V2.0 », « template Somtech »)
   - Sections laissées vides ou avec du texte lorem ipsum
   - Tout contenu qui ne serait pas pertinent ou professionnel du point de vue du client final

9. **Vérification automatique** : Si un contrat cadre a été fourni, exécuter automatiquement une vérification de cohérence des clauses et présenter le rapport à l'utilisateur avant la livraison finale.

10. **Livrer** : Sauvegarder le document dans le dossier workspace avec un lien computer://.

## Contexte

Ce document est une offre de services pour du développement logiciel sur mesure par Somtech inc. Il doit être professionnel, précis dans ses engagements, et cohérent avec le contrat cadre **signé du client** si existant. Le gabarit Offre V2.0 sert de base de formatage; le gabarit Contrat Cadre V4.0 ne doit PAS être utilisé dans ce contexte.
