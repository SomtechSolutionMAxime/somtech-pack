---
description: Compléter un contrat cadre de services (CCS) à partir du gabarit Somtech
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, TodoWrite
argument-hint: [nom-du-client]
---

Compléter un contrat cadre de services (CCS) à partir du gabarit Word intégré au plugin, en récupérant les informations du client via le MCP orbit-entreprise.

## Instructions

1. **Charger les skills nécessaires** :
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/completion-documents/SKILL.md`
   - Lire `${CLAUDE_PLUGIN_ROOT}/skills/analyse-juridique/SKILL.md` (pour la taxonomie des clauses)
   - Charger le skill docx pour les instructions de création/édition de documents Word

2. **Charger le gabarit intégré** :
   Le gabarit officiel est inclus dans le plugin : `${CLAUDE_PLUGIN_ROOT}/templates/CONTRAT-CADRE DE SERVICES (CCS) - Somtech inc. V4.0.docx`
   - Lire et analyser sa structure (sections, placeholders, mise en forme)
   - Identifier tous les champs à compléter :
     - `[NOM DU CLIENT]` — Nom légal de l'entreprise cliente
     - `[ADRESSE]` — Adresse du siège social du client
     - `[NOM REPRÉSENTANT]` — Nom du signataire autorisé côté client
     - `[TITRE]` — Titre du signataire
     - `[MONTANT À PRÉCISER]` — Montant de l'assurance responsabilité professionnelle (clause 20.4)
     - Ville et date de signature (section Acceptation)

3. **Récupérer les informations du client via MCP orbit-entreprise** :
   Si l'utilisateur fournit un nom de client en argument ($ARGUMENTS) :
   - Utiliser `app_contacts_list` avec le paramètre `q` pour rechercher le client par nom
   - Si un contact est trouvé, utiliser `app_contact_get` pour récupérer les détails complets :
     - `nom` → `[NOM DU CLIENT]` et `[NOM REPRÉSENTANT]`
     - `email` → pour référence
     - `telephone` → pour référence
     - `entreprise_id` → pour récupérer les infos de l'entreprise si disponible
   - Si aucun contact trouvé, informer l'utilisateur et demander les informations manuellement

   Si l'utilisateur ne fournit pas de nom :
   - Demander le nom du client via AskUserQuestion
   - Tenter la recherche MCP avant de demander les infos manuellement

4. **Collecter les informations manquantes** :
   Pour chaque placeholder non résolu par le MCP, demander à l'utilisateur via AskUserQuestion :
   - Nom légal complet de l'entreprise cliente
   - Adresse du siège social
   - Nom et titre du signataire autorisé
   - Montant de l'assurance responsabilité professionnelle (clause 20.4)
   - Ville de signature

5. **Vérifier la cohérence** :
   Avant de générer le document final :
   - Valider que toutes les mentions de `[NOM DU CLIENT]` et `[Nom du Client]` seront remplacées de manière cohérente
   - S'assurer que l'adresse est complète (numéro, rue, ville, province, code postal)
   - Vérifier que le montant d'assurance est raisonnable et bien formaté

6. **Générer le document** :
   - Créer le contrat cadre .docx en respectant fidèlement la mise en forme du gabarit Somtech
   - Utiliser le skill docx (unpack/edit/repack du gabarit original) pour remplacer les placeholders
   - **IMPORTANT** : Remplacer TOUTES les occurrences des placeholders dans le document, y compris :
     - Les variantes : `[NOM DU CLIENT]`, `[Nom du Client]`, `[NOM REPRÉSENTANT]`, `[TITRE]`, `[ADRESSE]`
     - Les mentions dans la section Acceptation (signatures)
   - Ne PAS modifier le contenu des clauses — uniquement les placeholders

   **CRITIQUE — Préservation des espaces dans les en-têtes et pieds de page** :
   - Lors du unpack/edit/repack, les fichiers `word/header*.xml` et `word/footer*.xml` contiennent souvent des `<w:t>` fragmentés avec l'attribut `xml:space="preserve"`
   - **NE JAMAIS** fusionner ou réassembler les éléments `<w:t>` dans les headers/footers — les espaces entre les runs (`<w:r>`) sont significatifs
   - **NE JAMAIS** supprimer `xml:space="preserve"` des éléments `<w:t>`
   - Si tu utilises docx-js (ou un outil qui regénère le XML), vérifier explicitement que :
     - Les espaces entre les mots dans les en-têtes et pieds de page sont préservés
     - Chaque `<w:t>` qui contient un espace en début ou fin a bien `xml:space="preserve"`
   - **Vérification obligatoire** : Après génération, extraire le texte des headers/footers du document produit et comparer avec le gabarit original pour détecter tout mot collé

   **CRITIQUE — Énumérations autonomes par section** :
   Dans le XML Word (.docx), les listes numérotées utilisent des `<w:numId>` définis dans `word/numbering.xml`. Chaque liste d'une section doit être **autonome** et ne PAS continuer la numérotation d'une liste précédente.
   - Chaque énumération (ex: sous-points de 6.1, sous-points de 8, etc.) doit avoir son propre `<w:abstractNum>` ou au minimum un `<w:num>` distinct avec `<w:lvlOverride>` et `<w:startOverride w:val="1"/>` pour redémarrer à 1
   - **NE JAMAIS** réutiliser le même `<w:numId>` pour des listes appartenant à des sections/clauses différentes — sinon la numérotation continue au lieu de recommencer
   - Si tu utilises docx-js : chaque appel à une liste numérotée dans une nouvelle section doit créer une nouvelle instance de numérotation (`reference: "..."` avec un restart)
   - Si tu fais du unpack/edit/repack : vérifier dans `word/numbering.xml` que chaque liste de chaque clause a bien un `<w:num>` séparé
   - **Vérification obligatoire** : Après génération, vérifier que les énumérations de chaque clause recommencent à 1 (ou a, b, c) et ne poursuivent pas la numérotation d'une clause précédente

7. **Nommer le fichier de sortie** :
   Format : `CONTRAT-CADRE_ET_OFFRE_DE_SERVICES_(CCS)_[NomClient].docx`
   Ou le nouveau format : `CONTRAT_CADRE_[NomClient].docx`
   Demander à l'utilisateur sa préférence de nommage.

8. **Livrer** :
   Sauvegarder le document complété dans le dossier workspace et fournir un lien au format computer:// à l'utilisateur.

## Contexte

Ce document est le contrat cadre de services (CCS) entre Somtech inc. et un client. C'est le document fondateur de la relation contractuelle — il établit les conditions générales qui s'appliquent à tous les mandats subséquents (cahiers des charges et offres de services). Il contient 21 clauses couvrant : services, propriété intellectuelle, hébergement, réversibilité, responsabilité, confidentialité, paiement, ainsi que les annexes SLA et politique de sécurité. Seuls les placeholders doivent être complétés — les clauses ne doivent PAS être modifiées.
