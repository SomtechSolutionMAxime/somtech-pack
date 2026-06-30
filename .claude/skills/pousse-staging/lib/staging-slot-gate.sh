#!/usr/bin/env bash
# ============================================================
# staging-slot-gate.sh — v1.0.0
# Gate « slot unique » pour /pousse-staging.
#
# Objectif : faire de `staging` un SAS À UNE SEULE LIVRAISON. Tant que
# ce qui est sur staging n'est pas rendu sur `main` (= déployé en prod),
# on refuse une AUTRE livraison. Traduit techniquement la règle d'or n°4
# (un ticket à la fois jusqu'en prod, jamais de bundle).
#
# Granularité : SLOT PAR LIVRAISON.
#   - Si staging == main (en contenu)            → slot LIBRE, on pousse.
#   - Si staging diverge mais l'occupant EST ma  → ITÉRATION QA de ma
#     branche courante                              propre livraison, autorisée.
#   - Si staging diverge et l'occupant est une   → BLOQUÉ : merge la
#     AUTRE branche (ou inconnu/legacy)             livraison en prod d'abord.
#
# Comment on sait QUI occupe le slot : chaque squash-merge dans staging
# (Étape 3 du skill) pose un trailer `Staging-Source: <branche>` sur le
# commit. Le gate lit le trailer du HEAD de staging.
#
# Invariant du workflow (garanti par les règles Somtech) :
#   - staging n'avance QUE via /pousse-staging (squash-merge).
#   - main n'avance QUE via /merge (PR staging→main).
#   Donc après chaque /merge, le tree de main == tree de staging (slot vidé),
#   et le seul commit « en attente » sur staging est le dernier squash —
#   d'où la lecture du trailer du HEAD de staging.
#
# Détection LIBRE/OCCUPÉ par `git diff --quiet` (comparaison de tree), pas
# par l'historique : robuste que /merge fasse un squash ou un merge-commit.
#
# Conçu pour être SOURCÉ (les fonctions retournent un code, elles ne tuent
# pas le shell appelant) ET exécutable directement (`ssg_run_gate`).
#
# Points d'injection (env), surtout pour les tests :
#   SSG_REMOTE          remote git            (def: origin)
#   SSG_MAIN_BRANCH     branche prod          (def: main)
#   SSG_STAGING_BRANCH  branche staging       (def: staging)
#   SSG_MAIN_REF        ref prod à comparer   (def: <REMOTE>/<MAIN_BRANCH>)
#   SSG_STAGING_REF     ref staging           (def: <REMOTE>/<STAGING_BRANCH>)
#   SSG_FETCH           1 = git fetch, 0 = skip (def: 1)
#
# Codes de retour de ssg_run_gate :
#   0  slot LIBRE, ou itération de MA propre livraison (sûr de pousser)
#   4  slot OCCUPÉ par une AUTRE livraison (ou occupant inconnu/legacy) → STOP
# ============================================================

# Extrait la valeur du trailer `Staging-Source:` d'un commit (lecture seule).
# Vide si le commit n'a pas de trailer (legacy / push direct).
ssg_source_of() {
  local ref="${1:?ssg_source_of: ref requise}"
  git show -s --format='%B' "$ref" 2>/dev/null \
    | grep -iE '^[[:space:]]*Staging-Source:[[:space:]]*' \
    | tail -1 \
    | sed -E 's/^[[:space:]]*[Ss]taging-[Ss]ource:[[:space:]]*//; s/[[:space:]]*$//'
}

# Orchestration complète du gate. Voir codes de retour ci-dessus.
# $1 = branche courante (def: branche git courante).
ssg_run_gate() {
  local current="${1:-$(git symbolic-ref --short -q HEAD 2>/dev/null)}"
  local remote="${SSG_REMOTE:-origin}"
  local main_branch="${SSG_MAIN_BRANCH:-main}"
  local staging_branch="${SSG_STAGING_BRANCH:-staging}"
  local main_ref="${SSG_MAIN_REF:-${remote}/${main_branch}}"
  local staging_ref="${SSG_STAGING_REF:-${remote}/${staging_branch}}"
  local do_fetch="${SSG_FETCH:-1}"

  # 1. Fetch main + staging (best-effort). Pas de remote => gate ignoré.
  if [ "$do_fetch" = "1" ]; then
    if ! git fetch "$remote" "$main_branch" "$staging_branch" >/dev/null 2>&1; then
      echo "ssg: impossible de fetch ${remote} (${main_branch}/${staging_branch}) — gate ignoré."
      return 0
    fi
  fi

  # Les deux refs doivent exister, sinon rien à comparer.
  if ! git rev-parse --verify --quiet "$main_ref" >/dev/null 2>&1 \
     || ! git rev-parse --verify --quiet "$staging_ref" >/dev/null 2>&1; then
    echo "ssg: ref '${main_ref}' ou '${staging_ref}' introuvable — gate ignoré."
    return 0
  fi

  # 2. Slot LIBRE si « staging n'a rien en attente de prod ». Deux signaux,
  #    en OR (l'un OU l'autre suffit) — couvre les deux façons dont /merge
  #    peut integrer staging dans main :
  #
  #    (a) MEME TREE  : `git diff --quiet main staging`. Robuste au
  #        SQUASH-merge (le squash casse l'ancestralite, mais le contenu
  #        absolu reste identique). C'est le seul signal qui survit a un
  #        squash.
  #    (b) ANCETRE    : `rev-list --count main..staging == 0` (staging
  #        n'apporte aucun commit absent de main). Robuste quand main a
  #        AVANCE au-dessus de staging (merge-commit classique puis commit
  #        suivant en prod) — evite un faux positif ou le tree differe alors
  #        que tout staging est deja en prod.
  local ahead
  ahead="$(git rev-list --count "${main_ref}..${staging_ref}" 2>/dev/null || echo 1)"
  if git diff --quiet "$main_ref" "$staging_ref" 2>/dev/null || [ "$ahead" = "0" ]; then
    echo "ssg: slot LIBRE — staging est à jour avec ${main_branch} (rien en attente de prod)."
    return 0
  fi

  # 3. Slot OCCUPÉ : qui détient le sas ? Trailer du HEAD de staging.
  local occupant
  occupant="$(ssg_source_of "$staging_ref")"

  if [ -n "$occupant" ] && [ "$occupant" = "$current" ]; then
    echo "ssg: slot occupé par TA livraison ('${current}') — itération QA autorisée."
    return 0
  fi

  echo "ssg: ⛔ staging est OCCUPÉ par une livraison non encore rendue en prod."
  if [ -n "$occupant" ]; then
    echo "ssg:    Occupant : '${occupant}'. Ta branche : '${current:-?}'."
  else
    echo "ssg:    Occupant : inconnu (commit sans trailer Staging-Source — legacy/push manuel)."
  fi
  echo "ssg:    Règle du sas : une seule livraison sur staging à la fois, jusqu'en prod."
  echo "ssg:    → Termine la livraison en cours : merge la PR staging→main (/merge),"
  echo "ssg:      puis relance /pousse-staging. Le slot sera alors libre."
  return 4
}

# Exécution directe (pas sourcé) : lancer le gate.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  ssg_run_gate "$@"
fi
