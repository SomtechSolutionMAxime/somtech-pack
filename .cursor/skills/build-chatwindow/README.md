# Skill : Build ChatWindow

Ce skill guide la construction de chatwindows avec widgets interactifs ChatWidget. Cette architecture est réutilisable dans tout projet utilisant Supabase, React et des workflows (OpenAI Agent Builder / n8n).

## Description

Le skill `build-chatwindow` guide la création et l'intégration de widgets ChatWidget dans les conversations ChatWindow. Il couvre :
- La création de widgets selon le contrat ChatWidget
- Les types de widgets supportés et leur structure
- L'intégration dans les workflows (OpenAI Agent Builder / n8n)
- La validation via le Playground et ChatWindow
- Les bonnes pratiques et conventions

## Structure

```
build-chatwindow/
├── SKILL.md                    # Instructions principales du skill
├── README.md                   # Ce fichier
├── references/                # Documentation de référence
│   ├── WIDGET_EXAMPLES.md     # Exemples de widgets copiables
│   └── WORKFLOW_INTEGRATION.md # Intégration dans les workflows
└── assets/                     # Ressources optionnelles
```

## Utilisation

### Pour l'agent

L'agent peut utiliser ce skill automatiquement lorsqu'il détecte une demande de création ou modification de widgets ChatWidget. Le skill fournit :
- Instructions détaillées pour chaque type de widget
- Exemples copiables
- Guide d'intégration dans les workflows
- Checklist de validation

### Pour l'utilisateur

Pour utiliser ce skill manuellement :
1. Demander à l'agent de créer un widget spécifique
2. L'agent utilisera ce skill pour générer le widget selon le contrat
3. Tester dans le Playground (`/admin/widget-playground`)
4. Intégrer dans le workflow (OpenAI Agent Builder / n8n)
5. Valider dans ChatWindow (bulle de test)

## Types de widgets supportés

- **`button`** : Actions rapides sans saisie
- **`form`** : Formulaire avec champs multiples
- **`select`** : Choix unique (liste déroulante)
- **`checkbox`** : Choix multiples
- **`radio`** : Choix unique (boutons radio)
- **`summary_confirm`** : Résumé et confirmation

⚠️ **Note** : `input` existe dans les types mais n'est pas rendu actuellement.

## Processus de validation

### 1. Playground (obligatoire)

- Accéder à `/admin/widget-playground`
- Copier le JSON du widget
- Vérifier le rendu
- Tester les actions
- Confirmer **0 erreur console**

### 2. ChatWindow (obligatoire)

- Utiliser la bulle de test (`ChatWindowWidget`)
- Sélectionner un workflow actif
- Envoyer un message qui déclenche le widget
- Vérifier le rendu et les interactions
- Confirmer **0 erreur console**

## Sources de vérité (structure type)

Dans un projet utilisant cette architecture, vous devriez avoir :

- **Contrat widgets** : Documentation du format ChatWidget (ex: `agentbuilder/WIDGETS_CONTRACT.md` ou équivalent)
- **Types TS** : Types TypeScript pour ChatWidget (ex: `src/types/chat.ts` ou équivalent)
- **Renderer** : Composant qui rend les widgets (ex: `src/components/chat/ChatWidget.tsx`)
- **Playground** : Page de test/prévisualisation (ex: `src/pages/WidgetPlayground.tsx`)
- **Documentation** : Documentation du projet (ex: `docs/chatbot/` ou équivalent)

> **Note** : Ces chemins sont des exemples. Adaptez-les selon la structure de votre projet.

## Références

### Documentation générique

- Ce skill fournit toutes les informations nécessaires pour créer des widgets ChatWidget
- Les exemples dans `references/WIDGET_EXAMPLES.md` sont réutilisables tels quels
- Le guide d'intégration dans `references/WORKFLOW_INTEGRATION.md` est applicable à tout projet

### Documentation spécifique (optionnelle)

Si vous adaptez ce skill depuis un projet existant, vous pouvez référencer votre documentation locale :
- Documentation ChatWindow : `docs/chatbot/README.md` (si présente)
- Contrat Widgets : `agentbuilder/WIDGETS_CONTRACT.md` (si présent)
- Architecture : `docs/chatbot/01-architecture.md` (si présent)

## Auteur

somtech-pack

## Version

1.0.0
