---
description: "Compléter une demande d'amélioration sur un module existant"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, TodoWrite
argument-hint: [brief-ou-contrat-cadre.pdf]
---

Compléter une demande d'amélioration (DA) sur un module existant à partir du gabarit Word allégé intégré au plugin.

## Instructions

> ### RÈGLES CARDINALES
> 1. **Gabarit DA** = source de **formatage uniquement** (structure, mise en page, styles)
> 2. **Ce document n'est PAS un cahier des charges** — il est conçu pour des améliorations sur des modules **déjà en production**
> 3. **Contrat cadre signé du client** (détecté dans le workspace) = **SEULE source de vérité** pour le contenu juridique et les conditions contractuelles
> 4. **Gabarit Contrat Cadre V4.0** = **NE PAS LIRE NI UTILISER** dans cette commande

1. **Charger les skills nécessaires** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/SKILL.md` et `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/references/guide-gabarits.md`
   - Charger le skill docx pour les instructions de création/édition de documents Word

2. **Charger le gabarit intégré** :
   Le gabarit officiel est inclus dans le plugin : `${CLAUDE_PLUGIN_ROOT}/templates/Gabarit-Demande-d-amelioration-SomTech.docx`
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

   > **INTERDIT** : NE PAS lire ni utiliser le gabarit template `CONTRAT-CADRE DE SERVICES (CCS) - Somtech inc. V4.0.docx` — ce fichier sert uniquement à la création de nouveaux contrats via `/complete-contrat`.

   **Analyse du contrat cadre du client (si disponible)** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/SKILL.md`
   - Vérifier que les améliorations demandées sont dans le périmètre du contrat cadre signé

4. **Déterminer le mode de travail** : Demander à l'utilisateur s'il souhaite :
   - **Mode interactif** : Répondre aux questions section par section
   - **Mode brief** : Fournir un document ou texte de brief que Claude analysera

5. **Collecter les informations** :
   - En mode interactif : Poser les questions via AskUserQuestion dans cet ordre :
     1. **Identification** : Module concerné, version actuelle, demandeur, priorité
     2. **Contexte** : Description du module existant, problème ou besoin motivant l'amélioration
     3. **Améliorations** : Pour chaque amélioration — titre, description détaillée, justification, type (Fonctionnalité / Comportement / UX / Performance / Intégration)
     4. **Impact** : Modules impactés, risques identifiés
     5. **Critères d'acceptation** : Conditions mesurables pour valider chaque amélioration
   - En mode brief : Analyser le brief fourni, extraire les informations, et ne poser que les questions pour les lacunes identifiées

6. **Générer le document** : Créer la demande d'amélioration .docx en respectant fidèlement la mise en forme du gabarit Somtech.

   **Méthode obligatoire : unpack/edit/repack du gabarit original**
   1. Décompresser le gabarit DA (c'est un zip contenant du XML)
   2. Modifier les fichiers XML pour insérer le contenu
   3. Recompresser en .docx

   > **docx-js** est un dernier recours uniquement si unpack/edit/repack échoue.

   **Checklist de fidélité au formatage :**
   - [ ] Polices, tailles et couleurs identiques au gabarit
   - [ ] En-têtes et pieds de page préservés intégralement
   - [ ] Styles Word utilisés (`Heading1`, `Heading2`) — pas de formatage inline pour les titres
   - [ ] Apostrophes droites `'` (U+0027) — aucun smart quote `'` (U+2019)
   - [ ] Tableaux : en-tête `#1F4E79` blanc gras, alternance `F2F2F2`/`FFFFFF`, largeur en `dxa`

   **CRITIQUE — Apostrophes** :
   Utiliser **exclusivement** l'apostrophe droite `'` (U+0027). NE JAMAIS insérer de smart quotes `'` (U+2019).

   **CRITIQUE — Tableaux** :
   Reproduire fidèlement le format des tableaux du gabarit :
   - Bordures : `single sz=4` sur tous les côtés
   - Largeur : `w:type="dxa"` (PAS `pct`)
   - En-tête : fond `#1F4E79`, texte blanc gras
   - Lignes alternées : `#F2F2F2` / `#FFFFFF`

   **Ajustements dynamiques du document** :
   - Le nombre de lignes dans le tableau des améliorations (Section 2) doit correspondre au nombre réel d'améliorations demandées — ajouter ou retirer des lignes selon le besoin
   - Le nombre de lignes dans le tableau des critères d'acceptation (Section 4) doit correspondre au nombre réel de critères — minimum un critère par amélioration
   - Les numéros de référence (A-01, A-02... et CA-01, CA-02...) doivent être séquentiels et les liens entre critères et améliorations doivent être cohérents

7. **Relecture de nettoyage (OBLIGATOIRE)** : Avant toute livraison, relire intégralement le document généré pour s'assurer qu'il ne reste **aucun résidu provenant des gabarits** :
   - Placeholders non remplacés (`[Nom du module]`, `[Description...]`, etc.)
   - Notes internes ou instructions destinées au rédacteur
   - Texte d'exemple ou contenu générique du gabarit non personnalisé
   - Sections laissées vides

8. **Nommage du fichier** :
   Format : `Demande-d-amelioration-[NomModule]-[AAAA-MM-JJ].docx`
   Exemple : `Demande-d-amelioration-GestionInventaire-2026-04-02.docx`

9. **Présenter le résultat** : Sauvegarder le document complété dans le dossier workspace et fournir un lien au format computer:// à l'utilisateur.

10. **Proposer la suite** : Si pertinent, proposer :
    - De lancer `/verifier-clauses` si un contrat cadre est disponible
    - De créer une estimation d'effort avec `/estimer`

## Contexte

Ce document est une demande d'amélioration pour un module existant dans un projet de développement logiciel sur mesure par Somtech. Contrairement au cahier des charges (qui décrit un nouveau module complet), ce document est plus léger et se concentre sur :
- **Quoi** : Les améliorations précises demandées
- **Pourquoi** : La justification de chaque amélioration
- **Impact** : Les effets sur le système existant
- **Validation** : Les critères mesurables d'acceptation

Il ne couvre PAS les corrections de bogues (qui ont leur propre processus).
