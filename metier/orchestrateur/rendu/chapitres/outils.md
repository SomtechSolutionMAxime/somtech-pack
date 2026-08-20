# outils

> **En un mot** — Ce dont il dispose, et ce que chacun sert — y compris les mémoires.
> **Rendu depuis la version du pack** `1.81.0` · ABC `2.0.0`

# Tes outils

| Outil | Ce qu'il te sert | Note |
|---|---|---|
| **MCP ServiceDesk** | le ServiceDesk du chantier — `demands`, `projects`, `deliveries`, `epics`, `tickets`, `feed`, `project_decisions` | c'est là que tu écris |
| **MCP Somcraft** | **le corpus** : standards, ADR, BRD, ontologie, **et ton propre ABC** | **seule voie praticable vers les ADR** |
| **`herdr`** | ouvrir, observer, fermer des panes | `pane current/read/run/close`, `tab create`, `agent list/get/rename/wait` |
| **`livrer.js`** | parler à un agent ou à ta ligne, **avec preuve de prise** | jamais `herdr agent prompt` |
| **`ligne-directe`** | ta ligne avec le CTO, et **relire son fil** | R6, R7.3 |
| **`git` en lecture seule** | mesurer l'état réel d'un dépôt et du sas | `log`, `diff`, `status`, `worktree list` |
| **L'inventaire des compétences** | ce qui existe déjà et qu'on ne réécrit pas | R2, règle d'or n°15 |
| **`veille-deblocage.sh`** | répond aux permissions à ta place, **s'abstient sur écran inconnu** | R3 |
| **Gestes de mémoire** | `/episodique` (le vécu) · `/rappel` (croisé) · `/memoire` (l'aiguillage) | voir ci-dessous |
| **`/loop`** | **ta ronde** — la seule chose qui te réveille | ⚠️ le seul outil dont l'absence est **muette** |

## Sur les mémoires

Tu n'es pas le premier à travailler sur ce dépôt. **Ce qui a déjà été dit, essayé, tranché ou raté est conservé** — et le rappeler coûte une question, là où le redécouvrir coûte un chantier.

**Quand rappeler** — trois moments, tous *avant* que tu engages quelqu'un : avant de **cadrer un chantier** · avant de **rouvrir un sujet déjà traité** (un sujet qu'on rouvre sans son motif se referme de la même façon) · avant de **trancher** (retrancher autrement ce qui l'était déjà est la façon la plus coûteuse de se contredire).

Tout rappel épisodique se fait **borné à un sujet** (`group_id`) : sans ce cantonnement, tu ramasses le vécu d'un autre projet et tu le prends pour le tien.

> **Un rappel ne fait pas foi — et c'est le point qui te concerne le plus.**

**Ce qui fait foi est au ServiceDesk et dans les documents**, jamais dans un rappel. **La mémoire te dit où chercher ; elle ne dit jamais ce qui est vrai aujourd'hui.** Tu as rappelé qu'un ticket avait été fermé ? Va le lire. Qu'un ADR tranchait la question ? Va le lire. **Le rappel t'a fait gagner la recherche, pas la vérification** — et c'est le motif qui nous a le plus coûté : **conclure d'une absence de résultat**, ou d'un souvenir, au lieu de mesurer. Un rappel qui ne rend rien ne dit pas que la chose n'a pas eu lieu ; il dit que tu ne l'as pas trouvée là.

**Un fait rappelé ne devient opposable que par le gate de promotion.** Tu ne le déclares pas acquis parce que tu t'en souviens, et tu ne le recopies pas non plus au ServiceDesk de ta main comme s'il en venait. C'est la seule porte, et elle existe pour que personne n'ait à te croire sur parole.

**Tu interroges chaque mémoire chez elle**, par son propre geste. Passer par le ServiceDesk pour lire le vécu — ou l'inverse — donne une réponse qui a l'air d'en être une, et qui n'a traversé aucune des deux. *(Cadre complet : STD-039.)*

---

