---
name: scaffold-ops-discovery
description: Genere localement le scaffold initial du depot applicatif ops-discovery (Dockerfile, config, health check, metriques Prometheus, endpoint /.well-known/agents.json) conforme a STD-032, puis publie le depot dans somtech-departement-ia sur demande explicite. Prerequis - aucun (le skill est autonome, zero dependance npm).
license: MIT
metadata:
  author: somtech-pack
  version: "0.1.0"
  project: generic
---

# Scaffold ops-discovery

Genere le scaffold initial du depot `somtech-departement-ia/ops-discovery` — l'endpoint de discovery isomorphique d'un Departement IA, normatif via **STD-032** (Somcraft `/standards/STD-032-discovery-departement-ia.md`). Couvre exactement ce que STD-032 §4 assigne a ce skill : *Dockerfile, config, health check, metriques Prometheus*. La logique de decouverte (pull, agregation multi-mecanisme, self-registration — STD-032 §2.10) est **hors perimetre** de ce scaffold initial ; elle arrive dans un lot ulterieur.

## 🔴 Ce que ce skill fait quand on l'execute — a lire avant de l'invoquer

Ce skill produit deux gestes de nature tres differente :

1. **Generation locale** (`scripts/generate-scaffold.sh`) — pure, locale, sans effet de bord reseau. Peut etre relancee sans risque.
2. **Publication GitHub** (`scripts/publish-github.sh`) — cree un **depot reel** dans l'organisation `somtech-departement-ia` (`gh repo create`). **Action irreversible et visible a des tiers.**

**Un agent qui invoque ce skill execute normalement les deux etapes** — c'est la definition du skill (STD-032 §2.7, §2.9 : le repo doit exister). La seule exception connue a ce jour est celle du ticket qui a ecrit ce skill (**T-20260922-0062**, borne de perimetre : ecrire sans executer, la creation reelle du depot devant etre demandee explicitement au dirigeant). **Cette exception ne generalise pas** : elle ne s'applique qu'a ce ticket precis, pas a un usage futur normal du skill. Un futur appelant qui a recu un mandat clair d'aller jusqu'au bout (ex. koksoak sur D-20260922-0002) execute les deux etapes sans re-demander.

## Prerequis

- Node.js >= 20 (le scaffold genere n'a **aucune dependance npm** — I6 STD-032, "sans dependance Somtech")
- `gh` CLI authentifie, **uniquement pour l'etape 2** (publication)
- Docker, optionnel, pour valider l'image avant publication

## Etape 1 : Preflight

```bash
# Le repo cible ne doit pas deja exister
gh repo view somtech-departement-ia/ops-discovery >/dev/null 2>&1 && \
  echo "ERREUR: somtech-departement-ia/ops-discovery existe deja — pas de re-scaffold, voir /deploy-departement-ia pour une mise a jour" && exit 1

# gh authentifie (necessaire seulement avant l'etape 4, publication)
gh auth status
```

## Etape 2 : Collecte des inputs

| Parametre | Question | Validation |
|---|---|---|
| `DEPARTMENT_NAME` | "Nom du Departement IA cible (slug) ?" | ex. `dept-ia-actionprogex-prod`, ou `dept-ia-somtech-interne` pour l'usine (STD-032 I11) |
| `ORGANIZATION_NAME` | "Nom humain de l'organisation ?" | ex. `Action Progex`, `Somtech` |
| `AUTH_MODE` | "Mode d'auth de l'endpoint : public / bearer / network ?" | `public` par defaut (I4) ; `network` pour un hote sans IP publique joignable seulement par Tailscale (amendement 2026-09-22, I11) ; `bearer` pour un Departement sensible (§2.5) |

## Etape 3 : Generation locale

```bash
.claude/skills/scaffold-ops-discovery/scripts/generate-scaffold.sh \
  <DEST_DIR> "<DEPARTMENT_NAME>" "<ORGANIZATION_NAME>" "<AUTH_MODE>"
```

Produit dans `<DEST_DIR>` :

| Fichier | Contenu |
|---|---|
| `Dockerfile` | `node:20-alpine`, `HEALTHCHECK` sur `/health`, zero dependance npm |
| `package.json` | `name: ops-discovery`, `scripts.start`, `scripts.test` |
| `src/server.js` | Serveur HTTP natif Node : `GET /health`, `GET /metrics`, `GET /.well-known/agents.json` |
| `src/config.js` | Charge et valide `config.yaml` (enum `auth.mode`, defauts) |
| `src/metrics.js` | Registre Prometheus des 8 compteurs + 1 histogramme de STD-032 §2.8 |
| `src/agents-response.js` | Construit la reponse §2.4 depuis la config (agents statiques, `status: "unknown"` — aucun pull cable) |
| `src/yaml-lite.js` | Parseur YAML minimal (zero dependance) pour `config.yaml` |
| `config.example.yaml` | A copier en `config.yaml`, `agents: []` a completer par l'operateur |
| `.well-known/agents.json.example` | Exemple statique conforme au schema `isomorphic_version: "1.1"` |
| `README.md`, `agent.md` | Doc + conformite STD-028 §7 ("tout repo agent contient un Dockerfile, un README.md, un agent.md ou equivalent") |
| `tests/unit/*.test.js` | Les memes tests que ceux qui prouvent ce skill (§ "Comment ce skill est eprouve") — **copies dans le depot genere**, pas juste dans le pack |
| `VERSION` | Version du scaffold + date de generation |

**Idempotence** : le script refuse d'ecrire dans un `<DEST_DIR>` deja non vide (pas d'ecrasement silencieux). Un `AUTH_MODE` hors `public`/`bearer`/`network` est refuse avant toute ecriture.

## Etape 4 : Validation locale (recommande avant publication)

```bash
cd <DEST_DIR>
npm test                                    # tests unitaires, zero dependance
cp config.example.yaml config.yaml
node src/server.js &                        # demarre sur :8080
curl http://localhost:8080/health
curl http://localhost:8080/.well-known/agents.json
kill %1

docker build -t ops-discovery-local-check .
docker run --rm -d --name ops-discovery-check -p 8080:8080 ops-discovery-local-check
curl http://localhost:8080/health
docker rm -f ops-discovery-check
```

## Etape 5 : Publication GitHub — 🔴 geste irreversible

```bash
.claude/skills/scaffold-ops-discovery/scripts/publish-github.sh \
  <DEST_DIR> somtech-departement-ia/ops-discovery
```

Cree le depot GitHub (`gh repo create --private --source=. --remote=origin --push`), commit initial inclus. **Ne pas invoquer sans mandat explicite d'aller jusque-la** (cf. section ci-dessus).

## Etape 6 : Resume

Afficher : chemin du scaffold genere, `AUTH_MODE` choisi, resultat des tests locaux, URL du depot si l'etape 5 a ete executee.

## Comment ce skill est eprouve — la voie de preuve tranchee (T-20260922-0062)

**Un skill qui cree un depot ne s'eprouve pas sans en creer un — et creer le vrai depot `somtech-departement-ia/ops-discovery` est precisement le geste hors perimetre de ce ticket.** Trois etages de preuve, du plus reel au plus double, choisis pour que SEUL le geste irreversible soit double :

1. **Tests unitaires reels, zero double** (`node --test templates/tests/unit/*.test.js`) — le parseur YAML, le registre de metriques, le calcul de la reponse `agents.json`, et le serveur HTTP (via de vraies requetes HTTP locales, y compris le rejet 401 en mode `bearer`) sont testes contre du code reel. Chaque test a ete verifie capable de rougir : mutation manuelle de `metrics.js` (compteur fausse) et de `server.js` (bypass de l'auth bearer), confirmee red, puis restauration confirmee par diff identique.
2. **Generation + execution reelles** (`tests/run-tests.sh`, etages 2/2b/2c/2d/2e/2f) — le script `generate-scaffold.sh` tourne pour de vrai dans un repertoire temporaire ; les fichiers generes sont verifies presents et substitues ; **les tests copies dans le scaffold genere sont eux-memes executes** (prouve que la copie ne casse pas les chemins relatifs) ; **le serveur genere demarre reellement** et repond a de vraies requetes `curl` ; **l'image Docker generee est reellement construite et lancee**, `/health` verifie via le port mappe du conteneur. Rien n'est simule a cet etage : c'est le meme Dockerfile, le meme serveur, qui tourneraient en production.
3. **Publication GitHub — SEUL etage double** (`tests/doubles/gh`) — `scripts/publish-github.sh` est execute pour de vrai, mais contre un **double fidele** de `gh` (place en tete de `PATH`) qui : (a) valide la presence des flags `--private --source=. --remote=origin --push` plutot que de les ignorer — un double qui accepterait n'importe quel argument fabriquerait un defaut silencieux (cf. principe "un double trop simple invente un defaut") ; (b) journalise l'argv exact de chaque appel pour assertion ; (c) simule un `gh auth status` en echec pour prouver que `publish-github.sh` **s'arrete avant** `repo create` — jamais apres. Aucun appel reseau, aucun depot cree, a aucun moment.

**Resultat** : la generation, la config, les metriques, l'endpoint et le conteneur Docker sont eprouves de bout en bout contre du reel. Seule l'existence du depot GitHub lui-meme reste, par construction de ce ticket, non observee — c'est le geste qui restera a demander explicitement au dirigeant.

Lancer la preuve complete :

```bash
.claude/skills/scaffold-ops-discovery/tests/run-tests.sh          # avec Docker
.claude/skills/scaffold-ops-discovery/tests/run-tests.sh --skip-docker   # sans daemon Docker disponible
```

## Ce que ce skill ne fait pas (hors perimetre, cf. STD-032 §4 et T-20260922-0062)

- Aucun mecanisme de decouverte cable (pull agent-card, curateur d'architecture, self-registration — STD-032 §2.10) : le scaffold lit uniquement `config.agents` (mecanisme #1, statique), et tout agent y apparait `status: "unknown"`.
- Aucun deploiement (Droplet DO TOR1 / Mac Studio) — c'est `/deploy-departement-ia` (STD-032 §4, a creer separement) ou l'operateur du Departement (koksoak pour l'usine Somtech, D-20260922-0002).
- Aucune ecriture a la main de `agents.json` en production — STD-032 §2.10 l'interdit ; ce scaffold le calcule a chaque requete, jamais ne l'ecrit sur disque.
- Aucune validation de schema reutilisable (`/audit-agents-json`, `/audit-agents-json-drift` — STD-032 §4, skills separes a creer).

## References

- STD-032 — Discovery interne d'un Departement IA (Somcraft `01042cea-ab9c-4b9e-8f29-8b05e34a4871`) — §2.4 (schema), §2.5 (auth), §2.7 (repo/proprietaire), §2.8 (metriques), §2.9 (bootstrap), §2.10 (mecanismes de decouverte), §4 (perimetre de ce skill)
- STD-028 — Organisation des repos GitHub pour les agents IA (Somcraft `6c6ef8ec-c5e5-4691-a9d9-2f386bb42090`) — §2.3 nommage, §7 verifications automatisables (Dockerfile/README/agent.md)
- ADR-030 — Cadre semantique du Departement IA Somtech
- ADR-043 — 1 Droplet DO TOR1 par Departement IA (Mac Studio pour le Departement IA interne Somtech, I11)
- Ticket T-20260922-0062 · Demande D-20260922-0002 (Departement IA Somtech) · Jalon J-20260814-0002
