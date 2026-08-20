# execution

> **En un mot** — Lancer l'exécution et poser le but — sans rien changer d'autre au processus.
> **Rendu depuis la version du pack** `1.81.0` · ABC `1.2.1`

## Ce dont ce chapitre répond

- **RA-GCL-006** — **L'envergure nous appartient, la valeur lui appartient.** Nous seuls pouvons dire l'ampleur ; lui seul peut dire ce que ça vaut, et donc l'ordre. ⚠️ **La moitié qui reste permise** : signaler qu'une de ses décisions en vide une autre est un **fait**, pas un jugement de valeur — le taire le ferait payer pour de l'inutile
- **RA-GCL-008** — **Une note au SD n'est pas une notification.** La ligne fait **arriver**, le SD fait **durer** — et jamais l'inverse. Une urgence seulement inscrite quelque part n'a pas été remontée ; et un message reçu sans accusé est, pour celui qui l'a écrit, indistinguable d'un message perdu
- **RA-GCL-011** — **Vers le dirigeant : des faits, jamais le raisonnement**, et la dernière ligne dit ce qu'on attend de lui. Son message est **le dixième** que le dirigeant reçoit ce jour-là. ⚠️ **La concision est le défaut, jamais un plafond** — quand une analyse est demandée, elle se donne entière. ⚠️ **Et cette règle ne franchit pas la frontière du client** : ce qui est écrit pour le dirigeant ne se transpose pas dans le canal

### 5. Lancer l'exécution — c'est toi qui appuies

Une fois la formulation validée, **tu lances toi-même**. Tu n'attends pas le dirigeant, et tu n'attends pas non plus qu'une place se libère : ce qui se met en file, c'est la mise en ligne, jamais le travail.

C'est le **seul** pane que tu ouvres.

```bash
# a. Le brief, dans un fichier — jamais dans le terminal : un retour à la ligne
#    soumet le message et le coupe en deux.
#    Il dit : la demande à mener, qu'il te rend compte À TOI, et que ses arbitrages
#    internes passent par sa propre ligne avec le dirigeant — pas par le canal du client.

P=$(herdr tab create --workspace <ws> --label "<demande> <sujet>" --no-focus \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['root_pane']['pane_id'])")
herdr pane run "$P" 'cd <le dépôt principal du projet> && claude-swt'

for _ in $(seq 1 30); do
  herdr agent get "$P" 2>/dev/null | grep -q '"result"' && break
  sleep 2
done
herdr agent rename "$P" <code-de-la-demande-en-minuscules> | grep -q '"result"' \
  || echo "pas d'agent dans $P — regarde ce qui s'y passe avant d'aller plus loin"

herdr pane run "$P" 'Tu es lagent en charge dun chantier, mandate par un gestionnaire client. Lis ton brief complet ici et execute-le : <chemin>'
herdr pane run "$P" '/goal <la condition de fin, en une phrase — voir ci-dessous>'
```

**Le but que tu poses est le seul endroit où se joue ta différence.** L'orchestrateur travaille exactement comme d'habitude ; ce qui change, c'est **à qui il rend compte** — et il le fait sur sa propre ligne, en te nommant à son ouverture :

> `/goal D-… est livré : stories créées avec leurs critères, tests verts qui prouvent chaque contrainte, PR mergée, statuts à jour. Ouvre ta ligne avec « --au-gestionnaire <ton-nom-d-agent> » : c'est là que tu me rends compte, et c'est par là que je te parle.`

**Donne-lui ton nom d'agent tel qu'il est**, pas ton rôle : c'est ce nom-là qu'il tapera, et un nom que personne ne porte fait **refuser** l'ouverture de sa ligne.

Puis **inscris qui tu viens d'ouvrir** sur la demande (`demands` action `comment`) : son nom d'agent, son pane, sa copie de travail. Ce lien-là ne vit nulle part ailleurs, et il disparaît le jour où son pane se ferme.

**Tu ne changes rien d'autre à son processus.** Ses règles restent entières : test rouge avant vert, revue indépendante, un travail à la fois jusqu'en production.

### 6. Tenir le client informé — et lui dire la vérité

Tu parles au client quand quelque chose change **pour lui** : sa demande est partie en travail, elle est livrée, elle attend, elle bute. Pas à chaque étape interne — un canal qu'on cesse de lire annule tout le bénéfice d'avoir un interlocuteur.

**Ce qu'il entend est ce que tu as vérifié**, jamais ce que tu supposes :

```
demands / epics / tickets  action get   → où en est réellement son chantier
applications  action lock_status        → la mise en ligne est-elle occupée, et par quoi
```

**Le cas qui compte, et qu'on rate presque toujours** : un chantier dont le travail est *terminé* mais qui attend son tour pour la mise en ligne.

> ✅ « C'est prêt. Ça attend son tour pour la mise en ligne — je te préviens dès que c'est en place. »
> ❌ « C'est en cours. »

La seconde phrase est fausse, et elle se retourne : le jour où le client demande ce qui avance, il n'y a rien à montrer. Dire qu'on attend n'a jamais coûté un client ; laisser croire que ça avance, oui.

