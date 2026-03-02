# Règles d'audit — Frontend (React/TypeScript)

> Références : Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1)

## Vérifications à effectuer

### 1. Affichage de PII sans masquage (art. 10, 20)

Art. 10 : L'entreprise doit prendre les mesures de sécurité propres à assurer la protection des renseignements personnels. Art. 20 : Seules les personnes ayant « qualité pour connaître » les renseignements peuvent y accéder.

Scanner les fichiers `.tsx` et `.ts` dans `app/src/` pour détecter l'affichage de champs PII sans masquage.

**Patterns à détecter :**

```typescript
// Affichage direct de téléphone
{employee.phone}
{profile.phone}
{data.emergency_contact_phone}

// Affichage direct d'adresse
{employee.address}
{profile.city}, {profile.postal_code}

// Affichage direct de date de naissance
{employee.birth_date}
{profile.birth_year}

// Affichage direct d'email personnel
{employee.personal_email}
```

**Masquage attendu :**

```typescript
// Téléphone → 514-***-1234
const maskPhone = (phone: string) => phone.replace(/(\d{3})\d{3}(\d{4})/, '$1-***-$2');

// Email → j***@gmail.com
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
};

// Adresse → Ville seulement
const maskAddress = (address: string, city: string) => city;

// Date de naissance → Année seulement ou âge
const maskBirthDate = (date: string) => new Date(date).getFullYear().toString();
```

### 2. PII dans le stockage local (art. 10)

Art. 10 exige des mesures de sécurité proportionnelles. Le stockage côté client (localStorage, sessionStorage) n'offre aucune protection d'accès et est accessible à tout script sur la page, incluant des scripts tiers malveillants.

Scanner pour :

```typescript
// INTERDIT : PII dans localStorage
localStorage.setItem('profile', JSON.stringify({ phone, address, ... }))
localStorage.setItem('user', ...) // si contient des PII

// INTERDIT : PII dans sessionStorage
sessionStorage.setItem(...)

// INTERDIT : PII dans les cookies côté client
document.cookie = `userPhone=${phone}`
```

**Constat si trouvé :** MAJEUR — Des renseignements personnels sont stockés dans le navigateur sans chiffrement, contrevenant aux mesures de sécurité de l'art. 10

### 3. PII dans les URL / query params (art. 10)

Les PII dans les URL sont exposées dans l'historique du navigateur, les logs serveur, les headers Referer et potentiellement dans les services d'analytique — ce qui constitue une communication non autorisée (art. 10, 18).

Scanner pour :

```typescript
// INTERDIT
navigate(`/profile?email=${email}`)
window.location.href = `...?phone=${phone}`
new URLSearchParams({ email, phone })
fetch(`/api/user?email=${email}`)
```

**Constat si trouvé :** MAJEUR — Des PII sont exposées dans les URL, risquant une communication non autorisée (art. 10, 18)

### 4. PII dans les logs frontend (art. 10)

Scanner pour :

```typescript
// INTERDIT
console.log(userData)
console.log('Profile:', { name, email, phone })
console.error('Failed for user:', email)
```

**Constat si trouvé :** MODÉRÉ — Des PII peuvent se retrouver dans la console du navigateur (art. 10)

### 5. Confidentialité par défaut (art. 9.1)

Art. 9.1 : Les paramètres d'un produit ou service technologique offert au public doivent, par défaut, assurer le plus haut niveau de confidentialité, sans aucune intervention de la personne concernée.

Vérifier :
- Les paramètres de partage/visibilité de profil sont désactivés par défaut
- Les fonctions de type « répertoire d'employés » ne sont pas opt-out (doivent être opt-in)
- Les formulaires ne pré-cochent pas le consentement au partage

**Patterns à détecter :**

```typescript
// RISQUE (art. 9.1): Partage activé par défaut
const defaultSettings = { shareProfile: true, publicDirectory: true };
const [shareData, setShareData] = useState(true); // devrait être false

// RISQUE (art. 9.1): Case de consentement pré-cochée
<input type="checkbox" checked={true} /> J'accepte que mes données soient partagées

// ATTENDU: Confidentialité par défaut
const defaultSettings = { shareProfile: false, publicDirectory: false };
```

**Constat si trouvé :** MAJEUR — Le principe de confidentialité par défaut (art. 9.1) n'est pas respecté

### 6. Décisions automatisées (art. 12.1)

Art. 12.1 : Lorsqu'un renseignement personnel est utilisé pour rendre une décision fondée exclusivement sur un traitement automatisé, l'entreprise doit informer la personne et lui offrir un recours humain.

Vérifier si le projet contient un chatbot, une IA, ou tout traitement automatisé qui prend des décisions :
- Approbation/refus de congés automatisé
- Recommandations de paie ou d'évaluation
- Assignation automatique de tâches basée sur le profil

**Patterns à détecter :**

```typescript
// RISQUE (art. 12.1): Décision automatisée sans transparence
if (aiRecommendation.action === 'approve') { autoApprove(request); }
chatbot.executeAction('deny_leave', { reason: aiReason });

// ATTENDU: Information + recours humain
<Alert>Cette recommandation a été générée automatiquement.
  Vous pouvez demander une révision par un gestionnaire.</Alert>
```

**Constat si trouvé :** MAJEUR — Des décisions automatisées sont prises sans informer la personne ni offrir de recours humain (art. 12.1)

### 7. Contrôle d'accès UI (art. 20)

Art. 20 : Seules les personnes ayant « qualité pour connaître » les renseignements personnels y ont accès.

Vérifier que les composants affichant des PII de Catégorie 1 :
- Vérifient le rôle/niveau d'accès AVANT le rendu
- Affichent un message « Accès restreint » plutôt que de masquer silencieusement
- Ne font pas de requête API pour les données sensibles si l'utilisateur n'a pas le droit

**Pattern attendu :**

```typescript
// BON : Vérification avant affichage
if (accessLevel >= ACCESS_LEVELS.HR) {
  return <SensitiveDataPanel data={sensitiveData} />;
}
return <AccessRestricted message="Données réservées aux RH" />;

// MAUVAIS : Données chargées puis cachées
const { data } = useQuery('sensitive-data'); // ← données déjà chargées !
if (!hasAccess) return null; // ← trop tard, les données sont en mémoire
```

### 8. Requêtes Supabase avec select('*') (art. 4, 20)

Art. 4 : La collecte se limite à ce qui est nécessaire. Art. 20 : Accès réservé à ceux qui ont « qualité pour connaître ».

Scanner pour :

```typescript
// RISQUE : Charge tous les champs incluant les PII
.from('employees').select('*')
.from('users').select('*')

// ATTENDU : Select explicite des champs nécessaires
.from('employees').select('id, first_name, last_name, position, department')
```

**Constat si trouvé :** MODÉRÉ — `select('*')` sur des tables PII charge des données non nécessaires (art. 4)

## Composants à vérifier en priorité

Dans un projet typique Somtech, vérifier en priorité :
- Profil employé (`EmployeeProfile`, `ProfilePage`)
- Liste d'équipe (`TeamMembers`, `TeamList`)
- Formulaires RH (`EmployeeForm`, `ProfileEdit`)
- Panneau d'admin (`AdminPanel`, `UserManagement`)
- Chat/Chatbot (si le chat renvoie des données employé — vérifier aussi art. 12.1)
- Paramètres utilisateur (`Settings`, `Preferences` — vérifier art. 9.1)
