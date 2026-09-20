#!/usr/bin/env bash
# ============================================================
# test-mutations-version-poste.sh — la garde du correctif T-20260816-0020.
#
# POURQUOI CE FICHIER EXISTE
# `cli/test/version-poste.test.js` est vert. Un banc vert ne dit rien tant qu'on
# ne l'a pas vu rougir : une garde peut être verte par accident de formulation,
# et le jour où elle cesse de garder, elle reste verte avec le même visage.
#
# Ce fichier réintroduit, dans une COPIE des sources, chacun des défauts que le
# ticket existe pour fermer — un numéro inventé sur un poste vierge, un
# « à jour » rendu sur une mesure impossible, un cache qui tait son âge — et
# EXIGE que la suite devienne rouge. Le dépôt n'est jamais modifié.
#
# L'instrument REFUSE une mutation sans effet : une mutation qui ne mute rien
# rend zéro rouge, exactement comme une garde qui tient.
#
# Usage : bash scripts/tests/test-mutations-version-poste.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SUITE="${ROOT}/cli/test/version-poste.test.js"
SUITE_CABLAGE="${ROOT}/cli/test/version-poste-cablage.test.js"

WORK="$(mktemp -d)"; PASS=0; FAIL=0; N=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node introuvable — ce banc ne peut pas être monté"
  echo "Assertions JOUÉES : 0"
  exit 1
fi

# jouer <dossier-src> — rend 0 si la suite passe contre CES sources.
jouer() {
  local src="$1"
  # LES DEUX bancs : celui des calculs ET celui du CHEMIN RÉEL. Une revue de fond
  # a montré que les calculs pouvaient être justes et le câblage silencieusement
  # contourné — vider la route `case 'version'`, inverser deux champs dans l'appel
  # de `setup.js` — sans qu'aucune garde ne bronche. C'est pourquoi `cli.js` et
  # `commands/setup.js` sont maintenant dans la portée de ce banc.
  SOMTECH_VERSION_POSTE_SRC="${src}/version-poste.js" \
  SOMTECH_VERSION_CMD_SRC="${src}/commands/version-poste-cmd.js" \
  SOMTECH_VERSION_ECRIRE_SRC="${src}/version-poste-ecrire.js" \
  SOMTECH_CLI_SRC="${src}/cli.js" \
    node --test "$SUITE" "$SUITE_CABLAGE" >/dev/null 2>&1
}

# essai <fichier-relatif-à-src> <libellé>   (le python de mutation est lu sur STDIN)
essai() {
  local cible="$1" label="$2" C SRC
  N=$((N+1)); C="${WORK}/c${N}.py"; SRC="${WORK}/src${N}"
  cat > "$C"
  cp -R "${ROOT}/cli/src" "$SRC"
  if ! python3 - "${SRC}/${cible}" "$C" <<'PY' 2>"${WORK}/err${N}"
import sys, io
f, codefile = sys.argv[1], sys.argv[2]
s = io.open(f, encoding="utf-8").read()
before = s
ns = {"s": s}
exec(io.open(codefile, encoding="utf-8").read(), ns)
s = ns["s"]
if s == before:
    print("MUTATION-INOPERANTE", file=sys.stderr)
    sys.exit(2)
io.open(f, "w", encoding="utf-8").write(s)
PY
  then
    ko "MUTATION INOPÉRANTE — ${label} : le motif ne correspond à aucun texte de ${cible} (l'épreuve n'a PAS eu lieu)"
    return
  fi
  if ! node --check "${SRC}/${cible}" 2>/dev/null; then
    ko "MUTATION INVALIDE — ${label} : la copie ne s'analyse plus, un rouge n'accuserait que la syntaxe"
    return
  fi
  if jouer "$SRC"; then
    ko "MUTANT SURVIVANT — ${label} : la suite reste VERTE, la garde ne tient pas ça"
  else
    ok "${label} → suite rouge"
  fi
}

echo "== Contrôle préalable — la suite est VERTE sur les sources du dépôt =="
if jouer "${ROOT}/cli/src"; then
  ok "suite verte avant toute mutation"
else
  ko "la suite est DÉJÀ rouge — aucun mutant ne prouverait quoi que ce soit"
  echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"; exit 1
fi

echo "== Le défaut d'origine : un numéro là où il n'y a rien =="

essai version-poste.js 'un poste vierge se voit attribuer un numéro' <<'PY'
s = s.replace(
  """    return { etat: 'ABSENTE', version: null, chemin, raison: 'aucun marqueur de version sur ce poste' };""",
  """    return { etat: 'ABSENTE', version: '0.0.0', chemin, raison: 'aucun marqueur de version sur ce poste' };""")
PY

essai version-poste.js 'un poste vierge est annoncé INSTALLEE' <<'PY'
s = s.replace("""    return { etat: 'ABSENTE', version: null, chemin,""",
              """    return { etat: 'INSTALLEE', version: '1.0.0', chemin,""")
PY

essai version-poste.js 'un marqueur illisible est confondu avec une absence' <<'PY'
s = s.replace("""    return { etat: 'ILLISIBLE', version: null, chemin, raison: 'le marqueur n’est pas du JSON' };""",
              """    return { etat: 'ABSENTE', version: null, chemin, raison: 'le marqueur n’est pas du JSON' };""")
PY

echo "== « Je n'ai pas pu regarder » ne doit pas ressembler à « à jour » =="

essai version-poste.js 'une comparaison impossible rend A-JOUR' <<'PY'
s = s.replace("  if (c === null) return 'INDETERMINE';", "  if (c === null) return 'A-JOUR';")
PY

essai commands/version-poste-cmd.js 'le code de retour vaut 0 sur un poste non installé' <<'PY'
s = s.replace("  if (e.poste.etat !== 'INSTALLEE') return 2;", "  if (e.poste.etat !== 'INSTALLEE') return 0;")
PY

essai commands/version-poste-cmd.js 'le code de retour vaut 0 sur un écart indéterminé' <<'PY'
s = s.replace("  if (e.ecart === 'INDETERMINE') return 3;", "  if (e.ecart === 'INDETERMINE') return 0;")
PY

essai commands/version-poste-cmd.js 'le rendu annonce « À JOUR » sur un écart indéterminé' <<'PY'
s = s.replace("""    INDETERMINE: 'INDÉTERMINÉ — on n’a pas pu comparer, ce n’est PAS « à jour »',""",
              """    INDETERMINE: 'À JOUR',""")
PY

echo "== Le cache qui se fait passer pour frais =="

essai commands/version-poste-cmd.js 'le cache tait son âge' <<'PY'
s = s.replace("""    l.push(`Dernière publiée (CACHE, ${direAge(e.agePubliee)})  : ${e.publiee}`);
    l.push('  ⚠️  registre injoignable — cette valeur peut être en retard.');""",
              """    l.push(`Dernière publiée                : ${e.publiee}`);""")
PY

essai commands/version-poste-cmd.js 'le cache prime sur le registre' <<'PY'
s = s.replace("  const publiee = registre ?? cache.version ?? null;",
              "  const publiee = cache.version ?? registre ?? null;")
s = s.replace("  const sourcePubliee = registre ? 'REGISTRE' : (cache.version ? 'CACHE' : 'INCONNUE');",
              "  const sourcePubliee = cache.version ? 'CACHE' : (registre ? 'REGISTRE' : 'INCONNUE');")
PY

essai version-poste.js 'un cache corrompu devient une valeur publiée' <<'PY'
s = s.replace("""  const v = data && typeof data.latest === 'string' && SEMVER.test(data.latest) ? data.latest : null;""",
              """  const v = data && typeof data.latest === 'string' ? data.latest : null;""")
PY

echo "== Le comparateur =="

essai version-poste.js 'le comparateur repasse à une clé pondérée qui déborde' <<'PY'
s = s.replace("""  for (let i = 1; i <= 3; i += 1) {
    const x = Number(ma[i]);
    const y = Number(mb[i]);
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;""",
"""  const ka = Number(ma[1]) * 1000000 + Number(ma[2]) * 1000 + Number(ma[3]);
  const kb = Number(mb[1]) * 1000000 + Number(mb[2]) * 1000 + Number(mb[3]);
  if (ka !== kb) return ka > kb ? 1 : -1;
  return 0;""")
PY

essai version-poste.js 'le comparateur accepte ce qui n_est pas un semver' <<'PY'
s = s.replace("  if (!ma || !mb) return null;", "  if (!ma || !mb) return 0;")
PY

echo "== Les verrous =="

essai version-poste.js 'tous les verrous sont déclarés périmés, y compris les frais' <<'PY'
s = s.replace("    if (age >= Number(ttlSecondes)) out.push({ nom, chemin, ageSecondes: age });",
              "    out.push({ nom, chemin, ageSecondes: age });")
PY

essai version-poste.js 'tout fichier .lock est pris pour un verrou de mise à jour' <<'PY'
s = s.replace("    if (!/^pack-update-.*\\.lock$/.test(nom)) continue;",
              "    if (!/\\.lock$/.test(nom)) continue;")
PY

essai version-poste.js 'les verrous ne sont plus rendus du plus vieux au plus jeune' <<'PY'
s = s.replace("  return out.sort((a, b) => b.ageSecondes - a.ageSecondes);",
              "  return out.sort((a, b) => a.ageSecondes - b.ageSecondes);")
PY

essai version-poste-ecrire.js 'le dry-run ramasse quand même les verrous' <<'PY'
s = s.replace("  if (dryRun) return { retires: [], candidats: perimes };", "")
PY

essai commands/version-poste-cmd.js 'les verrous sont signalés sans le geste qui les lève' <<'PY'
s = s.replace("""    l.push('   Ramasse-les : npx @somtech-solutions/pack setup --yes');""", "")
PY

echo "== Ce que setup écrit =="

essai version-poste-ecrire.js 'le marqueur porte la version du CONTENU au lieu de celle du paquet' <<'PY'
s = s.replace("""    version,
    packContentVersion: contenu,""",
              """    version: contenu,
    packContentVersion: contenu,""")
PY

essai version-poste-ecrire.js 'le marqueur ne dit plus qu_il est de portée poste' <<'PY'
s = s.replace("    portee: 'poste',\n", "")
PY

echo "== LE CÂBLAGE — l'endroit où les calculs sont branchés =="

essai cli.js 'la route `version` ne fait plus rien et rend 0' <<'PY'
s = s.replace("      case 'version': return cmdVersionPoste(flags);",
              "      case 'version': return 0;")
PY

essai cli.js 'la route `version` disparaît (commande inconnue)' <<'PY'
s = s.replace("      case 'version': return cmdVersionPoste(flags);", "")
PY

essai commands/setup.js 'setup n_écrit plus le marqueur du poste' <<'PY'
s = s.replace("      const chemin = ecrireVersionPoste(destDir, { version: pkgVersion(), contenu });",
              "      const chemin = 'rien';")
PY

essai commands/setup.js 'le marqueur porte la version du CONTENU au lieu de celle du PAQUET' <<'PY'
s = s.replace("ecrireVersionPoste(destDir, { version: pkgVersion(), contenu })",
              "ecrireVersionPoste(destDir, { version: contenu, contenu: pkgVersion() })")
PY

essai commands/setup.js 'setup ne ramasse plus les verrous périmés' <<'PY'
s = s.replace("    const v = ramasserVerrous(destDir, { dryRun: flags.dryRun });",
              "    const v = { retires: [], candidats: [] };")
PY

essai commands/version-poste-cmd.js 'le registre n_est plus jamais consulté' <<'PY'
s = s.replace("  const registre = deps.registre !== undefined ? deps.registre : interrogerRegistre(deps);",
              "  const registre = null;")
PY

essai commands/version-poste-cmd.js 'interrogerRegistre accepte une sortie qui n_est pas un semver' <<'PY'
s = s.replace("    return /^\\d+\\.\\d+\\.\\d+/.test(v) ? v : null;", "    return v;")
PY

essai commands/version-poste-cmd.js 'interrogerRegistre n_interroge plus npm mais autre chose' <<'PY'
s = s.replace("    const out = exec('npm', ['view', PKG, 'version', `--registry=${REGISTRY}`], {",
              "    const out = exec('echo', ['9.9.9'], {")
PY

essai commands/version-poste-cmd.js 'le garde-fou de la couture devient truthy (un stub vide part sur le vrai registre)' <<'PY'
s = s.replace("  if (stub !== undefined) return", "  if (stub) return")
PY

essai commands/version-poste-cmd.js 'la couture prend le pas même quand aucun stub n_est posé' <<'PY'
s = s.replace("  if (stub !== undefined) return /^\\d+\\.\\d+\\.\\d+/.test(stub) ? stub : null;",
              "  return /^\\d+\\.\\d+\\.\\d+/.test(String(stub)) ? stub : null;")
PY

echo "== Z — l'instrument refuse une épreuve VIDE =="
cp -R "${ROOT}/cli/src" "${WORK}/vide-src"
cat > "${WORK}/vide.py" <<'PY'
s = s.replace("CE-TEXTE-N-EXISTE-NULLE-PART-DANS-LA-LIB", "x")
PY
if python3 - "${WORK}/vide-src/version-poste.js" "${WORK}/vide.py" <<'PY' 2>"${WORK}/vide.err"
import sys, io
f, codefile = sys.argv[1], sys.argv[2]
s = io.open(f, encoding="utf-8").read()
before = s
ns = {"s": s}
exec(io.open(codefile, encoding="utf-8").read(), ns)
s = ns["s"]
if s == before:
    print("MUTATION-INOPERANTE", file=sys.stderr)
    sys.exit(2)
io.open(f, "w", encoding="utf-8").write(s)
PY
then
  ko "l'instrument a ACCEPTÉ une mutation sans effet — une épreuve vide se lirait comme une garde qui tient"
elif grep -q "MUTATION-INOPERANTE" "${WORK}/vide.err"; then
  ok "mutation sans effet REFUSÉE, et nommée (MUTATION-INOPERANTE)"
else
  ko "mutation sans effet rejetée, mais sans le dire : '$(cat "${WORK}/vide.err")'"
fi

echo "== Le chiffre annoncé au CHANGELOG =="
# Un chiffre de couverture rouillé se lit comme frais. On le compare au compte
# RÉELLEMENT JOUÉ — jamais à `PLANCHER`, qui est une valeur entretenue à la main
# et donc un voisin de la chose à mesurer.
total=$(( PASS + FAIL + 1 ))
annonces="$(grep -oE 'test-mutations-version-poste\.sh` — [0-9]+ assertions' "${ROOT}/CHANGELOG.md" | grep -oE '[0-9]+ assertions' | grep -oE '[0-9]+')"
if [ -z "$annonces" ]; then
  ko "le CHANGELOG n'annonce aucun compte d'assertions pour cette contre-épreuve"
else
  fausses=""
  for n in $annonces; do [ "$n" = "$total" ] || fausses="${fausses} ${n}"; done
  [ -z "$fausses" ] && ok "le CHANGELOG annonce ${total} assertions, soit le compte réellement joué" \
    || ko "le CHANGELOG annonce${fausses} assertion(s) ; ${total} sont jouées — chiffre rouillé"
fi

echo "----------------------------------------"
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
PLANCHER=30
if [ "$((PASS + FAIL))" -lt "$PLANCHER" ]; then
  echo "❌ SUITE INTERROMPUE : $((PASS + FAIL)) assertions jouées, plancher ${PLANCHER}"
  exit 1
fi
[ "$FAIL" = "0" ] && { echo "✅ CHAQUE DÉFAUT RÉINTRODUIT FAIT ROUGIR LA GARDE"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
