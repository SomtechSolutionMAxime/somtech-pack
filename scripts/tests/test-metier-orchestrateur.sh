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
# ⚠️ Depuis que le gabarit est RENDU (P-20260820-0001), le métier n'est plus UN
# fichier : « CLAUDE.md » porte le socle, et « metier/chapitres/*.md » le reste.
# Un contrôle qui ne lirait que le socle jugerait 850 mots là où le métier en
# fait 25 000 — il passerait au vert sans rien garder.
GABARIT="${GABARIT_ORCHESTRATEUR:-$RACINE/.claude/templates/orchestrateur}"
METIER="$(mktemp -t smtk-metier-orch)"
cat "$GABARIT/CLAUDE.md" > "$METIER"
if [ -d "$GABARIT/metier/chapitres" ]; then
  for c in "$GABARIT/metier/chapitres"/*.md; do printf '\n\n' >> "$METIER"; cat "$c" >> "$METIER"; done
fi
trap 'rm -f "$METIER"' EXIT

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
echo "   métier  : ${GABARIT#$RACINE/} (socle + chapitres)"

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
# ⚠️ ANCRÉES SUR LEUR MARQUEUR, PAS SUR UNE FENÊTRE.
# La première version cherchait « le tien » dans ±25 lignes autour du geste.
# Une revue de fond a reproduit le faux témoin : en SUPPRIMANT la condition ①,
# l'assertion restait VERTE — satisfaite par « puis livre le tien avec un avis »,
# une phrase sans aucun rapport située 24 lignes plus haut, dans le paragraphe
# sur la délivrance de `livrer.js`. La garde ne protégeait donc rien.
# On exige désormais que la MÊME LIGNE porte le marqueur de la condition ET sa
# substance : une collision fortuite ne suffit plus.
CTX_SK="$(grep -n 'send-keys' "$METIER" | head -1 | cut -d: -f1)"
if [ -n "$CTX_SK" ]; then
  VOISINAGE="$(sed -n "$((CTX_SK > 15 ? CTX_SK - 15 : 1)),$((CTX_SK + 15))p" "$METIER")"
  if printf '%s' "$VOISINAGE" | grep -qE '①[^①②]*(le TIEN|le tien|ton propre texte|que tu as écrit)'; then
    ok "condition ① — le texte est le tien, portée par la ligne qui l'énumère"
  else
    ko "condition ① absente auprès du geste — on autoriserait d'écrire dans la boîte d'autrui"
  fi
  if printf '%s' "$VOISINAGE" | grep -qE '②[^①②]*(juste avant|viens de relire|à l.instant)'; then
    ok "condition ② — tu viens de relire la boîte, portée par la ligne qui l'énumère"
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
# ⑪ LES HUIT RÈGLES DU 2026-08-19 — chacune À L'ENDROIT DE SON GESTE
#
# E-20260819-0013. Huit règles ont été mesurées ce jour-là, six formulées par
# les agents eux-mêmes, deux venues du CTO. Elles sont entrées ici SANS aucune
# garde : 177 lignes de règle opposable qu'une réécriture pouvait reperdre
# exactement comme les huit précédentes — c'est le motif que ce banc existe
# pour empêcher, et il ne le couvrait pas pour elles (relevé en revue de fond).
#
# ⚠️ CHAQUE ASSERTION EST ANCRÉE À LA SECTION OÙ LE GESTE SE POSE, jamais au
# fichier entier : une règle déplacée dans une section que personne n'ouvre au
# moment du geste ne gouverne plus personne — c'est précisément le défaut que
# ces huit corrigent, et il serait retourné si on le laissait passer ici.
#
# ⚠️ ET CHAQUE RÈGLE EST ÉPROUVÉE AVEC SA BORNE, pas seulement son affirmation.
# La borne est la moitié qui la fait survivre : sans elle la règle nuit, se
# fait retirer, et emporte ce qu'elle gardait. C'est la règle des deux chiffres
# appliquée à ce banc-ci.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑪ les huit règles du 2026-08-19 — chacune à son geste"

# ── 8. LU — ordre du CTO répété quatre fois. La règle EXISTAIT et nommait le
#    MAUVAIS adversaire : « se mettre à travailler d'abord ». Les quatre
#    occurrences mesurées sont « répondre le contenu qu'on a tout de suite ».
S_LU="$(section 'Accuser LU')"
# ⚠️ SUR SA SUBSTANCE, PAS SUR SON NOM. Calée d'abord sur « se mettre à
# travailler », elle restait VERTE quand on retirait la prescription d'origine :
# le bloc ajoute juste en dessous CITE ce piège pour dire qu'il n'est pas le bon
# (« Le piège nommé au-dessus est "se mettre à travailler d'abord" »). La citation
# suffisait à la satisfaire. On exige donc le motif que seule la prescription
# porte.
#
# ⚠️ CE RENVOI A DEJA ETE MAL LU, ET LA FORMULATION EST CORRIGEE POUR CA. Le
# premier jet de ce bloc ⑪ laissait SEPT mutations survivantes sur 23 — toutes
# corrigees dans le meme lot, avant livraison. Une revue de fond a lu la mention
# de ces sept comme sept survivantes RESTANTES et en a tire un verdict de rejet.
# Etat mesure a la livraison : 36 mutations jouees UNE A UNE sur copie hors du
# depot (`METIER_ORCHESTRATEUR=<copie>`), ZERO survivante, arbre propre.
if printf '%s' "$S_LU" | grep -qi 'parce que ce sera vite fait'; then
  ok "8 — l'ancien piège est conservé : la règle se précise, elle ne s'abroge pas"
else
  ko "8 — l'ancien piège a disparu : on a remplacé une moitié au lieu d'en ajouter une"
fi

if printf '%s' "$S_LU" | grep -qi "réponse utile n'est pas un" \
   && printf '%s' "$S_LU" | grep -qi "envie d'être utile"; then
  ok "8 — le VRAI adversaire est nommé : répondre le contenu qu'on a tout de suite"
else
  ko "8 — seul « se mettre à travailler » est nommé — c'est le piège qui n'a PAS mordu, et la règle se fera enjamber sans qu'on le voie"
fi

if printf '%s' "$S_LU" | grep -qi 'tanné de la répéter'; then
  ok "8 — le motif du CTO est recopié, pas résumé"
else
  ko "8 — le motif du CTO n'est plus recopié : une règle sans son motif se fait retirer"
fi

# Sa borne : elle ne tiendra pas par sa seule présence dans un fichier lu une
# fois à la naissance — elle doit AUSSI être portée par ce qui arrive.
if printf '%s' "$S_LU" | grep -qi '/loop'; then
  ok "8 — la règle est renvoyée au support qui ARRIVE, pas seulement écrite ici"
else
  ko "8 — rien ne la porte hors de ce fichier : elle est lue à la naissance et plus jamais au moment du geste"
fi

# ── 1. Le focus — consigne du CTO, T-20260819-0114.
S_FOCUS="$(section 'mets-le devant lui')"
if printf '%s' "$S_FOCUS" | grep -q 'herdr agent focus'; then
  ok "1 — le geste qui amène le pane devant le CTO est prescrit"
else
  ko "1 — le geste n'est pas prescrit : l'orchestrateur décrira où chercher sur un poste qui porte des dizaines de panes"
fi

if [ "$(printf '%s' "$S_FOCUS" | grep -c 'terminal_title')" -ge 2 ]; then
  ok "1 — le titre de fenêtre est donné : c'est ce que le CTO voit, lui"
else
  ko "1 — seul l'identifiant de pane est donné, et il ne lui dit rien"
fi

# ⚠️ SA PREMIERE ALTERNATIVE ETAIT MORTE, et une revue de fond l'a montre : le
# texte ecrit « le focus **amène** le pane », donc « amène le pane » n'a ZERO
# occurrence litterale — les asterisques sont au milieu. La sonde ne tenait donc
# que sur sa seconde moitie, et retirer toute la partie positive de la phrase la
# laissait VERTE (mutation reproduite). Une alternative qui ne peut jamais
# matcher ne garde rien : on exige les deux moities, sur le texte reel.
if printf '%s' "$S_FOCUS" | grep -qi 'le focus \*\*amène\*\* le pane' \
   && printf '%s' "$S_FOCUS" | grep -qi "ne dit pas ce qu'il faut y faire"; then
  ok "1 — sa borne est écrite : le focus amène, il n'explique pas"
else
  ko "1 — la borne manque : on envoie le CTO devant un écran qu'il doit décoder seul"
fi

# ── 2. Un hook, un /goal, un rappel de session ne sont pas une personne.
S_BIAIS="$(section 'Tes réflexes')"
if printf '%s' "$S_BIAIS" | grep -qi 'ne sont pas une personne' \
   && printf '%s' "$S_BIAIS" | grep -qi 'nommer le canal'; then
  ok "2 — la source non-humaine est couverte, et le canal doit être nommable"
else
  ko "2 — le biais d'autorité suppose encore un humain au départ : une consigne venue d'un dispositif se fera attribuer à quelqu'un"
fi

# La forme symétrique — une inférence rendue comme citation — est la plus
# insidieuse : la source EST une personne et tout le reste est vrai.
if printf '%s' "$S_BIAIS" | grep -qi 'inférence présentée comme citation' \
   && printf '%s' "$S_BIAIS" | grep -qi 'soi-même DÉDUITE'; then
  ok "2 — la forme symétrique est nommée : déduire puis rendre comme citation"
else
  ko "2 — seule la source-dispositif est couverte ; la déduction rendue comme citation reste découverte"
fi

# Le versant du DONNEUR D'ORDRE, là où le /goal se pose.
S_BUT2="$(section 'Poser son but')"
if printf '%s' "$S_BUT2" | grep -qi 'contredit un' \
   && printf '%s' "$S_BUT2" | grep -qi 'DANS LE MÊME GESTE'; then
  ok "2 — celui qui arbitre corrige son /goal dans le même geste"
else
  ko "2 — un arbitrage peut contredire un /goal posé sans le corriger : on fabrique la contradiction qu'on reprochera à l'agent"
fi

# ── 3. La complaisance ASCENDANTE — T-20260819-0106.
if printf '%s' "$S_BIAIS" | grep -qi 'un sens ASCENDANT' \
   && printf '%s' "$S_BIAIS" | grep -qi 'se tromper en ta faveur'; then
  ok "3 — le sens ascendant de la complaisance est couvert"
else
  ko "3 — seul le sens descendant est couvert : celui qui reçoit une validation qui l'arrange ne vérifiera pas"
fi

S_MONTRE="$(section "Exiger ce qu'un lot montre")"
if printf '%s' "$S_MONTRE" | grep -qi 'sous les yeux'; then
  ok "3 — pas d'arbitrage sur un texte qu'on n'a pas sous les yeux"
else
  ko "3 — un verdict peut être rendu sur la description d'un texte sans que ça se dise"
fi

# ── 4. On teste l'absence, jamais la panne de la mesure — T-20260819-0097.
S_REVUE="$(section 'Exiger deux passes de revue')"
if printf '%s' "$S_REVUE" | grep -qi 'couper la sonde'; then
  ok "4 — le geste est prescrit : couper la sonde et vérifier que le résultat diffère"
else
  ko "4 — on n'exige que la mutation du code : un test qui couvre « il n'y a rien » passe pendant que la sonde est aveugle"
fi

if printf '%s' "$S_REVUE" | grep -qi 'garde-t-il ce silence'; then
  ok "4 — le critère de tri est conservé — il distingue une décision d'un oubli"
else
  ko "4 — sans le critère, on casse un silence justifié en croyant réparer"
fi

if printf '%s' "$S_REVUE" | grep -qi 'même verdict sur les mêmes entrées' \
   && printf '%s' "$S_REVUE" | grep -qi 'sonde DUPLIQUÉE'; then
  ok "4 — le cas de la sonde dupliquée est couvert : un banc qui diverge se tait"
else
  ko "4 — deux copies d'un critère peuvent diverger sans qu'un seul essai rougisse"
fi

# ── 5. Relire pour la COHÉRENCE — T-20260819-0105.
S_RELIRE="$(section 'relis pour la COHÉRENCE')"
if printf '%s' "$S_RELIRE" | grep -qi 'rend ma conclusion fausse'; then
  ok "5 — le geste est formulé en QUESTION, celle qu'on ne se pose jamais"
else
  ko "5 — la relecture reste une relecture de clarté : un texte peut porter sa réfutation trois lignes plus bas"
fi

# ⚠️ SA SECONDE ALTERNATIVE ÉTAIT MORTE — « cohérence interne » a zéro occurrence
# (relevé en passe portail). Ici elle ne produisait PAS de faux vert : la branche
# vivante suffisait, mesuré. Mais l'assertion porte sur une DISTINCTION, et une
# distinction se garde par ses deux termes : on exige donc les deux moitiés de la
# phrase, ce qui supprime la branche morte au lieu de la tolérer.
if printf '%s' "$S_RELIRE" | grep -qi "pour vérifier que c'est clair" \
   && printf '%s' "$S_RELIRE" | grep -qi "cohérent avec soi-même"; then
  ok "5 — la cohérence avec soi-même est distinguée de la clarté"
else
  ko "5 — rien ne distingue relire pour la clarté de relire pour la cohérence : ce sont deux gestes"
fi

# Son second volet, là où l'on inscrit : une conclusion démentie se supersède.
S_RECOLTE="$(section 'Ce que tu récoltes')"
if printf '%s' "$S_RECOLTE" | grep -qi 'démentie'; then
  ok "5 — une conclusion démentie se supersède, elle ne se corrige pas par ajout"
else
  ko "5 — un diagnostic faux reste lisible comme un constat, et il se récite"
fi

# ── 6. Le prompt du /loop porte le BRIEFING — T-20260819-0110.
S_RONDE6="$(section 'La ronde — ce qui te réveille')"
if printf '%s' "$S_RONDE6" | grep -qi 'porte ton BRIEFING'; then
  ok "6 — la /loop porte le briefing, pas seulement l'ordre de faire une ronde"
else
  ko "6 — la /loop ne porte que la cadence : après un /clear, tout le reste doit être allé chercher"
fi

# ⚠️ SA BORNE, ET SANS ELLE LA RÈGLE NUIT : un prompt figé récite un briefing annulé.
if printf '%s' "$S_RONDE6" | grep -qiE 'SE REPOSE|se repose'; then
  ok "6 — sa borne est écrite : une /loop dont le contenu a changé se repose"
else
  ko "6 — la borne manque : on fabrique un briefing qui se récite après avoir été annulé"
fi

# ── 7. Trois états d'agent se ressemblent — T-20260819-0103, T-20260819-0111.
if printf '%s' "$S_RONDE" | grep -qi 'gelé par la limite' \
   && printf '%s' "$S_RONDE" | grep -qi 'ÉCRIRE PUIS DE REMESURER'; then
  ok "7 — les états voisins sont distingués, et le geste qui tranche est d'écrire puis remesurer"
else
  ko "7 — un agent gelé reste indiscernable d'un agent disponible : ses trois signes disent tous « disponible »"
fi

if printf '%s' "$S_RONDE" | grep -q 'agent_not_found'; then
  ok "7 — le cas où le registre ne voit pas l'agent est couvert — l'étape ① du protocole n'y a pas de réponse"
else
  ko "7 — un agent invisible au registre casse le protocole en silence : on conclut d'une absence de mesure"
fi

if printf '%s' "$S_RONDE" | grep -qi 'blocked the turn from ending' \
   && printf '%s' "$S_RONDE" | grep -qi 'agent retenu neuf fois'; then
  ok "7 — l'agent forcé de finir par un hook est nommé, et il repart si on lui écrit"
else
  ko "7 — on ferait renaître un agent qui aurait simplement redémarré sur un message"
fi

# ── Traçabilité des huit : un amendement sans sa mesure est une opinion.
for t in T-20260819-0095 T-20260819-0097 T-20260819-0103 T-20260819-0105 \
         T-20260819-0106 T-20260819-0110 T-20260819-0111 T-20260819-0114 \
         T-20260819-0121; do
  if grep -q "$t" "$METIER"; then
    ok "$t est cité dans le texte"
  else
    ko "$t n'est cité nulle part — la règle qu'il fonde est une opinion"
  fi
done

# ═══════════════════════════════════════════════════════════════════════════
# ⑩ LE TEXTE NE GONFLE PAS
#
# Il est lu EN ENTIER à chaque naissance. Un métier qui gonfle à chaque leçon
# finit par ne plus être lu — et ce serait pire que les huit défauts réunis.
#
# Baseline mesurée sur origin/main au 2026-08-19 : 118 856 octets.
#
# LA MARGE EST DE 6 500, ET CE CHIFFRE A ÉTÉ ARBITRÉ, PAS CHOISI PAR L'AUTEUR.
# Elle était à 4 000 ; les huit amendements, mesures citées, en coûtaient 6 303.
# L'écart a été remonté au coordonnateur AVANT tout relèvement, avec deux
# options : garder les mesures (+6 303) ou ne garder que les règles (~+3 000).
#
#   Arbitrage rendu (matapedia, 2026-08-19) : GARDER LES MESURES.
#   « La mesure citée est ce qui permet à un futur orchestrateur de CONTESTER
#     une règle. Sans elle il ne peut que l'appliquer ou la subir — et le jour
#     où l'une des huit se révèle fausse, personne ne saura sur quoi elle
#     reposait. Le vrai risque du gonflement n'est pas la taille, c'est le
#     BAVARDAGE ; une mesure n'est pas du bavardage. »
#
# Condition posée avec l'arbitrage, et tenue : une mesure tient en LE FAIT plus
# le CODE du ticket — jamais le récit de sa découverte, qui vit au ServiceDesk.
# Le texte a été repassé pour couper ce récit : 6 303 → 6 088 octets.
#
# ⚠️ NE RELÈVE PAS CETTE MARGE POUR FAIRE PASSER TON LOT. Si tes amendements
# n'y tiennent pas, c'est une question qui appartient à ton coordonnateur —
# la relever d'abord et demander ensuite rend la question décorative.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑩ le texte n'a pas gonflé sans raison"

# ⚠️ RELEVÉ LE 2026-08-19 POUR `E-20260819-0013` — huit règles, 179 insertions,
# 0 suppression sur le gabarit. La ligne de base passe de 118 856 à 145223, et
# LA MARGE PASSE À ZÉRO. Les deux mouvements vont ensemble et ils sont arbitrés.
#
#   Arbitrage rendu par `matapedia` sur la ligne de `e-20260819-0013`, 2026-08-19,
#   sous `E-20260819-0013` — INSCRIT AU FIL DE `D-20260818-0003` avec sa mesure,
#   parce qu'un epic n'a pas de fil et qu'une citation sans référent durable ne
#   se vérifie pas. Recopié mot pour mot :
#   « Re-baseline le plafond sur la taille FINALE et EXACTE de ton lot. AUCUNE
#     MARGE. Ma marge de 6 500 posée ce matin a été consommée en entier par le
#     lot précédent — 82 octets restants. Une marge n'est pas une réserve,
#     c'est une invitation. Sans marge, le prochain lot devra revenir me
#     demander, et c'est exactement le comportement qu'on veut d'une garde. »
#
# ⚠️ ET POURQUOI ON RE-BASELINE AU LIEU D'ÉLARGIR : mesuré avant l'arbitrage,
# `origin/main` était à 125 274 pour une ligne de base de 118 856 — le plafond
# mesurait donc DEUX lots à la fois, celui du 18 et celui du 19, donc il ne
# mesurait plus rien. Une ligne de base qui traîne un lot précédent est un
# plafond qui a cessé de garder sans que personne ne le voie.
#
# ⚠️ NE RELÈVE PAS CE CHIFFRE POUR FAIRE PASSER TON LOT — la consigne d'origine
# tient, et à marge nulle elle mord dès le premier octet. Si tes amendements
# n'y tiennent pas, la question appartient à ton coordonnateur ; la relever
# d'abord et demander ensuite rend la question décorative. Ce lot-ci a payé sa
# part avant de demander : 2 917 octets coupés — un récapitulatif d'anti-patterns
# qui redisait dans une liste ce que le lot pose au geste, et un hors-périmètre.
#
# ⚠️ RELEVÉ LE 2026-08-20 POUR `E-20260819-0015` / `T-20260820-0003` — la ligne
# de base passe de 145 223 à 146349, +1 126 octets, ET LA MARGE RESTE À ZÉRO.
# Mesuré sur le fichier livré, après le dernier commit du lot, pas estimé.
#
#   Arbitrage rendu par `matapedia`, 2026-08-20, INSCRIT AU FIL DE
#   `T-20260820-0003`. Recopié mot pour mot :
#   « Une garde à marge 0 ne dit pas "jamais plus grand", elle dit "pas sans
#     qu'on le décide". Re-baseliner EST la décision qu'elle exige. »
#   Deux voies ont été écartées, et savoir POURQUOI est ce qui permet de
#   refuser la prochaine : (a) mettre ce texte dans le `SKILL.md` plutôt que
#   dans le gabarit — refusé, car le gabarit dit lui-même qu'un orchestrateur
#   NE LIT PAS le `SKILL.md` ; mettre là ce qui doit gouverner, c'est choisir
#   qu'il ne gouverne pas ; (b) faire couper 1 126 octets ailleurs dans le
#   gabarit — refusé, car ce lot avait déjà coupé sa part deux fois (2 000 →
#   942 octets, puis la commande a perdu son chemin interne au profit de son
#   nom), et couper au-delà retire du texte qui garde autre chose sans que
#   personne sache quoi.
#
# CE QUE CES 1 126 OCTETS ACHÈTENT — c'est ça, le motif, et il est vérifiable :
#   · la commande qui MESURE l'état d'une boîte (`gestionnaire-etat-boite`) ;
#   · la table qui dit quoi faire de chacun des cinq états rendus ;
#   · la ligne qui dit que `herdr pane read` NE PEUT PAS répondre à « y a-t-il
#     du texte » — même écran pour une suggestion et pour un texte saisi, le
#     seul discriminant est un attribut ANSI.
# Sans cette dernière ligne, le gabarit continue de PRESCRIRE le geste qui a
# coûté ~3 h à chacun de deux orchestrateurs le 2026-08-19 (`E-20260819-0015`).
# Le texte ne corrige pas un défaut de lecture du balayeur — celui-là est
# correct depuis le 14 août ; il rend VÉRIFIABLE et NOMMABLE un comportement
# qu'aucun orchestrateur ne pouvait constater.
#
# ⚠️ COMMENT REFUSER LA PROCHAINE DEMANDE, et il FAUT la refuser par défaut :
# une garde à marge 0 ne meurt pas d'un grand saut — elle meurt d'une SUITE DE
# PETITS CAS JUSTIFIÉS. Un relèvement ne s'accorde que si les quatre tiennent
# ENSEMBLE : ① le texte ajouté PRESCRIT UN GESTE que l'orchestrateur ne peut
# pas poser sans lui — pas un rappel, pas un récit, pas une liste qui redit
# ailleurs ce que le gabarit pose déjà ; ② le défaut qu'il évite est MESURÉ et
# porte le code d'un ticket ; ③ le lot a d'abord coupé sa propre part et le
# dit chiffré ; ④ le lieu a été contesté — pourquoi le gabarit et pas le
# `SKILL.md`, la compétence ou le ServiceDesk. Un lot qui n'apporte que ① et
# ② se fait couper ailleurs. Un lot qui n'apporte aucun des quatre se refuse
# sans discussion, et ce paragraphe est ce sur quoi tu t'appuies pour le dire.
# ── RELÈVEMENT DU 2026-08-20 — P-20260820-0001, et les quatre conditions ──────
#
# 146 349 → 154 339 octets (+7 990). Le métier n'est plus UN fichier : il tient
# dans un socle chargé en permanence et des chapitres ouverts au moment d'agir.
# Les quatre conditions ci-dessus, une par une :
#
# ① LE GESTE QU'IL PRESCRIT — le socle porte les SEPT RÈGLES CARDINALES avec, pour
#    chacune, la couche qui la garantit ou la mention qu'aucune ne la porte, et la
#    CARTE des chapitres. Sans lui, un orchestrateur ne peut ni savoir laquelle des
#    146 règles prime, ni où trouver le reste. Ce n'est ni un rappel ni un récit :
#    c'est ce qui rend le métier navigable quand il n'est plus lu d'un bloc.
#
# ② LE DÉFAUT ÉVITÉ, MESURÉ — 35 344 tokens chargés à CHAQUE geste, 146 interdits
#    sans aucune priorité déclarée (vérifié : zéro phrase de préséance entre règles
#    de conduite). Le socle rendu en pèse 2 091. Projet `P-20260820-0001`, epics
#    `E-20260820-0005` à `0009`.
#
# ③ LE LOT A COUPÉ SA PROPRE PART, ET LE DIT CHIFFRÉ — la première mesure était
#    +27 862. Deux coupes, dans cet ordre : les chapitres ne recopient plus
#    l'énoncé d'ABC de leurs items (−15 127), puis ils les CITENT au lieu de les
#    lister (−4 745). Reste +7 990, dont 2 194 d'en-têtes de chapitre — l'abrégé
#    et la fraîcheur, qui sont ce qui permet de décider d'ouvrir sans ouvrir.
#
# ④ LE LIEU A ÉTÉ CONTESTÉ — pourquoi le gabarit et pas la compétence ? Parce
#    qu'un orchestrateur ne lit PAS le `SKILL.md` : il lit le `CLAUDE.md` de son
#    lieu, littéralement le premier fichier de son existence (arbitrage
#    `T-20260816-0015`). Et pas le ServiceDesk : ce qui y vit se cherche, alors
#    que le socle ARRIVE.
#
# ⚠️ LA MARGE RESTE À 0. Le prochain ajout se refuse par défaut, et ce paragraphe
#    est ce sur quoi s'appuyer pour le dire — le relèvement d'aujourd'hui ne crée
#    aucun droit pour le suivant.
BASELINE=154339
MARGE=0
PLAFOND=$((BASELINE + MARGE))
TAILLE="$(wc -c < "$METIER" | tr -d ' ')"

# La marge est dérivée, jamais réécrite en dur dans le message : un banc dont
# le compte rendu annonce une autre borne que celle qu'il applique ment sur sa
# propre garde, et c'est le seul chiffre que personne ne pense à vérifier.
if [ "$TAILLE" -le "$PLAFOND" ]; then
  ok "$TAILLE octets — sous le plafond de $PLAFOND (baseline $BASELINE + marge $MARGE), écart net $((TAILLE - BASELINE))"
else
  ko "$TAILLE octets — au-dessus du plafond de $PLAFOND (écart net $((TAILLE - BASELINE)), marge $MARGE) : chaque ajout doit REMPLACER ou PRÉCISER"
fi

echo
if [ "$echecs" -eq 0 ]; then
  echo "✅ $total/$total — le métier prescrit des gestes qui tiennent"
  exit 0
else
  echo "❌ $echecs échec(s) sur $total"
  exit 1
fi
