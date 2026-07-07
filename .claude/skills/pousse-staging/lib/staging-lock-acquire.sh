#!/usr/bin/env bash
# ============================================================
# staging-lock-acquire.sh — v1.0.0
# Résout le CONTEXTE d'acquisition du verrou de sas staging pour /pousse-staging
# (story T-20260706-0007, epic verrou de sas E-20260706-0001).
#
# Ce helper NE fait PAS l'appel MCP lui-même (seul l'agent qui exécute le skill
# peut appeler `applications.lock_acquire`). Il fait la partie SCRIPTABLE et
# testable : lire l'app liée, déterminer le détenteur, et TRANCHER si le verrou
# s'applique — puis émettre soit les paramètres prêts pour l'appel MCP, soit une
# décision SKIP/FAIL.
#
# Modèle de décision (décision Maxime 2026-07-07 — OPT-IN par app.yaml) :
#   • .somtech/app.yaml ABSENT      → DECISION=SKIP  (rc 0) : le repo n'a pas opté
#     au verrou → /pousse-staging continue SANS verrou (l'Étape 1.5 « slot »
#     git-trailer reste le filet). Ne casse aucun repo non lié.
#   • app.yaml présent, app_id vide → DECISION=FAIL  (rc 5) : le verrou EST censé
#     être actif mais l'identité de l'app manque → fail-CLOSED, STOP.
#   • pas de PR pour la branche      → DECISION=FAIL  (rc 6) : le détenteur du
#     verrou est le n° de PR (stable au rebase) ; sans PR, pas d'identité de
#     livraison → fail-CLOSED, STOP (ouvrir la PR d'abord — règle PR-tôt).
#   • sinon                          → DECISION=READY (rc 0) : émet application_id,
#     env, holder_pr, holder_label → l'agent fait l'appel MCP lock_acquire.
#
# Le fail-CLOSED sur « MCP injoignable / clé KO » se produit APRÈS ce helper, au
# moment de l'appel MCP côté agent (le helper ne parle pas au réseau MCP).
#
# Sourçable (fonctions à code retour) ou exécution directe (sla_resolve).
#
# Points d'injection (override tests/CI) :
#   SLA_APP_YAML    chemin du mapping app (défaut .somtech/app.yaml)
#   SLA_ENV         environnement verrouillé (défaut staging)
#   SLA_HOLDER_PR   si DÉFINIE (même vide), court-circuite `gh pr view` — permet
#                   de tester « pas de PR » (SLA_HOLDER_PR="") sans réseau.
# ============================================================

# Extrait servicedesk.app_id de .somtech/app.yaml (posé par /lier-app).
# Le champ vit sous la section `servicedesk:` — on le résout en respectant la
# section pour ne pas confondre avec un éventuel autre `*_id:` du fichier.
sla_read_app_id() {
  local file="$1"
  [ -f "$file" ] || return 1
  awk '
    /^[^[:space:]#]/ { in_sd = ($0 ~ /^servicedesk:/) ? 1 : 0 }   # section top-level
    in_sd && /^[[:space:]]+app_id:[[:space:]]*/ {
      sub(/^[[:space:]]+app_id:[[:space:]]*/, "")
      gsub(/^["'"'"']|["'"'"']$/, "")                              # trim quotes
      gsub(/[[:space:]]+$/, "")                                    # trim trailing ws
      print; exit
    }
  ' "$file"
}

# Numéro de PR détenteur pour la branche courante. Override par SLA_HOLDER_PR si
# définie (tests/CI). Vide = pas de PR ouverte.
sla_holder_pr() {
  if [ -n "${SLA_HOLDER_PR+x}" ]; then
    printf '%s' "$SLA_HOLDER_PR"
    return 0
  fi
  command -v gh >/dev/null 2>&1 || return 0
  gh pr view --json number -q '.number' 2>/dev/null || true
}

# Résout le contexte et tranche. Usage : sla_resolve <current_branch>
# Émet des lignes KEY=VALUE + DECISION sur stdout. Code retour = voir en-tête.
sla_resolve() {
  local current_branch="$1"
  local yaml="${SLA_APP_YAML:-.somtech/app.yaml}"
  local env="${SLA_ENV:-staging}"
  local app_id holder_pr

  if [ ! -f "$yaml" ]; then
    echo "DECISION=SKIP"
    echo "REASON=repo non lié (${yaml} absent) — verrou de sas non applicable, on continue sans verrou"
    return 0
  fi

  app_id="$(sla_read_app_id "$yaml")"
  if [ -z "$app_id" ]; then
    echo "DECISION=FAIL"
    echo "REASON=${yaml} présent mais servicedesk.app_id manquant/vide — fail-CLOSED (STOP)"
    return 5
  fi

  holder_pr="$(sla_holder_pr)"
  if [ -z "$holder_pr" ]; then
    echo "DECISION=FAIL"
    echo "REASON=aucune PR ouverte pour '${current_branch}' — ouvre la PR (règle PR-tôt) avant de verrouiller (fail-CLOSED, STOP)"
    return 6
  fi

  echo "DECISION=READY"
  echo "application_id=${app_id}"
  echo "env=${env}"
  echo "holder_pr=${holder_pr}"
  echo "holder_label=${current_branch}"
  return 0
}

# Exécution directe (non sourcé) : résout pour la branche courante.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  sla_resolve "${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null)}"
fi
