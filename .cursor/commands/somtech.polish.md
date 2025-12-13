Effectue un exercice de polish UI/UX sur une interface : révision visuelle complète (format, marges, espacements, couleurs, contrastes, cohérence, accessibilité).

## Objectif
Améliorer la qualité visuelle et l'expérience utilisateur d'une interface en appliquant les principes de design moderne et les bonnes pratiques UX/UI.

## Procédure de polish

### 1. Analyse de l'interface existante
- Lire le code du composant/page concerné(e)
- Vérifier la Charte de conception (`Charte_de_conception.mdc` ou `DocExample/design_charter.yaml`)
- Examiner les design tokens (couleurs, typographie, espacements)
- Identifier les incohérences visuelles potentielles

### 2. Révision visuelle via navigateur MCP
- Démarrer l'application locale (`npm run dev` ou `bun dev`)
- Naviguer vers la page/composant avec `mcp_playwright_playwright_navigate`
- Capturer des screenshots avec `mcp_playwright_playwright_screenshot`
- Interagir avec les éléments pour vérifier les états (hover, focus, active)
- **OBLIGATOIRE** : Capturer les logs console (`mcp_playwright_playwright_console_logs` type: "error")
- **OBLIGATOIRE** : Confirmer 0 erreur console avant de continuer

### 3. Checklist de polish (à vérifier systématiquement)

#### Format & Structure
- [ ] Hiérarchie visuelle claire (titres, sous-titres, corps de texte)
- [ ] Alignement cohérent (gauche, centre, droite selon contexte)
- [ ] Grille respectée (colonnes, espacements réguliers)
- [ ] Responsive design vérifié (mobile, tablette, desktop)

#### Marges & Espacements
- [ ] Marges externes cohérentes (padding du conteneur)
- [ ] Espacements internes harmonieux (gap, padding)
- [ ] Espacements entre éléments respectent la grille (multiples de 4px ou 8px)
- [ ] Espacements verticaux cohérents entre sections
- [ ] Pas d'espacements trop serrés ou trop larges

#### Couleurs & Contraste
- [ ] Contraste texte/fond conforme WCAG AA minimum (4.5:1 pour texte normal, 3:1 pour texte large)
- [ ] Contraste conforme WCAG AAA si possible (7:1 pour texte normal)
- [ ] Couleurs cohérentes avec la palette de la Charte
- [ ] États visuels distincts (hover, focus, active, disabled)
- [ ] Couleurs sémantiques respectées (succès, erreur, avertissement, info)

#### Typographie
- [ ] Hiérarchie typographique claire (tailles, poids)
- [ ] Ligne de base cohérente (line-height)
- [ ] Longueur de ligne optimale (45-75 caractères)
- [ ] Espacement entre paragraphes harmonieux

#### Composants & Cohérence
- [ ] Boutons cohérents (tailles, styles, espacements)
- [ ] Formulaires harmonisés (labels, inputs, erreurs)
- [ ] Cards/Containers avec bordures/ombres cohérentes
- [ ] Icônes alignées et de taille cohérente
- [ ] États de chargement/erreur/succès bien visibles

#### Accessibilité (a11y)
- [ ] Labels ARIA présents et descriptifs
- [ ] Navigation clavier fonctionnelle (Tab, Enter, Escape)
- [ ] Focus visible et contrasté
- [ ] Textes alternatifs pour images/icônes
- [ ] Ratio de contraste vérifié avec outil (contrast checker)

### 4. Corrections & améliorations
- Appliquer les corrections identifiées dans le code
- Utiliser les design tokens de la Charte (pas de valeurs hardcodées)
- Respecter les conventions Tailwind/CSS du projet
- Documenter les choix de design si nécessaire

### 5. Re-validation obligatoire
- Recharger la page dans le navigateur MCP
- Vérifier visuellement les améliorations
- **OBLIGATOIRE** : Re-capturer les logs console (`console_logs` type: "error")
- **OBLIGATOIRE** : Confirmer 0 erreur console
- Capturer de nouveaux screenshots pour comparaison
- Tester les interactions (hover, focus, clics)
- Vérifier le responsive sur différentes tailles d'écran

### 6. Documentation
- Documenter les améliorations apportées
- Mettre à jour la Charte si nouveaux tokens/composants ajoutés
- Noter les métriques de contraste si améliorées
- Ajouter des commentaires dans le code si choix de design spécifique

## Agent responsable
→ **UX/UI Designer** :: `*update-interface` avec focus polish visuel

## Références
- Charte de conception : `Charte_de_conception.mdc` ou `DocExample/design_charter.yaml`
- Design tokens : `DocExample/design_charter.yaml`
- Règles UX/UI : `.cursor/rules/03_ux_ui_designer.mdc`
- Validation navigateur : `.cursor/rules/browser-validation-strategy.mdc`
- WCAG Guidelines : https://www.w3.org/WAI/WCAG21/quickref/

## Notes importantes
- ⚠️ **OBLIGATOIRE** : Toujours vérifier la console navigateur après modifications (0 erreur requis)
- ⚠️ **OBLIGATOIRE** : Utiliser le navigateur MCP Playwright pour validation interactive
- Respecter la Charte de conception existante (ne pas créer de nouveaux tokens sans validation)
- Si ajout de nouveaux tokens/composants → mettre à jour `design_charter.yaml` via Design Librarian
- Prioriser la cohérence avec le reste de l'application