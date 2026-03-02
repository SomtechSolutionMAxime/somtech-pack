# Règles d'audit — API, Backend et Logs

> Références : Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1)

## Vérifications à effectuer

### 1. Exposition de PII dans les API (art. 4, 10, 20)

Art. 4 : La collecte doit se limiter à ce qui est nécessaire à l'objet du dossier. Art. 20 : Seules les personnes ayant « qualité pour connaître » les renseignements y ont accès.

Scanner les fichiers de service/API (`chat-service/`, `api/`, `functions/`) pour :

**Endpoints retournant des PII :**
```typescript
// Vérifier les .select() dans les api-client, hooks, services
.from('employees').select('..., phone, address, birth_date, ...')

// Vérifier les fonctions RPC exposant des PII
supabase.rpc('get_employee_details', ...)
```

**Règles :**
- Les endpoints publics ne doivent JAMAIS retourner de PII de Catégorie 1
- Les endpoints authentifiés doivent retourner seulement les champs nécessaires (art. 4)
- Les PII de Catégorie 1 nécessitent une vérification de rôle supplémentaire côté serveur (art. 20)

### 2. PII dans les logs serveur (art. 10)

Art. 10 : L'entreprise doit prendre les mesures de sécurité propres à assurer la protection des renseignements personnels. La présence de PII dans des logs constitue un risque de communication non autorisée (art. 18) et un défaut de mesure de sécurité.

Scanner les fichiers backend pour :

```typescript
// INTERDIT : PII dans les logs
logger.info({ email, phone, address }, 'User updated')
logger.error(`Failed for ${userName} (${email})`)
console.log('Processing user:', userData)

// ACCEPTABLE : Identifiant anonymisé
logger.info({ userId: user.id }, 'User updated')
logger.error({ userId, errorCode }, 'Profile update failed')
```

**Fichiers à vérifier :**
- `chat-service/src/utils/logger.ts` — Configuration du logger
- `chat-service/src/actions/*.ts` — Handlers d'actions
- `chat-service/src/llm/*.ts` — Interactions LLM
- `app/src/lib/*.ts` — Bibliothèques utilitaires
- Tout fichier Edge Function dans `supabase/functions/`

### 3. PII envoyées au LLM (art. 10, 17, 18.3)

Art. 10 : Mesures de sécurité. Art. 17 : Transfert hors Québec requiert EFVP et protection équivalente. Art. 18.3 : Le mandataire ne peut utiliser les renseignements que pour les fins prévues au contrat.

Si le projet utilise un chatbot ou une intégration LLM :

```typescript
// RISQUE : Envoi de PII au LLM
const prompt = `L'employé ${name} (${email}, tel: ${phone}) demande...`

// ATTENDU : Identifiants anonymisés
const prompt = `L'employé (ID: ${userId}) demande...`
```

**Règles spécifiques LLM :**
- Ne JAMAIS envoyer de PII de Catégorie 1 dans un prompt (art. 12 al. 2 — données sensibles)
- Limiter les PII de Catégorie 2 au strict nécessaire (art. 4 — nécessité)
- Utiliser des identifiants anonymisés quand possible
- Documenter quelles données transitent par le LLM (nécessaire pour l'EFVP, art. 3.3)
- Vérifier que le contrat avec le fournisseur LLM couvre l'art. 18.3 (mandataire)

**Constat si trouvé :** MAJEUR — Des renseignements personnels sont transmis à un service tiers (API LLM) potentiellement hors Québec (art. 17), sans vérification de la nécessité (art. 4)

### 4. Décisions automatisées par le chatbot (art. 12.1)

Art. 12.1 : Toute décision fondée exclusivement sur un traitement automatisé de renseignements personnels requiert : (1) informer la personne, (2) offrir un recours humain, (3) communiquer les raisons et facteurs principaux sur demande.

Vérifier dans le chat-service :
- Si des actions automatisées sont exécutées (approbation de congés, évaluations, assignations)
- Si le chatbot informe l'utilisateur du caractère automatisé de la décision
- Si un mécanisme de révision humaine est disponible

```typescript
// RISQUE (art. 12.1): Action automatisée sans transparence
executor.handle('approve_leave', { autoApprove: true });

// ATTENDU: Information + recours
return {
  message: "Votre demande a été traitée automatiquement.",
  disclaimer: "Cette décision peut être révisée par votre gestionnaire.",
  reviewUrl: "/demandes/revision"
};
```

### 5. Tokens et authentification (art. 10)

Art. 10 exige des mesures de sécurité proportionnelles.

Vérifier :
- Les tokens JWT ne contiennent pas de PII supplémentaires (au-delà du sub/user_id)
- Les service role keys ne sont pas exposées côté client
- Le pattern token passthrough est utilisé (pas de service account qui bypasse RLS)

```typescript
// RISQUE : Token avec PII
jwt.sign({ userId, email, phone, role })

// ATTENDU : Token minimal
jwt.sign({ sub: userId, role })
```

### 6. Transfert de données hors Québec (art. 17)

Art. 17 al. 1 : Avant de communiquer un renseignement personnel à l'extérieur du Québec, l'entreprise doit s'assurer que le renseignement bénéficiera d'une **protection équivalente** à celle prévue par la loi québécoise.

Art. 17 al. 2 : La communication est subordonnée à la réalisation d'une **EFVP** qui tient compte :
- De la sensibilité du renseignement
- De la finalité de son utilisation
- Des mesures de protection dont il bénéficierait
- Du régime juridique applicable dans l'État concerné

Art. 17 al. 3 : La communication doit faire l'objet d'une **entente écrite** tenant compte des résultats de l'EFVP.

**Services à vérifier :**
| Service | Type de données | Localisation typique | EFVP requise (art. 17) | Entente écrite (art. 17 al. 3) |
|---------|----------------|---------------------|----------------------|-------------------------------|
| Supabase | BD complète | Vérifier la région | Oui si hors QC | Oui |
| Anthropic API | Données de chat | États-Unis | Oui (art. 17) | Oui |
| Netlify | Code + assets | Vérifier | Possiblement | Si PII dans assets |
| Sentry/logging | Logs (vérifier PII) | Vérifier | Si PII dans logs | Si applicable |

### 7. Obligations des mandataires (art. 18.3)

Art. 18.3 : Toute personne à qui des renseignements personnels sont communiqués dans le cadre d'un mandat doit :
- N'utiliser les renseignements **que pour les fins prévues au contrat**
- Ne pas les conserver après l'expiration du contrat
- Prendre les mesures de sécurité nécessaires (art. 10)

Vérifier :
- Existence de contrats écrits avec chaque sous-traitant recevant des PII
- Clauses de limitation d'usage et de destruction des données
- Clause de notification en cas d'incident de confidentialité

### 8. Gestion des incidents de confidentialité (art. 3.5, 3.6, 3.7, 3.8)

Art. 3.6 — **Définition** : Un incident de confidentialité est tout accès non autorisé, toute utilisation non autorisée, toute communication non autorisée, ou toute perte de renseignements personnels.

Art. 3.5 — **Obligations** : Prendre les mesures raisonnables pour diminuer les risques. Si risque sérieux de préjudice, aviser la CAI et les personnes concernées avec diligence.

Art. 3.7 — **Évaluation du risque** : Considérer la sensibilité des renseignements, les conséquences appréhendées de leur utilisation, et la probabilité d'utilisation préjudiciable.

Art. 3.8 — **Registre** : Tenir un registre des incidents qui doit être **communiqué à la CAI sur demande**.

Vérifier la présence de :
- Procédure documentée de notification en cas de fuite de données
- Registre des incidents de confidentialité (conservé et communicable à la CAI)
- Mécanisme de notification à la CAI (Commission d'accès à l'information)
- Notification aux personnes touchées
- Critères d'évaluation du risque de préjudice (art. 3.7)

**Constat si absent :** MAJEUR — Aucune procédure de gestion des incidents de confidentialité (art. 3.5 à 3.8). Sanction administrative possible (art. 90.1 al. 5°).

## Niveaux de sévérité spécifiques API

| Constat | Niveau | Réf. art. |
|---------|--------|-----------|
| PII Cat. 1 dans les logs | CRITIQUE | 10, 12 al. 2 |
| Service role key exposée côté client | CRITIQUE | 10 |
| PII envoyées au LLM sans nécessité | MAJEUR | 4, 10, 17 |
| Pas d'EFVP pour transfert international | MAJEUR | 17 al. 2 |
| Pas de contrat mandataire écrit | MAJEUR | 18.3 |
| Décisions automatisées sans transparence | MAJEUR | 12.1 |
| Pas de procédure d'incident | MAJEUR | 3.5, 3.8 |
| PII Cat. 2 dans les logs | MODÉRÉ | 10 |
| select('*') côté serveur | MODÉRÉ | 4, 20 |
