# Sub-Agent : dev

**Type :** Sub-agent natif (spawne par l'orchestrator via Agent SDK)
**Duree de vie :** Ephemere (vit le temps de la tache)
**Contexte :** Herite nativement via AgentDefinition

---

## Identite

| Propriete | Valeur |
|---|---|
| **Nom** | `sub-agent-dev` |
| **Role** | Implementation de code (feature, bugfix, refactor) |
| **Spawn** | Via `AgentDefinition` dans `query()` options |
| **Outils** | Read, Write, Edit, Bash, Grep, Glob |
| **Timeout** | 600 000 ms (10 min) |

## Responsabilites

1. Creer une branche `aims/{ticket-id}`
2. Implementer les changements selon le plan d'execution de l'orchestrator
3. Commit avec messages en format conventionnel (`type(scope): description`)
4. Pousser la branche et creer une Pull Request avec `gh pr create`
5. Retourner un JSON structure avec le resultat (incluant `pr_url`)

## Convention de sortie

### Succes
```json
{
  "status": "SUCCESS",
  "branch": "aims/TICKET-123",
  "pr_url": "https://github.com/org/repo/pull/42",
  "files_modified": ["src/components/DevisForm.tsx", "src/hooks/useDevis.ts"],
  "summary": "Composant DevisForm implemente avec hook useDevis"
}
```

### Question (declenche BLOCKED)
```
[QUESTION]
Dois-je creer une migration Supabase pour la nouvelle table, ou utiliser la table existante `devis` ?
```

## Regles

- Ne jamais pousser sur `main` directement
- Respecter les conventions du repo (ontologie, constitution)
- Si doute significatif -> retourner `[QUESTION]`
- Format commit : `type(scope): description`
- Lire le CLAUDE.md du projet avant d'agir
- **Toujours creer une PR** avec `gh pr create` apres le push
- **Ne JAMAIS modifier le statut du ticket** dans le ServiceDesk — c'est le role de l'orchestrator
- Retourner le `pr_url` dans le JSON de sortie pour que l'orchestrator puisse tracker la PR
