#!/usr/bin/env bash
# ============================================================
# test-swt-db.sh
# Teste la lib swt-db.sh (BD Supabase isolée par worktree, D-20260709-0003).
# Fonctions pures / filesystem — AUCUN appel Docker ou Supabase ici.
#
# Couvre les 3 critères d'acceptation de T-20260709-0038 :
#   1. mapping profil -> services exclus (-x) avec les noms réels du CLI ;
#   2. allocation d'offset non-collidante + réutilisable après libération ;
#   3. patch config.toml (ports + project_id) masqué de git status (skip-worktree).
# ============================================================
set -u

HERE="$(cd "$(dirname "$0")/../shell" && pwd)"
# shellcheck source=/dev/null
. "$HERE/swt-db.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail=0
ok()  { printf '  ✅ %s\n' "$1"; }
ko()  { printf '  ❌ %s\n' "$1"; fail=1; }
eq()  { [ "$2" = "$3" ] && ok "$1" || { ko "$1"; printf '     attendu=[%s] obtenu=[%s]\n' "$3" "$2"; }; }
has() { case "$2" in *"$3"*) ok "$1" ;; *) ko "$1"; printf '     [%s] ne contient pas [%s]\n' "$2" "$3" ;; esac; }
hasnt(){ case "$2" in *"$3"*) ko "$1"; printf '     [%s] contient [%s] (ne devrait pas)\n' "$2" "$3" ;; *) ok "$1" ;; esac; }

echo "== 1. Mapping profil -> services exclus =="
DB=$(swt_db_excludes db)
has  "db exclut logflare (analytics = poste le plus lourd)" "$DB" "logflare"
has  "db exclut vector" "$DB" "vector"
has  "db exclut gotrue (auth)" "$DB" "gotrue"
has  "db exclut studio" "$DB" "studio"
has  "db exclut mailpit (ex-inbucket)" "$DB" "mailpit"
has  "db exclut supavisor (pooler)" "$DB" "supavisor"
has  "db exclut postgrest (API REST -> profil auth ; kong requis)" "$DB" "postgrest"
has  "db exclut postgres-meta" "$DB" "postgres-meta"

AUTH=$(swt_db_excludes auth)
has  "auth exclut realtime" "$AUTH" "realtime"
has  "auth exclut storage-api" "$AUTH" "storage-api"
has  "auth exclut logflare" "$AUTH" "logflare"
hasnt "auth GARDE gotrue" "$AUTH" "gotrue"
hasnt "auth GARDE kong" "$AUTH" "kong"

eq   "full n'exclut rien" "$(swt_db_excludes full)" ""
swt_db_excludes n_importe_quoi >/dev/null 2>&1 && ko "profil invalide devrait échouer" || ok "profil invalide échoue (code != 0)"

echo "== 2. Allocation d'offset non-collidante =="
o1=$(swt_db_alloc_offset "20260709-101010" "")
o1b=$(swt_db_alloc_offset "20260709-101010" "")
eq   "offset déterministe (même session -> même offset)" "$o1" "$o1b"
[ "$o1" -ge 1 ] && [ "$o1" -le 8 ] && ok "offset dans la plage worktree [1..8]" || ko "offset hors plage : $o1"

# le candidat déterministe est pris -> doit en prendre un autre, hors 'taken'
o2=$(swt_db_alloc_offset "20260709-101010" "$o1")
[ "$o2" != "$o1" ] && ok "collision évitée (offset différent du pris)" || ko "collision non évitée : $o2"
case ",$o1," in *",$o2,"*) ko "offset alloué figure dans taken" ;; *) ok "offset alloué hors de taken" ;; esac

# tous pris -> échec
swt_db_alloc_offset "sess" "1,2,3,4,5,6,7,8" >/dev/null 2>&1 && ko "plein devrait échouer" || ok "plage pleine échoue (code != 0)"

echo "== 3. Patch config.toml (ports + project_id + skip-worktree) =="
REPO="$TMP/repo"
git init -q "$REPO"
mkdir -p "$REPO/supabase"
cat > "$REPO/supabase/config.toml" <<'EOF'
project_id = "monapp"

[api]
port = 54321

[db]
port = 54322
shadow_port = 54320

[db.pooler]
port = 54329

[studio]
port = 54323

[inbucket]
port = 54324
# smtp_port = 54325

[auth.email.smtp]
# port = 587

[edge_runtime]
inspector_port = 8083

[analytics]
port = 54327
EOF
git -C "$REPO" add -A && git -C "$REPO" commit -q -m init

swt_db_patch_config "$REPO/supabase/config.toml" "monapp-20260709-101010" 1
cfg=$(cat "$REPO/supabase/config.toml")
has  "project_id remplacé par l'ID de session" "$cfg" 'project_id = "monapp-20260709-101010"'
has  "api 54321 -> 54341 (offset 1, delta 20)" "$cfg" "port = 54341"
has  "db 54322 -> 54342" "$cfg" "port = 54342"
has  "shadow 54320 -> 54340" "$cfg" "shadow_port = 54340"
has  "pooler 54329 -> 54349" "$cfg" "port = 54349"
has  "analytics 54327 -> 54347" "$cfg" "port = 54347"
has  "SMTP externe 587 NON touché" "$cfg" "# port = 587"
has  "inspector 8083 NON touché" "$cfg" "inspector_port = 8083"

# skip-worktree : config.toml ne doit plus apparaître dans git status
# (NB : `status` est une variable read-only en zsh — on utilise cfgstatus)
cfgstatus=$(git -C "$REPO" status --porcelain -- supabase/config.toml)
eq   "config.toml patché absent de git status (skip-worktree)" "$cfgstatus" ""

# M1 : reprise sur registre perdu — la config patchée reste la source de vérité.
swt_db_is_patched "$REPO/supabase/config.toml" && ok "is_patched détecte le skip-worktree" || ko "is_patched rate une config patchée"
eq   "read_offset relit l'offset depuis shadow_port (1)" "$(swt_db_read_offset "$REPO/supabase/config.toml")" "1"
# idempotence : re-patcher une config déjà patchée ne doit PAS re-décaler les ports
swt_db_patch_config "$REPO/supabase/config.toml" "monapp-x" 3 2>/dev/null
has  "re-patch n'a pas re-décalé (api reste 54341, pas 54401)" "$(cat "$REPO/supabase/config.toml")" "port = 54341"

echo "== 4. Écriture .env.local =="
WT="$TMP/wt"; mkdir -p "$WT"
swt_db_write_env "$WT" "http://127.0.0.1:54341" "anon.key.xyz" "service.key.xyz"
[ -f "$WT/.env.local" ] && ok ".env.local créé" || ko ".env.local absent"
env=$(cat "$WT/.env.local" 2>/dev/null)
has  "URL API du worktree" "$env" "54341"
has  "clé anon exposée" "$env" "anon.key.xyz"


# ============================================================
# D-20260714-0008 — collisions de ports non détectées.
#
# Le détecteur d'origine sondait UN port par offset, sur une grille supposée
# (54322 + offset×20). Or le patch décale les ports D'ORIGINE du projet : un
# projet dont la config ne part pas des ports standard produit des ports hors
# grille, invisibles au détecteur. Cas réel : actionprogex (db d'origine 54324)
# occupait 54484, quand le détecteur regardait 54482 → « port already allocated ».
# ============================================================
printf '\n▸ D-20260714-0008 — ports dérivés de la config réelle\n'

CFG_NS="$TMP/nonstandard.toml"
cat > "$CFG_NS" <<'TOML'
project_id = "actionprogex"
[api]
port = 54323
[db]
port = 54324
shadow_port = 54320
[studio]
port = 54325
TOML

# 1. Les ports cibles d'un offset se lisent dans la config, pas dans une grille.
got=$(swt_db_offset_ports "$CFG_NS" 8 | tr '\n' ' ')
eq "offset 8 sur config non standard -> ports réels" "$got" "54483 54484 54480 54485 "

CFG_STD="$TMP/standard.toml"
cat > "$CFG_STD" <<'TOML'
project_id = "std"
[api]
port = 54321
[db]
port = 54322
TOML
got=$(swt_db_offset_ports "$CFG_STD" 1 | tr '\n' ' ')
eq "offset 1 sur config standard -> ports réels" "$got" "54341 54342 "

# 2. Un offset dont UN SEUL port est occupé doit être écarté.
#    On occupe un VRAI port de la plage 543xx (pas un port éphémère : le patch ne
#    décale que les 543xx, un port hors plage ne prouverait rien).
FREE_PORT=$(python3 - <<'PY'
import socket
for port in range(54300, 54400):
    s = socket.socket()
    try:
        s.bind(('127.0.0.1', port)); s.close(); print(port); break
    except OSError:
        s.close()
PY
)
python3 - "$FREE_PORT" "$TMP/holding" <<'PY' &
import socket, sys, time
s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(('127.0.0.1', int(sys.argv[1]))); s.listen(1)
open(sys.argv[2], 'w').write('up')
time.sleep(30)
PY
BUSY_PID=$!
for _ in $(seq 1 50); do [ -s "$TMP/holding" ] && break; sleep 0.1; done

CFG_BUSY="$TMP/busy.toml"
printf 'project_id = "x"\n[db]\nport = %s\n' "$FREE_PORT" > "$CFG_BUSY"

if swt_db_offset_free "$CFG_BUSY" 0; then
  ko "un port réellement occupé rend l'offset indisponible"
else
  ok "un port réellement occupé rend l'offset indisponible"
fi

got=$(swt_db_offset_conflicts "$CFG_BUSY" 0)
case "$got" in
  *"$FREE_PORT"*) ok "le conflit nomme le port en cause ($got)" ;;
  *) ko "le conflit nomme le port en cause"; printf '     obtenu=[%s]\n' "$got" ;;
esac

kill "$BUSY_PID" 2>/dev/null; wait "$BUSY_PID" 2>/dev/null

# Une fois le port libéré, l'offset redevient disponible.
if swt_db_offset_free "$CFG_BUSY" 0; then
  ok "port libéré -> offset de nouveau disponible"
else
  ko "port libéré -> offset de nouveau disponible"
fi

# 3. L'allocation ne doit JAMAIS rendre un offset dont les ports sont occupés.
#    (Avant D-20260714-0008 elle le faisait : elle ignorait les ports réels.)
CFG_ALLOC="$TMP/alloc.toml"
printf 'project_id = "x"\n[db]\nport = 54322\n' > "$CFG_ALLOC"
got=$(swt_db_alloc_offset "sess-x" "" "$CFG_ALLOC")
if [ -z "$got" ]; then
  ok "plage saturée -> aucun offset rendu (pas de faux positif)"
elif swt_db_offset_free "$CFG_ALLOC" "$got"; then
  ok "l'offset alloué ($got) a bien tous ses ports libres"
else
  ko "l'offset alloué ($got) a des ports occupés"
fi


echo
[ "$fail" -eq 0 ] && echo "✅ TOUS LES TESTS PASSENT" || echo "❌ DES TESTS ÉCHOUENT"
exit "$fail"
