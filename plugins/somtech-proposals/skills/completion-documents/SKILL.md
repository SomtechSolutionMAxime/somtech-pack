---
name: completion-documents
description: >
  Ce skill doit être utilisé quand l'utilisateur demande à "compléter un cahier des charges",
  "remplir une offre de services", "créer un document à partir du gabarit", "préparer une
  proposition", ou a besoin de générer un cahier des charges ou une offre de services à partir
  d'un gabarit Word (.docx). Aussi déclenché par "gabarit", "template", "cahier des charges",
  "offre de services", "proposition commerciale", "CDC".
version: 0.1.0
---

# Complétion de Documents — Cahier des Charges et Offre de Services

Guider l'utilisateur dans la complétion de cahiers des charges et d'offres de services à partir de gabarits Word (.docx) existants.

## Réflexes biais prioritaires (STD-011 §2.6)

**Anti-sycophantie envers client PRIORITAIRE** : avant de valider une proposition commerciale ou une offre de services, jouer le rôle de l'avocat du diable. Identifier au moins 3 failles (juridiques, techniques, économiques) avant la conclusion. Interdit d'ouvrir par « Excellente proposition ! ».

**Anti-ancrage** : si le client suggère une option ou un prix de référence, présenter les inconvénients de cette option avant les avantages. Ne pas reproduire la formulation du client comme acquise.

**Contexte QC/CA par défaut** : devise CAD, taxes TPS/TVQ, juridiction québécoise, formes juridiques Inc./SENC/SENCRL (pas LLC). Patterns inspirés du sub-agent commercial : « ne jamais accepter sans vérification les estimations de coûts ou de délais générées par l'IA » (rapport biais §5.1).

Standard complet : STD-011 (Somcraft `f515cb9e-1fbd-4271-a83c-53cdcb27f55e`).

## Prérequis

1. Le **gabarit Word** (.docx) — inclus dans le plugin sous `templates/`
2. Les **informations du projet** — soit via un brief, soit interactivement
3. (Optionnel) Le **contrat cadre signé du client** pour la vérification de cohérence

## Distinction Critique : Gabarits vs Contrat Client

| Document | Rôle | Quand l'utiliser |
|----------|------|------------------|
| **Gabarit Offre V2.0** (`OFFRE DE SERVICES - Somtech inc. (gabarit) V2.0.docx`) | **Formatage uniquement** — structure, mise en forme, sections | Comme base de mise en page pour générer une offre |
| **Gabarit Contrat Cadre V4.0** (`CONTRAT-CADRE DE SERVICES (CCS) - Somtech inc. V4.0.docx`) | **Création de nouveaux contrats uniquement** | Exclusivement dans `/complete-contrat` pour créer un nouveau CCS |
| **Contrat cadre signé du client** (détecté dans le workspace) | **SEULE source de vérité contractuelle et juridique** | Pour toute référence juridique dans les offres et CDC |

> **RÈGLE NON-NÉGOCIABLE** : Lors de la génération d'offres (`/complete-offre`) ou de cahiers des charges (`/complete-cahier`), le gabarit V4.0 NE DOIT JAMAIS être lu ni utilisé comme source de contenu juridique. Seul le contrat cadre signé du client (détecté dans le workspace) fait foi. Les conditions signées par le client peuvent différer du gabarit V4.0.

## Détection Automatique du Contrat Cadre

**IMPORTANT** — Avant de commencer la collecte d'informations, toujours scanner le répertoire de travail (workspace) pour détecter un contrat cadre existant. Les conventions de nommage sont :

- `CONTRAT-CADRE_ET_OFFRE_DE_SERVICES_(CCS)*` (ancien format)
- `CONTRAT_CADRE*` (nouveau format)

Patterns de recherche :
```
Glob: **/CONTRAT-CADRE_ET_OFFRE_DE_SERVICES_(CCS)*
Glob: **/CONTRAT_CADRE*
```

Si un contrat cadre signé du client est détecté, il devient la **SEULE source de vérité contractuelle** :
- Informer la rédaction du contenu (périmètre, conditions, terminologie du client)
- Pré-remplir les sections juridiques et conditions générales **à partir de ce contrat signé** (les conditions signées prévalent sur le gabarit V4.0)
- Déclencher automatiquement une vérification de cohérence à la fin de la génération
- **Référencement** : Extraire le titre officiel du contrat cadre détecté (page de titre ou nom de fichier sans extension). Toute mention du contrat cadre dans les documents générés doit utiliser ce titre exact, jamais le nom du gabarit template V4.0
- **INTERDIT** : Ne pas lire ni référencer le gabarit `CONTRAT-CADRE DE SERVICES (CCS) - Somtech inc. V4.0.docx` — ce gabarit sert uniquement à la commande `/complete-contrat`

## Processus de Complétion

### Étape 1 : Analyse du Gabarit

1. Lire le gabarit Word fourni en utilisant le skill docx (unpack → lire XML ou pandoc)
2. Identifier toutes les sections et sous-sections du gabarit
3. Repérer les champs à compléter (texte entre crochets, placeholders, zones vides)
4. Dresser la liste des informations nécessaires pour compléter chaque section

### Étape 2 : Collecte des Informations

**Mode interactif (par défaut) :**
Poser des questions à l'utilisateur section par section en utilisant AskUserQuestion :
- Commencer par les informations générales (client, projet, dates)
- Progresser vers les détails techniques et fonctionnels
- Terminer par les conditions commerciales et juridiques

**Mode lot (si l'utilisateur fournit un brief) :**
1. Analyser le document ou texte fourni par l'utilisateur
2. Extraire les informations pertinentes pour chaque section
3. Identifier les lacunes et poser uniquement les questions manquantes

### Étape 3 : Génération du Document

**Méthode obligatoire : unpack/edit/repack du gabarit original**
1. Décompresser le gabarit .docx original (c'est un zip contenant du XML)
2. Modifier les fichiers XML pour insérer le contenu collecté
3. Recompresser en .docx
4. Cette méthode préserve fidèlement toute la mise en forme (polices, styles, en-têtes, pieds de page, logos, images)

> **docx-js** est un **dernier recours uniquement** si unpack/edit/repack échoue. Il ne garantit pas la fidélité au formatage du gabarit.

**Checklist de fidélité au formatage :**
- [ ] Polices, tailles et couleurs identiques au gabarit
- [ ] En-têtes et pieds de page préservés intégralement
- [ ] Logo et images existantes conservés
- [ ] Styles de titres et paragraphes respectés (voir ci-dessous)
- [ ] Marges et espacements cohérents
- [ ] Apostrophes droites (voir ci-dessous)
- [ ] Tableaux conformes au gabarit (voir ci-dessous)

5. Remplir chaque section avec le contenu collecté
6. Sauvegarder le document complété dans le dossier workspace

**CRITIQUE — Apostrophes et caractères spéciaux** :
- Utiliser **exclusivement** l'apostrophe droite `'` (U+0027) dans tout le contenu XML
- **NE JAMAIS** utiliser les smart quotes / guillemets courbes `'` (U+2019) ni `'` (U+2018) — ils apparaissent comme `&#x2019;` dans le XML et causent des problèmes d'affichage dans Word
- Cela s'applique à tout le texte inséré : paragraphes, titres, en-têtes, pieds de page, tableaux
- Lors du remplacement de placeholders dans le XML existant, s'assurer que le texte inséré utilise des apostrophes droites
- **Vérification obligatoire** : Après génération, chercher `&#x2019;` et `&#x2018;` dans le XML du document — il ne doit y en avoir aucun

**CRITIQUE — Utilisation obligatoire des styles Word du gabarit** :
Les gabarits définissent des styles Word (`Heading1`, `Heading2`, `ListParagraph`, etc.) dans `word/styles.xml`. Lors de la génération :
- **TOUJOURS** utiliser `<w:pStyle w:val="Heading1"/>` dans `<w:pPr>` pour les titres de niveau 1 — NE PAS simuler un titre avec du formatage inline (bold + taille + couleur)
- **TOUJOURS** utiliser `<w:pStyle w:val="Heading2"/>` pour les titres de niveau 2
- **TOUJOURS** utiliser `<w:pStyle w:val="ListParagraph"/>` pour les éléments de listes à puces
- Le formatage inline (gras, taille, couleur sur chaque `<w:rPr>`) ne remplace PAS un style — les styles contrôlent aussi les espacements avant/après, les bordures, la navigation dans Word
- Si des paragraphes du gabarit utilisent un style, le document généré DOIT utiliser le même style
- **Vérification obligatoire** : Après génération, s'assurer que chaque titre utilise `<w:pStyle>` et non du formatage inline brut

**CRITIQUE — Formatage des tableaux** :
Les tableaux du gabarit suivent un format précis qui doit être reproduit fidèlement :
- **Bordures** : Chaque tableau doit avoir des bordures explicites dans `<w:tblBorders>` — copier exactement les propriétés du gabarit (`<w:top w:val="single" w:sz="4" w:color="auto"/>`, idem pour left, bottom, right, insideH, insideV)
- **Largeur** : Utiliser la même unité que le gabarit (`w:type="dxa"` avec `w:w="9360"`), NE PAS utiliser `w:type="pct"`
- **Alternance de couleurs** : Les lignes de données doivent alterner entre `#F2F2F2` (gris clair) et `#FFFFFF` (blanc) via `<w:shd w:fill="F2F2F2"/>` sur les `<w:tcPr>` de chaque cellule. La ligne d'en-tête utilise `#1F4E79` (bleu foncé) avec texte blanc et gras.
- **Structure** : Copier les `<w:tblPr>` et `<w:tblGrid>` du gabarit original pour chaque type de tableau
- **Vérification obligatoire** : Après génération, vérifier que chaque tableau a des bordures visibles et l'alternance de couleurs

**CRITIQUE — Préservation des espaces dans les en-têtes et pieds de page** :
Lors de la manipulation des fichiers .docx (unpack/edit/repack), les en-têtes (`word/header*.xml`) et pieds de page (`word/footer*.xml`) sont particulièrement sensibles aux problèmes d'espacement :
- Les textes sont souvent fragmentés en plusieurs éléments `<w:t>` avec l'attribut `xml:space="preserve"` — cet attribut est **essentiel** pour conserver les espaces
- **NE JAMAIS** fusionner ou réassembler les éléments `<w:t>` dans les headers/footers
- **NE JAMAIS** supprimer `xml:space="preserve"` des éléments `<w:t>`
- Lors du remplacement de placeholders dans les headers/footers, s'assurer que les espaces adjacents ne sont pas supprimés
- Si un outil comme docx-js regénère le XML, vérifier explicitement que chaque `<w:t>` contenant un espace en début ou fin conserve `xml:space="preserve"`
- **Vérification obligatoire** : Après chaque génération de document, extraire le texte brut des headers et footers du fichier produit et le comparer au gabarit original pour détecter tout mot collé ou espace manquant

**CRITIQUE — Énumérations autonomes par section** :
Les listes numérotées (1, 2, 3... ou a, b, c...) dans un document Word utilisent des définitions de numérotation dans `word/numbering.xml`. Un problème fréquent est que les énumérations de différentes sections partagent le même `<w:numId>`, ce qui fait que la numérotation **continue** d'une section à l'autre au lieu de recommencer.
- Chaque énumération appartenant à une clause ou section différente doit avoir son propre `<w:numId>` dans `word/numbering.xml`, ou utiliser `<w:lvlOverride>` avec `<w:startOverride w:val="1"/>` pour forcer le redémarrage
- **NE JAMAIS** réutiliser le même identifiant de numérotation pour des listes de sections/clauses différentes
- Exemple concret : si la clause 6.1 a une énumération (a, b, c, d, e) et la clause 8 a sa propre énumération, elles doivent être indépendantes — la clause 8 doit recommencer à (a) et non continuer à (f)
- Si tu utilises docx-js : créer une nouvelle instance de numérotation avec `restart` pour chaque liste dans une nouvelle section
- Si tu fais du unpack/edit/repack : inspecter `word/numbering.xml` et s'assurer que chaque liste a son propre `<w:num w:numId="...">` séparé
- **Vérification obligatoire** : Après génération, parcourir le document et vérifier que chaque énumération recommence à 1 (ou a) dans sa section respective

### Étape 4 : Relecture de Nettoyage (OBLIGATOIRE)

Avant toute livraison, relire intégralement le document généré pour s'assurer qu'il ne reste **aucun résidu provenant des gabarits** :
- Placeholders non remplacés (`[NOM DU CLIENT]`, `[À COMPLÉTER]`, `[DATE]`, etc.)
- Notes internes, commentaires ou instructions destinées au rédacteur (ex: « Adapter selon le contexte », « Voir gabarit », « Section optionnelle »)
- Texte d'exemple ou contenu générique du gabarit qui n'a pas été personnalisé pour le client
- Références au gabarit lui-même (ex: « gabarit V2.0 », « template Somtech », « V4.0 »)
- Sections laissées vides ou avec du texte lorem ipsum
- Tout contenu qui ne serait pas pertinent ou professionnel du point de vue du client final

> Le document final doit être **prêt à envoyer au client** sans retouche manuelle.

### Étape 5 : Revue et Ajustements

1. Présenter un résumé des sections complétées
2. Demander à l'utilisateur s'il souhaite modifier ou ajuster du contenu
3. Appliquer les corrections demandées
4. Proposer la vérification de cohérence avec le contrat cadre si disponible

## Sections Typiques — Cahier des Charges

Voici les sections courantes dans un CDC de développement logiciel :

1. **Page de garde** : Titre du projet, client, date, version, auteur
2. **Contexte et objectifs** : Description du besoin, problématique actuelle, objectifs visés
3. **Périmètre du projet** : Inclusions et exclusions, modules concernés
4. **Exigences fonctionnelles** : User stories, cas d'utilisation, workflows
5. **Exigences non-fonctionnelles** : Performance, sécurité, accessibilité, compatibilité
6. **Architecture technique** : Stack technologique, intégrations, environnements
7. **Livrables attendus** : Code, documentation, formation, environnements
8. **Calendrier et jalons** : Phases, dates clés, critères de passage
9. **Critères d'acceptation** : Tests, validation, recette
10. **Annexes** : Maquettes, diagrammes, glossaire

## Sections Typiques — Offre de Services

1. **Page de garde** : Titre, client, prestataire, date, validité de l'offre
2. **Présentation de l'entreprise** : Somtech, compétences, références
3. **Compréhension du besoin** : Reformulation du besoin client
4. **Solution proposée** : Approche technique, architecture, choix technologiques
5. **Méthodologie** : Agile/Scrum, phases, livrables par phase
6. **Équipe projet** : Rôles, profils, disponibilité
7. **Calendrier de réalisation** : Planning, jalons, dépendances
8. **Proposition financière** : Estimation, ventilation, conditions de paiement
9. **Conditions générales** : Clauses juridiques, propriété intellectuelle, confidentialité
10. **Annexes** : CV de l'équipe, références clients, certifications

## Règles de Rédaction

- Adopter un ton professionnel et clair
- Utiliser la terminologie du client quand disponible
- Éviter le jargon technique excessif dans les sections destinées aux décideurs
- Être précis et quantifiable dans les engagements (délais, volumes, métriques)
- Inclure des réserves appropriées (hypothèses, dépendances, limites)

## Ressources

- **`references/guide-gabarits.md`** — Guide de bonnes pratiques pour la complétion des gabarits
