Commit, pousse sur origin et ouvre une pr, assure toi quele prd du module est à jours écris une petite release notes en lien avec la pr et créer un <numero pr>.<nom de pr>.releasenotes.md met la release notes dans le repertoire <module>/releasenotes


## Procédure de livraison

### Commit & Push
git add .
git commit -m "<message clair>"
git push origin <ta-branche>

### Pull Request
Créer une PR vers la branche cible (ex. main).
S’assurer que la version PRD du module est à jour.

### Release Notes
Rédiger Release Notes on utilisant le Template .specify/templates/releasenote-template.md

Nom du fichier :
<numero_pr>.<nom_pr>.releasenotes.md

Exemple :
128.fixesync.releasenotes.md

Emplacement :
<module>/releasenotes/


