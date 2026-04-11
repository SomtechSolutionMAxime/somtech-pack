# RAG Service — Quand l'utiliser

Le RAG Service est puissant mais pas adapté à tous les besoins. Ce document aide à choisir le bon outil.

## Matrice de décision

| Besoin | Outil recommandé |
|--------|------------------|
| Réponses sourcées sur base documentaire du client | **RAG Service** |
| Q&A conversationnel sur politiques, contrats, procédures | **RAG Service** |
| Recherche sémantique floue dans des docs | **RAG Service** |
| Résumé ou synthèse d'un corpus | **RAG Service** (top-k + génération) |
| Recherche d'un fichier par nom exact | Somcraft (liste de fichiers) |
| Lister les fichiers d'un dossier | Somcraft |
| Télécharger un PDF original | Supabase Storage + signed URL |
| Données transactionnelles (users, factures, tickets) | DB directe (Supabase REST/SQL) |
| Chat général sans base documentaire spécifique | Claude direct, pas RAG |
| Recherche floue dans du code source | Grep ou recherche IDE |
| Analyse de code | Claude direct avec Read tool |

## Cas d'usage idéaux pour le RAG

Le RAG excelle quand ces conditions sont réunies :

1. **Corpus stable** — Les documents changent peu (politiques RH, contrats types, procédures)
2. **Besoin de citations** — L'utilisateur veut savoir d'où vient la réponse
3. **Vocabulaire spécialisé** — Jargon métier où les synonymes aident
4. **Volume moyen** — 10 à 1000 documents par client (pas 10M, pas 2)
5. **Recherche sémantique** — Les utilisateurs cherchent par concept, pas par mot exact

**Exemples concrets :**

- "Quelle est la politique de remboursement kilométrique ?"
- "Comment gérer un retour de congé de maternité ?"
- "Quels sont les EPI obligatoires sur un chantier en hauteur ?"
- "Que dit le contrat cadre sur les délais de paiement ?"

## Cas où le RAG est NOT appropriate

### Données transactionnelles

Le RAG ne remplace pas une base de données. Pour :
- Lister les factures du mois
- Combien d'employés sont actifs
- Quels projets sont en cours

→ Utiliser directement la DB via Supabase.

### Recherche exacte

Si l'utilisateur cherche exactement "facture #A-2345", pas besoin de similarité sémantique — utiliser un `WHERE id = '#A-2345'` direct.

### Données fraîches

Le RAG indexe ce qu'on lui pousse. Si la réponse dépend de données qui changent en temps réel (stock, prix, dispo), passer par la DB.

### Petits volumes

Si le client a 2-3 documents, c'est souvent plus simple de passer le contenu complet à Claude en contexte, sans RAG. Le RAG amortit son coût à partir de ~10 documents.

### Chat général

Pour une conversation ouverte sans base documentaire spécifique, utiliser Claude direct. Le RAG n'apporte rien et peut même confuser la réponse avec des chunks hors-sujet.

## Règles de combinaison

Le RAG se combine bien avec d'autres sources :

### RAG + DB transactionnelle

Exemple : "Quel est le délai de paiement pour la facture #1234 ?"

1. DB : récupérer les infos de la facture #1234 (client, montant, date)
2. RAG : chercher "délai de paiement" dans les contrats du client
3. Claude : combiner les deux pour répondre

### RAG + recherche de fichiers

Exemple : "Trouve le document qui parle de X et donne-moi le lien original"

1. RAG : chercher X, récupérer les chunks pertinents
2. Extraire les `document_id` et `signed_url`
3. Retourner le lien vers le PDF original

### RAG + ontologie métier

Phase 2 du RAG : table `ontology_concepts` qui enrichit les synonymes et les relations entre concepts. Permet des recherches croisées multi-domaines.

## Red flags — Quand s'arrêter et réfléchir

- ❌ **"Le RAG devrait connaître l'info, pourquoi il ne trouve pas ?"** → Vérifier que le doc est bien indexé, pas assumer.
- ❌ **"Indexons toute la DB dans le RAG"** → Non. Le RAG est pour des documents narratifs, pas des données tabulaires.
- ❌ **"Le RAG peut remplacer Google"** → Non, le RAG est ciblé sur un corpus spécifique.
- ❌ **"On peut mettre 10 000 chunks dans le contexte Claude"** → Non, le RAG retourne top-k (10 par défaut), pas tout.
- ❌ **"Le seuil est trop haut, mettons-le à 0.3"** → Non, en dessous de 0.75 les résultats sont bruités. Ajuster plutôt la query ou les synonymes.

## Quand investir dans l'ontologie (Phase 2)

L'ontologie (table `ontology_concepts`) devient utile quand :

- Le client a 100+ documents
- Il y a des relations complexes entre concepts (acteur → processus → document → réglementation)
- Les utilisateurs posent des questions transverses ("Qui est responsable de X selon le contrat Y ?")
- Les synonymes flat ne suffisent plus

Avant 100 docs, le dictionnaire flat de synonymes suffit largement.
