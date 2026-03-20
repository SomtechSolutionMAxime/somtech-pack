# Guide de Bonnes Pratiques — Complétion de Gabarits

## Principes Généraux

### Fidélité au Gabarit
- Toujours préserver la structure et la mise en forme du gabarit original
- Ne pas ajouter ou supprimer de sections sans confirmation de l'utilisateur
- Respecter les polices, tailles et styles définis dans le gabarit
- Conserver les en-têtes, pieds de page, logos et éléments visuels existants

### Distinction Gabarits vs Contrat Client

Il existe trois types de documents dans le plugin — chacun a un rôle distinct :

| Document | Rôle | Usage autorisé |
|----------|------|----------------|
| **Gabarit Offre V2.0 / Gabarit CDC** | Formatage et structure | Base de mise en page pour `/complete-offre` et `/complete-cahier` |
| **Gabarit Contrat Cadre V4.0** | Création de nouveaux contrats | Exclusivement `/complete-contrat` |
| **Contrat cadre signé du client** | Vérité juridique | Toute référence contractuelle dans offres et CDC |

> **INTERDIT** : Lors de `/complete-offre` ou `/complete-cahier`, ne jamais lire ni utiliser le gabarit V4.0 comme source de contenu juridique. Le contrat signé du client est la seule référence.

### Qualité du Contenu
- Chaque section doit être complète et auto-suffisante
- Éviter les phrases vagues comme "selon les besoins" — être spécifique
- Quantifier les engagements quand c'est possible (dates, volumes, métriques)
- Inclure les hypothèses et limites de façon transparente

## Workflow de Complétion

### 1. Analyse Initiale du Gabarit

Avant de poser des questions, analyser le gabarit pour comprendre :
- Le nombre et la nature des sections à remplir
- Les champs pré-remplis vs. à compléter
- Le niveau de détail attendu par section
- Les éventuels tableaux ou matrices à remplir

### 2. Collecte Efficace d'Informations

**Regrouper les questions par thème :**
- Informations générales (client, projet, dates) — 1 série de questions
- Exigences fonctionnelles — 1 série de questions
- Aspects techniques — 1 série de questions
- Conditions commerciales — 1 série de questions

**Maximiser l'information extraite :**
- Si l'utilisateur fournit un brief, extraire un maximum d'informations avant de poser des questions
- Ne demander que ce qui manque réellement
- Proposer des suggestions basées sur le contexte plutôt que des questions ouvertes

### 3. Génération du Document

**Approche technique (ordre de priorité) :**
1. **unpack/edit/repack** (méthode privilégiée) — Décompresser le gabarit .docx, modifier le XML, recompresser. Préserve fidèlement toute la mise en forme.
2. **docx-js** (dernier recours) — Uniquement si unpack/edit/repack échoue. Ne garantit pas la fidélité au formatage.

**Règles de formatage XML obligatoires :**
- **Apostrophes** : Utiliser exclusivement `'` (U+0027). Ne jamais insérer de smart quotes `'` (U+2019) — elles causent des `&#x2019;` dans le XML et des problèmes d'affichage.
- **Styles Word** : Toujours utiliser les styles définis dans le gabarit (`Heading1`, `Heading2`, `ListParagraph`) via `<w:pStyle>`. Ne jamais simuler un titre avec du formatage inline (bold + taille + couleur) — les titres apparaîtront "flous" sans les espacements et propriétés du style.
- **Tableaux** : Reproduire les propriétés exactes du gabarit :
  - Bordures explicites dans `<w:tblBorders>` (`single sz=4 color=auto`)
  - Largeur fixe en `dxa` (ex: `9360`), pas en `pct`
  - Alternance de couleurs : en-tête `#1F4E79` (bleu, texte blanc gras), lignes impaires `#F2F2F2`, lignes paires `#FFFFFF`

**Contenu :**
- Adapter le niveau de langage à l'audience du document
- Pour le CDC : langage clair, accessible aux parties prenantes non-techniques
- Pour l'offre de services : langage commercial professionnel avec juste assez de technique

### 4. Points d'Attention par Type de Document

#### Cahier des Charges
- Les exigences doivent être testables et vérifiables
- Séparer clairement le "quoi" (exigences) du "comment" (solution)
- Inclure des critères d'acceptation mesurables
- Lister explicitement ce qui est hors périmètre

#### Offre de Services
- La compréhension du besoin doit montrer qu'on a bien compris le client
- La solution proposée doit répondre point par point aux exigences du CDC
- Le calendrier doit être réaliste avec des marges raisonnables
- La proposition financière doit être claire et détaillée
- Les clauses juridiques doivent être alignées avec le contrat cadre **signé du client** (pas le gabarit V4.0)

## Erreurs Courantes à Éviter

1. **Copier-coller générique** : Chaque document doit être adapté au contexte du client
2. **Engagements flous** : "Livraison rapide" → "Livraison sous 6 semaines ouvrables"
3. **Incohérence interne** : Le calendrier ne correspond pas à l'effort estimé
4. **Oubli de contexte client** : Ne pas adapter la terminologie au domaine du client
5. **Sections vides** : Toujours remplir ou indiquer explicitement "non applicable"
6. **Divergence avec le contrat cadre** : Toujours vérifier la cohérence si un contrat cadre existe
7. **Utiliser le gabarit V4.0 comme source juridique** : Le gabarit V4.0 sert uniquement à créer de nouveaux contrats (`/complete-contrat`). Pour les offres et CDC, seul le contrat cadre signé du client fait foi — ses conditions peuvent différer du V4.0
8. **Smart quotes au lieu d'apostrophes droites** : Utiliser `'` (U+2019) au lieu de `'` (U+0027) cause des `&#x2019;` dans le XML et des caractères manquants ou cassés à l'affichage
9. **Titres sans style Word** : Simuler des titres avec du formatage inline (bold + taille + couleur) au lieu d'utiliser `Heading1`/`Heading2` produit des titres incohérents avec des espacements incorrects
10. **Tableaux sans bordures ni alternance** : Oublier les bordures `<w:tblBorders>` et l'alternance de couleurs `F2F2F2`/`FFFFFF` rend les tableaux difficiles à lire et non professionnels
