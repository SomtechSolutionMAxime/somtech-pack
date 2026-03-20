---
name: estimation-report
description: >
  Ce skill génère le rapport d'estimation final en deux formats : markdown
  (fichier de travail versionnable) et .docx (document client avec branding
  Somtech). Déclenché après la validation utilisateur en Phase 3 du pipeline
  d'estimation.
version: 0.1.0
---

# Skill: estimation-report

Génération des livrables d'estimation (markdown + .docx).

## Responsabilités

1. Générer le rapport markdown dans le projet
2. Générer le rapport .docx client à partir du gabarit Word

## Phase 4 — Génération

### 4a. Rapport Markdown

**Emplacement** : `estimations/YYYY-MM-DD-<nom-projet>-estimation.md` (dans le projet courant, pas dans le plugin)

**Format** : Voir `${CLAUDE_PLUGIN_ROOT}/skills/estimation-report/references/format-livrable.md` pour le template exact.

**Règles de formatage** :
- Montants en CAD ($), taxes exclues
- Séparateur d'espace pour les milliers : `12 500 $` (convention québécoise)
- Arrondir les montants à l'unité (pas de centimes)
- Arrondir les jours au 0.5 le plus proche
- Le facteur de risque global est affiché avec 2 décimales (ex: `1.25`)

**Contenu obligatoire** :
1. **Sommaire exécutif** : totaux trad/IA, économie projetée (% et $), facteur de risque global
2. **Détail par feature** : tableau par rôle avec jours et coûts (trad + IA)
3. **Synthèse** : tableau comparatif avec coût brut, architecte, marge de risque, total avec risque
4. **Hypothèses et exclusions** : lister les hypothèses posées pendant l'estimation et ce qui n'est pas inclus
5. **Paramètres utilisés** : taux journaliers, facteurs IA utilisés (surtout si modifiés par l'utilisateur)

### 4b. Rapport .docx

**Gabarit** : `${CLAUDE_PLUGIN_ROOT}/templates/estimation-report.docx`

**Méthode** : unpack/edit/repack (même approche que somtech-proposals).
Voir le SKILL.md de `completion-documents` dans somtech-proposals pour les règles de formatage Word :
- Apostrophes : uniquement `'` (U+0027)
- Styles : utiliser `<w:pStyle>` pour les titres
- Tableaux : bordures explicites, largeur en `dxa`, alternance de couleurs
- En-têtes/pieds de page : préserver `xml:space="preserve"`

**Contenu** : identique au markdown, mis en forme avec le branding Somtech (en-tête, couleurs corporatives, logo).

### Gestion d'erreurs

- Si le gabarit .docx n'est pas trouvé, générer uniquement le markdown et informer l'utilisateur
- Si le dossier `estimations/` n'existe pas dans le projet courant, le créer
