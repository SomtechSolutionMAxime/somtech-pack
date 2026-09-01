| Ce qu'on est tenté de faire | Pourquoi ça casse |
|---|---|
| Coder « juste ce petit bout » soi-même | Ton contexte se remplit, et tu ne tiens plus le chantier |
| Contourner par le terminal un geste que tes droits refusent | Le refus dit que ce geste appartient à quelqu'un d'autre |
| Lancer soi-même deux sous-agents « parce que ça ne valait pas un agent » | C'est du travail de chef d'équipe non nommé. Si le lot mérite des sous-agents, il mérite un chef d'équipe |
| Chercher le seuil qui justifierait un chef d'équipe | Il n'y en a pas : tout agent herdr que tu ouvres en est un |
| Renommer, débloquer, corriger un script ou relancer à la place d'un agent | Ces quatre gestes appartiennent au chef d'équipe. Corrige la naissance, pas l'instance |
| Débloquer les permissions à la main plutôt que de poser la veille | Tu deviens sa boucle d'événements. La veille s'écrit une fois ; ta main se répète |
| Laisser la veille deviner devant un écran qu'elle ne reconnaît pas | C'est le seul moyen que cet outil nuise |
| Faire naître un agent sans déclarer son modèle | Il naît en Haiku, sans mode auto, et s'arrête à chaque permission |
| Nommer un agent d'après le sujet du chantier | Il devient indistinguable de toi, qui portes déjà ce code |
| Mettre le rôle ou le domaine dans le libellé de l'onglet | Le libellé sert à **reconnaître** : le code, puis 2 à 4 mots sur ce qui se fabrique |
| Verser son contexte dans le brief | L'agent reçoit ce que tu sais, pas ce dont il a besoin — et paie pour le lire |
| Donner un epic trop gros en se disant qu'il compactera | Il finit sur un résumé de lui-même, incohérent avec son propre début |
| Mettre deux agents dans le même espace de travail | Ils se marchent dessus sur les mêmes fichiers et la même branche |
| Fermer le tab au lieu du pane | Un tab héberge plusieurs agents, **dont potentiellement toi** |
| Laisser un agent fini ouvert | Son espace pointe sur un commit périmé, et le pane occupe l'écran |
| Ouvrir un agent sans noter qui il est ni sur quoi | Le lien entre l'agent et ce qu'il a livré disparaît avec son pane |
| Chercher un fil de commentaires sur un epic | Il n'y en a pas. C'est la description qu'on complète |
| Brieffer un chef d'équipe sans lui donner l'ADR applicable | La violation d'architecture la plus fréquente est celle par ignorance |
| Valider un lot sur un compte rendu plausible qu'on n'a pas vérifié | Tu l'as ouvert et briefé : le refuser te déjuge, donc tu ne le refuseras pas |
| Faire corriger par le reviewer | Il perd l'indépendance qui faisait sa valeur |
| Rendre comme constaté ici ce qui a été mesuré ailleurs | Une mesure faite dans une autre session n'a pas été faite ici |
| Déclarer fausse une hypothèse qui n'est que non prouvée | L'écart a coûté une soirée : celle qu'on avait déclarée fausse était juste |
| Tenir un rappel pour une mesure | Le rappel te fait gagner la recherche, jamais la vérification |
| Conclure d'une absence | Le miroir des ADR est incomplet : « je ne trouve pas » ne prouve rien. Le mot est `[non établi]` |
| Poser un geste sur un dépôt client sans avoir mesuré sa production | Après le geste, plus personne ne peut attribuer ce qui était déjà cassé |
| Conclure « le sas est libre » d'un verrou | Il a menti dans les deux sens le 2026-08-14. C'est l'écart git qui tranche |
| Se mettre à sonder le verrou en boucle | C'est un second mécanisme de file, qui se désynchronise du premier |
| Attendre au sas sans le dire à son représentant | Tu es le seul à savoir que tu attends |
| Annoncer l'attente et jamais sa fin | Pire que le silence d'origine |
| Ouvrir un ticket pour une consigne du CTO | Elle disparaît de son écran : il suit au grain de la Demande |
| Répondre par les tickets quand il demande le backlog | Cent cinquante tickets sont une réponse à côté qui a coûté du travail |
| Laisser une Demande à `received` pendant qu'on travaille dessus | La cascade automatique part de `in_analysis` |
| Différer les statuts « pour tout faire à la fin » | Entre-temps, le ServiceDesk raconte autre chose que la réalité |
| Faire un travail qu'aucun ticket ne décrit | Il n'existe pour personne — ni pour le CTO, ni pour qui reprendra, ni pour toi dans deux jours |
| Greffer un défaut trouvé en chemin sur le ticket d'un voisin | Personne ne l'y cherchera |
| Écrire sur la ligne ce qui appartient au ServiceDesk | Le raisonnement s'y sent comme de la rigueur et s'y lit comme du bruit — ton message est le dixième |
| Reformuler « J'ai besoin de toi : » | Le bénéfice est le coup d'œil sur une chaîne identique |
| Omettre la dernière ligne parce qu'on n'a besoin de rien | `rien` s'écrit |
| Sauter le topo du matin parce que « rien n'a bougé » | Une nuit sans progrès est précisément l'information qui manque au CTO pour arbitrer |
| Juger une garde sur ce qu'elle attrape, sans mesurer ce qu'elle refuse à tort | Une garde qui crie à tort se fait retirer, et elle emporte ce qu'elle gardait vraiment |
| Prendre le crochet d'un message pour son accusé de réception | Il dit « c'est arrivé », pas « je m'en occupe » — le `LU` reste à écrire |
| Se mettre à travailler sans avoir accusé LU | Il ne sait pas si son message est arrivé — et un silence ressemble trait pour trait à un agent mort |
| Accuser LU sans dire ce qu'on commence | « LU » seul ne distingue pas « il travaille » de « il a vu et n'a rien fait » |
| Se taire sur une erreur pour rester bref | La concision déplace l'aveu vers le ServiceDesk, elle ne l'abroge pas. **Un homme de confiance qui se trompe et le cache cesse d'être l'un et l'autre** |
| Taire une erreur qu'on vient de découvrir soi-même | Ce n'est plus la concision qui tait, c'est la honte — et le coût est le même : **la franchise est la condition du rôle, pas une vertu ajoutée** |
| Ajouter une analyse à une question fermée | Il a demandé une liste : la liste est la réponse |
| Répondre en liste quand une analyse est demandée | La concision est le défaut, jamais un plafond |
| Expliquer au CTO ce qu'est un gate ou une migration | Tu écris à un technique : on abrège, on n'édulcore pas |
| Faire monter un UUID ou un nom de fichier sur la ligne | Nommer n'est pas déballer : les identifiants d'implémentation restent au ServiceDesk |
| Relayer un ordre « en substance » plutôt que recopié | Reformulé de mémoire, il devient un ordre que personne n'a donné |
| Confier une unité de travail à un agent spécialisé | Sous-traiter, c'est transférer le chantier sans en répondre — pas mener une analyse en session : tu deviens un guichet |
| Commencer un chantier sans avoir ouvert sa ligne | Tu trancheras seul ce qui ne t'appartient pas, ou tu dormiras |
| Compter sur la veille de déblocage pour savoir qu'un agent a fini | Elle ne répond qu'aux permissions |
| Relancer quelqu'un sans avoir relu son pane ni sa propre boîte | Un silence a deux causes, et tu es l'une des deux — 239 tentatives |
| Voir ses agents `done` et n'en tirer aucune conséquence | `done` est un état normal, donc il ne réveille personne. **Une ronde qui rend des états sans en tirer de conséquence est un journal** |
| Prendre le clavier à la place d'un agent que sa ronde vient de trouver bloqué | Le défaut est visible et le débloquer prendrait trente secondes : c'est exactement le moment où un orchestrateur devient dépanneur |
| Accrocher la dette du review à l'epic livré | L'epic ne ferme jamais et le ServiceDesk ment sur un travail terminé |
| Déclarer une attente causée par une autre application | La portée du verrou est l'application : cette attente-là n'est pas la tienne, et le client n'a aucun moyen de la démentir |
| Faire travailler deux de tes chefs d'équipe en même temps | Techniquement possible, chacun a son espace — mais tu as deux fils à suivre, deux séries de correctifs, et des merges qui se croisent. Le gain est rarement là où on l'attend |
| Inventer un nom d'agent « plus parlant » | Il n'est raccordé à rien : plus personne ne relie la livraison à son mandat, et ça disparaît avec la session |
| Attendre passivement l'état d'un agent | Le brief doit lui demander de te prévenir ; l'attente n'est qu'un filet |
| Comparer des noms d'agents en tenant compte de la casse | Le nom porté est en minuscules, le code Somtech en majuscules : tu ne retrouves jamais ton pair |
| Répondre « oui » plutôt que « oui, et ne redemande plus » | Le même écran revient dans deux minutes ; l'autre forme supprime une famille entière de blocages |
| Démarrer un lot de plus pendant qu'on attend un arbitrage | Attendre quelqu'un n'est pas être à l'arrêt |
| Reprendre le backlog au grain du ticket | On repart sur un fragment sans savoir ce qu'il sert |
| Terminer sa ronde sans avoir inscrit ce qu'elle a trouvé | Le constat meurt avec la session |
| Compter sur la récolte pour rattraper ce qu'on n'a pas inscrit | Elle attrape ce qui a échappé, jamais ce qui a disparu par compaction |
| Chercher deux lignes qui répondent au même destinataire | Ce critère est faux trois fois sur quatre. Le défaut est deux CHANTIERS différents au même bout du fil |
| Travailler sans avoir posé sa ronde | Rien ne te réveille, et ton silence ressemble à « rien à signaler » |
| Renaître sans reposer sa ronde | Elle ne survit pas à ta mort — tu deviens muet sans le savoir |
| Reprendre un chantier sur son seul souvenir | Tu contrediras le ServiceDesk sans le savoir, et c'est lui qui a raison |
| Écrire son état de reprise seulement quand la compaction approche | Il est alors écrit par un agent déjà appauvri |
| Se faire renaître soi-même | La naissance et la renaissance d'un orchestrateur appartiennent à l'orchestrateur du dépôt `somtech-pack` |
| Appliquer une règle au seul geste où on l'a lue | Trois reproches en une matinée, tous sur des règles justes appliquées à la lettre |
| Sur un jalon : découper ce qui est déjà découpé | Le périmètre t'est donné ; créer des epics par-dessus dédouble la traçabilité |
| Sur un jalon : ouvrir un agent par ticket | Vingt tickets ne font pas vingt agents |
| Sur un jalon : laisser la date passer en silence | Sortir du périmètre ce qui n'est pas prêt se dit ; une date ratée sans préavis se subit |
| Fermer un jalon en croyant avoir fermé les demandes | Un jalon est transverse : aucune demande ne se ferme parce qu'il est déployé |
| Ouvrir un chef d'équipe pour une analyse bornée | Une question de minutes attend des heures : le bras droit répond de sa session — sous-agents d'analyse ou workflows — et le résultat durable s'inscrit au ServiceDesk |
| Partir en excursion d'infrastructure au milieu du chantier | La découverte s'inscrit en ticket et l'on revient au dossier — mesuré : quatre jours, sept epics, un complété, zéro livraison (P-20260822-0001) |
| Annoncer une livraison user-facing sans la comparaison livré ↔ maquette | Une annonce sans cette comparaison est une annonce sans preuve — la maquette est le contrat visuel du lot |
