---
description: Générer le rapport PDF professionnel à partir d'un audit Loi 25
allowed-tools: Read, Bash(python3:*, pip:*, find:*, ls:*, sort:*, tail:*, head:*)
argument-hint: [rapport-audit.md] [--client NomClient] [--projet NomProjet]
---

Générer un rapport PDF professionnel et livrable au client à partir d'un rapport d'audit Loi 25 en Markdown. Charger d'abord le skill `loi-25-compliance` si nécessaire.

## Prérequis

1. **Installer reportlab** si pas déjà disponible :
   ```bash
   pip install reportlab --break-system-packages
   ```

2. **Localiser le rapport Markdown** :
   - Si un argument fichier est fourni en paramètre, utiliser ce fichier
   - Sinon, chercher le rapport le plus récent dans `security/audit/` :
     ```bash
     ls -t security/audit/audit-loi25_*.md 2>/dev/null | head -1
     ```
   - En dernier recours, chercher `audit-loi25-rapport-*.md` ou `audit-loi25_*.md` dans le projet

3. **Valider que le rapport existe** et contient les sections attendues (Volet A, Volet B, Score, Plan d'action)

## Génération du PDF

Exécuter le script de génération :

```bash
python3 <chemin-plugin>/scripts/generate_pdf_report.py <rapport.md> \
  --output <rapport-sans-extension>.pdf \
  --client "<Nom du client>" \
  --projet "<Nom du projet>"
```

### Paramètres

| Paramètre | Source | Défaut |
|-----------|--------|--------|
| `rapport` | Argument CLI ou auto-détection du plus récent dans `security/audit/` | — |
| `--client` | Argument CLI ou demander à l'utilisateur | « Client » |
| `--projet` | Argument CLI, ou extraire du champ **Projet** / **Client** dans le rapport | « Projet » |
| `--output` | Argument CLI | Même nom que le .md avec extension .pdf |

### Auto-détection du rapport

Si aucun fichier n'est spécifié en argument, le script cherche automatiquement :

1. `security/audit/audit-loi25_*.md` — trié par nom (le plus récent en dernier grâce à la nomenclature date-heure)
2. `audit-loi25-rapport-*.md` dans le dossier courant (ancien format, rétrocompatibilité)

### Extraction automatique des métadonnées

Si `--client` ou `--projet` ne sont pas fournis en argument :
1. Lire les premières lignes du rapport Markdown
2. Extraire la valeur de `**Projet** :` et `**Client** :` si présents
3. Utiliser ces valeurs comme défaut

## Processus

1. Vérifier que `reportlab` est installé, l'installer sinon
2. Localiser le rapport Markdown (argument ou auto-détection dans `security/audit/`)
3. Déterminer les paramètres (client, projet, output)
4. Exécuter le script `generate_pdf_report.py`
5. Vérifier que le PDF a été généré avec succès
6. Afficher le chemin du PDF généré et sa taille

## Format de sortie

Le PDF généré contient :

- **Page couverture** — Logo Somtech, titre, client, projet, date, score global + sous-scores Technique/Gouvernance
- **Table des matières** — Sections numérotées avec pages
- **Sommaire exécutif** — Scores par volet, constats par catégorie et niveau, exposition aux sanctions
- **Volet A — Technique** — Inventaire PII, constats DB/API/Frontend avec sévérité, description, recommandations
- **Volet B — Gouvernance** — Constats organisationnels avec sévérité, description, recommandations
- **Plan d'action** — Deux tableaux séparés (Technique / Gouvernance) avec corrections priorisées
- **Annexes** — Fichiers analysés, méthodologie, références légales, barème des sanctions

Le fichier PDF est sauvegardé à côté du rapport Markdown original (dans `security/audit/`).
