#!/usr/bin/env bash
# ============================================================
# staging-secret-key-gate.sh — v1.0.0
# Gate cle a droits elevees pour /pousse-staging (regle d'or n12, STD-038).
#
# Objectif : REFUSER toute cle Supabase a droits elevees (service_role /
# sb_secret_) presente dans le code livre, AVANT la poussee sur staging.
#
# Detection (voir lib/secret-key-scan.py pour le detail des deux motifs et
# le pourquoi on ne grep JAMAIS le mot "service_role").
#
# Conçu pour etre SOURCE (les fonctions retournent un code, elles ne tuent
# pas le shell appelant) ET executable directement (skg_run_gate).
#
# Points d'injection (env), surtout pour les tests :
#   SKG_PY          chemin du scanner python3 (def: secret-key-scan.py a cote de ce fichier)
#   SKG_MODE        "diff" (def, code livre vs SKG_BASE_REF) ou "tree" (tout le tracked tree)
#   SKG_BASE_REF    ref de base pour le mode diff (def: main) — meme convention que
#                   l'Etape 2.5 (git diff main..HEAD), pas de refetch ici : la fraicheur
#                   de main est acquise a l'Etape 1 du skill.
#
# Codes de retour de skg_run_gate :
#   0  aucune cle a droits elevees detectee (no-op silencieux si rien a scanner)
#   1  cle detectee — REFUS, fichier+ligne nommes (JAMAIS la valeur) dans le message
#   2  python3 introuvable — impossible de verifier -> FAIL-CLOSED (jamais un skip
#      silencieux : un gate de securite qui ne peut pas s'executer ne dit pas "RAS")
# ============================================================

# Fichiers ajoutes/modifies/renommes par la branche courante par rapport a la
# base (le "code livre") — jamais les fichiers supprimes (rien a scanner).
skg_files_diff() {
  local base="${1:-${SKG_BASE_REF:-main}}"
  git diff --name-only --diff-filter=ACMR "${base}..HEAD" 2>/dev/null
}

# Tout le tracked tree a HEAD — utilise en CI pour que la garde tienne meme
# quand personne n'est passe par le skill (aucune branche/diff a comparer).
skg_files_tree() {
  git ls-files
}

# Orchestration complete du gate. Voir codes de retour ci-dessus.
skg_run_gate() {
  local mode="${SKG_MODE:-diff}"
  local py="${SKG_PY:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/secret-key-scan.py}"

  if ! command -v python3 >/dev/null 2>&1; then
    echo "skg: ❌ python3 introuvable — IMPOSSIBLE de verifier les cles a droits elevees."
    echo "skg:    Fail-closed : la poussee est REFUSEE tant que le gate ne peut pas s'executer."
    return 2
  fi

  local files=()
  if [ "$mode" = "tree" ]; then
    while IFS= read -r f; do [ -n "$f" ] && files+=("$f"); done < <(skg_files_tree)
  else
    while IFS= read -r f; do [ -n "$f" ] && files+=("$f"); done < <(skg_files_diff)
  fi

  if [ "${#files[@]}" -eq 0 ]; then
    echo "skg: aucun fichier a verifier — no-op."
    return 0
  fi

  local out rc
  out="$(python3 "$py" "${files[@]}" 2>/dev/null)"
  rc=$?

  if [ "$rc" != "0" ]; then
    echo "skg: ⛔ cle(s) a droits elevees detectee(s) dans le code livre :"
    printf '%s\n' "$out" | sed 's/^/skg:    /'
    echo "skg:    Retire la cle (jamais en clair dans le code — STD-038 / regle d'or n12)."
    return 1
  fi

  echo "skg: ✅ aucune cle a droits elevees detectee — sur de pousser."
  return 0
}

# Execution directe (pas source) : lancer le gate.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  skg_run_gate "$@"
fi
