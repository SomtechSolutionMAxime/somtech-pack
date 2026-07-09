# shellcheck shell=bash
# ============================================================
# swt-db.sh — v0.1.0
# BD Supabase isolée et légère par worktree claude-swt (D-20260709-0003).
#
# Lib PURE : ne définit que des fonctions, aucun effet de bord au chargement.
# Interface par arguments — ne connaît pas claude-swt (testable en isolation).
# Sourcée par claude-swt.sh pour provisionner/arrêter une stack Supabase élaguée
# par worktree.
#
# Modèle : chaque worktree obtient un project_id unique + un offset de ports
# (delta = offset × 20) dans la plage réservée 54321-54499. Le profil choisit
# quels services démarrer via `supabase start -x <exclus>`.
#
# Design : docs/superpowers/specs/2026-07-09-bd-par-worktree-claude-swt-design.md
#
# Fonctions publiques :
#   swt_db_excludes <db|auth|full>          -> liste CSV des services à exclure (-x)
#   swt_db_alloc_offset <sess> <taken_csv>  -> offset libre [1..8] non-collidant
#   swt_db_api_port <offset>                -> port de l'API Supabase pour cet offset
#   swt_db_patch_config <cfg> <pid> <off>   -> décale les ports + project_id + skip-worktree
#   swt_db_write_env <dir> <url> <anon> <svc> -> écrit .env.local (gitignored) du worktree
# ============================================================

# Nombre d'offsets worktree disponibles (1..8) et pas de décalage entre stacks.
# 8 × 20 = 160 → dernier bloc à 54320+160 = 54480..54489, dans 54321-54499.
# On démarre à 1 (offset 0 = ports 5432x par défaut, réservés au dev hors worktree).
: "${SWT_DB_MAX_OFFSET:=8}"
: "${SWT_DB_STRIDE:=20}"

# swt_db_excludes <profile> — services à passer à `supabase start -x`.
# Noms réels du CLI Supabase 2.78+ :
#   gotrue realtime storage-api imgproxy kong mailpit postgrest
#   postgres-meta studio edge-runtime logflare vector supavisor
#
# Profils (validés par le benchmark T-20260709-0037) :
#   db   = Postgres SEUL — migrations, SQL direct, db reset. Le plus léger.
#          PostgREST sans kong échoue au health check du CLI → l'API REST monte
#          au profil auth. On exclut donc les 13 services excludables.
#   auth = Postgres + PostgREST + postgres-meta + GoTrue + kong — RLS avec
#          auth.uid() + API REST. ~293 Mo mesuré (-82 % vs full).
#   full = stack complète (comportement CLI par défaut). ~1673 Mo mesuré.
swt_db_excludes() {
  case "${1:-}" in
    db)   printf '%s' 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor' ;;
    auth) printf '%s' 'realtime,storage-api,imgproxy,mailpit,studio,edge-runtime,logflare,vector,supavisor' ;;
    full) printf '%s' '' ;;
    *)    return 1 ;;
  esac
}

# swt_db_alloc_offset <sess> <taken_csv> — offset [1..8] libre pour cette session.
# Déterministe : dérive un candidat du hash de <sess>, puis avance circulairement
# jusqu'au premier offset absent de <taken_csv> (CSV d'offsets déjà vivants).
# Retourne 1 si la plage est pleine.
swt_db_alloc_offset() {
  local sess="${1:-}" taken="${2:-}" max="${SWT_DB_MAX_OFFSET:-8}"
  local h cand i o
  h=$(printf '%s' "$sess" | cksum | awk '{print $1}')
  cand=$(( h % max + 1 ))
  for i in $(seq 0 $(( max - 1 )) ); do
    o=$(( (cand - 1 + i) % max + 1 ))
    case ",$taken," in
      *",$o,"*) : ;;                       # offset déjà pris
      *) printf '%s' "$o"; return 0 ;;
    esac
  done
  return 1
}

# swt_db_api_port <offset> — port de l'API (kong) Supabase pour cet offset.
swt_db_api_port() {
  local off="${1:-0}" stride="${SWT_DB_STRIDE:-20}"
  printf '%s' $(( 54321 + off * stride ))
}

# swt_db_patch_config <config_path> <project_id> <offset>
# Décale tous les ports locaux (543xx) de offset×20, remplace project_id, puis
# masque le fichier de git status via skip-worktree (protège l'auto-teardown de
# claude-swt). L'ordre ports-puis-id évite de re-décaler un project_id qui
# contiendrait des chiffres ressemblant à un port.
swt_db_patch_config() {
  local cfg="${1:?config path}" pid="${2:?project_id}" off="${3:?offset}"
  local delta=$(( off * ${SWT_DB_STRIDE:-20} ))
  # 1) décale les ports locaux 543xx (n'affecte ni 587 SMTP ni 8083 inspector)
  perl -i -pe "s/(543\\d\\d)/\$1+$delta/ge" "$cfg"
  # 2) remplace project_id (après le décalage, jamais re-scanné)
  perl -i -pe "s/^(\\s*project_id\\s*=\\s*).*/\${1}\"$pid\"/" "$cfg"
  # 3) skip-worktree si le fichier est suivi par git
  local top rel
  top=$(git -C "$(dirname "$cfg")" rev-parse --show-toplevel 2>/dev/null) || return 0
  rel=${cfg#"$top"/}
  git -C "$top" ls-files --error-unmatch -- "$rel" >/dev/null 2>&1 \
    && git -C "$top" update-index --skip-worktree -- "$rel" 2>/dev/null
  return 0
}

# swt_db_write_env <worktree_dir> <api_url> <anon_key> <service_role_key> [db_url]
# Écrit un .env.local pointant vers la stack du worktree. N'écrit que les
# variables non vides (le profil db — Postgres seul, sans API — n'a ni URL API ni
# clés ; seul DATABASE_URL est pertinent). Ce fichier est un secret de dev local
# (service_role incluse) — jamais commité (.env.local gitignored, règle d'or n°12).
swt_db_write_env() {
  local dir="${1:?dir}" url="${2:-}" anon="${3:-}" svc="${4:-}" dburl="${5:-}"
  {
    echo "# ⚠️ Généré par claude-swt — BD Supabase isolée de ce worktree. NE PAS COMMITER."
    [ -n "$url" ]   && { echo "NEXT_PUBLIC_SUPABASE_URL=$url"; echo "SUPABASE_URL=$url"; }
    [ -n "$anon" ]  && { echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon"; echo "SUPABASE_ANON_KEY=$anon"; }
    [ -n "$svc" ]   && echo "SUPABASE_SERVICE_ROLE_KEY=$svc"
    [ -n "$dburl" ] && echo "DATABASE_URL=$dburl"
  } > "$dir/.env.local"
}

# ============================================================
# Orchestration (effets de bord : supabase CLI, Docker, registre d'offsets).
# Non couverte par les tests unitaires purs — validée par test-swt-db-integration.sh
# (nécessite Docker) et par le benchmark T-20260709-0037.
# ============================================================

# Registre d'offsets vivants : un fichier par session (contenu = offset).
: "${SWT_DB_REG:=$HOME/.claude/swt-db-offsets}"

# swt_db_taken — CSV des offsets réservés par des sessions vivantes (registre).
# Réserve un offset même quand sa stack est arrêtée (session conservée pour reprise).
swt_db_taken() {
  local f out=""
  [ -d "$SWT_DB_REG" ] || return 0
  for f in "$SWT_DB_REG"/*; do
    [ -e "$f" ] || continue
    out="$out,$(cat "$f" 2>/dev/null)"
  done
  printf '%s' "${out#,}"
}

# swt_db_busy_offsets — CSV des offsets dont le port db est DÉJÀ écouté sur la
# machine. Indispensable : le registre ne voit pas les stacks Supabase lancées
# hors de ce mécanisme (autres worktrees, `supabase start` manuel, anciens
# projets). On sonde donc les ports réels — seule source de vérité fiable.
swt_db_busy_offsets() {
  local off port out="" stride="${SWT_DB_STRIDE:-20}" max="${SWT_DB_MAX_OFFSET:-8}"
  command -v lsof >/dev/null 2>&1 || return 0
  for off in $(seq 1 "$max"); do
    port=$(( 54322 + off * stride ))           # port db du profil pour cet offset
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && out="$out,$off"
  done
  printf '%s' "${out#,}"
}

# swt_db_up <main_repo> <worktree> <sess> <profile> -> echo project_id (vide si non provisionné)
# Idempotent sur reprise : si la session a déjà un offset (registre), la config est
# déjà patchée -> on relance seulement la stack, sans re-décaler les ports.
swt_db_up() {
  local main="${1:?}" wt="${2:?}" sess="${3:?}" profile="${4:-db}"
  local cfg="$wt/supabase/config.toml"
  [ -f "$cfg" ] || return 0
  command -v supabase >/dev/null 2>&1 || { printf '⚠️  supabase CLI absent — BD non provisionnée.\n' >&2; return 0; }

  local excludes offset pid repo
  excludes=$(swt_db_excludes "$profile") || { printf '⚠️  profil inconnu: %s\n' "$profile" >&2; return 1; }
  repo=$(basename "$main")
  pid=$(printf 'swt-%s-%s' "$repo" "$sess" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | cut -c1-40)

  if [ -f "$SWT_DB_REG/$sess" ]; then
    offset=$(cat "$SWT_DB_REG/$sess")            # reprise : config déjà patchée
  else
    offset=$(swt_db_alloc_offset "$sess" "$(swt_db_taken),$(swt_db_busy_offsets)") \
      || { printf '⚠️  plage de ports worktree pleine — BD non provisionnée.\n' >&2; return 0; }
    swt_db_patch_config "$cfg" "$pid" "$offset"
    mkdir -p "$SWT_DB_REG"; printf '%s' "$offset" > "$SWT_DB_REG/$sess"
  fi

  printf '🗄️  BD worktree : profil %s, offset %s (ports +%s)…\n' \
    "$profile" "$offset" "$(( offset * ${SWT_DB_STRIDE:-20} ))" >&2
  local xarg=""; [ -n "$excludes" ] && xarg="-x $excludes"
  if ( cd "$wt" && supabase start $xarg >/dev/null 2>&1 ); then
    local env_out url anon svc dburl
    env_out=$( cd "$wt" && supabase status -o env 2>/dev/null )
    url=$(printf   '%s\n' "$env_out" | sed -n 's/^API_URL=["'\'']*\([^"'\'']*\).*/\1/p')
    anon=$(printf  '%s\n' "$env_out" | sed -n 's/^ANON_KEY=["'\'']*\([^"'\'']*\).*/\1/p')
    svc=$(printf   '%s\n' "$env_out" | sed -n 's/^SERVICE_ROLE_KEY=["'\'']*\([^"'\'']*\).*/\1/p')
    dburl=$(printf '%s\n' "$env_out" | sed -n 's/^DB_URL=["'\'']*\([^"'\'']*\).*/\1/p')
    swt_db_write_env "$wt" "$url" "$anon" "$svc" "$dburl"
    # .env.local ne doit pas apparaître dans git status (sinon l'auto-teardown de
    # claude-swt croirait à des modifications non commitées). S'il n'est pas déjà
    # ignoré, on l'exclut localement (info/exclude — non commité). Tout se fait
    # dans le cwd du worktree : git-path renvoie un chemin relatif à ce cwd, et
    # dans un worktree `.git` est un fichier (le append doit résoudre via git).
    ( cd "$wt" && {
        git check-ignore -q .env.local 2>/dev/null && exit 0
        ge=$(git rev-parse --git-path info/exclude 2>/dev/null) || exit 0
        [ -n "$ge" ] && ! grep -qxF '.env.local' "$ge" 2>/dev/null && printf '.env.local\n' >> "$ge"
      } )
    printf '%s' "$pid"
  else
    printf '⚠️  supabase start a échoué (profil %s). BD non disponible ; la session continue.\n' "$profile" >&2
    return 1
  fi
}

# swt_db_down <worktree> <sess> <destroy:0|1>
# Toujours arrêter la stack (libère RAM/CPU). destroy=1 (session terminée) : purge
# les volumes + libère l'offset. destroy=0 (session conservée) : garde l'offset et
# les données pour une reprise rapide.
swt_db_down() {
  local wt="${1:?}" sess="${2:?}" destroy="${3:-0}"
  [ -f "$wt/supabase/config.toml" ] || return 0
  command -v supabase >/dev/null 2>&1 || return 0
  if [ "$destroy" = 1 ]; then
    ( cd "$wt" && supabase stop --no-backup >/dev/null 2>&1 )
    rm -f "$SWT_DB_REG/$sess"
  else
    ( cd "$wt" && supabase stop >/dev/null 2>&1 )
  fi
}
