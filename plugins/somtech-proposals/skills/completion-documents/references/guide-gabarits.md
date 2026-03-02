# Guide de Bonnes Pratiques — Complétion de Gabarits

## Principes Généraux

### Fidélité au Gabarit
- Toujours préserver la structure et la mise en forme du gabarit original
- Ne pas ajouter ou supprimer de sections sans confirmation de l'utilisateur
- Respecter les polices, tailles et styles définis dans le gabarit
- Conserver les en-têtes, pieds de page, logos et éléments visuels existants

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

**Approche technique :**
- Utiliser le skill docx pour créer le document Word
- Si le gabarit est simple, utiliser docx-js pour générer from scratch
- Si le gabarit est complexe (mise en forme élaborée), envisager unpack/edit/repack

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
- Les clauses juridiques doivent être cohérentes avec le contrat cadre

## Erreurs Courantes à Éviter

1. **Copier-coller générique** : Chaque document doit être adapté au contexte du client
2. **Engagements flous** : "Livraison rapide" → "Livraison sous 6 semaines ouvrables"
3. **Incohérence interne** : Le calendrier ne correspond pas à l'effort estimé
4. **Oubli de contexte client** : Ne pas adapter la terminologie au domaine du client
5. **Sections vides** : Toujours remplir ou indiquer explicitement "non applicable"
6. **Divergence avec le contrat cadre** : Toujours vérifier la cohérence si un contrat cadre existe
