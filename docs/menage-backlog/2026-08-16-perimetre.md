# Ménage du backlog du pack — le périmètre mesuré

`T-20260816-0016` · mesuré le 2026-08-16 par `t-20260816-0016` · dépôt à `d84b54f` (= `origin/main`), `VERSION` = `1.62.0`

## Ce qui est ouvert, par statut

| Statut | Compte |
|---|---:|
| `new` | 155 |
| `proposed` | 9 |
| `in_progress` | 3 |
| `ready_to_deploy` | 1 |
| `in_review` | 1 |
| `qa` | 1 |
| `failed` | 0 |
| **Total non fermé** | **170** |

Moins `T-20260816-0016` lui-même : **169 tickets à relire**.

## Ce que ce compte corrige dans le brief

La description du ticket raisonnait sur un ordre de grandeur de **quarante** tickets
(« si le ménage ferme trois tickets sur quarante »). Le périmètre réel est **quatre fois plus large**.
Le lot reste faisable, mais l'échelle change ce qu'on peut en attendre.

Deux affirmations du brief, remesurées :

- **« un seul ticket est en `ready_to_deploy` »** — **exact**, c'est `T-20260725-0001`, et il y est
  depuis le 2026-07-27.
- **« cinq demandes de fusion dorment en brouillon »** — **quatre**, pas cinq, au moment de la mesure
  (`#197`, `#192`, `#160`, `#144`), la cinquième étant celle de ce lot, ouverte après le brief.

## Ce que la mesure ajoute, et que le brief ne disait pas

Deux demandes de fusion **prêtes à réviser** — pas en brouillon — dorment aussi :

| PR | Ouverte le | Branche | Ce qu'elle porte |
|---|---|---|---|
| `#44` | 2026-05-12 | `feat/std-011-bias-prompts-sub-agents` | les profils de biais LLM par persona — c'est-à-dire **les neuf tickets `proposed`** du 2026-05-12 |
| `#148` | 2026-07-26 | `fix/D-20260726-0001-brd-parser-codes-domaine` | le parser BRD de `T-20260725-0001` |

`#44` attend depuis **96 jours**. Ce n'est pas un brouillon oublié : c'est une livraison qui a été
déclarée prête et que personne n'a fusionnée.

## Répartition dans le temps des tickets `new`

| Mois d'inscription | Compte |
|---|---:|
| 2026-03 | 1 |
| 2026-05 | 25 |
| 2026-06 | 13 |
| 2026-07 | 40 |
| 2026-08 | 76 |

## Méthode

Chaque ticket est relu individuellement — description **et** commentaires — et tranché en un des six
verdicts : `DEJA_REGLE` (avec sa preuve), `ENCORE_VRAI`, `SANS_OBJET`, `DOUBLON`,
`MARQUE_NON_INSTALLE`, `NON_ETABLI`.

La preuve admise, par ordre de force : la mesure refaite aujourd'hui · l'état du dépôt à `HEAD` ·
le commit ou la version. **Une demande de fusion fusionnée ne prouve pas qu'un défaut est réglé.**
