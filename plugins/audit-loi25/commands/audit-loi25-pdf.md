---
description: Générer le rapport PDF professionnel à partir d'un audit Loi 25
allowed-tools: Read, Bash(python3:*, pip:*, find:*, ls:*)
argument-hint: [rapport-audit.md] [--client NomClient] [--projet NomProjet]
---

Générer un rapport PDF professionnel et livrable au client à partir d'un rapport d'audit Loi 25 en Markdown. Charger d'abord le skill `loi-25-compliance` si nécessaire.

## Prérequis

1. **Installer reportlab** si pas déjà disponible :
   ```bash
   pip install reportlab --break-system-packages
   ```

2. **Localiser le rapport Markdown** :
   - Si un argument fichier est fourni, utiliser ce fichier
   - Sinon, chercher le fichier `audit-loi25-rapport-*.md` le plus récent dans le projet

3. **Valider que le rapport existe** et contient les sections attendues (Score de conformité, Sommaire exécutif, Constats, Plan d'action)

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
| `--client` | Argument CLI ou demander à l'utilisateur | « Client » |
| `--projet` | Argument CLI, ou extraire du champ **Projet** dans le rapport | « Projet » |
| `--output` | Argument CLI | Même nom que le .md avec extension .pdf |

### Extraction automatique

Si `--client` ou `--projet` ne sont pas fournis en argument :
1. Lire les premières lignes du rapport Markdown
2. Extraire la valeur de `**Projet** :` et `**Client** :` si présents
3. Utiliser ces valeurs comme défaut

## Processus

1. Vérifier que `reportlab` est installé, l'installer sinon
2. Localiser le rapport Markdown (argument ou recherche automatique)
3. Déterminer les paramètres (client, projet, output)
4. Exécuter le script `generate_pdf_report.py`
5. Vérifier que le PDF a été généré avec succès
6. Afficher le chemin du PDF généré et sa taille

## Format de sortie

Le PDF généré contient :

- **Page couverture** — Logo Somtech, titre, client, projet, date, score de conformité avec indicateur visuel
- **Table des matières** — Sections numérotées avec pages
- **Sommaire exécutif** — Tableau des constats par catégorie et niveau, score, exposition aux sanctions
- **Sections détaillées** — Chaque constat avec niveau de sévérité, description, recommandations, articles P-39.1
- **Plan d'action** — Tableau des corrections priorisées avec effort et échéance
- **Annexes** — Fichiers analysés, méthodologie, références légales, barème des sanctions

Le fichier est sauvegardé à côté du rapport Markdown original.
