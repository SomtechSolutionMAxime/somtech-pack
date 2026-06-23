#!/usr/bin/env bash
# ============================================================
# staging-migration-gate.sh — v1.0.0
# Gate migrations multi-contributeur pour /pousse-staging.
#
# Objectif : attraper EN LOCAL les collisions de migrations entre
# contributeurs concurrents AVANT de pousser sur staging.
#
# Mécanisme : la branche feat est coupée de `main` et `supabase db reset`
# est AVEUGLE aux migrations qu'un voisin vient de pousser sur staging.
# Ce gate fetch `origin/staging`, et si des migrations y existent qui
# manquent dans la branche feat, il les merge puis rejoue TOUTES les
# migrations en local (`supabase db reset`). Une collision (timestamp
# dupliqué, conflit d'ordre, conflit de schéma) échoue alors EN LOCAL —
# pas sur staging (le pire endroit).
#
# No-op STRICT en mode solo : si staging n'est pas divergent (aucune
# migration manquante), le gate ne fait rien et ne prompt pas.
#
# Conçu pour être SOURCÉ (les fonctions retournent un code, elles ne
# tuent pas le shell appelant) ET exécutable directement (`smg_run_gate`).
#
# Points d'injection (env), surtout pour les tests :
#   SMG_MIGRATIONS_DIR   répertoire des migrations (def: supabase/migrations)
#   SMG_REMOTE           remote git           (def: origin)
#   SMG_STAGING_BRANCH   branche staging      (def: staging)
#   SMG_STAGING_REF      ref à comparer/merger (def: <REMOTE>/<STAGING_BRANCH>)
#   SMG_FETCH            1 = git fetch staging, 0 = skip (def: 1)
#   SMG_DB_RESET_CMD     commande de reset DB (def: supabase db reset)
#
# Codes de retour de smg_run_gate :
#   0  no-op (solo / déjà à jour) OU merge + db reset OK (sûr de pousser)
#   2  conflit git lors du merge de staging (résolution manuelle requise)
#   3  collision attrapée EN LOCAL par db reset (corriger avant de pousser)
# ============================================================

# Liste les migrations (basenames .sql) présentes dans <staging_ref>
# mais absentes de HEAD. Lecture seule. Vide = pas de divergence.
smg_detect_divergence() {
  local mig_dir="${1:-${SMG_MIGRATIONS_DIR:-supabase/migrations}}"
  local staging_ref="${2:-${SMG_STAGING_REF:-${SMG_REMOTE:-origin}/${SMG_STAGING_BRANCH:-staging}}}"

  # Hypothèse : migrations à plat dans <mig_dir> (convention Supabase),
  # donc la comparaison par basename est sans ambiguïté. Si un jour des
  # sous-dossiers sont introduits sous <mig_dir>, comparer sur chemins
  # relatifs plutôt que basenames pour éviter un collapse de noms.
  local staging_files local_files
  staging_files="$(git ls-tree -r --name-only "$staging_ref" -- "$mig_dir" 2>/dev/null \
    | grep -E '\.sql$' | sed 's#.*/##' | sort -u)"
  local_files="$(git ls-tree -r --name-only HEAD -- "$mig_dir" 2>/dev/null \
    | grep -E '\.sql$' | sed 's#.*/##' | sort -u)"

  comm -23 <(printf '%s\n' "$staging_files") <(printf '%s\n' "$local_files") \
    | grep -E '\.sql$' || true
}

# Orchestration complète du gate. Voir codes de retour ci-dessus.
smg_run_gate() {
  local mig_dir="${SMG_MIGRATIONS_DIR:-supabase/migrations}"
  local remote="${SMG_REMOTE:-origin}"
  local staging_branch="${SMG_STAGING_BRANCH:-staging}"
  local staging_ref="${SMG_STAGING_REF:-${remote}/${staging_branch}}"
  local reset_cmd="${SMG_DB_RESET_CMD:-supabase db reset}"
  local do_fetch="${SMG_FETCH:-1}"

  # 1. Fetch staging (best-effort). Pas de remote staging => gate ignoré.
  if [ "$do_fetch" = "1" ]; then
    if ! git fetch "$remote" "$staging_branch" >/dev/null 2>&1; then
      echo "smg: impossible de fetch ${remote}/${staging_branch} — gate ignoré (pas de staging distant ?)."
      return 0
    fi
  fi

  # La ref staging doit exister, sinon rien à comparer.
  if ! git rev-parse --verify --quiet "$staging_ref" >/dev/null 2>&1; then
    echo "smg: ref '${staging_ref}' introuvable — gate ignoré."
    return 0
  fi

  # 2. Détecter la divergence.
  local missing
  missing="$(smg_detect_divergence "$mig_dir" "$staging_ref")"
  if [ -z "$missing" ]; then
    echo "smg: staging non divergent (mode solo / déjà à jour) — no-op."
    return 0
  fi

  echo "smg: migrations présentes sur ${staging_ref} absentes de la branche feat :"
  printf '  - %s\n' $missing

  # 3. Merger staging dans la branche feat (amène les migrations voisines).
  if ! git merge --no-edit "$staging_ref"; then
    echo "smg: ⚠️  CONFLIT git lors du merge de ${staging_ref}."
    echo "smg:    Le merge est EN COURS — la branche feat est mi-mergée."
    echo "smg:    Option A : 'git merge --abort' pour revenir à l'état d'avant le gate."
    echo "smg:    Option B : résoudre les conflits, 'git commit', puis relancer /pousse-staging."
    return 2
  fi

  # 4. Rejouer TOUTES les migrations en local sur une base vierge.
  echo "smg: lancement de '${reset_cmd}' pour rejouer toutes les migrations en LOCAL…"
  if ! eval "$reset_cmd"; then
    echo "smg: ❌ COLLISION de migrations attrapée EN LOCAL par db reset."
    echo "smg:    Corriger (renommer/réordonner/fusionner la migration) AVANT de pousser sur staging."
    return 3
  fi

  echo "smg: ✅ db reset OK après merge de staging — pas de collision, sûr de pousser sur staging."
  return 0
}

# Exécution directe (pas sourcé) : lancer le gate.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  smg_run_gate "$@"
fi
