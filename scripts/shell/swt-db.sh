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

# swt_db_config_ports <config> — tous les ports locaux (543xx) déclarés dans la config.
# Base de tout le reste : les ports d'un worktree se DÉRIVENT de la config du projet.
# Ne jamais supposer une grille globale (54322 + offset×20) : le patch décale les ports
# D'ORIGINE, et un projet qui ne part pas des ports Supabase standard sort de la grille.
# Cas réel (D-20260714-0008) : actionprogex, db d'origine 54324 → occupait 54484 quand
# le détecteur regardait 54482. Collision invisible, `supabase start` en échec.
swt_db_config_ports() {
  local cfg="${1:?config path}"
  [ -f "$cfg" ] || return 1
  grep -oE '(^|[^0-9])543[0-9][0-9]([^0-9]|$)' "$cfg" 2>/dev/null \
    | grep -oE '543[0-9][0-9]' | awk '!seen[$0]++'
}

# swt_db_offset_ports <config> <offset> — ports que la config OCCUPERAIT à cet offset.
swt_db_offset_ports() {
  local cfg="${1:?config path}" off="${2:?offset}" stride="${SWT_DB_STRIDE:-20}" p
  swt_db_config_ports "$cfg" | while IFS= read -r p; do
    [ -n "$p" ] && printf '%s\n' $(( p + off * stride ))
  done
}

# swt_db_port_holder <port> — qui écoute ce port (conteneur Docker si identifiable).
# Sert à dire QUI bloque, plutôt qu'un « port already allocated » opaque.
swt_db_port_holder() {
  local port="${1:?port}" name
  name=$(docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null \
    | grep -F ":$port->" | cut -f1 | head -1)
  [ -n "$name" ] && { printf '%s' "$name"; return 0; }
  command -v lsof >/dev/null 2>&1 \
    && lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fc 2>/dev/null | grep '^c' | head -1 | cut -c2-
}

# swt_db_offset_free <config> <offset> — vrai si TOUS les ports cibles sont libres.
# Un seul port occupé suffit à faire échouer `supabase start` : on les teste tous.
swt_db_offset_free() {
  local cfg="${1:?config path}" off="${2:?offset}" p
  command -v lsof >/dev/null 2>&1 || return 0   # sans lsof, on ne peut rien affirmer
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && return 1
  done <<EOF
$(swt_db_offset_ports "$cfg" "$off")
EOF
  return 0
}

# swt_db_offset_conflicts <config> <offset> — « port (détenteur) » pour chaque port pris.
swt_db_offset_conflicts() {
  local cfg="${1:?config path}" off="${2:?offset}" p holder out=""
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      holder=$(swt_db_port_holder "$p")
      out="$out $p (${holder:-inconnu})"
    fi
  done <<EOF
$(swt_db_offset_ports "$cfg" "$off")
EOF
  printf '%s' "${out# }"
}

# swt_db_alloc_offset <sess> <taken_csv> [config] — offset [1..8] libre pour cette session.
# Déterministe : dérive un candidat du hash de <sess>, puis avance circulairement
# jusqu'au premier offset absent de <taken_csv> (CSV d'offsets déjà vivants).
#
# Si <config> est fourni, un offset n'est retenu que si TOUS les ports que cette
# config occuperait à cet offset sont réellement libres (D-20260714-0008) — le
# registre et une grille supposée ne suffisent pas à voir les stacks des projets
# à ports non standard, ni celles lancées hors de ce mécanisme.
#
# Retourne 1 si la plage est pleine.
swt_db_alloc_offset() {
  local sess="${1:-}" taken="${2:-}" cfg="${3:-}" max="${SWT_DB_MAX_OFFSET:-8}"
  local h cand i o
  h=$(printf '%s' "$sess" | cksum | awk '{print $1}')
  cand=$(( h % max + 1 ))
  for i in $(seq 0 $(( max - 1 )) ); do
    o=$(( (cand - 1 + i) % max + 1 ))
    case ",$taken," in
      *",$o,"*) continue ;;                # offset déjà réservé par une session
    esac
    if [ -n "$cfg" ] && ! swt_db_offset_free "$cfg" "$o"; then
      continue                             # ports réellement occupés : offset écarté
    fi
    printf '%s' "$o"; return 0
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
  # idempotence (M1) : si la config est déjà patchée (skip-worktree posé), ne pas
  # re-décaler — un second passage doublerait le décalage des ports.
  swt_db_is_patched "$cfg" && return 0
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
# NB : on itère via `find` (pas un glob `*/`) — sous zsh un glob sans correspondance
# est une ERREUR fatale (`no matches found`), pas une liste vide comme en bash.
swt_db_taken() {
  local f out=""
  [ -d "$SWT_DB_REG" ] || return 0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    out="$out,$(cat "$f" 2>/dev/null)"
  done <<EOF
$(find "$SWT_DB_REG" -maxdepth 1 -type f 2>/dev/null)
EOF
  printf '%s' "${out#,}"
}

# swt_db_busy_offsets — DÉPRÉCIÉ (D-20260714-0008). Sonde un seul port par offset
# sur une grille SUPPOSÉE (54322 + offset×20), ce qui rend invisibles les stacks
# des projets dont la config ne part pas des ports Supabase standard — cause du
# « port already allocated » sur actionprogex (db réel 54484, sondé 54482).
# L'allocation s'appuie désormais sur swt_db_offset_free, qui dérive les ports de
# la config RÉELLE du projet. Conservé pour les appelants tiers.
swt_db_busy_offsets() {
  local off port out="" stride="${SWT_DB_STRIDE:-20}" max="${SWT_DB_MAX_OFFSET:-8}"
  command -v lsof >/dev/null 2>&1 || return 0
  for off in $(seq 1 "$max"); do
    port=$(( 54322 + off * stride ))           # port db du profil pour cet offset
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && out="$out,$off"
  done
  printf '%s' "${out#,}"
}

# swt_db_report_saturation <config> — pourquoi aucun offset n'est disponible.
# Un « plage pleine » sans coupable oblige à enquêter à la main ; on nomme donc
# les ports pris et les conteneurs qui les tiennent (souvent des stacks orphelines
# de worktrees supprimés).
swt_db_report_saturation() {
  local cfg="${1:?config path}" off max="${SWT_DB_MAX_OFFSET:-8}" conflicts
  printf '\n'
  printf '════════════════════════════════════════════════════════════\n'
  printf '⛔ BD NON PROVISIONNÉE — aucun jeu de ports libre.\n'
  printf '   Cette session démarre SANS base de données.\n'
  printf '════════════════════════════════════════════════════════════\n'
  for off in $(seq 1 "$max"); do
    conflicts=$(swt_db_offset_conflicts "$cfg" "$off")
    [ -n "$conflicts" ] && printf '   offset %s occupé : %s\n' "$off" "$conflicts"
  done
  printf '\n   Des stacks de worktrees disparus tiennent souvent ces ports.\n'
  printf '   Les lister :  claude-swt-db-orphans\n'
  printf '   Les libérer : claude-swt-db-orphans --stop\n\n'
}

# swt_db_orphan_stacks — stacks `swt-*` dont le worktree n'existe plus.
# Le project_id encode la session (swt-<repo>-<YYYYMMDD-HHMMSS>) : si aucun worktree
# ne porte ce timestamp, la stack est orpheline — elle occupe des ports pour rien.
swt_db_orphan_stacks() {
  local name pid ts
  command -v docker >/dev/null 2>&1 || return 0
  docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^supabase_db_swt-' | while IFS= read -r name; do
    pid=${name#supabase_db_}
    ts=$(printf '%s' "$pid" | grep -oE '[0-9]{8}-[0-9]{6}$')
    [ -n "$ts" ] || continue
    if ! git worktree list 2>/dev/null | grep -q "$ts" \
       && [ ! -d "$HOME/worktrees" -o -z "$(find "$HOME/worktrees" -maxdepth 2 -name "$ts" -type d 2>/dev/null)" ]; then
      printf '%s\n' "$pid"
    fi
  done
}

# swt_db_is_patched <config_path> — vrai si la config est déjà patchée (skip-worktree posé).
swt_db_is_patched() {
  local cfg="$1" top rel
  top=$(git -C "$(dirname "$cfg")" rev-parse --show-toplevel 2>/dev/null) || return 1
  rel=${cfg#"$top"/}
  git -C "$top" ls-files -v -- "$rel" 2>/dev/null | grep -q '^S'
}

# swt_db_read_offset <config_path> — relit l'offset depuis une config DÉJÀ patchée.
# S'appuie sur shadow_port (unique, valeur d'origine 54320) : offset = (sp-54320)/stride.
# Permet de reconstruire le registre s'il a été perdu, sans re-décaler les ports (M1).
swt_db_read_offset() {
  local cfg="$1" sp stride="${SWT_DB_STRIDE:-20}"
  sp=$(grep -oE 'shadow_port *= *[0-9]+' "$cfg" 2>/dev/null | grep -oE '[0-9]+$' | head -1)
  [ -n "$sp" ] || return 1
  [ $(( (sp - 54320) % stride )) -eq 0 ] || return 1
  printf '%s' $(( (sp - 54320) / stride ))
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

  mkdir -p "$SWT_DB_REG"
  if [ -f "$SWT_DB_REG/$sess" ]; then
    offset=$(cat "$SWT_DB_REG/$sess")            # reprise : config déjà patchée
  elif swt_db_is_patched "$cfg"; then
    # config déjà patchée mais registre perdu (nouveau poste, $HOME différent, purge
    # manuelle) : relire l'offset au lieu de re-patcher (M1 — sinon double-décalage
    # des ports et registre incohérent).
    offset=$(swt_db_read_offset "$cfg") \
      || { printf '⚠️  config déjà patchée mais offset illisible — BD non provisionnée.\n' >&2; return 1; }
    printf '%s' "$offset" > "$SWT_DB_REG/$sess"
  else
    # nouvelle session : alloc + patch + enregistrement sous verrou atomique
    # (M2 — deux `claude-swt` quasi-simultanés ne doivent pas choisir le même offset,
    # busy_offsets ne voyant les ports qu'une fois la stack montée).
    local lock="$SWT_DB_REG/.lock" tries=0
    while ! mkdir "$lock" 2>/dev/null; do
      tries=$(( tries + 1 )); [ "$tries" -ge 100 ] && break; sleep 0.1
    done
    # Les ports cibles sont dérivés de la config RÉELLE du projet, et tous vérifiés
    # libres (D-20260714-0008) : une grille supposée ne voit pas les stacks des
    # projets à ports non standard, ni celles lancées hors de ce mécanisme.
    offset=$(swt_db_alloc_offset "$sess" "$(swt_db_taken)" "$cfg")
    if [ -z "$offset" ]; then
      rmdir "$lock" 2>/dev/null
      swt_db_report_saturation "$cfg" >&2
      return 0
    fi
    swt_db_patch_config "$cfg" "$pid" "$offset"
    printf '%s' "$offset" > "$SWT_DB_REG/$sess"
    rmdir "$lock" 2>/dev/null
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
    # M3 : un start avorté (ex. health check) peut laisser des conteneurs montés.
    # On les arrête pour ne pas fuir RAM/ports, et on libère l'offset (la config
    # reste patchée → une reprise le relira via swt_db_read_offset).
    printf '⚠️  supabase start a échoué (profil %s) — nettoyage ; la session continue.\n' "$profile" >&2
    ( cd "$wt" && supabase stop --no-backup >/dev/null 2>&1 )
    rm -f "$SWT_DB_REG/$sess"
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
