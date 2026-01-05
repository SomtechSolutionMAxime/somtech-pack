# Skill : Configure MCP Server

Ce skill permet de configurer un serveur MCP (Model Context Protocol) dans Cursor.

## Description

Le skill `configure-mcp-server` guide la configuration d'un serveur MCP dans Cursor pour permettre à l'agent d'accéder à des outils et ressources externes. Il supporte plusieurs types de serveurs MCP :
- Supabase Edge Functions ⭐ (méthode principale recommandée)
- n8n MCP
- Serveurs locaux via npx (développement)
- Railway MCP (optionnel, si votre projet utilise Railway)

## Structure

```
configure-mcp-server/
├── SKILL.md                    # Instructions principales du skill
├── README.md                   # Ce fichier
├── references/                # Documentation de référence
│   ├── SERVEURS_MCP.md        # Template pour documenter vos serveurs MCP
│   └── TYPES_CONFIGURATION.md # Types de configuration supportés
└── scripts/                   # Scripts utilitaires
    └── validate-mcp-config.sh # Script de validation du fichier mcp.json
```

## Utilisation

### Pour l'agent

L'agent peut utiliser ce skill automatiquement lorsqu'il détecte une demande de configuration MCP. Le skill fournit :
- Instructions détaillées pour chaque type de serveur
- Exemples de configuration
- Guide de dépannage
- Template de documentation des serveurs MCP (à adapter)

### Pour l'utilisateur

Pour utiliser ce skill manuellement :
1. Demander à l'agent de configurer un serveur MCP spécifique
2. L'agent utilisera ce skill pour générer la configuration appropriée
3. Suivre les instructions pour redémarrer Cursor et vérifier la configuration

## Validation

Utiliser le script de validation pour vérifier la configuration :

```bash
.cursor/skills/configure-mcp-server/scripts/validate-mcp-config.sh
```

Ou avec un chemin personnalisé :

```bash
.cursor/skills/configure-mcp-server/scripts/validate-mcp-config.sh ~/.cursor/mcp.json
```

## Références

- [Documentation MCP officielle](https://modelcontextprotocol.io)
- [Documentation Cursor Skills](https://cursor.com/docs/context/skills)
- [Documentation Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- Documentation projet : `docs/mcp/CURSOR_MCP_CONFIG.md`

## Auteur

somtech-pack

## Version

1.2.0
