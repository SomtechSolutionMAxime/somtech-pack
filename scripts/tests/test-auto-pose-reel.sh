#!/usr/bin/env bash
# ============================================================
# test-auto-pose-reel.sh — v1.0.0
# LA preuve de T-20260826-0089 : l'AUTO-POSE — le seul chemin par lequel un agent
# naît sans qu'un humain touche un écran — jouée pour de vrai, hors du lanceur de
# tests, sans jamais désarmer la cloison d'essais.
#
# ─────────────────────────────────────────────────────────────────────────────
# CE QU'EST L'AUTO-POSE, ET POURQUOI ELLE N'AVAIT JAMAIS ÉTÉ ÉPROUVÉE ENTIÈRE
#
# `naitre.js` ne posait rien : un humain posait le lieu, puis faisait naître.
# Depuis E-20260813-0002, quand le lieu MANQUE et que le registre des rôles dit
# `pose_automatique: true`, la commande POSE le lieu elle-même, puis continue.
# C'est ce segment-là — décision du registre → `preparerLieu` → garde du lieu
# renseigné → avis d'auto-pose → versement → frontière herdr — qui n'avait
# aucune épreuve de bout en bout, pour aucun rôle.
#
# La raison est écrite en toutes lettres dans `naissance.js` et dans
# `naitre-bin.test.js` : la cloison d'essais (`ligne-directe/src/cloison.js`)
# REFUSE toute lecture du trousseau à un processus descendant de `node --test`,
# et `preparerLieu` exige que la ligne puisse s'ouvrir — donc que le trousseau
# réponde. L'auto-pose ne peut donc pas aboutir DANS un banc. Ce qui est
# décidable l'a été en fonctions pures, éprouvées ; la jointure, elle, ne
# l'était par rien.
#
# ⚠️ ON NE TOUCHE PAS À LA CLOISON. Elle a été posée après un incident mesuré :
# deux veilleurs orphelins nés d'une campagne de mutation ont tenu une connexion
# de production pendant des heures, et deux messages du dirigeant sur trois
# partaient chez eux. L'épreuve se joue donc À L'ÉTAGE AU-DESSUS — ce script
# n'est pas un fichier de test, il n'est jamais lancé par `node --test`, et il
# VÉRIFIE que la cloison mord toujours (voir le bras « LA CLOISON TIENT »).
#
# ─────────────────────────────────────────────────────────────────────────────
# LA CHAÎNE RÉELLE, MOINS UN SEUL POINT — NOMMÉ
#
# Tout est réel : le vrai `naitre.js`, le vrai `preparerLieu`, le vrai registre
# des rôles, le vrai `verifierLigneOuvrable`, le vrai `lireJetons`, le vrai
# `git`, de vraies écritures sur disque. Une seule chose est substituée, et elle
# est nommée : le CHEMIN DU BINAIRE `security` (`OUTILS.security.chemin`), pour
# que le banc ne lise jamais le trousseau de production du poste. Le double
# reproduit ce que le vrai `security` fait, mesuré sur ce poste le 2026-08-26 :
#
#     $ security find-generic-password -a <compte> -s <service-inexistant> -w
#     code 44 — security: SecKeychainSearchCopyNext: The specified item could
#               not be found in the keychain.
#
# ⚠️ ET LE DOUBLE DOIT PROUVER QU'IL A SERVI. S'il n'a pas été consulté, c'est
# que le vrai trousseau l'a été : le banc échoue alors bruyamment, plutôt que de
# rendre un vert obtenu contre la production. C'est mesuré par sa trace.
#
# ⚠️ CEINTURE : chaque appel tourne sous un HOME jetable. Même si la
# substitution ratait, le vrai `/usr/bin/security` ne verrait pas le trousseau
# de session (mesuré : sous un HOME jetable, `list-keychains` ne rend plus
# `login.keychain-db`). Aucune écriture dans `~/.somtech`, aucun réseau, aucun
# pane, aucun agent herdr.
#
# ─────────────────────────────────────────────────────────────────────────────
# CE BANC NE PEUT PAS JOINDRE SLACK, ET CE N'EST PAS UNE PROMESSE — C'EST LA
# FERMETURE DU CHEMIN
#
# Hors du lanceur de tests, la cloison ne s'applique pas : un veilleur né ici
# ouvrirait une connexion vers le VRAI espace Slack, l'incident exact qui a fait
# poser la cloison. Ce banc ne monte donc AUCUN double de Slack — il n'en a pas
# besoin, parce qu'il S'ARRÊTE AVANT.
#
# Ce qu'il lance est `naitre.js`, dont la fermeture d'imports — 26 modules,
# relevée le 2026-08-26 en suivant les `import … from './…'` de proche en
# proche — ne contient ni `slack.js`, ni `client.js`, ni `veilleur.js`, ni
# `demarrer-veilleur.js`, ni `service.js` :
# aucune ligne n'est ouverte, aucun veilleur n'est démarré. Le seul appel
# sortant du chemin d'auto-pose est la lecture du trousseau — substituée — et
# la commande s'arrête ensuite à la résolution de session herdr, à laquelle on
# donne délibérément un nom qui n'existe pas.
#
# Et ça se MESURE plutôt que de se dire : le banc compte les veilleurs avant et
# après, sans jamais passer par le CLI `ligne-directe` (voir `veilleurs()`).
#
# ─────────────────────────────────────────────────────────────────────────────
# CE QU'IL PROUVE, ET COMMENT — jamais par le message seul :
#   • LE REGISTRE DÉCIDE   → un rôle à pose MANUELLE refuse, et RIEN n'existe
#   • LA LIGNE EST UN PRÉALABLE → trousseau muet ⇒ refus, et RIEN n'existe
#   • L'AUTO-POSE ABOUTIT  → le lieu est SUR LE DISQUE, complet, non versé,
#                            et l'avis dit qu'il vient d'être posé
#   • LA SUITE DE LA CHAÎNE → lieu rempli ⇒ la commande le VERSE (git le porte),
#                            pose la garde, la verse, et s'arrête à la frontière
#                            herdr sans avoir créé le moindre onglet
#   • LA CLOISON TIENT     → la MÊME commande, sous la marque du lanceur de
#                            tests, ne pose RIEN
#
# SAUTÉ proprement quand il ne peut pas être honnête. Forcer le saut :
# SOMTECH_SKIP_E2E=1
#
# ⚠️ ET UN BRAS PEUT SAUTER SEUL. Ce banc tourne aussi sur la chaîne d'intégration
# (`.github/workflows/tests.yml` lance TOUS les `scripts/tests/*.sh`, sans liste
# blanche, sur `ubuntu-latest`). `security` y est absent : le BRAS 2 — le seul qui
# consulte le vrai binaire — se saute alors en le disant, et les bras 1, 3, 4 et 5
# continuent de garder. Faire sauter le banc ENTIER là-dessus reviendrait à ne plus
# rien garder à l'endroit qui compte le plus. Les sauts se comptent à part du vert.
#
# Usage : bash scripts/tests/test-auto-pose-reel.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NAITRE="${ROOT}/naissance-representant/bin/naitre.js"
ROLES="${ROOT}/ligne-directe/src/roles.js"

skip() { echo "⏭️  $1 — test sauté (il ne peut pas être honnête ici)."; exit 0; }

[ -n "${SOMTECH_SKIP_E2E:-}" ] && skip "saut demandé (SOMTECH_SKIP_E2E)"
command -v node >/dev/null 2>&1 || skip "node absent"
command -v git  >/dev/null 2>&1 || skip "git absent"
NODE="$(command -v node)"
[ -f "$NAITRE" ] || skip "naissance-representant/bin/naitre.js absent"
[ -f "$ROLES" ]  || skip "ligne-directe/src/roles.js absent — pas de registre des rôles à lire"
[ -d "${ROOT}/.claude/templates" ] || skip "aucun gabarit dans ce dépôt"

PASS=0; FAIL=0; SAUTS=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
# ⚠️ UN BRAS SAUTÉ NE SE COMPTE PAS COMME RÉUSSI, et il se compte quand même.
# Le noyer dans les ✅ ferait lire « tout est gardé » là où une garde ne s'est pas
# exécutée — c'est ce qui laisse une couverture fondre sans qu'un chiffre bouge.
saute() { echo "  ⏭️  $1"; SAUTS=$((SAUTS+1)); }

# ⚠️ AUCUN PROCESSUS NE DOIT SURVIVRE À CE BANC — surtout pas un veilleur, qui est
# l'incident même qui a fait poser la cloison. La mesure ne passe JAMAIS par le CLI
# `ligne-directe` : certaines de ses commandes réveillent un veilleur, donc le geste
# de mesure créerait l'objet qu'on prétend compter.
#
# ⚠️ ET ELLE NE PASSE PAS NON PLUS PAR `pgrep -f`, QUI SE COMPTE LUI-MÊME. `pgrep -f`
# frappe sur la ligne de commande entière : le shell qui porte la mesure porte aussi
# le motif, et se fait compter. Mesuré sur le poste le 2026-08-26 — `pgrep -f
# demarrer-veilleur.js | wc -l` rendait 3 là où UN SEUL veilleur tournait. On filtre
# donc sur le programme (`node`) et on neutralise l'auto-capture par la classe `[d]`.
veilleurs() {
  ps -eo pid=,args= | awk '/[d]emarrer-veilleur\.js/ && $2 ~ /node$|\/node$/ {print $1}' | wc -l | tr -d ' '
}
VEILLEURS_AVANT="$(veilleurs)"
echo "== Veilleurs vivants AVANT le banc : ${VEILLEURS_AVANT} =="

BAC="$(mktemp -d "${TMPDIR:-/tmp}/smtk-autopose-XXXXXX")"
FOYER="${BAC}/foyer"          # HOME jetable : ni trousseau de session, ni ~/.somtech
RACINE="${BAC}/racine"        # LIGNE_DIRECTE_RACINE jetable : ni registre, ni socket
DEPOT="${BAC}/depot"
TRACE="${BAC}/security-consulte.log"
FAUX_SECURITY="${BAC}/faux-security"
SUBSTITUTION="${BAC}/substituer-le-trousseau.mjs"
mkdir -p "$FOYER" "$RACINE"

cleanup() {
  [ -n "${SOMTECH_AUTOPOSE_GARDER:-}" ] && { echo "bac conservé : $BAC"; return; }
  rm -rf "$BAC"
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────────────────────────
# LE DOUBLE DU TROUSSEAU — conforme au vrai, et il laisse une trace.
#
# ⚠️ IL RÉPOND COMME `security`, PAS MIEUX : un service qu'il ne connaît pas
# rend le code 44 et la phrase exacte de l'absence — les DEUX seuls témoins que
# `trousseau.js` accepte pour conclure à une absence. Un double plus indulgent
# que le vrai service est le motif qui a coûté sept défauts au lot jumeau.
cat > "$FAUX_SECURITY" <<'DOUBLE'
#!/bin/sh
# find-generic-password -a <compte> -s <service> -w
printf '%s\n' "$*" >> "$SECURITY_TRACE"
service=""
while [ $# -gt 0 ]; do
  case "$1" in
    -s) service="$2"; shift 2 ;;
    *)  shift ;;
  esac
done
case "$service" in
  ligne-directe-bot) printf 'xoxb-jeton-du-banc-jamais-envoye-nulle-part\n'; exit 0 ;;
  ligne-directe-app) printf 'xapp-jeton-du-banc-jamais-envoye-nulle-part\n'; exit 0 ;;
esac
echo "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain." >&2
exit 44
DOUBLE
chmod +x "$FAUX_SECURITY"

# LA SUBSTITUTION, EN UN SEUL POINT NOMMÉ. Chargée par `--import`, donc AVANT le
# module principal : `outils.js` est alors déjà instancié, et `naitre.js` en
# recevra la même instance (le registre de modules ESM indexe par URL).
cat > "$SUBSTITUTION" <<SUBST
import { OUTILS } from '${ROOT}/ligne-directe/src/outils.js';
if (!process.env.FAUX_SECURITY) throw new Error('substitution demandée sans double : le banc refuse de partir');
OUTILS.security.chemin = process.env.FAUX_SECURITY;
SUBST

# ─────────────────────────────────────────────────────────────────────────────
# Lancer `naitre` hors de tout : PATH minimal (donc AUCUN `herdr` joignable),
# HOME jetable, racine jetable, et jamais la marque du lanceur de tests — sauf
# quand le bras l'exige explicitement.
#   $1 = 'double' pour substituer le trousseau, 'nu' pour le vrai `security`,
#        'sous-essais' pour le vrai chemin ET la marque du lanceur de tests.
naitre() {
  local mode="$1"; shift
  local opts=""
  local marque=""
  case "$mode" in
    double)      opts="--import file://${SUBSTITUTION}" ;;
    sous-essais) opts="--import file://${SUBSTITUTION}"; marque="1" ;;
    nu)          : ;;
  esac
  env -i \
    PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
    HOME="$FOYER" \
    TMPDIR="${TMPDIR:-/tmp}" \
    LIGNE_DIRECTE_RACINE="$RACINE" \
    FAUX_SECURITY="$FAUX_SECURITY" \
    SECURITY_TRACE="$TRACE" \
    ${opts:+NODE_OPTIONS="$opts"} \
    ${marque:+NODE_TEST_CONTEXT="$marque"} \
    "$NODE" "$NAITRE" "$@" 2>&1
}

# Une question posée au registre lui-même — jamais une valeur recopiée ici. Un
# littéral dans ce fichier ferait passer au vert un registre qui a changé.
registre() {
  "$NODE" --input-type=module -e "$1" 2>/dev/null
}

# ═════════════════════════════════════════════════════════════════════════════
# LE MÉCANISME DONT TOUT LE BANC DÉPEND — ÉPROUVÉ, PAS SUPPOSÉ.
#
# La substitution passe par `--import` dans `NODE_OPTIONS` (node ≥ 20.6). Un node
# plus ancien la REFUSE et sort aussitôt : chaque bras rougirait alors pour une
# raison qui n'a aucun rapport avec le code éprouvé — le pire des rouges, celui
# qui accuse l'objet quand c'est l'instrument qui a lâché.
#
# ⚠️ ON NE COMPARE AUCUN NUMÉRO DE VERSION : on fait le geste et on regarde s'il a
# porté. Une borne de version dit ce qu'on croit du monde ; un essai dit ce que ce
# node-ci fait.
SONDE="${BAC}/sonde-import.mjs"
printf 'process.env.SONDE_IMPORT_A_PORTE = "1";\n' > "$SONDE"
if ! NODE_OPTIONS="--import file://${SONDE}" "$NODE" -e 'process.exit(process.env.SONDE_IMPORT_A_PORTE === "1" ? 0 : 3)' 2>/dev/null; then
  skip "ce node ne porte pas « --import » dans NODE_OPTIONS ($("$NODE" --version)) — la substitution du trousseau serait inerte, et le banc ne peut pas être honnête sans elle"
fi

# ═════════════════════════════════════════════════════════════════════════════
# OÙ LE CODE CHERCHE `security` — DEMANDÉ AU CODE, JAMAIS ÉCRIT ICI.
#
# ⚠️ UN LITTÉRAL « /usr/bin/security » DANS CE FICHIER SERAIT UNE SECONDE ÉCRITURE
# DE LA RÈGLE. Le jour où `OUTILS` change de chemin, le banc mesurerait la présence
# d'un binaire que le code n'appelle plus — et rendrait un verdict sur un objet
# pour conclure sur un autre.
CHEMIN_SECURITY="$("$NODE" --input-type=module -e "import {OUTILS} from '${ROOT}/ligne-directe/src/outils.js'; process.stdout.write(OUTILS.security.chemin);" 2>/dev/null)"

# ═════════════════════════════════════════════════════════════════════════════
echo "== Ce que le REGISTRE DES RÔLES dit, et c'est lui qui choisit les bras =="
ROLES_AUTO="$(registre "import {rolesConnus, poseAutomatique} from '${ROLES}';
process.stdout.write(rolesConnus().filter((r) => poseAutomatique(r)).join(' '));")"
ROLES_MANUEL="$(registre "import {rolesConnus, poseAutomatique} from '${ROLES}';
process.stdout.write(rolesConnus().filter((r) => !poseAutomatique(r)).join(' '));")"
echo "     pose automatique : ${ROLES_AUTO:-—}"
echo "     pose manuelle    : ${ROLES_MANUEL:-—}"
ROLE_AUTO="$(printf '%s' "$ROLES_AUTO" | awk '{print $1}')"
ROLE_MANUEL="$(printf '%s' "$ROLES_MANUEL" | awk '{print $1}')"
[ -n "$ROLE_AUTO" ] && ok "au moins un rôle du registre s'auto-pose : « ${ROLE_AUTO} »" \
  || { ko "🚨 AUCUN rôle du registre ne s'auto-pose — il n'y a plus d'auto-pose à éprouver"; echo; echo "Résultat : ${PASS} réussis, ${FAIL} échoués"; exit 1; }

DOSSIER_AUTO="$(registre "import {role} from '${ROLES}'; process.stdout.write(role('${ROLE_AUTO}').dossier);")"
GABARITS_AUTO="$(registre "import {role} from '${ROLES}'; process.stdout.write(role('${ROLE_AUTO}').gabarits);")"
[ -n "$DOSSIER_AUTO" ] && [ -n "$GABARITS_AUTO" ] || { ko "le registre ne dit ni dossier ni gabarits pour « ${ROLE_AUTO} »"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
echo "== Un dépôt jetable qui a reçu le pack, et rien d'autre =="
mkdir -p "${DEPOT}/.claude/templates"
for g in "${ROOT}/.claude/templates/"*/; do
  [ -d "$g" ] && cp -R "$g" "${DEPOT}/.claude/templates/$(basename "$g")"
done
git -C "$DEPOT" init -q 2>/dev/null
git -C "$DEPOT" config user.email "banc@somtech.invalid"
git -C "$DEPOT" config user.name  "banc auto-pose"
git -C "$DEPOT" config commit.gpgsign false
git -C "$DEPOT" add -A >/dev/null 2>&1
git -C "$DEPOT" commit -q -m "le pack, tel qu'un dépôt client le reçoit" >/dev/null 2>&1
[ -n "$(git -C "$DEPOT" rev-parse --verify -q HEAD)" ] && ok "dépôt jetable prêt : $(basename "$DEPOT")" \
  || { ko "impossible de préparer un dépôt git jetable"; exit 1; }

NOM="autopose$$"
LIEU="${DEPOT}/${DOSSIER_AUTO}/${NOM}"

# ═════════════════════════════════════════════════════════════════════════════
# BRAS 1 — LE REGISTRE DÉCIDE QUI S'AUTO-POSE, et le refus dit CE QU'IL DIT.
#
# ⚠️ ON NE COMPARE À AUCUN TEXTE ÉCRIT ICI : le motif et le geste sont DEMANDÉS
# au registre, puis cherchés dans le refus. C'est la jointure qu'on mesure —
# « le registre est-il vraiment ce qui parle ? » —, pas une tournure de phrase.
if [ -n "$ROLE_MANUEL" ]; then
  echo "== BRAS 1 — un rôle à pose MANUELLE (« ${ROLE_MANUEL} ») : refus, et RIEN n'existe =="
  DOSSIER_MANUEL="$(registre "import {role} from '${ROLES}'; process.stdout.write(role('${ROLE_MANUEL}').dossier);")"
  MOTIF="$(registre "import {poseManuelle} from '${ROLES}'; process.stdout.write(poseManuelle('${ROLE_MANUEL}').motif);")"
  GESTE="$(registre "import {poseManuelle} from '${ROLES}'; process.stdout.write(poseManuelle('${ROLE_MANUEL}').geste);")"
  SORTIE="$(naitre double "manuel$$" --workspace w-inexistant --role "$ROLE_MANUEL" --depot "$DEPOT")"
  CODE=$?
  [ "$CODE" -ne 0 ] && ok "la commande refuse (code ${CODE}, jamais 0)" || ko "🚨 elle rend 0 sur un rôle qui ne s'auto-pose pas"
  case "$SORTIE" in
    *"$MOTIF"*) ok "le refus porte le MOTIF que le registre déclare" ;;
    *) ko "🚨 le refus ne relaie pas le motif du registre — il le porte donc en dur quelque part" ;;
  esac
  case "$SORTIE" in
    *"$GESTE"*) ok "le refus porte le GESTE que le registre déclare" ;;
    *) ko "🚨 le refus ne relaie pas le geste du registre" ;;
  esac
  [ ! -e "${DEPOT}/${DOSSIER_MANUEL}" ] && ok "RIEN n'a été créé : « ${DOSSIER_MANUEL} » n'existe pas" \
    || ko "🚨 un lieu a été posé pour un rôle à pose manuelle"
else
  echo "== BRAS 1 — sauté : le registre ne porte aucun rôle à pose manuelle =="
fi

# ═════════════════════════════════════════════════════════════════════════════
# BRAS 2 — LA LIGNE EST UN PRÉALABLE, PAS UN SOUHAIT.
#
# Ici, AUCUNE substitution : le vrai `/usr/bin/security` tourne, sous un HOME
# jetable — il cherche donc pour de vrai, et ne trouve rien pour de vrai. C'est
# la vraie cause, pas un état simulé.
echo "== BRAS 2 — le poste ne peut pas ouvrir de ligne : refus, et RIEN n'existe =="
#
# ─────────────────────────────────────────────────────────────────────────────
# CE BRAS EST LE SEUL À CONSULTER LE VRAI BINAIRE, ET IL EST LE SEUL À SAUTER.
#
# `security` est un outil macOS. Sur la chaîne d'intégration (ubuntu-latest,
# `.github/workflows/tests.yml`, qui lance TOUS les `scripts/tests/*.sh` sans
# liste blanche), il n'existe pas au chemin fixe que `OUTILS` désigne.
#
# ⚠️ ET LE DANGER N'EST PAS UN ROUGE — C'EST UN VERT POUR LE MAUVAIS MOTIF.
# MESURÉ le 2026-08-26, en faisant pointer `OUTILS.security.chemin` sur un chemin
# inexistant (la CAUSE de la CI, pas une imitation de son état) : le banc rendait
# 30/30. `chercherJeton` enveloppe l'`OutilIntrouvable` dans un `JetonIllisible`,
# dont le message porte lui aussi « trousseau de ce poste ». Le bras passait donc
# — en affirmant « mesuré par le vrai security » alors qu'aucun binaire n'avait
# été lancé, et sur `jeton_illisible` là où il croit prouver `jeton_absent`.
#
# Deux conduites en découlent, et les deux sont nécessaires :
#   1. quand le binaire n'est pas là, on SAUTE, et le saut se compte à part —
#      une garde qui ne s'est pas exécutée n'est pas une garde qui a réussi ;
#   2. quand il est là, on exige LE MOTIF et LE TÉMOIN — l'absence PROUVÉE, avec
#      ce que `security` a effectivement répondu. Un `jeton_illisible` ne peut
#      plus satisfaire ce bras, sur aucune plateforme.
if [ ! -x "$CHEMIN_SECURITY" ]; then
  saute "« ${CHEMIN_SECURITY:-le binaire du trousseau} » est absent de ce poste — l'absence PROUVÉE d'un jeton ne peut pas être mesurée ici, et un refus « je n'ai pas pu lancer l'outil » ne prouve pas la même chose"
  saute "  (les bras 1, 3, 4 et 5 ne consultent pas ce binaire : ils passent par la substitution, ou refusent en amont)"
else
  SORTIE="$(naitre nu "$NOM" --workspace w-inexistant --role "$ROLE_AUTO" --depot "$DEPOT")"
  CODE=$?
  [ "$CODE" -ne 0 ] && ok "la pose échoue (code ${CODE}, jamais 0)" || ko "🚨 la pose rend 0 sans ligne possible"
  # LE MOTIF, et pas seulement le sujet. `jeton_absent` est le verdict qui exige
  # une preuve POSITIVE d'absence (code 44) ; `jeton_illisible` est le fourre-tout
  # prudent. Les confondre ferait passer ce bras là où rien n'a été mesuré.
  case "$SORTIE" in
    *"(jeton_absent)"*) ok "le refus est « jeton_absent » — l'absence a été PROUVÉE, pas supposée" ;;
    *) ko "🚨 le refus n'est pas « jeton_absent » : $(printf '%s' "$SORTIE" | tr '\n' ' ' | cut -c1-200)" ;;
  esac
  # LE TÉMOIN : le refus rapporte ce que le binaire a DIT. C'est ce qui distingue
  # « security a répondu » de « security n'a jamais été lancé ».
  case "$SORTIE" in
    *"Ce que « security » a répondu"*) ok "et il rapporte ce que le vrai « ${CHEMIN_SECURITY} » a répondu — il a donc bien été lancé" ;;
    *) ko "🚨 le refus ne rapporte rien du binaire : il n'a peut-être jamais été consulté" ;;
  esac
  [ ! -e "${DEPOT}/${DOSSIER_AUTO}" ] && ok "RIEN n'a été créé : « ${DOSSIER_AUTO} » n'existe pas" \
    || ko "🚨 un lieu a été posé alors que la ligne ne pouvait pas s'ouvrir"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BRAS 3 — L'AUTO-POSE ABOUTIT. C'est la jointure que rien ne gardait.
echo "== BRAS 3 — l'auto-pose : la commande POSE le lieu elle-même =="
: > "$TRACE"
SORTIE="$(naitre double "$NOM" --workspace w-inexistant --role "$ROLE_AUTO" --depot "$DEPOT" --session banc-sans-session-$$)"
CODE=$?

# ⚠️ LA PREUVE QUE LA PRODUCTION N'A PAS ÉTÉ TOUCHÉE — mesurée, pas supposée.
if [ -s "$TRACE" ]; then
  ok "le double du trousseau a RÉELLEMENT été consulté ($(wc -l < "$TRACE" | tr -d ' ') appel(s)) — le vrai trousseau ne l'a pas été"
else
  ko "🚨 le double n'a jamais été appelé : ce bras a donc interrogé le VRAI trousseau — banc arrêté"
  echo; echo "Résultat : ${PASS} réussis, ${FAIL} échoués"; exit 1
fi

# La preuve de la pose est SUR LE DISQUE, jamais dans le message.
[ -d "$LIEU" ] && ok "le lieu existe : ${DOSSIER_AUTO}/${NOM}/ — posé par la commande, par personne d'autre" \
               || ko "🚨 aucun lieu n'a été posé : l'auto-pose n'a pas eu lieu"
for f in CLAUDE.md CONTEXTE.md .mcp.json .claude/settings.json; do
  [ -f "${LIEU}/${f}" ] && ok "  ${f} est là" || ko "  ${f} manque — le lieu est à demi posé"
done

# Et la commande REFUSE quand même, parce qu'un lieu qu'on vient de poser est
# resté son gabarit. C'est le défaut bloquant que T-20260826-0043 a fermé.
[ "$CODE" -ne 0 ] && ok "la commande refuse (code ${CODE}) : un lieu au gabarit ne fait pas naître" \
                  || ko "🚨 elle rend 0 sur un lieu resté au gabarit"
case "$SORTIE" in
  *"VIENT D'ÊTRE POSÉ"*|*"VIENT D’ÊTRE POSÉ"*) ok "l'avis dit que le lieu VIENT d'être posé" ;;
  *) ko "🚨 l'avis d'auto-pose manque : $(printf '%s' "$SORTIE" | tr '\n' ' ' | cut -c1-240)" ;;
esac
case "$SORTIE" in
  *"pas versé"*) ok "et il dit que ce lieu n'est pas versé" ;;
  *) ko "🚨 l'avis ne dit pas que le lieu n'est pas versé" ;;
esac
case "$SORTIE" in
  *"Rien n'a été créé par cette commande"*|*"Rien n’a été créé par cette commande"*)
    ko "🚨 l'avis affirme que rien n'a été créé alors qu'un répertoire entier vient de l'être" ;;
  *) ok "et il n'affirme JAMAIS le contraire de ce qui vient d'arriver" ;;
esac
# Non versé : c'est ce que l'avis promet, et ça se vérifie chez git.
SUIVIS="$(git -C "$DEPOT" ls-files "${DOSSIER_AUTO}/${NOM}" | wc -l | tr -d ' ')"
[ "$SUIVIS" = "0" ] && ok "git ne porte encore RIEN de ce lieu (${SUIVIS} fichier suivi) — l'avis disait vrai" \
                    || ko "🚨 l'avis dit « pas versé » et git en porte ${SUIVIS}"

# ═════════════════════════════════════════════════════════════════════════════
# BRAS 4 — LA SUITE DE LA CHAÎNE, une fois le geste que l'avis demande accompli.
#
# On remplit les rubriques du lieu — exactement ce que l'avis dit de faire — et
# on relance. Ce qui se mesure n'est pas un message : c'est que GIT PORTE le
# lieu et la garde d'ouverture, donc que la chaîne a franchi la garde du lieu
# renseigné, le versement, la pose de la garde et son versement.
echo "== BRAS 4 — lieu rempli : la chaîne continue, verse, et s'arrête à la frontière herdr =="
if [ -d "$LIEU" ]; then
  for f in CONTEXTE.md RONDE.md; do
    [ -f "${LIEU}/${f}" ] || continue
    perl -0pi -e 's/<(?!!--)[^<>\n]+>/rempli par le banc d’auto-pose/g' "${LIEU}/${f}"
  done
  SORTIE="$(naitre double "$NOM" --workspace w-inexistant --role "$ROLE_AUTO" --depot "$DEPOT" --session banc-sans-session-$$)"
  CODE=$?

  case "$SORTIE" in
    *"VIENT D'ÊTRE POSÉ"*|*"VIENT D’ÊTRE POSÉ"*|*"au gabarit"*|*"rubrique"*)
      ko "🚨 la garde du lieu renseigné refuse encore un lieu rempli : $(printf '%s' "$SORTIE" | tr '\n' ' ' | cut -c1-240)" ;;
    *) ok "la garde du lieu renseigné ne reproche plus rien" ;;
  esac

  SUIVIS="$(git -C "$DEPOT" ls-files "${DOSSIER_AUTO}/${NOM}" | wc -l | tr -d ' ')"
  [ "${SUIVIS:-0}" -ge 4 ] && ok "la commande a VERSÉ le lieu : git en porte ${SUIVIS} fichiers" \
                           || ko "🚨 le lieu n'est pas versé (${SUIVIS} fichier(s) suivi(s)) — un lieu hors de git fait naître un agent que rien ne borne"
  git -C "$DEPOT" ls-files "${DOSSIER_AUTO}/${NOM}/.claude/settings.json" | grep -q . \
    && ok "la garde d'ouverture est posée ET versée — personne ne pouvait la verser d'avance" \
    || ko "🚨 « .claude/settings.json » du lieu n'est dans aucun commit"

  # LA FRONTIÈRE. On a désigné une session herdr qui n'existe pas : la commande
  # doit s'arrêter là, en la nommant, et n'avoir créé AUCUN onglet.
  [ "$CODE" -ne 0 ] && ok "la commande s'arrête (code ${CODE}) sans faire naître quoi que ce soit" \
                    || ko "🚨 elle rend 0 alors qu'aucune session herdr ne pouvait la recevoir"
  # ⚠️ AUCUN REPLI PERMISSIF ICI. Une première version acceptait « le message
  # contient herdr » en second choix : un refus sans rapport qui aurait cité
  # `herdr` au passage l'aurait satisfaite — une assertion trop faible SUR UN
  # CHEMIN CORRECT survit à l'énumération des appelants et ne se voit jamais.
  # Le message est déterministe, puisque c'est NOUS qui désignons une session
  # qui n'existe pas : on exige donc celui-là, et son nom.
  case "$SORTIE" in
    *"aucune session herdr ne s'appelle « banc-sans-session-$$ »"*|*"aucune session herdr ne s’appelle « banc-sans-session-$$ »"*)
      ok "elle s'arrête EXACTEMENT à la frontière herdr, en nommant la session — tout ce qui précède a été franchi" ;;
    *) ko "🚨 elle s'arrête ailleurs qu'à la frontière herdr : $(printf '%s' "$SORTIE" | tr '\n' ' ' | cut -c1-240)" ;;
  esac
else
  ko "pas de lieu posé : la suite de la chaîne ne peut pas être mesurée"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BRAS 5 — LA CLOISON TIENT, ET CE BANC NE LUI OUVRE AUCUNE PORTE.
#
# ⚠️ C'EST LA GARDE QUI ROUGIT SI LA CLOISON EST RETIRÉE. On rejoue le BRAS 3 —
# même commande, même double du trousseau, même lieu absent — en portant la
# marque que `node --test` transmet à sa descendance. La cloison doit refuser la
# lecture du trousseau AVANT que le binaire soit lancé, donc AVANT le double :
# si elle est retirée ou contournée, le lieu se pose, et ce bras devient rouge.
echo "== BRAS 5 — sous la marque du lanceur de tests, la MÊME auto-pose ne pose RIEN =="
NOM_CLOISON="cloison$$"
LIEU_CLOISON="${DEPOT}/${DOSSIER_AUTO}/${NOM_CLOISON}"
: > "$TRACE"
SORTIE="$(naitre sous-essais "$NOM_CLOISON" --workspace w-inexistant --role "$ROLE_AUTO" --depot "$DEPOT" --session banc-sans-session-$$)"
CODE=$?
[ ! -e "$LIEU_CLOISON" ] && ok "AUCUN lieu posé sous la marque d'essais — la cloison mord toujours" \
                         || ko "🚨 LA CLOISON NE MORD PLUS : un lieu a été posé depuis un processus marqué « essais »"
[ "$CODE" -ne 0 ] && ok "et la commande refuse (code ${CODE})" || ko "🚨 elle rend 0 sous la marque d'essais"
case "$SORTIE" in
  *"CLOISON D'ESSAIS"*|*"CLOISON D’ESSAIS"*) ok "le refus est bien celui de la cloison, nommé" ;;
  *) ko "🚨 le refus ne vient pas de la cloison : $(printf '%s' "$SORTIE" | tr '\n' ' ' | cut -c1-240)" ;;
esac
[ ! -s "$TRACE" ] && ok "le trousseau n'a même pas été INTERROGÉ — la cloison est en amont du binaire" \
                  || ko "🚨 la cloison a laissé partir $(wc -l < "$TRACE" | tr -d ' ') appel(s) au trousseau"

# ═════════════════════════════════════════════════════════════════════════════
VEILLEURS_APRES="$(veilleurs)"
echo
echo "== Veilleurs vivants APRÈS le banc : ${VEILLEURS_APRES} (avant : ${VEILLEURS_AVANT}) =="
[ "$VEILLEURS_APRES" = "$VEILLEURS_AVANT" ] && ok "aucun veilleur n'est né de ce banc" \
  || ko "🚨 ${VEILLEURS_AVANT} → ${VEILLEURS_APRES} veilleur(s) : c'est l'incident même qui a fait poser la cloison"

echo
if [ "$SAUTS" -gt 0 ]; then
  echo "Résultat : ${PASS} réussis, ${FAIL} échoués, ${SAUTS} sautés (non mesurés — voir les ⏭️ ci-dessus)"
else
  echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
fi
[ "$FAIL" -eq 0 ]
