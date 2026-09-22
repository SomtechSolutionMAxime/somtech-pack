#!/usr/bin/env bash
# Harnais de preuve du skill /scaffold-ops-discovery — la "voie de preuve"
# tranchee pour T-20260922-0062 : voir SKILL.md section "Comment ce skill est
# eprouve" pour la justification complete.
#
# Trois etages, du plus reel au plus double :
#   1. Tests unitaires (node --test) sur templates/src — code reel, zero double.
#   2. Generation locale + le serveur genere REELLEMENT demarre et repond
#      (curl reel), + build ET run REEL de l'image Docker generee.
#   3. scripts/publish-github.sh — SEUL etage double : il appellerait `gh repo
#      create somtech-departement-ia/ops-discovery`, action irreversible et
#      hors perimetre (regle d'or 7). On verifie qu'il appelle `gh` avec les
#      bons arguments, jamais qu'il cree un vrai depot.
#
# Sortie non-nulle si un test echoue. `--skip-docker` saute l'etage Docker
# (environnement sans daemon Docker).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKIP_DOCKER=false
[ "${1:-}" = "--skip-docker" ] && SKIP_DOCKER=true

PASS=0
FAIL=0
FAILED_NAMES=()

report() {
  local name="$1" status="$2"
  if [ "$status" = "0" ]; then
    echo "  OK   $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $name"
    FAIL=$((FAIL + 1))
    FAILED_NAMES+=("$name")
  fi
}

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/ops-discovery-scaffold-test.XXXXXX")"
cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" >/dev/null 2>&1 || true
  [ "$SKIP_DOCKER" = false ] && docker rm -f ops-discovery-scaffold-test >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "== Etage 1 : tests unitaires (templates/src, zero double) =="
if node --test "$SKILL_DIR/templates/tests/unit/"*.test.js > "$WORKDIR/unit-tests.log" 2>&1; then
  report "tests unitaires templates/src" 0
else
  report "tests unitaires templates/src" 1
  cat "$WORKDIR/unit-tests.log"
fi

echo "== Etage 2 : generation locale + serveur reel + Docker reel =="

DEST="$WORKDIR/generated"
if "$SKILL_DIR/scripts/generate-scaffold.sh" "$DEST" "dept-ia-test" "Test Org" "public" > "$WORKDIR/gen.log" 2>&1; then
  report "generate-scaffold.sh produit un scaffold" 0
else
  report "generate-scaffold.sh produit un scaffold" 1
  cat "$WORKDIR/gen.log"
fi

EXPECTED_FILES=(
  "Dockerfile" ".dockerignore" ".gitignore" "package.json" "README.md" "agent.md"
  "config.example.yaml" "VERSION" "src/server.js" "src/config.js" "src/metrics.js"
  "src/agents-response.js" "src/yaml-lite.js" ".well-known/agents.json.example"
  "tests/unit/server.test.js"
)
missing=0
for f in "${EXPECTED_FILES[@]}"; do
  [ -f "$DEST/$f" ] || { echo "    manquant: $f"; missing=1; }
done
report "tous les fichiers attendus (STD-028 §7 : Dockerfile+README+agent.md, STD-032 §4)" "$missing"

grep -q "dept-ia-test" "$DEST/config.example.yaml" 2>/dev/null
report "placeholders substitues dans config.example.yaml" $?

echo "== Etage 2b : les tests copies dans le scaffold genere passent AUSSI apres copie =="
if (cd "$DEST" && node --test tests/unit/*.test.js) > "$WORKDIR/copied-tests.log" 2>&1; then
  report "tests copies dans le depot genere (chemins relatifs corrects post-copie)" 0
else
  report "tests copies dans le depot genere (chemins relatifs corrects post-copie)" 1
  cat "$WORKDIR/copied-tests.log"
fi

echo "== Etage 2c : le scaffold genere refuse d'ecraser une destination non vide =="
"$SKILL_DIR/scripts/generate-scaffold.sh" "$DEST" "autre" "autre" "public" > "$WORKDIR/overwrite.log" 2>&1
overwrite_status=$?
if [ "$overwrite_status" -ne 0 ] && grep -q "existe deja et n'est pas vide" "$WORKDIR/overwrite.log"; then
  report "refus d'ecraser une destination non vide" 0
else
  report "refus d'ecraser une destination non vide" 1
fi

echo "== Etage 2d : auth mode invalide refuse avant toute ecriture =="
BAD_DEST="$WORKDIR/generated-bad-auth"
"$SKILL_DIR/scripts/generate-scaffold.sh" "$BAD_DEST" "dept" "org" "yolo" > "$WORKDIR/bad-auth.log" 2>&1
bad_auth_status=$?
if [ "$bad_auth_status" -ne 0 ] && [ ! -d "$BAD_DEST" ]; then
  report "auth mode invalide refuse, rien ecrit (coherent config.js VALID_AUTH_MODES)" 0
else
  report "auth mode invalide refuse, rien ecrit (coherent config.js VALID_AUTH_MODES)" 1
fi

echo "== Etage 2e : le serveur genere demarre reellement et repond =="
cp "$DEST/config.example.yaml" "$DEST/config.yaml"
(cd "$DEST" && node src/server.js > "$WORKDIR/server.log" 2>&1 &)
sleep 0.6
SERVER_PID=$(pgrep -f "$DEST/src/server.js" | head -1 || true)

health_body=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null || echo "000")
if [ "$health_body" = "200" ]; then
  report "GET /health reel (serveur genere, pas templates/) -> 200" 0
else
  report "GET /health reel (serveur genere, pas templates/) -> 200" 1
fi

metrics_body=$(curl -s http://localhost:8080/metrics 2>/dev/null || echo "")
if echo "$metrics_body" | grep -q "^agents_total 0$"; then
  report "GET /metrics reel expose agents_total" 0
else
  report "GET /metrics reel expose agents_total" 1
fi

[ -n "$SERVER_PID" ] && kill "$SERVER_PID" >/dev/null 2>&1 || true
unset SERVER_PID

if [ "$SKIP_DOCKER" = true ]; then
  echo "== Etage 2f : Docker SAUTE (--skip-docker) =="
else
  echo "== Etage 2f : build ET run REELS de l'image Docker generee =="
  if docker build -t ops-discovery-scaffold-test "$DEST" > "$WORKDIR/docker-build.log" 2>&1; then
    report "docker build de l'image generee" 0
  else
    report "docker build de l'image generee" 1
    tail -30 "$WORKDIR/docker-build.log"
  fi

  if docker run -d --rm --name ops-discovery-scaffold-test -p 18080:8080 ops-discovery-scaffold-test > "$WORKDIR/docker-run.log" 2>&1; then
    report "docker run de l'image generee" 0
  else
    report "docker run de l'image generee" 1
    cat "$WORKDIR/docker-run.log"
  fi

  sleep 1
  docker_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:18080/health 2>/dev/null || echo "000")
  if [ "$docker_health" = "200" ]; then
    report "GET /health via le conteneur Docker reel -> 200" 0
  else
    report "GET /health via le conteneur Docker reel -> 200" 1
    docker logs ops-discovery-scaffold-test 2>&1 | tail -20
  fi

  docker rm -f ops-discovery-scaffold-test >/dev/null 2>&1 || true
fi

echo "== Etage 3 : publish-github.sh — DOUBLE de gh, aucun depot reel cree =="

GH_DOUBLE_LOG="$WORKDIR/gh-calls.log"
export GH_DOUBLE_LOG
: > "$GH_DOUBLE_LOG"

PUBLISH_DEST="$WORKDIR/generated-for-publish"
"$SKILL_DIR/scripts/generate-scaffold.sh" "$PUBLISH_DEST" "dept-ia-test" "Test Org" "public" > /dev/null 2>&1

PATH_WITH_DOUBLE="$SKILL_DIR/tests/doubles:$PATH"
if PATH="$PATH_WITH_DOUBLE" "$SKILL_DIR/scripts/publish-github.sh" "$PUBLISH_DEST" "somtech-departement-ia/ops-discovery" > "$WORKDIR/publish.log" 2>&1; then
  report "publish-github.sh reussit contre le double gh" 0
else
  report "publish-github.sh reussit contre le double gh" 1
  cat "$WORKDIR/publish.log"
fi

if grep -q '"auth","status"' "$GH_DOUBLE_LOG" && grep -q '"repo","create","somtech-departement-ia/ops-discovery"' "$GH_DOUBLE_LOG"; then
  report "gh appele avec auth status PUIS repo create <org>/<repo> exact" 0
else
  report "gh appele avec auth status PUIS repo create <org>/<repo> exact" 1
  cat "$GH_DOUBLE_LOG"
fi

if grep -q '"--private"' "$GH_DOUBLE_LOG" && grep -q '"--source=."' "$GH_DOUBLE_LOG" && grep -q '"--push"' "$GH_DOUBLE_LOG"; then
  report "flags --private --source=. --push presents (STD-028 ACL)" 0
else
  report "flags --private --source=. --push presents (STD-028 ACL)" 1
fi

echo "== Etage 3b : publish-github.sh s'arrete AVANT repo create si gh non authentifie =="
: > "$GH_DOUBLE_LOG"
PUBLISH_DEST2="$WORKDIR/generated-for-publish-2"
"$SKILL_DIR/scripts/generate-scaffold.sh" "$PUBLISH_DEST2" "dept-ia-test" "Test Org" "public" > /dev/null 2>&1

GH_DOUBLE_AUTH_FAIL=1 PATH="$PATH_WITH_DOUBLE" "$SKILL_DIR/scripts/publish-github.sh" "$PUBLISH_DEST2" "somtech-departement-ia/ops-discovery" > "$WORKDIR/publish-fail.log" 2>&1
publish_fail_status=$?

if [ "$publish_fail_status" -ne 0 ] && ! grep -q '"repo","create"' "$GH_DOUBLE_LOG"; then
  report "gate auth : repo create jamais appele si non authentifie" 0
else
  report "gate auth : repo create jamais appele si non authentifie" 1
  cat "$GH_DOUBLE_LOG"
fi

echo
echo "=================================================="
echo "  $PASS OK, $FAIL FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "  echecs: ${FAILED_NAMES[*]}"
fi
echo "=================================================="

[ "$FAIL" -eq 0 ]
