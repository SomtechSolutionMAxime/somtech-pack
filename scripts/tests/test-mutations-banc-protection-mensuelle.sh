#!/usr/bin/env bash
# ============================================================
# test-mutations-banc-protection-mensuelle.sh — v1.0.0
# La garde de `banc-protection-mensuelle.py` — T-20260922-0106, garde 5/5
# (dernière) du lot 4, D-20260921-0017. Même motif, même instrument que
# test-mutations-verifie-brief-chef.sh (règle d'or n°15 — on ne
# l'invente pas une 3e fois).
#
# Mute une COPIE du compagnon python, jamais le dépôt. Une mutation qui ne
# mute rien (motif introuvable) est un ÉCHEC DE L'INSTRUMENT
# (MUTATION-INOPÉRANTE), distinct d'un mutant survivant.
#
# Usage : bash scripts/tests/test-mutations-banc-protection-mensuelle.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PY_SRC="${ROOT}/.claude/skills/orchestrer-chantier/lib/banc-protection-mensuelle.py"
SH_LIB="${ROOT}/.claude/skills/orchestrer-chantier/lib/banc-protection-mensuelle.sh"
SUITE_UNIT="${SCRIPT_DIR}/test-banc-protection-mensuelle.sh"

command -v python3 >/dev/null 2>&1 || { echo "⚠️  python3 indisponible — mutations sautees (skip)"; exit 0; }
[ -f "$PY_SRC" ] || { echo "❌ compagnon python absent: $PY_SRC"; exit 1; }

WORK="$(mktemp -d)"; PASS=0; FAIL=0; N=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# applique <src> <dst> <fichier-python-de-mutation> — refuse une mutation
# sans effet.
applique() {
  python3 - "$1" "$2" "$3" <<'PY'
import sys
src, dst, codefile = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(src, encoding="utf-8").read()
before = s
ns = {"s": s}
exec(open(codefile, encoding="utf-8").read(), ns)
s = ns["s"]
if s == before:
    print("MUTATION-INOPERANTE", file=sys.stderr)
    sys.exit(2)
open(dst, "w", encoding="utf-8").write(s)
PY
}

# essai <libellé>   (code python de mutation lu sur STDIN)
essai() {
  local label="$1" M C
  N=$((N+1)); M="${WORK}/m${N}.py"; C="${WORK}/c${N}.py"
  cat > "$C"
  if ! applique "$PY_SRC" "$M" "$C" 2>"${WORK}/err${N}"; then
    ko "MUTATION INOPÉRANTE — ${label} : le motif ne correspond à aucun texte du compagnon (l'épreuve n'a PAS eu lieu)"
    return
  fi
  if ! python3 -c "compile(open('${M}', encoding='utf-8').read(), '${M}', 'exec')" 2>/dev/null; then
    ko "MUTATION INVALIDE — ${label} : la copie ne compile plus, un rouge n'accuserait que la syntaxe"
    return
  fi
  if BPM_PY="$M" bash "$SUITE_UNIT" >"${WORK}/uout${N}" 2>&1; then
    ko "MUTANT SURVIVANT — ${label} : le banc unitaire reste VERT, la garde ne tient pas ça"
  else
    ok "${label} → le banc unitaire rougit"
  fi
}

echo "== Contrôle préalable — le banc unitaire est VERT sur le code du dépôt =="
if BPM_PY="$PY_SRC" bash "$SUITE_UNIT" >"${WORK}/base.log" 2>&1; then
  ok "le banc unitaire est vert avant toute mutation"
else
  ko "le banc unitaire est DÉJÀ rouge — aucun mutant ne prouverait quoi que ce soit"
  tail -30 "${WORK}/base.log"
  echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"; exit 1
fi

echo "== (a) Discriminant non_etabli vs protege : la vérification du fichier mécanisme (chemin_ok) est retirée =="
echo "   RETIRÉ (2e tour de revue de fond, correctif du OU chemin/banc) : cite_dans_mecanisme appelle grep_fichier(chemin, ...),"
echo "   qui revérifie lui-même l'existence du fichier (voir sa définition) — forcer chemin_ok=True n'a donc PLUS AUCUN EFFET"
echo "   observable (défense en profondeur, pas un trou : grep_fichier() est exercé par (a-ter), (Discriminant 1-ter) et le"
echo "   témoin positif). Garder ce test produirait une MUTATION INOPÉRANTE permanente, jamais un signal utile."

echo "== (a-bis) Discriminant non_etabli vs protege : la vérification du banc est retirée =="
essai 'banc_ok toujours vrai — un banc inexistant sur disque passerait quand meme pour protege' <<'PY'
old = '        banc_ok = os.path.isfile(os.path.join(racine, banc))'
new = '        banc_ok = True'
assert old in s
s = s.replace(old, new)
PY

echo "== (a-ter) Discriminant non_etabli vs prose : une citation manquante ne dégrade plus jamais vers non_etabli =="
essai 'hits toujours non-vide — une regle sans AUCUNE citation trouvee dans le depot serait quand meme prose/protege' <<'PY'
old = '''        cite_dans_mecanisme = chemin_ok and grep_fichier(racine, chemin, citations)
        hits = grep_repo(racine, citations, fichiers_cache)'''
new = '''        cite_dans_mecanisme = chemin_ok and grep_fichier(racine, chemin, citations)
        hits = ["invente-un-hit-qui-nexiste-pas.txt"]'''
assert old in s
assert s.count(old) == 1, "le motif doit etre unique dans le fichier (sinon la mutation deborde sur une autre branche)"
s = s.replace(old, new)
PY

echo "== (a-quater) — RÉGRESSION (revue de fond, 1er tour) : la citation n'est plus exigée DANS le mécanisme déclaré =="
essai 'cite_dans_mecanisme toujours vrai — un mecanisme sans rapport avec la regle (citation trouvee ailleurs dans le depot) serait quand meme protege' <<'PY'
old = '''        cite_dans_mecanisme = chemin_ok and grep_fichier(racine, chemin, citations)'''
new = '''        cite_dans_mecanisme = True'''
assert old in s
s = s.replace(old, new)
PY

echo "== (a-quinquies) — RÉGRESSION (revue de fond, 2e tour) : le OU chemin/banc revient — un chemin VIDÉ reste protege si son banc cite encore =="
essai 'OU chemin/banc reintroduit — un mecanisme gutted (chemin sans citation) reste protege si son fichier de test, lui, cite toujours la chaine' <<'PY'
old = '''        cite_dans_mecanisme = chemin_ok and grep_fichier(racine, chemin, citations)'''
new = '''        cite_dans_mecanisme = (chemin_ok and grep_fichier(racine, chemin, citations)) or (
            banc_ok and grep_fichier(racine, banc, citations)
        )'''
assert old in s
s = s.replace(old, new)
PY

echo "== (b) Témoin positif : neutralisé — un manquant n'est plus jamais détecté =="
essai 'manquants toujours vide — TEMOIN_POSITIF=OK meme si une garde du lot 4 casse' <<'PY'
old = '''    manquants = []
    for wid in WITNESS_IDS:
        if wid not in classement:
            manquants.append(f"{wid} absent du corpus")
        elif classement[wid] != "protege":
            manquants.append(f"{wid} classe {classement[wid]} (attendu protege)")
        elif not audite_par_id.get(wid, False):
            manquants.append(f"{wid} classe protege MAIS par l'heuristique generique non auditee (AUDITE=non) — pas une preuve valable pour un temoin")'''
new = '''    manquants = []'''
assert old in s
s = s.replace(old, new)
PY

echo "== (b-bis) Témoin positif : la liste des 4 gardes surveillées est vidée =="
essai 'WITNESS_IDS vide — plus aucune garde du lot 4 nest surveillee par le temoin' <<'PY'
old = 'WITNESS_IDS = ["STD-038", "STD-030-MERGE", "STD-029", "GF-ORC-013"]'
new = 'WITNESS_IDS = []'
assert old in s
s = s.replace(old, new)
PY

echo "== (c) Source cassée : BPM_SOURCE_CASSEE=oui ignoré (le pire résultat — un classement complet sort quand meme) =="
# Cette mutation cible le .sh (garde en amont du compagnon python), pas le
# .py — traitee a part (pas via `essai`, qui suppose le compagnon python).
python3 - "$SH_LIB" "${WORK}/msh.sh" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
before = s
old = '''  if [ "$source_cassee" = "oui" ]; then
    echo "VERDICT_GLOBAL=SOURCE_CASSEE"
    echo "MOTIF=BPM_SOURCE_CASSEE=oui — la source du corpus est declaree cassee par l'appelant, aucune regle n'est mesurable"
    return 4
  fi'''
new = ''
assert old in s, "motif de la garde SOURCE_CASSEE introuvable dans le .sh"
s = s.replace(old, new)
assert s != before
open(dst, "w", encoding="utf-8").write(s)
PY
N=$((N+1))
if BPM_LIB="${WORK}/msh.sh" bash "$SUITE_UNIT" >"${WORK}/uout_shmut" 2>&1; then
  ko "MUTANT SURVIVANT — garde SOURCE_CASSEE (.sh) neutralisee : le banc unitaire reste VERT"
else
  ok "garde SOURCE_CASSEE (.sh) neutralisee → le banc unitaire rougit"
fi

echo "== (d) Écart avec l'état précédent : jamais comparé (toujours PREMIER_PASSAGE, meme avec un etat fourni) =="
essai 'ECART_PRECEDENT reste PREMIER_PASSAGE meme quand un etat precedent valide est fourni' <<'PY'
old = '''    elif not os.path.isfile(etat_precedent_path):
        lignes.append("ECART_PRECEDENT=PREMIER_PASSAGE (etat precedent introuvable: " + etat_precedent_path + ")")
    else:'''
new = '''    elif not os.path.isfile(etat_precedent_path):
        lignes.append("ECART_PRECEDENT=PREMIER_PASSAGE (etat precedent introuvable: " + etat_precedent_path + ")")
    elif False:'''
assert old in s
s = s.replace(old, new)
PY

echo "== (d-bis) Écart : les changements de classe ne sont plus détectés (comparaison neutralisée) =="
essai 'la comparaison ancien != nouveau est neutralisee — un ecart reel nest plus jamais signale' <<'PY'
old = '''                elif ancien is not None and nouveau is not None and ancien != nouveau:
                    ecarts.append(f"{rid}:{ancien}->{nouveau}")'''
new = '''                elif False:
                    ecarts.append(f"{rid}:{ancien}->{nouveau}")'''
assert old in s
s = s.replace(old, new)
PY

echo "== (e) — RÉGRESSION (revue de fond, 3e tour) : AUDITE reste 'oui' pour un protege de l'heuristique generique =="
essai 'AUDITE fige a True dans la branche heuristique generique — un protege par coincidence (repro reel : STD-030) se ferait passer pour un protege verifie' <<'PY'
old = '''    if code_hits and test_hits:
        return ("protege", code_hits[0], None, None, None, False)
    return ("prose", None, None, None, None, False)'''
new = '''    if code_hits and test_hits:
        return ("protege", code_hits[0], None, None, None, True)
    return ("prose", None, None, None, None, False)'''
assert old in s
s = s.replace(old, new)
PY

echo "== (f) — RÉGRESSION (revue de fond, 5e tour) : l'ecart ne boucle plus que sur le passage courant, une DISPARITION redevient invisible =="
essai 'boucle restreinte a classement.keys() — un id qui disparait du corpus (present dans precedent, absent du courant) redevient invisible, AUCUN ecart' <<'PY'
old = '''            for rid in sorted(set(classement.keys()) | set(precedent.keys())):'''
new = '''            for rid in sorted(classement.keys()):'''
assert old in s
s = s.replace(old, new)
PY

echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
