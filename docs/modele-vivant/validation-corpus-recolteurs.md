# Validation des récolteurs d'architecture sur corpus réel (I19)

> Preuve à l'appui de **STD-031 §2.7.9 / I19** pour la livraison **D-20260804-0006**.
> Mesures rejouables : `bash scripts/tests/test-archi-ci-corpus.sh`.
> Les dépôts du corpus sont lus en **lecture seule** — aucune écriture, jamais (règle d'or n°7).

## Corpus

| Dépôt | Front | Volume SQL | Pourquoi il est dans le corpus |
|---|---|---|---|
| `constructiongauthier` | Vite + React Router | 461 fichiers, 178 activations de RLS | Le plus gros — c'est lui qui révèle une précision qui se dégrade avec la taille |
| `actionprogex` | Next.js en monorepo | 91 fichiers | Monorepo + tests colocalisés aux routes |
| `servicedesk-somtech` | Vite + Express + Edge | 107 fichiers | Trois surfaces HTTP dans un seul dépôt |
| `print-template-hub` (Morasse) | Vite + React Router | 22 fichiers, 3 emplacements | Assez petit pour une vérité terrain **exhaustive et vérifiable à la main** |

## Ce que la mesure a démenti

Le point de départ était que deux dépôts se trompaient **en sens opposés** — sous-déclaration
chez `constructiongauthier` (3 tables déclarées pour ~169 réelles), sur-déclaration chez
Morasse (25 déclarées pour 11 trouvées) — et que cette symétrie désignait le récolteur.

La mesure dit autre chose, et c'est plus simple :

- **Morasse ne sur-déclarait rien.** Ses 25 tables sont exactes. Son schéma vit dans un dump
  `supabase/_baseline_prod_public.sql` (25 `CREATE TABLE`) doublé d'un second dossier
  `scripts/migrations/`. Le récolteur ne regardait que `supabase/migrations/` et ne savait pas
  lire `"public"."archive_matrices"` — la forme que produit `pg_dump`. **Le manifeste écrit à
  la main avait raison contre l'outil.**
- **Le manifeste de `constructiongauthier` est tronqué volontairement.** Son en-tête le dit :
  « le grain FIN et complet (121 tables…) est récolté dans `docs/schema/schema.yaml` ». Ce
  n'est pas une défaillance du récolteur mais un choix humain — dont la légitimité est une
  question de standard, pas d'outillage (voir « Ce qui reste à trancher »).

Le récolteur ne se trompait donc jamais dans les deux sens : **il sous-récoltait, toujours.**
Le seul défaut qui fabriquait vraiment du faux — l'appariement non borné des clés étrangères —
était déjà corrigé (D-20260731-0001) : 0 appariement suspect sur les 96 du corpus.

## Défauts corrigés

| # | Défaut | Mesuré sur | Effet |
|---|---|---|---|
| 1 | Identifiants quotés par segment (`"public"."x"`) illisibles | Morasse | 25 tables invisibles |
| 2 | Schéma écrasé (`audit.audit_log` → `audit_log`) | Construction Gauthier | 5 tables attribuées au mauvais schéma, collision possible |
| 3 | `DROP TABLE` et `RENAME TO` ignorés | Construction Gauthier | 3 tables supprimées et 2 renommées encore déclarées |
| 4 | Aucune description récoltée | tout le corpus | 100 % des éléments sans description |
| 5 | Découverte du SQL limitée à `supabase/migrations` | Morasse, ServiceDesk | schéma récolté à moitié |
| 6 | Littéraux et `$$` non reconnus au découpage | Construction Gauthier (280 fichiers avec `$$`) | bornage des instructions non fiable |
| 7 | Migrations défensives (`DO $$ … IF NOT EXISTS … CREATE TABLE`) ignorées | Construction Gauthier | tables conditionnelles invisibles |
| 8 | Edge Functions Supabase jamais récoltées | tout le corpus | 102 endpoints réels absents ; « aucune API » affirmé à tort |
| 9 | Aucun récolteur d'écrans | tout le corpus | seul grain jamais confronté au code |
| 10 | `app/` d'un monorepo pris pour le routeur Next.js | ActionProgex | **URL inventées** (`/src/app/api/assistant`) |
| 11 | `src/pages/` d'une app Vite pris pour un routeur Next.js | Morasse | **15 écrans inventés** |
| 12 | `route.test.ts` lu comme une route | ActionProgex | **4 endpoints inventés** |
| 13 | Description contenant `:` réécrite sans quote à la fusion | Construction Gauthier | manifeste fusionné **YAML invalide** |
| 14 | Collision d'id entre la table `matrices` et l'écran `/matrices` | Morasse, Construction Gauthier | un élément perdu silencieusement à la fusion |

Les défauts **10, 11 et 12 fabriquaient du faux** — les seuls de cette nature, et tous
préexistants au chantier. Les autres sous-récoltaient.

## Résultat

| Dépôt | Tables | Tables décrites | Endpoints | Écrans |
|---|---|---|---|---|
| `actionprogex` | 59 → **61** | 0 → **46** | 10 (dont 4 faux) → **31** | 0 → **25** |
| `constructiongauthier` | 171 → **169** | 0 → **125** | 0 → **37** | 0 → **98** |
| `print-template-hub` | 11 → **26** | 0 → **13** | 0 → **2** | 0 → **20** |
| `servicedesk-somtech` | 33 → **47** | 0 → **15** | 6 → **44** | 0 → **23** |

Les variations à la baisse sont des corrections : `constructiongauthier` passe de 171 à 169
parce que les tables supprimées et renommées ne sont plus comptées deux fois.

## Les trois critères d'I19

**1 — Zéro faux positif, sur un dépôt discipliné réel.** Morasse sert de vérité terrain
exhaustive : ses 26 tables sont vérifiées une à une contre les `CREATE TABLE` de ses trois
emplacements de schéma. Récolte = 26. Aucune table absente, aucune inventée. Le jeu de données
de test (`seed_test_qa.sql`) reste dehors. Les 20 écrans correspondent aux 20 routes réelles,
nommés par leur composant et non par leur garde d'authentification.

**2 — Invariant d'échelle.** Sur `constructiongauthier` — 461 fichiers, 20× Morasse — aucune
relation ne pointe vers une table qui n'existe pas. Le bornage ne repose plus sur un réglage
mais sur un découpage en instructions : rien à re-régler quand le dépôt grossit.

**3 — Motifs des projets disciplinés.** C'est le critère que §2.7.9 nomme comme le plus
coûteux à manquer, parce que le rater revient à **punir la rigueur**. Chacune de ces marques de
discipline cassait une version de l'outil, et chacune a maintenant son test :

| Marque de rigueur | Ce que l'outil en faisait |
|---|---|
| Isolation dans un schéma dédié (posture Loi 25) | écrasait le schéma |
| Tables commentées (`COMMENT ON TABLE`) | ignorait le commentaire, laissait la description vide |
| Migrations défensives (`IF NOT EXISTS` dans un `DO $$`) | ne voyait pas la table |
| Tests colocalisés au code (`route.test.ts`) | **inventait un endpoint** |
| Baseline de production versionnée | ne la lisait pas |
| Structure en monorepo | **inventait des URL** |

## Ce qui reste hors de portée — assumé, pas masqué

- **`CREATE TABLE` construit dynamiquement** (`EXECUTE '…'`) : non récolté. Le nom peut être
  calculé ; le deviner serait inventer. **Signalé sur stderr** (1 occurrence sur tout le corpus).
- **Description depuis l'ontologie** : écartée. Le lien concept → table y est en prose
  (« (table user_profiles) »), pas structuré, et la couverture varie du tout au tout d'un dépôt
  à l'autre (24 concepts sur 48 chez ActionProgex, 1 sur 73 chez Construction Gauthier).
  Rattacher une description par heuristique, c'est risquer de la coller à la mauvaise table —
  une documentation fausse, ce qu'I17 interdit. La source traçable est `COMMENT ON TABLE`, déjà
  présente dans les migrations et désormais lue. Combler les 25 % restants se fait **dans la
  source**, pas dans l'outil (I16).
- **Frameworks de routage hors React Router et Next.js** : signalés comme grain non vérifié,
  jamais devinés.

## Ce qui reste à trancher (hors outillage)

`constructiongauthier` délègue explicitement son grain fin à `docs/schema/schema.yaml` et ne
déclare que 3 tables. Avec un récolteur fidèle, son rapport de drift signalera ~166 tables
absentes du manifeste. Deux lectures possibles — le manifeste doit les énumérer, ou la
délégation à une projection voisine est légitime — et l'arbitrage relève de **STD-031**, pas
de cet outil. Le gate restant en mode signalement, rien ne bloque d'ici là.
