#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Le métier de l'orchestrateur prescrit des gestes QUI TIENNENT — E-20260819-0001
#
# CE QUE CE BANC GARDE, et pourquoi il existe :
#
# `.claude/templates/orchestrateur/CLAUDE.md` est le PREMIER FICHIER de
# l'existence d'un orchestrateur, lu EN ENTIER à chaque naissance. Huit gestes
# qu'il prescrivait ont été mesurés faux le 2026-08-18 sur des lots réels.
# Une fois corrigés, rien n'empêchait qu'une réécriture ultérieure les reperde :
# une relecture ne voit pas qu'une moitié a disparu (mémoire du dépôt —
# « une moitié survit, le lieu non »).
#
# ⚠️ CE QUE CE BANC NE PRÉTEND PAS FAIRE. Il éprouve que la FONCTION est
# servie à l'endroit où le geste se pose — pas que le mot est présent quelque
# part. Un `grep` de mot serait désarmable en déplaçant la phrase dans une
# section où personne ne la lira. Chaque assertion est donc ANCRÉE À SA
# SECTION, et les assertions négatives (« ne contient pas X ») sont toujours
# APPARIÉES à une assertion positive sur le même objet — sinon supprimer la
# ligne les rendrait vertes.
#
# Mesures qui fondent chaque garde : T-20260818-0109 · T-20260818-0123 ·
# T-20260818-0124 · T-20260818-0128 · T-20260818-0143 · D-20260818-0008.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
METIER="${METIER_ORCHESTRATEUR:-$RACINE/.claude/templates/orchestrateur/CLAUDE.md}"

echecs=0
total=0

ok()   { total=$((total+1)); echo "  ✓ $1"; }
ko()   { total=$((total+1)); echo "  ✗ $1"; echecs=$((echecs+1)); }

# section <titre-exact-sans-les-dièses> — rend le corps de la section, du titre
# jusqu'au prochain titre de MÊME niveau ou plus haut. On borne à la section
# parce qu'une règle écrite ailleurs que là où le geste se pose ne gouverne
# personne : c'est le défaut « une règle vaut pour sa fonction » retourné.
section() {
  local motif="$1"
  awk -v motif="$motif" '
    /^#+ / {
      n = 0; while (substr($0, n+1, 1) == "#") n++
      if (dedans && n <= niv_ouvert) { dedans = 0 }
      if (!dedans && index($0, motif) > 0) { dedans = 1; niv_ouvert = n; next }
    }
    dedans { print }
  ' "$METIER"
}

echo "── Le métier de l'orchestrateur — les huit gestes mesurés le 2026-08-18"
echo "   fichier : ${METIER#$RACINE/}"

if [ ! -f "$METIER" ]; then
  echo "  ✗ le gabarit est introuvable — rien à éprouver"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# ① LA VEILLE — le geste prescrit est celui qui SURVIT     (T-20260818-0109)
#
# Mesuré 2× : `veille-deblocage.sh … &` lancée depuis une session Claude Code
# devient une tâche de fond du harnais, et le harnais la tue. Les veilles d'un
# autre orchestrateur, lancées autrement, survivaient — même script, même
# poste, même journée.
# ═══════════════════════════════════════════════════════════════════════════
echo "① la veille posée survit — T-20260818-0109"

# Toutes les invocations qui POSENT une veille (donc pas `--list`, pas `--duree`).
# ⚠️ Pas de `mapfile` ici : il n'existe pas en bash 3.2, celui de macOS. Un banc
# qui ne tourne que sur le runner ne peut pas rougir chez celui qui écrit —
# et c'est exactement le mode de panne que ce dépôt paie en boucle.
POSES=()
while IFS= read -r __l; do
  [ -n "$__l" ] && POSES+=("$__l")
done <<EOF
$(grep -n 'veille-deblocage\.sh' "$METIER" \
  | grep -v -- '--list' | grep -v -- '--duree' \
  | grep -v '`veille-deblocage\.sh`' || true)
EOF

# Assertion POSITIVE d'abord, et elle n'est pas décorative : sans elle, un
# simple effacement des lignes de pose rendrait VERTES toutes les assertions
# négatives qui suivent (« aucune ne porte de & » est vrai d'un ensemble vide).
# C'est le mode de panne « une garde qu'on peut désarmer sans rougir ».
if [ "${#POSES[@]}" -ge 1 ]; then
  ok "le geste de pose est prescrit (${#POSES[@]} endroit(s))"
else
  ko "aucun geste de pose dans le texte — un orchestrateur ne saurait pas poser sa veille"
fi

pose_sans_detach=0
pose_avec_esperluette=0
for ligne in "${POSES[@]}"; do
  corps="${ligne#*:}"
  case "$corps" in
    *--detach*) ;;
    *) pose_sans_detach=$((pose_sans_detach+1)) ;;
  esac
  # une pose qui se termine par `&` (éventuellement suivie d'un commentaire)
  if printf '%s' "$corps" | grep -qE '&\s*(#.*)?$'; then
    pose_avec_esperluette=$((pose_avec_esperluette+1))
  fi
done

if [ "$pose_sans_detach" -eq 0 ]; then
  ok "toutes les poses portent --detach — la survie ne dépend plus de l'appelant"
else
  ko "$pose_sans_detach pose(s) sans --detach — la forme prescrite serait tuée par le harnais"
fi

if [ "$pose_avec_esperluette" -eq 0 ]; then
  ok "aucune pose ne s'appuie sur un « & » nu"
else
  ko "$pose_avec_esperluette pose(s) se terminent par « & » — la forme mesurée MORTE deux fois"
fi

# `--list` : le texte doit dire qu'un compte ne suffit pas — il faut le pane,
# l'agent et le MOTIF. « Compter ne suffit pas : il faut savoir ce qu'on compte »
# est la mesure exacte du 2026-08-18 22 h 15 (3 veilles trouvées, aucune à soi).
S_VEILLE="$(section 'Poser la veille de déblocage')"
if printf '%s' "$S_VEILLE" | grep -q -- '--list'; then
  ok "la section de la veille prescrit --list pour savoir lesquelles tournent"
else
  ko "la section de la veille ne prescrit pas --list — un orchestrateur ne sait pas les lister"
fi

if printf '%s' "$S_VEILLE" | grep -qi 'motif'; then
  ok "elle nomme le MOTIF d'arrêt — un compte global ne dit pas sur quoi on veille"
else
  ko "elle ne parle d'aucun motif d'arrêt — la veille pourrait s'éteindre en silence"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ⑧ L'ORDRE À LA NAISSANCE — la veille ne se pose pas sur un agent qui n'a
#    rien à faire                                          (T-20260818-0109)
#
# La séquence prescrite posait la veille AVANT le brief, c'est-à-dire au seul
# moment où l'agent est `idle` sans avoir rien à faire : elle lisait son
# attente comme un travail fini et rendait « TERMINE apres 0 deblocages ».
# ═══════════════════════════════════════════════════════════════════════════
echo "⑧ la veille se pose après le brief — T-20260818-0109"

lig_brief="$(grep -n 'livrer\.js' "$METIER" | grep -- '--en-attente' | head -1 | cut -d: -f1)"
lig_pose="$(printf '%s\n' "${POSES[@]}" | head -1 | cut -d: -f1)"

if [ -n "$lig_brief" ] && [ -n "$lig_pose" ]; then
  if [ "$lig_pose" -gt "$lig_brief" ]; then
    ok "la première pose (l. $lig_pose) vient APRÈS la livraison du brief (l. $lig_brief)"
  else
    ko "la première pose (l. $lig_pose) précède la livraison du brief (l. $lig_brief) — l'agent y est idle sans rien à faire"
  fi
else
  ko "impossible de situer la livraison du brief ou la pose de la veille dans le texte"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ② LE NOMMAGE — R3 ne dit plus le contraire du dispositif  (T-20260818-0124)
#
# La rivière pour qui ARBITRE, le code de mandat pour qui EXÉCUTE. Le bloc
# « Te nommer toi-même » s'adresse à l'orchestrateur : son exemple doit donc
# être une rivière, sinon il montre le geste que la règle du dessus interdit.
# ═══════════════════════════════════════════════════════════════════════════
echo "② R3 — la rivière pour qui arbitre, le code pour qui exécute — T-20260818-0124"

lig_rename="$(grep -n 'herdr agent rename' "$METIER" | head -1)"
corps_rename="${lig_rename#*:}"

if [ -n "$lig_rename" ]; then
  ok "le geste pour se nommer soi-même est prescrit"
  if printf '%s' "$corps_rename" | grep -qE '\b[dpjet]-2[0-9]{7}-[0-9]{4}\b'; then
    ko "il donne un CODE DE MANDAT en exemple — le geste même que la règle du dessus refuse à un orchestrateur"
  else
    ok "il ne donne pas un code de mandat en exemple"
  fi
  if printf '%s' "$corps_rename" | grep -qE 'matapedia|batiscan|ristigouche|bonaventure|<ta-rivière>|ta-riviere'; then
    ok "il donne une RIVIÈRE en exemple"
  else
    ko "il ne donne aucune rivière en exemple — l'orchestrateur ne voit pas ce qu'il doit porter"
  fi
else
  ko "aucun geste pour se nommer soi-même — un orchestrateur naîtrait anonyme"
fi

# Le contre-exemple d'origine reste valide pour les CHEFS D'ÉQUIPE : R3 ne
# s'abroge pas, il se précise.
if grep -q 'revue-pr180' "$METIER"; then
  ok "le contre-exemple d'origine (revue-pr180) est conservé — R3 se précise, il ne s'abroge pas"
else
  ko "le contre-exemple d'origine a disparu — R3 a été abrogé au lieu d'être précisé"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ③ LA LIGNE À LA RENAISSANCE — aux DEUX endroits           (T-20260818-0128)
#
# « Referme ta ligne, c'est le dernier geste » vise la CLÔTURE d'un chantier.
# Appliqué à une renaissance, il coupe le dirigeant entre la mort d'un
# orchestrateur et la naissance de son successeur. Le ticket exige la
# distinction dans « Clore » ET dans « Mettre à jour un agent vivant » : une
# règle écrite dans une seule des deux sections ne mord pas dans l'autre.
# ═══════════════════════════════════════════════════════════════════════════
echo "③ la ligne ne se referme pas à une renaissance — T-20260818-0128"

porte_la_distinction() {
  # La fonction servie : « chantier non clos / renaissance → tu NE refermes PAS ».
  # On exige les deux moitiés dans la même section, sinon la phrase peut être
  # juste et parler d'autre chose.
  printf '%s' "$1" | grep -qiE 'rena(is|ît|it)|successeur' \
    && printf '%s' "$1" | grep -qiE 'ne +(la +|te +)?referme[sz]? +(pas|jamais)|sans la refermer|reste ouverte'
}

S_CLORE="$(section 'Clore')"
if porte_la_distinction "$S_CLORE"; then
  ok "« Clore » distingue la clôture d'une renaissance"
else
  ko "« Clore » ne distingue pas la clôture d'une renaissance — le successeur naîtrait sans canal"
fi

S_VIVANT="$(section 'Mettre à jour un agent vivant')"
if porte_la_distinction "$S_VIVANT"; then
  ok "« Mettre à jour un agent vivant » la porte aussi — là où le geste se pose"
else
  ko "« Mettre à jour un agent vivant » ne la porte pas — la règle ne mord qu'à un seul endroit"
fi

if printf '%s' "$S_CLORE" | grep -qi 'jetable' && printf '%s' "$S_CLORE" | grep -qi 'durable'; then
  ok "la différence durable / jetable est écrite là où l'on referme"
else
  ko "durable et jetable ne sont pas distingués — refermer une ligne jetable est irréversible"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ④ UN `done` SE RELIT À L'ÉCRAN                            (T-20260818-0123)
#
# Deux chefs d'équipe `done` qui n'avaient PAS fini — coupés par une limite de
# session. Sans lecture d'écran, l'orchestrateur concluait à deux lots livrés,
# et fermer leur pane aurait détruit du travail non poussé.
#
# ⚠️ La BORNE compte autant que la règle : la ronde ne doit pas devenir
# « lire tous les écrans à chaque tour », ce qui la rendrait impraticable.
# ═══════════════════════════════════════════════════════════════════════════
echo "④ un done se relit à l'écran — T-20260818-0123"

S_RONDE="$(section '1 — Tes agents et le travail qui tourne')"
if printf '%s' "$S_RONDE" | grep -q '`done`' \
   && printf '%s' "$S_RONDE" | grep -qiE 'relis|relire|lis son écran|à l.écran'; then
  ok "la ronde dit qu'un done se relit à l'écran avant conclusion"
else
  ko "la ronde ne dit pas qu'un done se relit — elle se fie à un état qui recouvre « a fini » et « a été coupé »"
fi

if printf '%s' "$S_RONDE" | grep -qiE 'tous les écrans|chaque tour.*écran|pas.*lire tous'; then
  ok "la borne est écrite — la ronde ne devient pas « lire tous les écrans à chaque tour »"
else
  ko "la borne manque — la règle rendrait la ronde impraticable, donc elle sera abandonnée"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ⑤ LES CONDITIONS DE FIN AUX DEUX ENDROITS                 (T-20260818-0143)
#
# Un `herdr pane run` vers un agent OCCUPÉ s'affame : mesuré à ~16 minutes de
# texte non soumis. Un `/goal` jamais pris est un agent qui s'arrête au premier
# palier. Ce qui a sauvé le lot : les conditions de fin vivaient AUSSI dans les
# success_criteria de l'epic. La redondance existait par habitude, pas par règle.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑤ les conditions de fin vivent aux deux endroits — T-20260818-0143"

S_BUT="$(section 'Poser son but')"
if printf '%s' "$S_BUT" | grep -q 'success_criteria'; then
  ok "« Poser son but » renvoie aussi aux success_criteria de l'epic"
else
  ko "« Poser son but » ne connaît que le /goal — point unique de défaillance mesuré"
fi

if printf '%s' "$S_BUT" | grep -qiE 'affam|occupé|16 min|non soumis'; then
  ok "il dit POURQUOI — un pane run vers un agent occupé s'affame"
else
  ko "il ne dit pas pourquoi la redondance existe — une règle sans son motif se fait retirer"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ⑥ RELIS LA BOÎTE JUSTE AVANT D'Y AGIR                     (T-20260818-0143)
#
# Une consigne juste, donnée sur un état vieux de quinze minutes, a produit un
# geste sur une boîte VIDE — le but était pris depuis quatre minutes. « Sur une
# boîte, un geste inutile n'est jamais sans effet. »
#
# La règle a DEUX conditions : ① le texte est le tien, tu l'as vu déposer
# ② tu viens de relire la boîte, juste avant. Sans ②, on autorise un geste sur
# un état supposé. Le mot `send-keys` n'existait NULLE PART dans ce texte.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑥ relis la boîte juste avant d'y agir — T-20260818-0143"

if grep -q 'send-keys' "$METIER"; then
  ok "le geste send-keys est nommé — il se posait sans qu'aucune règle ne l'encadre"
else
  ko "send-keys n'apparaît nulle part — le geste le plus irréversible du texte n'est pas encadré"
fi

# Les deux conditions, mesurées dans le voisinage du geste (± 25 lignes) :
# une condition écrite à l'autre bout du fichier ne gouverne pas ce geste-ci.
CTX_SK="$(grep -n 'send-keys' "$METIER" | head -1 | cut -d: -f1)"
if [ -n "$CTX_SK" ]; then
  VOISINAGE="$(sed -n "$((CTX_SK > 25 ? CTX_SK - 25 : 1)),$((CTX_SK + 25))p" "$METIER")"
  if printf '%s' "$VOISINAGE" | grep -qiE 'le tien|ton propre texte|que tu as écrit'; then
    ok "condition ① — le texte est le tien, présente auprès du geste"
  else
    ko "condition ① absente auprès du geste — on autoriserait d'écrire dans la boîte d'autrui"
  fi
  if printf '%s' "$VOISINAGE" | grep -qiE 'juste avant|viens de relire|à l.instant'; then
    ok "condition ② — tu viens de relire la boîte, juste avant"
  else
    ko "condition ② absente — c'est la condition qui manquait, et son absence a produit le geste sur une boîte vide"
  fi
else
  ko "aucun voisinage à éprouver — le geste n'est pas dans le texte"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ⑦ LA CORRECTION ENTRE PAIRS EST RÉCIPROQUE                (D-20260818-0008)
#
# « Un pair qui se croit systématiquement en tort finit par ne plus corriger —
# et c'est précisément ce qui nous a servi ce soir. » Six corrections croisées
# en trois heures, chacune ayant évité une écriture fausse.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑦ la correction entre pairs est réciproque — D-20260818-0008"

S_PAIRS="$(section 'Coordonner les chantiers voisins')"
if printf '%s' "$S_PAIRS" | grep -qiE 'deux sens|réciproq|dans les deux'; then
  ok "la réciprocité de la correction est écrite là où le pair est défini"
else
  ko "rien ne dit que la correction se rend dans les deux sens — celui qui se croit en tort cesse de corriger"
fi

if printf '%s' "$S_PAIRS" | grep -qi 'compte' && printf '%s' "$S_PAIRS" | grep -qi 'tort'; then
  ok "le compte des torts est nommé comme une mesure qui se fausse"
else
  ko "le compte des torts n'est pas nommé — c'est la mesure la plus facile à fausser, elle n'a pas d'empreinte"
fi

# ═══════════════════════════════════════════════════════════════════════════
# TRAÇABILITÉ — un amendement sans sa mesure est une opinion
#
# Une opinion dans ce fichier devient une règle opposable pour tout le monde.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑨ chaque amendement cite la mesure qui le fonde"

for t in T-20260818-0109 T-20260818-0123 T-20260818-0124 T-20260818-0128 T-20260818-0143; do
  if grep -q "$t" "$METIER"; then
    ok "$t est cité dans le texte"
  else
    ko "$t n'est cité nulle part — l'amendement qu'il fonde est une opinion"
  fi
done

# ═══════════════════════════════════════════════════════════════════════════
# ⑩ LE TEXTE NE GONFLE PAS
#
# Il est lu EN ENTIER à chaque naissance. Un métier qui gonfle à chaque leçon
# finit par ne plus être lu — et ce serait pire que les huit défauts réunis.
# La borne n'est pas un seuil de confort : elle est la contrainte du brief.
#
# Baseline mesurée sur origin/main au 2026-08-19 : 118 856 octets.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑩ le texte n'a pas gonflé sans raison"

BASELINE=118856
PLAFOND=$((BASELINE + 4000))
TAILLE="$(wc -c < "$METIER" | tr -d ' ')"

if [ "$TAILLE" -le "$PLAFOND" ]; then
  ok "$TAILLE octets — sous le plafond de $PLAFOND (baseline $BASELINE + 4000)"
else
  ko "$TAILLE octets — au-dessus du plafond de $PLAFOND : chaque ajout doit REMPLACER ou PRÉCISER"
fi

echo
if [ "$echecs" -eq 0 ]; then
  echo "✅ $total/$total — le métier prescrit des gestes qui tiennent"
  exit 0
else
  echo "❌ $echecs échec(s) sur $total"
  exit 1
fi
