---
name: problem-analysis
description: >
  Méthodologie structurée d'analyse de problèmes pour les agents silo AIMS.
  Ce skill guide un agent à travers l'identification de la cause racine,
  la collecte de preuves, et la proposition de solutions. Utiliser ce skill
  quand un agent rencontre un bug complexe, un comportement inattendu, une
  régression, ou un problème de performance qui ne se résout pas par un
  simple retry. Également utile pour les post-mortems d'incidents.
---

# Problem Analysis

Quand un agent silo rencontre un problème qui n'est pas un simple échec transitoire, il a besoin d'une approche structurée pour diagnostiquer la cause et proposer une solution. Ce skill fournit cette méthode.

## Quand utiliser ce skill

- Un bug apparaît en production mais pas en dev
- Un test passe localement mais échoue en CI
- Une performance se dégrade sans changement apparent
- Un comportement change après un déploiement
- Un client signale un problème que personne ne reproduit
- Après un incident pour documenter la cause racine (post-mortem)

## Méthode en 5 étapes

### Étape 1 — Cadrer le problème

Avant de chercher la cause, il faut décrire précisément le symptôme. Un problème mal cadré mène à des investigations dans la mauvaise direction.

**Template de cadrage :**

```
PROBLÈME: [Description factuelle du symptôme]
ATTENDU: [Ce qui devrait se passer]
OBSERVÉ: [Ce qui se passe réellement]
DEPUIS: [Quand le problème a commencé, ou quand il a été détecté]
IMPACT: [Qui est affecté, quelle fonctionnalité, quelle gravité]
REPRODUCTIBLE: [Toujours / Intermittent / Pas encore reproduit]
```

**Exemple :**

```
PROBLÈME: Les factures PDF générées affichent 0.00$ pour le montant total
ATTENDU: Le montant total correspond à la somme des lignes
OBSERVÉ: total_amount = 0.00 même quand les lignes ont des montants
DEPUIS: Déploiement du 5 mars (commit abc123)
IMPACT: Tous les clients du silo acme — factures incorrectes
REPRODUCTIBLE: Toujours, sur toute facture avec > 1 ligne
```

### Étape 2 — Collecter les preuves

Ne pas émettre d'hypothèse avant d'avoir des données. Collecter les éléments factuels avant d'interpréter.

**Checklist de collecte :**

| Source | Quoi chercher | Commande/requête type |
|--------|--------------|----------------------|
| Logs (silo_logs) | Erreurs, warnings autour du timestamp | `WHERE action LIKE 'invoice.%' AND ts > '2026-03-05'` |
| Audit trail | Changements récents sur les ressources impliquées | `WHERE resource_type = 'invoice' ORDER BY ts DESC` |
| Desk tasks | Tâches liées au flux en erreur | `WHERE trace_id = 'tr_...'` |
| Git | Commits récents sur les fichiers impliqués | `git log --since="2026-03-05" -- src/invoices/` |
| Migrations | Changements de schéma récents | `ls supabase/migrations/ \| tail -5` |
| Métriques | Changement de pattern (durée, volume, erreurs) | Métriques de cycle des agents impliqués |

### Étape 3 — Isoler la cause

Réduire l'espace des possibles par élimination systématique.

**Techniques d'isolation :**

| Technique | Quand l'utiliser | Comment |
|-----------|-----------------|---------|
| **Bisection temporelle** | Le problème a une date de début | `git bisect` ou revue des déploiements pour trouver le commit fautif |
| **Isolation par couche** | Pas clair si c'est front, back, ou DB | Tester chaque couche indépendamment (requête SQL directe, API curl, UI) |
| **Comparaison A/B** | Marche pour un client, pas un autre | Comparer les configs, données, permissions entre les deux cas |
| **Réduction minimale** | Bug complexe avec beaucoup de variables | Retirer des éléments un par un jusqu'à trouver le minimum reproductible |
| **Injection de trace** | Flux multi-agents opaque | Ajouter des logs temporaires aux points de passage entre agents |

**Arbre d'investigation typique :**

```
Le bug est-il dans les données ?
├─ OUI → Depuis quand ? Migration récente ? Import corrompu ?
└─ NON → Le bug est-il dans le code ?
         ├─ OUI → Quel commit l'a introduit ? (bisect)
         └─ NON → Le bug est-il dans la config ?
                  ├─ OUI → Env vars ? Secrets ? Permissions ?
                  └─ NON → Le bug est-il dans l'infrastructure ?
                           ├─ OUI → Réseau ? Mémoire ? Disk ?
                           └─ NON → Revisiter le cadrage (étape 1)
```

### Étape 4 — Proposer et valider la correction

Une fois la cause identifiée, documenter la solution AVANT de l'appliquer.

**Template de proposition :**

```
CAUSE RACINE: [Description précise de la cause]
PREUVE: [Données qui confirment cette cause]
CORRECTION PROPOSÉE: [Ce qu'on va changer]
RISQUES: [Effets secondaires possibles de la correction]
VALIDATION: [Comment vérifier que la correction fonctionne]
ROLLBACK: [Comment revenir en arrière si la correction échoue]
```

**Exemple :**

```
CAUSE RACINE: La migration 20260305_invoice_totals.sql a changé
  le type de total_amount de NUMERIC(10,2) à INTEGER, tronquant
  les décimales à 0.
PREUVE: git diff de la migration montre ALTER COLUMN ... TYPE INTEGER.
  Les factures créées avant le 5 mars ont les bons montants.
CORRECTION PROPOSÉE: Migration corrective qui remet NUMERIC(10,2)
  + recalcul des totaux affectés.
RISQUES: Les factures créées entre le 5 et aujourd'hui ont des
  totaux à 0 — il faudra les recalculer.
VALIDATION: Créer une facture test, vérifier que le total est correct.
  Vérifier que les factures existantes sont recalculées.
ROLLBACK: La migration corrective est additive (ALTER COLUMN),
  pas de perte de données possible.
```

### Étape 5 — Documenter pour le futur

Après résolution, créer un événement d'audit et un résumé pour la base de connaissances du silo.

**Template post-mortem (pour les incidents significatifs) :**

```markdown
## Post-mortem : [Titre court]

**Date de l'incident** : YYYY-MM-DD
**Durée** : X heures
**Impact** : [Description de l'impact client]
**Sévérité** : P1/P2/P3

### Timeline
- HH:MM — Détection du problème
- HH:MM — Début de l'investigation
- HH:MM — Cause identifiée
- HH:MM — Correction déployée
- HH:MM — Confirmation de résolution

### Cause racine
[Description détaillée]

### Ce qui a bien fonctionné
- [Point positif]

### Ce qui peut être amélioré
- [Point à améliorer]

### Actions préventives
- [ ] [Action + responsable + deadline]
```

## Patterns par type de problème

### Bug de régression
Privilégier la **bisection temporelle** (git bisect). Le problème fonctionnait avant, donc un commit spécifique l'a cassé. C'est la méthode la plus rapide pour les régressions.

### Problème intermittent
Chercher des **conditions de course** (race conditions) : deux agents qui écrivent en même temps, un cache qui expire, un timeout variable. Augmenter le logging temporairement et attendre la prochaine occurrence. Le pattern `FOR UPDATE SKIP LOCKED` de desk-comm est conçu pour éviter ces cas.

### Problème de performance
Commencer par les **métriques de cycle** (silo-logging). Comparer les `avg_duration_ms` et `tokens_used` avant et après le changement. Les causes fréquentes : requête N+1, index manquant, payload trop gros dans desk_tasks.

### Problème multi-agents
Utiliser le **trace_id** pour reconstituer le flux complet. Le problème est souvent à la frontière entre deux agents : un payload mal formé, un status mal interprété, une tâche qui n'a jamais été consommée.

## Anti-patterns

- **Corriger avant de comprendre** : Modifier le code sur une intuition sans avoir isolé la cause. Ça peut "marcher" mais masquer le vrai problème.
- **Investigation en solo trop longue** : Si après 30 minutes l'agent n'a pas progressé, escalader vers le dev-orchestrator avec les preuves collectées.
- **Post-mortem bâclé** : "C'est fixé" n'est pas un post-mortem. Le but est d'empêcher la récurrence, pas de déclarer victoire.
- **Ignorer les incidents mineurs** : Les P3 d'aujourd'hui deviennent les P1 de demain si on ne documente pas les patterns.
