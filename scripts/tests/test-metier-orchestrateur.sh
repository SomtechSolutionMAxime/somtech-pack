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
# ⚠️ Forme PORTABLE : « mktemp -t <prefixe> » n'a pas le même contrat sur macOS
# (BSD, préfixe) et sur Linux (GNU, gabarit qui exige des X). Sans les X, il
# réussit ici et échoue en CI — le fichier reste vide, et le banc annonce « le
# gabarit est introuvable » sur un gabarit parfaitement présent.
METIER="$(mktemp "${TMPDIR:-/tmp}/smtk-metier-orch.XXXXXX")" || {
  echo "  ✗ impossible de créer le fichier de travail — le banc ne peut rien éprouver" >&2
  exit 1
}
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
# ⚠️ EXPANSION GARDÉE — `"${TAB[@]}"` sur un tableau VIDE est une variable non
# liée en bash 3.2 (celui de macOS) sous `set -u` : le banc AVORTE au lieu de
# rougir, et tout ce qui suit devient inmesurable. Mesuré le 2026-09-20 en
# jouant une contre-épreuve de la vague 2A : retirer la section de la veille
# tuait la série entière après le premier contrôle — 78 assertions muettes,
# aucune d'elles rouge. Un banc qui s'interrompt ne dit rien de ce qu'il gardait.
for ligne in ${POSES[@]+"${POSES[@]}"}; do
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
lig_pose="$(printf '%s\n' ${POSES[@]+"${POSES[@]}"} | head -1 | cut -d: -f1)"

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
# ⑫ LE GESTE PRESCRIT LIT LE SIGNAL DE SUCCÈS          (D-20260825-0002)
#
# `pack agent naitre` rend le pane À L'IDENTIQUE sur un succès et sur un refus
# qui laisse un agent vivant, et `$( )` n'expose pas le code de sortie. Un
# orchestrateur qui suivait la consigne à la lettre enchaînait donc brief, /goal
# et veille sur un agent dont la déclaration n'avait pas pu s'écrire — sans
# jamais l'apprendre, et sans que la garde des naissances le rattrape : il EST
# déclaré.
#
# Le correctif (db41dec9) a fait lire `ok` au geste prescrit. Il n'était gardé
# par RIEN : mesuré, 23 occurrences de `select(.ok)` dans 11 fichiers, TOUS des
# textes, ZÉRO dans un banc, un script ou une CI. Réécrire le chapitre — ce que
# ce lot a fait deux fois, et ce que `/orchestrateur` fait à chaque pose —
# pouvait le supprimer sans qu'une seule assertion rougisse.
#
# ⚠️ CETTE GARDE PORTE LA FONCTION, PAS LA CHAÎNE. Elle n'exige nulle part
# `select(.ok)` : ce qu'elle exige, ce sont les DEUX choses sans lesquelles le
# geste ne peut pas échouer — le drapeau `-e` (sans lui jq sort 0 sur `null`, et
# le `||` ne part jamais) et une consultation de `ok` dans le programme jq.
# `jq -e -r 'select(.ok).pane'`, `jq -e -r 'select(.ok) | .pane'` et
# `jq -er 'if .ok then .pane else empty end'` passent toutes les trois — les deux
# premières sont d'ailleurs vivantes dans le dépôt, dans deux textes différents.
#
# 🔴 ET LA FAMILLE S'ÉNUMÈRE PAR UN FAIT QUE LA MUTATION NE PEUT PAS EFFACER.
# Cette garde a d'abord cherché les textes qui « parlent de jq et du pane » — et
# une mutation lui a survécu : retirer la ligne de lecture retirait le dernier
# `jq` du fichier, donc le faisait SORTIR de la famille. La population rétrécissait
# au lieu d'accuser. C'est exactement la forme que ce même lot vient de fermer sur
# la garde des naissances (un agent qui sort du dénominateur au lieu d'être jugé).
#
# Le fait qui reste, lui, est celui qui CRÉE le risque : **une naissance capturée
# dans une variable** (`NAISSANCE=$(…)`). À partir de là, le texte va lire quelque
# chose dans cette sortie — et c'est cette lecture-là qui doit consulter `ok`.
# Retirer la lecture ne retire pas la capture : le texte reste dans la famille et
# se fait accuser d'avoir capturé une naissance sans jamais la vérifier.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑫ le geste prescrit LIT le signal de succès — D-20260825-0002"

FAMILLE=()
while IFS= read -r __f; do
  [ -n "$__f" ] && FAMILLE+=("$__f")
done <<EOF
$(cd "$RACINE" && git ls-files '*.md' | while IFS= read -r f; do
  grep -q 'NAISSANCE=\$(' "$f" 2>/dev/null && printf '%s\n' "$f"
done)
EOF

# ── LES DEUX TEXTES STRUCTURELS. Ils ne peuvent pas cesser de prescrire le geste
#    sans que ce soit une régression : l'un est la SOURCE du métier (d'où
#    descendent les 9 autres), l'autre la compétence que lit un orchestrateur qui
#    n'a pas encore de lieu. Sans cette assertion-ci, vider la famille rendrait
#    toutes les négatives ci-dessous vertes — « une garde qu'on peut désarmer
#    sans rougir ».
for __structurel in \
  'metier/orchestrateur/chapitres/chefs-equipe.md' \
  '.claude/skills/orchestrer-chantier/SKILL.md'
do
  __vu=0
  for __f in ${FAMILLE[@]+"${FAMILLE[@]}"}; do [ "$__f" = "$__structurel" ] && __vu=1; done
  if [ "$__vu" -eq 1 ]; then
    ok "« $__structurel » prescrit bien la naissance d'un chef d'équipe et en capture la sortie"
  else
    ko "« $__structurel » ne capture plus la sortie d'une naissance : la famille a perdu un texte STRUCTUREL"
  fi
done

if [ "${#FAMILLE[@]}" -ge 2 ]; then
  ok "la famille du geste compte ${#FAMILLE[@]} texte(s) — énumérée par sa fonction, pas par une liste de chemins"
else
  ko "la famille du geste est vide ou incomplète (${#FAMILLE[@]}) — les contrôles suivants n'éprouveraient rien"
fi

lectures=0
sans_e=0
sans_ok=0
non_verifiees=0
for __f in ${FAMILLE[@]+"${FAMILLE[@]}"}; do
  __naissances="$(cd "$RACINE" && grep -c 'NAISSANCE=\$(' "$__f")"
  __lues=0
  while IFS= read -r corps; do
    [ -n "$corps" ] || continue
    __lues=$((__lues+1))
    lectures=$((lectures+1))
    __vu="${corps#"${corps%%[![:space:]]*}"}"
    # Ce qui sépare `jq` de son programme : ses drapeaux.
    drapeaux="$(printf '%s' "$corps" | sed -n "s/.*jq\([^']*\)'.*/\1/p")"
    # Le programme jq lui-même, entre apostrophes.
    programme="$(printf '%s' "$corps" | sed -n "s/.*jq[^']*'\([^']*\)'.*/\1/p")"
    # `-e` fait sortir jq en non-zéro sur `false`/`null` : SANS LUI le `||` ne
    # part jamais, et la vérification prescrite ne peut pas échouer. La forme
    # combinée (`-er`) compte autant que la forme séparée.
    printf '%s' "$drapeaux" | grep -qE '(^| )-[a-zA-Z]*e' || {
      sans_e=$((sans_e+1))
      ko "$__f : « $__vu » — jq sans « -e » : il sort 0 sur un refus, le repli ne part jamais"
    }
    printf '%s' "$programme" | grep -q 'ok' || {
      sans_ok=$((sans_ok+1))
      ko "$__f : « $__vu » — le programme jq ne consulte pas « ok » : le pane sort à l'identique d'un succès et d'un refus"
    }
  done <<EOF
$(cd "$RACINE" && grep -h '=\$(' "$__f" | grep 'jq' | grep 'NAISSANCE' | grep -v '^[[:space:]]*#')
EOF

  # 🔴 PAR FICHIER, ET CONTRE SON PROPRE NOMBRE DE NAISSANCES — jamais contre une
  # somme. Un total agrégé se laisse compenser : « 11 lectures pour 11 textes »
  # reste vrai quand un texte en perd une et qu'un autre en gagne une.
  if [ "$__lues" -lt "$__naissances" ]; then
    non_verifiees=$((non_verifiees+1))
    ko "$__f : $__naissances naissance(s) capturée(s), $__lues lecture(s) vérifiée(s) — une sortie capturée que rien ne consulte"
  fi
done

if [ "$non_verifiees" -eq 0 ]; then
  ok "$lectures lecture(s) de naissance sur ${#FAMILLE[@]} texte(s) — chacun en vérifie autant qu'il en capture"
fi
if [ "$sans_e" -eq 0 ]; then
  ok "toutes les lectures portent « -e » — le refus prescrit peut réellement échouer"
fi
if [ "$sans_ok" -eq 0 ]; then
  ok "toutes les lectures consultent « ok » — aucune ne brieffe un agent que le geste a refusé"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ⑬ LES CINQ CHANGEMENTS DE LA VAGUE 1 SONT PRESCRITS — D-20260920-0001
#
# POSÉ PARCE QUE LA REVUE DE FOND DU LOT QUI LES A ÉCRITS L'A MESURÉ : elle a
# VIDÉ chacun des cinq blocs, l'un après l'autre, et le banc est resté 66/66
# VERT à chaque fois. Le seul filet était le plafond de taille ⑩ — et un
# PLAFOND est aveugle par construction à tout ce qu'on RETIRE. Cinq règles de
# métier neuves ne tenaient à rien.
#
# CHAQUE CONTRÔLE CHERCHE LE GESTE DANS SA SECTION, jamais dans le texte
# entier : une règle écrite ailleurs que là où le geste se pose ne gouverne
# personne, et un `grep` global rendrait vert un bloc déplacé au mauvais
# chapitre.
#
# ⚠️ CHAQUE CONTRÔLE GARDE AUSSI L'OCCURRENCE DATÉE DE SON CHANGEMENT, et cette
# ligne-ci a été ajoutée parce que la première version ne la gardait qu'à
# MOITIÉ : les gestes 1 et 5 exigeaient une date par accident de formulation,
# les gestes 2, 3 et 4 n'en exigeaient aucune. On pouvait donc retirer
# l'occurrence de trois changements sur cinq sans qu'un seul contrôle rougisse
# — et retomber sur des règles sans le fait qui les a payées, ce que le lot
# venait précisément de fermer pour les deux autres. **La moitié fermée était
# celle où ça se voyait.**
#
# ⚠️ CE QUE CES CONTRÔLES NE SAVENT PAS FAIRE, et il faut le savoir pour ne pas
# s'y fier plus qu'ils ne valent : ils tiennent l'EXISTENCE d'un geste, pas sa
# JUSTESSE. Une phrase réécrite en gardant ses mots-clés passerait. Le cas
# `pousser-qa-avant-merge` de `cli/test/fixtures/orchestrateur-reformulations.json`
# est le mécanisme qui garde une FORMULATION ; celui-ci garde une PRESCRIPTION.
# Les deux sont nécessaires, aucun ne remplace l'autre.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑬ les cinq changements de la vague 1 sont prescrits — D-20260920-0001"

# porte <titre-de-section> <étiquette> <motif>… — chaque motif doit se trouver
# DANS le corps de la section nommée. Une section disparue est un échec NOMMÉ,
# jamais un silence : sans ce cas, renommer le titre désarmerait le contrôle
# sans rien faire rougir.
porte() {
  local titre="$1"; shift
  local etiquette="$1"; shift
  local corps manquants=0 m
  corps="$(section "$titre")"
  if [ -z "$corps" ]; then
    ko "$etiquette — la section « $titre » a disparu du métier"
    return
  fi
  for m in "$@"; do
    if ! printf '%s\n' "$corps" | grep -qF -- "$m"; then
      manquants=$((manquants+1))
      ko "$etiquette — « $m » absent de « $titre »"
    fi
  done
  [ "$manquants" -eq 0 ] && ok "$etiquette"
}

porte "Qui clique" \
  "1 — la délégation du clic de fusion dit QUI clique, et ce qu'elle ne lève pas" \
  "2026-09-15" \
  "orchestrateur ou le chef qui fusionne" \
  "ne lève AUCUNE condition"

porte "Et commence par mesurer l'ÂGE de ce réceptacle" \
  "2 — l'âge du réceptacle d'amélioration est un geste, pas une vigilance" \
  "epics get" \
  "48 h" \
  "présumée morte" \
  "2026-09-19"

porte "La cinquième question" \
  "3 — la veille du corpus pose sa cinquième question à un tiers" \
  "Qu'est-ce qui a changé dans la façon de travailler des orchestrateurs" \
  "vide qui se lit comme une stabilité" \
  "2026-09-19"

porte "Tes réflexes" \
  "4 — l'asymétrie du fait rapporté est écrite sous le biais d'autorité apparente" \
  "RETIRER une consigne" \
  "AJOUTE une contrainte" \
  "2026-09-19"

porte "Ce qu'un rapport de revue doit porter" \
  "5 — un rapport de revue porte ses trois listes" \
  "REGARDÉ" \
  "ÉPROUVÉ" \
  "PAS PU être atteint" \
  "le doute se tranche vers le bas" \
  "2026-09-19"

# ⚠️ L'ATTRIBUTION DU CINQUIÈME EST GARDÉE À PART, et c'est le seul contrôle de
# ce bloc qui porte sur QUI a dit quelque chose. Cette forme vient de deux
# pairs — `ristigouche` le 2026-09-01, amendée avec `chaudiere` le 02/09 — et
# NON du dirigeant. Un gabarit qui la lui attribuerait fabriquerait un ordre
# que personne n'a donné : c'est le premier biais nommé par le métier lui-même,
# et il est d'autant plus facile à commettre ici que tout le reste du lot
# descend, lui, d'une décision du dirigeant.
porte "Ce qu'un rapport de revue doit porter" \
  "5 — et elle est attribuée aux deux pairs, jamais au dirigeant" \
  "ristigouche" \
  "chaudiere" \
  "2026-09-01" \
  "n'est pas un ordre du dirigeant"

# ═══════════════════════════════════════════════════════════════════════════
# ⑭ LES SEPT RÈGLES DE LA VAGUE 2A SONT PRESCRITES — D-20260920-0001
#
# Elles viennent toutes de la nuit du 2026-09-19 au 20, chez UN orchestrateur
# qui connaissait déjà son métier. Coût mesuré, inscrit au registre
# `E-20260818-0007` : UNE HEURE de blocage d'un chef · DEUX gardes disparues ·
# QUINZE travaux libres arrêtés par DEUX arbitrages · QUATRE comptes rendus
# faux au dirigeant.
#
# CE BLOC REPREND LA FORME DE ⑬ ET SES DEUX LEÇONS, qui ont été payées :
#   · BORNÉ À LA SECTION — un `grep` global rendrait vert un bloc déplacé au
#     mauvais chapitre, et une règle écrite ailleurs que là où le geste se pose
#     ne gouverne personne ;
#   · CHAQUE CONTRÔLE EXIGE LA DATE DE SON OCCURRENCE, par INTENTION et non par
#     accident de formulation — sur la vague 1, deux gardes sur cinq gardaient
#     l'occurrence sans que l'auteur l'ait choisi, et une garde verte par
#     coïncidence ne rougit pas le jour où elle cesse de garder.
#
# ⚠️ CE QU'ILS NE SAVENT PAS FAIRE : ils tiennent l'EXISTENCE d'une
# prescription à son endroit, pas sa JUSTESSE. Le plafond ⑩ est aveugle à tout
# RETRAIT ; ces contrôles sont le filet qui manquait. Aucun ne remplace l'autre.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑭ les sept règles de la vague 2A sont prescrites — D-20260920-0001"

porte "Toute consigne qui déclenche une action NOMME SON SUJET" \
  "1 — une consigne qui déclenche nomme QUI agit" \
  "opérationnellement ambiguë" \
  "rien dedans ne dit **QUI** monte" \
  "UNE HEURE de blocage" \
  "2026-09-20"

porte "Poser son but" \
  "2 — un /goal différé se repose au premier retour au repos" \
  "DIFFÉRÉ SE REPOSE AU PREMIER RETOUR AU REPOS" \
  "n'est pas un but posé" \
  "LUE par ta veille comme une fin de mandat" \
  "2026-09-20"

porte "Poser la veille de déblocage" \
  "3 — la veille déduit la fin d'un mandat de l'absence de but" \
  "agent-termine" \
  "Un agent sans but n'a pas fini : il n'a pas de but" \
  "fait disparaître la garde" \
  "2026-09-20"

porte "Ce qu'un rapport de revue doit porter" \
  "4 — le corollaire : la tête finale se lit de ce qu'ils COUVRENT" \
  "de ce qu'ils COUVRENT" \
  "CHANGELOG" \
  "pas les faire rejouer" \
  "2026-09-20"

porte "Devant un dialogue de choix ouvert par ton chef" \
  "5 — devant un dialogue de choix, on annule, on ne répond pas" \
  "Annuler libère sans décider" \
  "injoignable même pour son coordonnateur" \
  "2026-09-20"

porte "Tes réflexes" \
  "6 — la question du cadre se pose AUSSI aux cadres qu'on produit" \
  "AUSSI aux cadres que TU produis" \
  "range de force dans l'une des deux cases" \
  "son lot · le dépôt · **le poste**" \
  "2026-09-20"

# ⚠️ LA HUITIÈME GARDE N'EST PAS UNE HUITIÈME RÈGLE : c'est la règle 4 gardée À
# L'ENDROIT DU GESTE. Trouvé par la passe de fond du lot, contre son auteur :
# le corollaire vivait dans le chapitre de la REVUE, pendant que l'énoncé strict
# qu'il assouplit — « les deux verdicts sur la tête FINALE » — vivait seul dans
# le chapitre du MERGE. La défense de l'auteur — « l'ordre des chapitres met la
# revue avant le merge » — était fausse DEUX FOIS : l'ordre réel est celui de
# `classement.json` et non l'ordre alphabétique qu'il avait mesuré (un artefact
# du glob de ce banc, pas du produit) ; et surtout le métier se consulte PAR
# SUJET depuis l'index du socle, jamais d'un trait. Le lecteur qu'il fallait
# sauver — le chef qui ouvre le chapitre du merge trois jours plus tard — est
# précisément celui qu'aucun ordre de lecture n'atteint.
porte "Qui clique" \
  "4bis — le corollaire est rappelé LÀ OÙ LE GESTE SE POSE" \
  "de ce qu'ils COUVRENT" \
  "CHANGELOG" \
  "pas les faire rejouer" \
  "2026-09-20"

porte "Si rien n'avance, repars du backlog" \
  "7 — j'attends quelqu'un se lit PAR CHANTIER, jamais en bloc" \
  "PAR CHANTIER, jamais en bloc" \
  "quinze travaux libres" \
  "2026-09-20"

# ═══════════════════════════════════════════════════════════════════════════
# ⑮ LES HUIT RÈGLES DE LA VAGUE 2B SONT PRESCRITES — D-20260920-0001
#
# Elles portent toutes sur UNE SEULE fonction : ÉPROUVER UNE GARDE. Mesurées
# les 19 et 20 septembre chez TROIS chefs d'équipe différents, inscrites au
# registre `E-20260818-0007` avec leur occurrence et leur coût — reprises, pas
# réinventées.
#
# ⚠️ POURQUOI CE BLOC EST LE PLUS EXPOSÉ DE CE BANC. Les huit défauts qu'il
# garde ont ceci de commun qu'AUCUN NE PRODUIT D'ERREUR : ils produisent un
# résultat plausible, et ce résultat est exactement celui qu'on espérait. Un
# contrôle écrit contre eux peut donc être vert pour la même raison qu'eux.
# C'est pourquoi chacun est BORNÉ À SA SECTION et exige la DATE de son
# occurrence — et pourquoi les contre-épreuves de ce lot ont été jouées UNE À
# LA FOIS, en DÉPLAÇANT la valeur gardée plutôt qu'en abîmant le chemin, sous
# un instrument qui REFUSE une mutation sans effet (règle 4, appliquée au lot
# qui l'écrit).
#
# ⚠️ LA DATE EST DISCRIMINANTE PAR INTENTION, PAS PAR ACCIDENT : chacune des
# huit sections visées ne porte QU'UNE occurrence de « 2026-09-20 ». C'est la
# règle 2 appliquée à ce bloc — une garde qui exige une date présente deux fois
# dans sa section ne rougit pas quand on déplace l'une des deux.
# ═══════════════════════════════════════════════════════════════════════════
#
# 🔴 DETTE À DÉCLENCHEUR NOMMÉ — `T-20260920-0055`, inscrite et NON fermée.
# Ces huit règles s'adressent à CELUI QUI ÉPROUVE UNE GARDE — et ce n'est pas
# l'orchestrateur, c'est le REVIEWER. Or un sous-agent de revue ne reçoit pas
# une ligne de ce métier : il reçoit `.claude/skills/orchestrer-chantier/
# BRIEF-REVUE.md`. Les huit sont donc au bon SUJET et absentes du lieu du GESTE.
# DÉCLENCHEUR : dès qu'un sous-agent de revue est lancé sur un lot qui pose des
# gardes. ⚠️ La cible est BRIEF-REVUE.md, PAS `chefs-equipe.md` — un renvoi
# posé dans un chapitre que le reviewer ne lit jamais refait la faute du mauvais
# lecteur un lot plus loin. Arbitrage de `batiscan`, 2026-09-20.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑮ les huit règles de la vague 2B sont prescrites — D-20260920-0001"

# ⚠️ LA GARDE DU FIL N'EST PAS UNE NEUVIÈME RÈGLE, et elle n'exige PAS de date :
# elle est bornée au CHAPEAU, qui contient les huit sous-sections — donc leurs
# huit dates. Exiger « 2026-09-20 » ici serait vert tant qu'UNE SEULE des huit
# subsiste : une garde verte par accident de formulation, c'est-à-dire la règle
# 2 commise dans le bloc qui la prescrit.
porte "Éprouver une garde — huit silences qui se lisent comme des succès" \
  "le fil : un silence qui se lit comme un succès" \
  "SILENCE qui se lit comme un SUCCÈS" \
  "en éprouvant AUTRE CHOSE — jamais en cherchant" \
  "trois chefs d'équipe différents"

porte "Un retrait qui fait rougir une garde est une amputation" \
  "1 — un retrait qui fait rougir est une amputation, pas un remplacement" \
  "joue les bancs" \
  "pousser-qa-avant-merge" \
  "vert ne veut pas dire caduc" \
  "2026-09-20"

porte "Une garde peut être verte par ACCIDENT DE FORMULATION" \
  "2 — une garde verte par accident ne rougira pas en cessant de garder" \
  "déplacer la VALEUR, pas abîmer le chemin" \
  "il y en avait ZÉRO" \
  "2026-09-20"

porte "Des mutations qui tuent TOUTES ne prouvent rien" \
  "3 — zéro survivante sur un sous-ensemble ne dit rien de la population" \
  "ne dit rien de la population" \
  "1353 bancs verts" \
  "2026-09-20"

# ⚠️ LE MOTIF DE COÛT N'EST PAS « zéro rouge », et le choix est mesuré : cette
# suite apparaît DEUX fois dans la section (l'énoncé et l'occurrence), donc en
# déplacer une laisse la garde VERTE sur l'autre. C'est la règle 2 commise dans
# le bloc qui la prescrit — trouvée par la contre-épreuve de ce lot, pas par
# une relecture.
porte "Un essai VIDE se lit exactement comme une garde qui tient" \
  "4 — le banc de mutation refuse une mutation sans effet" \
  "REFUSER une mutation sans effet" \
  "une épreuve qui n'avait pas eu lieu" \
  "2026-09-20"

porte "Un banc qui S'INTERROMPT ne dit rien de ce qu'il gardait" \
  "5 — un banc rend le nombre d'assertions JOUÉES, pas seulement les échecs" \
  "assertions JOUÉES" \
  "78 assertions muettes" \
  "2026-09-20"

porte "Le joint qui permet d'éprouver peut SOUSTRAIRE à l'épreuve" \
  "6 — le banc éprouve le double, la production utilise l'original" \
  "le banc éprouve le double, la production utilise l'original" \
  "11 bancs verts" \
  "2026-09-20"

porte "Une garde juste, sur un chemin que le NOUVEL APPELANT ne traverse pas" \
  "7 — mesurer OÙ vit la garde dont on croit hériter" \
  "dans la fonction, ou chez son appelant actuel" \
  "SUPPRIMAIT la branche d'une demande de fusion déjà ouverte" \
  "2026-09-20"

porte "Deux gardes justes, chacune bornée à sa section, ne gardent pas leur ACCORD" \
  "8 — deux gardes justes ne gardent pas leur accord" \
  "c'est leur accord que rien ne mesure" \
  "T-20260920-0051" \
  "2026-09-20"

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
# ⚠️ ON COMPTE DES CARACTÈRES, PLUS DES OCTETS — et ce n'est pas un détail.
# En UTF-8, un caractère accentué coûte DEUX octets. Une garde qui compte les
# octets fait donc payer l'orthographe : restaurer quinze accents a coûté
# 30 octets et l'a fait rougir, alors que le texte n'avait pas grossi d'un mot.
# Telle quelle, elle RÉCOMPENSAIT un français dépouillé de ses accents — le
# défaut exact qu'on venait de corriger dans le socle livré (2026-08-21).
# Mesuré sur le métier : 154 369 octets pour 149 078 caractères, soit 5 291
# octets qui ne sont QUE des accents et des symboles.
#
# La baseline est convertie dans la même unité, sur le même objet, le même jour.
#
# ── RELÈVEMENT DU 2026-08-27 — D-20260826-0010, ABC orchestrateur 3.0.0 ───────
#
# 149 078 → 151 037 caractères (+1 959). Arbitrage rendu par la session
# `somtech-pack-f6` sur délégation du dirigeant (« je te laisse choisir »,
# 2026-08-26), CONSIGNÉ MOT POUR MOT au fil de `D-20260826-0010` (2026-08-27)
# avec son canal — comme le précédent E-20260819-0013 l'exige : « re-baseline
# sur la taille FINALE et EXACTE du lot, AUCUNE MARGE ». Les quatre conditions :
#
# ① LE GESTE PRESCRIT — le refus des sous-agents recentré sur construction/revue
#    (les sous-agents d'analyse deviennent des moyens propres, GF-ORC-002/R2.6),
#    le delta de ronde (RA-ORC-043), la maquette opposable (RA-ORC-044) : trois
#    conduites que l'orchestrateur ne peut pas tenir sans leur texte.
# ② LE DÉFAUT ÉVITÉ, MESURÉ — P-20260822-0001 : quatre jours, sept epics, un
#    complété, zéro livraison ; et la première livraison de la vue du parc non
#    conforme aux maquettes. Les deux sont cités dans le texte ajouté.
# ③ LA PART COUPÉE — aucune : le texte est la recopie canonique de l'ABC 3.0.0
#    adopté nominativement par le dirigeant ; couper ailleurs pour compenser
#    aurait raboté du texte adopté pour une contrainte comptable (motif de
#    l'arbitrage, recopié).
# ④ LE LIEU CONTESTÉ — le gabarit, parce que c'est l'ABC qui y descend
#    (INV-ABC-2 : l'ABC précède, le code suit) ; la compétence et le harnais
#    ont reçu leur part propre dans le même lot.
#
# ⚠️ LA MARGE RESTE À 0 — la taille est celle MESURÉE du rendu final, pas un
#    chiffre rond : une marge gratuite désarmerait le gate (mot de l'arbitrage).
# ⚠️ RE-BASELINE DU 2026-09-01 — 151 037 → 151 875, ARBITRÉE, PAS RELEVÉE.
#
#   Arbitrage rendu par `temiscouata`, orchestrateur `P-20260822-0001`, sur la
#   fusion de `E-20260825-0002` (T-20260827-0037). Recopié dans son intention :
#   « OUI, re-baseline à 151875, exactement, aucune marge — c'est moi qui te
#     l'accorde, pas toi qui la relèves, et c'est toute la différence que le banc
#     protège. »
#
# ⚠️ CE QUI A ÉTÉ RENDU AVANT D'OBTENIR LE CHIFFRE, parce que l'arithmétique seule
# ne prouve pas que la croissance MÉRITE d'exister :
#   • socle commun 148 240 · `main` 151 037 · le lot 149 078 · la fusion 151 875
#     = 148 240 + 2 797 (main) + 838 (le lot). Pas un octet de plus que les deux
#     croissances légitimes : la fusion n'ajoute rien, elle additionne ;
#   • UN SEUL fichier diffère de `main` — `chefs-equipe.md`. Les onze autres sont
#     identiques à l'octet ;
#   • et il RETIRE plus de lignes qu'il n'en ajoute (19 contre 26) : les 838
#     octets sont de la prose qui remplace une séquence bash plus longue.
#
# La borne reste donc ce qu'elle était : la taille FINALE et EXACTE, marge nulle.
# Le prochain lot devra revenir demander — c'est le comportement voulu.
#
# ── RE-BASELINE DU 2026-09-20 — D-20260920-0001 / E-20260920-0001 ─────────────
#
# 151 875 → 160 695 caractères (+8 820), MARGE TOUJOURS 0.
#
#   ACCORDÉE PAR `batiscan`, orchestrateur de `J-20260814-0002`, le 2026-09-20,
#   sur la ligne de `e-20260920-0001`. Ce n'est pas le lot qui l'a relevée.
#   Ce qu'il a d'abord REFUSÉ, et qui borne ce qu'on peut faire la prochaine fois :
#   « Retirer les occurrences datées et les coûts contredit l'arbitrage du 19/08
#     et produit exactement des règles qui se font enjamber — une règle sans le
#     fait qui l'a payée ne tient pas. Les mesures restent, ce n'est pas
#     négociable. » Et, avant d'accorder le chiffre : « Tu m'as donné une
#     ventilation par fichier, c'est de l'arithmétique, pas une justification.
#     Chapitre par chapitre, pour chaque bloc que tu ajoutes, nomme ce qu'il rend
#     caduc dans le même chapitre et retire-le. Cherche le remplacement, pas la
#     coupe. »
#
# LES QUATRE CONDITIONS, UNE PAR UNE :
#
# ① LE GESTE PRESCRIT — cinq gestes qu'un orchestrateur ne peut pas poser sans
#    eux : QUI clique une fusion et à quelles conditions (`mise-en-production`) ·
#    `epics get <son-epic>` et le seuil de 48 h qui présume la boucle
#    d'amélioration morte (`rondes` §5) · la cinquième question de la veille du
#    corpus, posée à un tiers (`rondes` §8) · mesurer à sa source AVANT de
#    l'inscrire un fait qui RETIRERAIT une consigne (`reflexes`) · les trois
#    listes obligatoires d'un rapport de revue (`faire-appliquer`).
#
# ② LE DÉFAUT MESURÉ, AVEC SON RÉFÉRENT — `D-20260920-0001` : le gabarit figé
#    depuis le 2026-09-01 pendant que le métier changeait, mesuré sur les quatre
#    sources opposables (aucun STD, aucun ADR, zéro publication au feed du 12 au
#    19/09). Conséquence chiffrable : tout orchestrateur né du gabarit demandait
#    un go que le dirigeant avait cessé de vouloir donner depuis le 15/09.
#    `E-20260818-0007` : 32 jours de réceptacle d'amélioration mort, trois écarts
#    rouges sur huit, tous des contrôles périodiques.
#
# ③ LE LOT A COUPÉ SA PART, ET LE DIT CHIFFRÉ — première mesure +10 013.
#    Deux passages, dans cet ordre : coupe des redites de la citation des
#    permissions et du récit de découverte (−1 235), puis PASSAGE DE REMPLACEMENT
#    exigé par l'arbitrage (−731 net) — « rendre un verdict franc » rendu caduc
#    par les trois listes qui disent ce qu'un rapport porte, et le renvoi de
#    `continuite` qui recopiait la règle de `rondes` §5 au lieu d'y renvoyer.
#    Reste +8 820, dont 980 pour la seule citation opposable des permissions du
#    poste — qui ne se résume pas, c'est la source, et 773 pour l'occurrence
#    datée du cinquième changement, ajoutée APRÈS le relèvement sur demande de
#    la revue de fond : elle manquait, et une règle sans le fait qui l'a payée
#    se fait enjamber (même arbitrage que le refus de couper les mesures).
#
#    ⚠️ UN TROISIÈME RETRAIT A ÉTÉ ANNULÉ, ET C'EST LE BANC QUI L'A DIT. « Mais la
#    QA passe AVANT le merge — le merge n'est qu'un constat » avait été retirée
#    comme rendue caduque par les conditions de fusion. Elle est gardée nommément
#    par `cli/test/fixtures/orchestrateur-reformulations.json`, cas
#    `pousser-qa-avant-merge` : le retrait a fait rougir `cli-tests`, en CI et en
#    local. Elle est rendue au texte (+64). **Un retrait qui fait rougir une garde
#    n'est pas un remplacement** — et c'est le seul des trois qu'aucune relecture
#    n'aurait distingué des deux autres.
#
# ④ LE LIEU A ÉTÉ CONTESTÉ — le gabarit et non le `SKILL.md` (un orchestrateur
#    ne le lit pas, arbitrage `T-20260816-0015`), et non le lieu d'un orchestrateur
#    vivant : corriger un lieu vivant ne corrige personne d'autre, le gabarit
#    descend à tous.
#
# ⚠️ LA MARGE RESTE À 0, et ce relèvement ne crée aucun droit pour le suivant.
#    Le prochain ajout se refuse par défaut, et le passage de remplacement — pas
#    la seule coupe — est ce qu'on lui demande d'abord.
# ── RE-BASELINE DU 2026-09-20 (2ᵉ) — D-20260920-0001 / E-20260920-0002 ────────
#
# 160 695 → 165 374 caractères (+4 679), MARGE TOUJOURS 0.
#
# ACCORDÉE D'AVANCE par `batiscan`, orchestrateur de `J-20260814-0002`, le
# 2026-09-20, dans le brief du lot : « si l'écart net reste positif après le
# passage de remplacement, la re-baseline à la taille finale EXACTE, marge
# zéro, est accordée d'avance ».
#
# DÉCOMPOSITION, mesurée par chapitre :
#   chefs-equipe    +2 505  règles 1, 2, 3 et 5 (sujet nommé · /goal différé ·
#                           la veille déduit la fin d'un mandat · on annule un
#                           dialogue de choix au lieu d'y répondre)
#   reflexes          +909  règle 6 (la question du cadre se pose aussi aux
#                           cadres qu'on produit soi-même)
#   faire-appliquer   +485  règle 4 (le corollaire des trois listes)
#   rondes            +398  règle 7 (« j'attends quelqu'un » se lit par chantier)
#   mise-en-production +382  le RENVOI de la règle 4 à l'endroit du geste — ajouté
#                           sur le seul défaut qu'ait trouvé la passe de fond,
#                           contre l'auteur (voir la garde 4bis)
#
# LE PASSAGE DE REMPLACEMENT A ÉTÉ FAIT AVANT DE DEMANDER, et il rend ZÉRO
# retrait — c'est un résultat, pas un renoncement. Les sept règles sont sept
# mécanismes NEUFS : aucune ne remplace une prescription déjà présente dans son
# chapitre. Deux candidats ont été examinés et écartés :
#   · `faire-appliquer`, le calcul de péremption au rebase — non gardé, donc
#     retirable SANS faire rougir, mais complémentaire du corollaire et non
#     doublé par lui : l'un porte sur le DELTA d'un rebase, l'autre sur ce qui
#     est AJOUTÉ après la revue. Le retirer serait passé au vert en amputant.
#     ⚠️ VERT NE VEUT PAS DIRE CADUC : la garde dit qu'un retrait est une
#     amputation, elle ne dit jamais qu'il est un remplacement.
#   · `chefs-equipe`, la redite de « premier palier » — doublon PRÉEXISTANT au
#     lot, donc une coupe et non un remplacement.
#
# ⚠️ CE RELÈVEMENT NE CRÉE AUCUN DROIT POUR LE SUIVANT. La marge reste à 0 : le
# prochain ajout se refuse par défaut, et c'est le passage de remplacement —
# pas la coupe — qu'on lui demandera d'abord.
# ── RE-BASELINE DU 2026-09-20 (3ᵉ) — D-20260920-0001 / E-20260920-0003 ────────
#
#   ACCORDÉE D'AVANCE par `batiscan` le 2026-09-20, dans le brief de ce lot,
#   recopiée : « Si l'écart net reste positif : re-baseline à la taille finale
#   EXACTE, marge zéro. »
#
# 165 374 → 171 024. MARGE ZÉRO, comme les deux précédentes.
#
# DÉCOMPOSITION, mesurée par chapitre — un SEUL chapitre bouge :
#   faire-appliquer  +5 650  les huit règles de « ÉPROUVER UNE GARDE », mesurées
#                            les 19 et 20/09 chez TROIS chefs différents, plus le
#                            fil qui les relie (14 430 → 20 080 caractères).
#                            Retrait compris : −37, « deux ou trois mutations de
#                            son cru » (voir ci-dessous).
#
# LE PASSAGE DE REMPLACEMENT A ÉTÉ FAIT AVANT DE DEMANDER, et la règle 1 de ce
# lot lui a été appliquée À LUI-MÊME : les bancs ont été JOUÉS après chaque
# retrait candidat, pas seulement relus.
#   · RETENU — « — deux ou trois mutations de son cru — » (−37) : la règle 3
#     remplace cette prescription, elle ne l'ampute pas. Un compte de mutations
#     fixé d'avance EST le sous-ensemble dont la règle 3 dit qu'il ne prouve
#     rien. Retrait joué : 80/80, aucune garde rougie.
#   · ÉCARTÉ — le bloc « Cas de la sonde DUPLIQUÉE » (−745), candidat plausible
#     parce que la règle 8 porte aussi sur deux copies. Retrait joué : DEUX
#     gardes rouges (⑬ « deux copies d'un critère peuvent diverger » et la
#     traçabilité de `T-20260819-0097`). C'est une AMPUTATION, pas un
#     remplacement — et rien à l'œil ne le distinguait du premier.
#
# ⚠️ CE RELÈVEMENT NE CRÉE AUCUN DROIT POUR LE SUIVANT. La marge reste à 0 : le
# prochain ajout se refuse par défaut, et c'est le passage de remplacement —
# bancs JOUÉS, pas relus — qu'on lui demandera d'abord.
# ── RE-BASELINE DU 2026-09-21 — T-20260921-0028 / J-20260814-0002 ─────────────
#
#   POURQUOI ÇA GROSSIT, PAS SEULEMENT DE COMBIEN. `puce(i)` — la fonction qui
#   écrit `enonce_socle` — n'était appelée QUE dans L1 (cardinales, dérogés,
#   garde-fous). La boucle qui construit `chapitres/<nom>.md` ne citait ses
#   items que par ID : 43 items `nature: regle` avaient un `enonce_socle`
#   ÉCRIT dans le classement et JAMAIS RENDU à un orchestrateur né — une
#   source prête, que le pipeline ne lisait pas. Ce lot fait lire ces 43
#   citations, EN TÊTE de chaque chapitre concerné, sans toucher au récit.
#
#   171 024 → 181 657. MARGE ZÉRO, comme les précédentes. +10 633.
#
#   ⚠️ CE CHIFFRE A DÉJÀ ÉTÉ CORRIGÉ UNE FOIS DANS CE MÊME LOT, ET LA CORRECTION
#   EST LE FAIT LE PLUS IMPORTANT DE CETTE ENTRÉE. Une première version citait
#   les 43 items `regle` sans exclure ceux déjà `cardinale` (`dejaEnL1`), et
#   avait mesuré 182 043 (+11 019). Une revue de fond — pas l'auteur — a trouvé
#   que trois d'entre eux (RA-ORC-004, RA-ORC-006, RA-ORC-014, tous rattachés à
#   `reflexes`) sont AUSSI des cardinales : ils étaient donc cités deux fois,
#   mot pour mot, une fois dans L1 et une fois dans leur chapitre — exactement
#   la duplication que ce modèle combat (voir le commentaire I7 dans
#   `rendu.js`). Le correctif exclut ces 3 doublons (`!dejaEnL1.has(i.id)`,
#   même garde que celle déjà posée sur `deroges` et `gardeFous`) ; `reflexes`
#   perd 386 caractères par rapport à la première mesure, d'où 181 657 et non
#   182 043. **Le nombre qui compte est celui mesuré APRÈS le correctif, pas
#   celui du premier passage — une baseline posée sur un chiffre encore faux
#   aurait figé le doublon comme normal pour tous les lots suivants.**
#
#   POURQUOI EN TÊTE ET PAS EN REMPLACEMENT DU RÉCIT — LE CHOIX EST MESURÉ, PAS
#   SUBI. Une épreuve a été jouée AVANT de construire, sur UN SEUL chapitre
#   (`chefs-equipe`, choisi pour son ratio récit/règles le plus élevé PARMI
#   les chapitres non dilués par des garde-fous hors périmètre — `reflexes`
#   avait un ratio plus haut mais 13 de ses 17 items sont `garde-fou`, déjà
#   rendus en L1). Remplacer son récit par les seules citations socle a mesuré
#   29 826 → 1 770 caractères, **−94 %** — et ce qui disparaissait n'avait
#   AUCUNE trace ailleurs dans le classement (deux natures seulement y
#   existent, `regle` et `garde-fou`) : table de choix du modèle Opus/Haiku
#   et son incident, la règle « dialogue de choix → tu annules », toute la
#   section veille de déblocage, la procédure de fermeture (piège `@{u}`).
#   Ce n'était pas du récit d'incident, c'était du savoir opératoire sans
#   autre lieu où vivre. Arbitrage révisé en conséquence par `batiscan`
#   (T-20260921-0032) : AJOUTER, jamais remplacer.
#
# DÉCOMPOSITION, mesurée par chapitre APRÈS correctif — les 7 chapitres portant des `regle` :
#   servicedesk        +1943   cadrer-concevoir   +1402   faire-appliquer +2495
#   rendre-compte       +1454  rondes             +1457   reflexes         +371
#   chefs-equipe        +1511
#   (`continuite`, `mise-en-production`, `outils`, `anti-patterns` : aucun
#   item `regle`, donc aucun changement — hors périmètre de ce ticket.)
#   (`reflexes` porte 4 items `regle`, dont 3 cardinales désormais exclues :
#   son delta n'est donc que celui de RA-ORC-042, le seul `regle` non cardinal
#   du chapitre — cohérent avec un ratio récit/règles réellement au plus haut
#   parmi tous, comme mesuré avant construction.)
#
# ⚠️ CE RELÈVEMENT NE CRÉE AUCUN DROIT POUR LE SUIVANT. La marge reste à 0, et
# la séparation entre savoir opératoire et récit d'incident — nommée par cette
# épreuve, jamais faite avant elle — reste un chantier ouvert (voir le ticket
# qui la porte, cité dans le jalon).
#
# ── RE-BASELINE DU 2026-09-22 — T-20260922-0059 / D-20260921-0016 (Q2 + annexe 1) ──
#
#   LE GESTE PRESCRIT. Deux décisions du dirigeant portées dans `chefs-equipe.md`
#   et `reflexes.md` : (Q2) une liste fermée de dix pointeurs (STD-029/030/031/
#   033/035/036/038/047, ADR-030/040) et la règle « à ta naissance, lis la liste
#   de ton application et mets-la dans chaque brief » ; (annexe 1) la correction
#   de `reflexes.md` et de l'énoncé de `GF-ORC-001` pour dire que l'orchestrateur
#   tient son `CONTEXTE.md`.
#
#   LE DÉFAUT ÉVITÉ, MESURÉ. Sans Q2, un chef d'équipe naît sans savoir quels
#   textes de gouvernance s'appliquent à son application — chaque orchestrateur
#   réinvente la liste, ou l'oublie. Sans l'annexe 1, `reflexes.md` affirme
#   depuis le 2026-08-17 qu'aucune exception d'écriture locale n'existe et que
#   « la voie n'existe pas » — FAUX depuis le 2026-08-24 (`T-20260824-0002`,
#   `gardes/ecriture-decision.js`, `FICHIER_PERMIS`) : un orchestrateur qui lit
#   cette prose renonce à une capacité qu'il possède réellement. Mesuré sur
#   `batiscan` lui-même, qui l'a vécu tel quel un mois entier avant de le
#   corriger (delivery `4c777bb2`, commentaire `32f1c530`).
#
#   LA PART COUPÉE AVANT DE DEMANDER. Le modèle par rôle (même lot, chapitre
#   `chefs-equipe`) a été compressé DEUX fois avant d'entrer, banc rejoué après
#   chaque coupe : la mesure « deux reviewers Haiku bloqués en boucle » a
#   perdu sa reformulation ; l'exception Opus a perdu son adverbe. −127
#   caractères récupérés avant même la première mesure de ce lot. Pour Q2 et
#   l'annexe 1 eux-mêmes : AUCUNE coupe supplémentaire trouvée sans perdre un
#   fait vérifié — la liste des dix pointeurs et le nom du fichier permis ne
#   se raccourcissent pas sans devenir faux ou incomplets, et les deux dates
#   (2026-08-17 / 2026-08-24) sont ce qui distingue une prose légitime d'une
#   prose fautive : les retirer redonnerait l'ambiguïté que ce lot ferme.
#
#   181 657 → 182 118. MARGE ZÉRO, comme les précédentes. +461.
#
#   L'ARBITRAGE, avec son référent durable. `batiscan`, coordonnateur du
#   jalon, tranche seul (ligne 1084 : « si tes amendements n'y tiennent pas,
#   la question appartient à ton coordonnateur » ; règle permanente de
#   `matapedia`, 2026-08-19/20, D-20260818-0003 / T-20260820-0003 : « re-
#   baseliner EST la décision qu'elle exige »). GO FERME inscrit le
#   2026-09-22T11:22:28Z, delivery `4c777bb2-9209-4488-88fc-a459009e5f53`,
#   commentaire `7e04e151-e5b7-4f34-9606-70e6c3728d3e` — qui supersède une
#   première conclusion erronée (`32f1c530`) confondant ce plafond avec
#   `BUDGETS.L1` de `cli/src/metier/rendu.js` (celui-là EST signé par le
#   dirigeant, 2026-08-20, et Q2 ne le touche pas : L1 = 1924/2500 avec Q2
#   dedans, qui vit entièrement dans un chapitre L2 souple).
#
# ⚠️ CE RELÈVEMENT NE CRÉE AUCUN DROIT POUR LE SUIVANT. La marge reste à 0.
#
# ── RE-BASELINE DU 2026-09-22 (2ᵉ) — T-20260922-0059 / D-20260921-0016 (revert 4 hooks) ──
#
#   LE GESTE PRESCRIT. `GF-ORC-004`, `011`, `012`, `013` restaurés en couche
#   `persona` avec leur bloc `sans_garantie` complet (motif d'origine, `assume_par`
#   « Maxime Leboeuf (dirigeant) », `definitif: false`, `echeance: 2026-09-30`).
#   Suite à l'arbitrage du dirigeant, relayé par `michel` le 2026-09-22 ~11h46Z :
#   les quatre restent en persona TANT QUE leurs hooks ne sont pas branchés — le
#   reclassement immédiat se réduit au retrait de `GF-ORC-009` (déjà conforme,
#   non touché ici). Ce texte supersède le premier reclassement (bd38943,
#   `RE-BASELINE DU 2026-09-22` ci-dessus), fusionné trois minutes avant que
#   l'arbitrage réel n'arrive — la décision « GO » citée dans `D-20260921-0016`
#   avait déjà été révisée en « GO avec b » sans que ce lot en soit informé à
#   temps.
#
#   LE DÉFAUT ÉVITÉ, MESURÉ. Sans ce retrait, le métier affiche une garantie
#   fausse : `GF-ORC-004/011/012/013` sont classés `hook` — une couche qui
#   GARANTIT selon STD-047 — sans qu'aucun hook technique réel ne les couvre
#   (mesuré par la revue de fond de la première PR : grep vide sur les quatre
#   fichiers de garde existants). C'est exactement ce que STD-047 R1 existe
#   pour interdire, et le pack l'a porté trois minutes en production.
#
#   RE-VÉRIFIÉ, PAS RECOPIÉ — STD-047 R1. Mesuré par le moteur de rendu
#   lui-même (`pack metier rendre --role orchestrateur`), pas par lecture :
#   **12 garde-fous · 7 dérogés · 0 refusés.** Les sept dérogés (`GF-ORC-003`,
#   `004`, `006`, `008`, `011`, `012`, `013`) portent tous un motif, un nom qui
#   assume, et soit `definitif: true` soit une `echeance` — R1 reste satisfaite,
#   avec une répartition différente (5 hook / 7 persona assumée, au lieu de
#   9 hook / 3) que la demande d'origine n'annonçait pas.
#
#   LA PART COUPÉE AVANT DE DEMANDER. Aucune. Restaurer un bloc `sans_garantie`
#   déjà signé par le dirigeant est un geste de restitution, pas une
#   composition libre — rien à couper sans mutiler une signature déjà validée
#   ailleurs (le texte des quatre motifs est repris mot pour mot de la version
#   d'avant reclassement).
#
#   182 118 → 182 520. MARGE ZÉRO, comme les précédentes. +402.
#
#   L'ARBITRAGE, avec son référent durable. `batiscan`, coordonnateur du
#   jalon : « ce plus 402 ne vient pas d'un ajout de prose, il vient de
#   RESTAURER quatre blocs que la décision du dirigeant exige. Refuser ce
#   dépassement reviendrait à faire choisir entre la garde de taille et un
#   ordre du dirigeant, et la garde de taille n'a pas cette autorité. » GO
#   FERME, delivery `4c777bb2-9209-4488-88fc-a459009e5f53`, commentaire
#   `7bb9e4c9-5933-4865-a7b0-c088e6de036e`, 2026-09-22.
#
# ⚠️ CE RELÈVEMENT NE CRÉE AUCUN DROIT POUR LE SUIVANT. La marge reste à 0, et
# les quatre hooks réels restent un chantier ouvert (ticket séparé, ouvert par
# `batiscan`) — quand ils existeront, la couche de chaque item redeviendra
# `hook` et ce lot se re-baselinera dans l'autre sens.
#
# ── RE-BASELINE DU 2026-09-25 — T-20260923-0012 (`/episodique` marqué écriture gelée) ──
#
#   182 520 → 182 576. MARGE ZÉRO, comme les précédentes. +56. Mesuré sur le rendu FINAL, après
#   le dernier commit du lot, pas estimé ; `origin/main` mesuré à 182 520 exactement (la « marge
#   d'environ 30 » du brief n'existait pas : la marge était déjà nulle).
#
#   ① LE GESTE PRESCRIT — un orchestrateur qui lit le tableau des outils voit `/episodique`
#      offert comme disponible alors que son ÉCRITURE est gelée ; il ne peut pas tenir cette
#      conduite sans le texte.
#   ② LE DÉFAUT ÉVITÉ, MESURÉ — `T-20260923-0012` et `T-20260923-0013` sont gelés sur
#      `STD-045` §2.7.2 : encoder une session communique son contenu hors Québec.
#   ③ LA PART COUPÉE — AUCUNE, et c'est le coordonnateur qui l'assume : couper 56 caractères de
#      prose que rien ne vérifie pour tenir une contrainte comptable raboterait du texte utile,
#      le motif exact du précédent du 2026-08-27 (D-20260826-0010).
#   ④ LE LIEU — la source `metier/orchestrateur/chapitres/outils.md`, parce que c'est le
#      tableau des outils qui prescrit le geste.
#
#   L'ARBITRAGE, avec son canal. `batiscan`, coordonnateur du jalon, relayé au chef d'équipe
#   `t-20260925-0048` le 2026-09-25 : « le plafond n'est PAS un budget de taille à respecter,
#   c'est une LIGNE DE BASE qui se re-pose à chaque lot, sur la taille FINALE et EXACTE du rendu,
#   AUCUNE MARGE. […] TU RELÈVES LA LIGNE DE BASE, à la taille EXACTE de ton rendu final, marge
#   zéro. » Consigné mot pour mot au ServiceDesk sur `T-20260925-0048`, par `batiscan`.
#   Il supersède le constat de `T-20260925-0045` (un plafond qui « dicterait » le contenu).
#
# ⚠️ CE RELÈVEMENT NE CRÉE AUCUN DROIT POUR LE SUIVANT. La marge reste à 0.
#
# ── RE-BASELINE DU 2026-09-25 (2ᵉ) — T-20260925-0080 (hook `Stop` scribe des tâches) ──
#
#   182 576 → 183 385. MARGE ZÉRO, comme les précédentes. +809. Mesuré sur le rendu FINAL,
#   après `pack metier rendre --role orchestrateur`, pas estimé.
#
#   ① LE GESTE PRESCRIT — l'orchestrateur doit savoir qu'un hook `Stop` lit son dernier
#      message : sans le texte, il ignore la forme du bloc ```` ```taches ```` (verbes
#      `ouvrir`/`en-cours`/`fait`/`attend`), la demande qu'il déclare dans `.demande`, et le
#      fait que `attend: dirigeant` écrit mais ne relance pas.
#   ② LE DÉFAUT ÉVITÉ, MESURÉ — un scribe que l'agent ne sait pas nourrir reste silencieux :
#      « pas de bloc → le hook ne fait rien » se lirait comme « le hook ne sert à rien »
#      plutôt que comme « je n'ai pas rendu mon bloc ce tour-ci ».
#   ③ LA PART COUPÉE — AUCUNE section existante n'a été retirée ; le paragraphe ajouté est
#      la forme la plus courte trouvée (bloc + `attend: dirigeant` + pointeur vers `.demande`).
#   ④ LE LIEU — `metier/orchestrateur/chapitres/servicedesk.md`, section « Le hook `Stop`
#      écrit tes tâches — et lit ta suite », juste avant « L'hygiène du ServiceDesk » : c'est
#      le chapitre qui tient déjà la tenue du ServiceDesk du chantier.
#
#   L'ARBITRAGE — même règle que les précédentes (arbitrage `batiscan` du 2026-09-25,
#   `T-20260925-0048` : « TU RELÈVES LA LIGNE DE BASE, à la taille EXACTE de ton rendu
#   final, marge zéro »), appliquée par le chef d'équipe `t-20260925-0086` sur `T-20260925-0080`.
#
# ⚠️ CE RELÈVEMENT NE CRÉE AUCUN DROIT POUR LE SUIVANT. La marge reste à 0.
#
# ── RE-BASELINE DU 2026-09-25 (3ᵉ) — T-20260925-0080 (revue de fond, défaut D1) ──
#
#   183 385 → 183 512. MARGE ZÉRO, comme les précédentes. +127. Mesuré sur le rendu FINAL,
#   après `pack metier rendre --role orchestrateur`, pas estimé.
#
#   ① LE GESTE PRESCRIT — la revue de fond a trouvé un défaut réel : un bloc ```` ```taches ````
#      CITÉ en exemple (« voici la syntaxe : … » suivi d'autre texte) créait un vrai ticket, parce
#      que l'extraction balayait tout le message au lieu de ne retenir que le bloc qui le
#      termine. Corrigé côté code (`extraireBloc`) ; le texte doit dire la règle, pas seulement
#      la coder — sinon l'orchestrateur continue de croire qu'un exemple cité est sans danger.
#   ② LE DÉFAUT ÉVITÉ, MESURÉ — un ticket créé depuis un exemple pédagogique, jamais voulu comme
#      directive.
#   ③ LA PART COUPÉE — AUCUNE.
#   ④ LE LIEU — `metier/orchestrateur/chapitres/servicedesk.md`, une phrase ajoutée juste après
#      la mise en garde sur le bloc mal formé, dans la même section.
#
#   L'ARBITRAGE — même règle que les précédentes (arbitrage `batiscan`, `T-20260925-0048` :
#   « TU RELÈVES LA LIGNE DE BASE, à la taille EXACTE de ton rendu final, marge zéro »), appliquée
#   après la passe de revue de fond NO-GO sur `T-20260925-0080`.
#
# ⚠️ CE RELÈVEMENT NE CRÉE AUCUN DROIT POUR LE SUIVANT. La marge reste à 0.
BASELINE=183512
MARGE=0
PLAFOND=$((BASELINE + MARGE))
TAILLE="$(wc -m < "$METIER" | tr -d ' ')"

# La marge est dérivée, jamais réécrite en dur dans le message : un banc dont
# le compte rendu annonce une autre borne que celle qu'il applique ment sur sa
# propre garde, et c'est le seul chiffre que personne ne pense à vérifier.
if [ "$TAILLE" -le "$PLAFOND" ]; then
  ok "$TAILLE caractères — sous le plafond de $PLAFOND (baseline $BASELINE + marge $MARGE), écart net $((TAILLE - BASELINE))"
else
  ko "$TAILLE caractères — au-dessus du plafond de $PLAFOND (écart net $((TAILLE - BASELINE)), marge $MARGE) : chaque ajout doit REMPLACER ou PRÉCISER"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ⑫ Volubilité — D-20260925-0003. Quatre causes du MÊME chapitre (rendre-compte),
#    qui se contredisent si on les sépare. Chaque assertion est ANCRÉE À SA
#    SECTION, et chaque négative est APPARIÉE à une positive sur le même objet
#    (sinon supprimer la section les rendrait vertes).
# ═══════════════════════════════════════════════════════════════════════════
echo "⑫ volubilité — la dernière ligne, la question, l'identifiant, l'accusé"

# ── (a) La dernière ligne est exigée sur le message QUI ATTEND, plus sur tout message.
S_DER="$(section 'La dernière ligne')"
if printf '%s' "$S_DER" | grep -qF "J'ai besoin de toi :" \
   && printf '%s' "$S_DER" | grep -qi 'attend quelque chose'; then
  ok "12a — la dernière ligne littérale est exigée sur le message qui attend quelque chose du dirigeant"
else
  ko "12a — la section « La dernière ligne » n'exige pas la formule littérale sur le message qui attend quelque chose"
fi
if printf '%s' "$S_DER" | grep -qi 'purement informatif' \
   && printf '%s' "$S_DER" | grep -qi "n'a pas cette ligne"; then
  ok "12a — un message purement informatif n'a pas cette ligne"
else
  ko "12a — rien ne dit qu'un message purement informatif se passe de la ligne : le « rien » redevient obligatoire"
fi
# Négatif apparié aux deux positives ci-dessus : l'ancienne exigence a disparu de TOUT le métier.
if [ -n "$S_DER" ] \
   && ! grep -qi 'Tout message se termine par' "$METIER" \
   && ! grep -qF 'rien.` compris' "$METIER" \
   && ! grep -qF 'tout message**, et le `rien`' "$METIER" \
   && ! grep -qi 'Le `rien` s.écrit' "$METIER" \
   && ! grep -qF 'de **chaque** message, `rien.`' "$METIER" \
   && ! grep -qF '0 message sans sa dernière ligne' "$METIER" \
   && ! grep -qF 'sa dernière ligne, comme tout message' "$METIER" \
   && ! grep -qF '`rien` s'"'"'écrit' "$METIER" \
   && ! grep -qF 'la dernière ligne obligatoire' "$RACINE/metier/orchestrateur/classement.json"; then
  ok "12a — plus aucun chapitre n'exige « J'ai besoin de toi : rien. » sur tout message"
else
  ko "12a — un chapitre exige encore la ligne (ou son « rien ») sur tout message : contradiction avec la règle"
fi

# ── (b) Une question au dirigeant est une DÉCISION ; le reste va au chef ou se mesure.
# ⚠️ Assertion sur la PHRASE ENTIÈRE, ancrée à sa section : des mots isolés (« guichet »
# figure aussi ailleurs, au chapitre du sous-traitant) seraient satisfaits par autre chose.
S_MONTE="$(section 'Ce que tu fais monter')"
if printf '%s' "$S_MONTE" | grep -qF "**Une question au dirigeant est une décision** : les faits qui décident, **deux options au plus**, ta recommandation, une échéance."; then
  ok "12b — une question au dirigeant est une décision : faits, deux options au plus, recommandation, échéance (phrase entière)"
else
  ko "12b — la phrase « une question au dirigeant est une décision… deux options au plus, ta recommandation » n'est plus entière dans sa section"
fi
if printf '%s' "$S_MONTE" | grep -qF "**Toute autre question va au chef d'équipe, ou se mesure** — jamais au dirigeant." \
   && ! printf '%s' "$S_MONTE" | grep -qiE "va aussi au dirigeant|ni au chef ni mesur"; then
  ok "12b — toute autre question va au chef d'équipe ou se mesure, jamais au dirigeant (phrase entière, contraire absent)"
else
  ko "12b — la phrase « toute autre question va au chef d'équipe, ou se mesure — jamais au dirigeant » n'est plus entière, ou son contraire est écrit : l'orchestrateur redevient un guichet"
fi
if printf '%s' "$S_MONTE" | grep -qF "une question rendue nue fait de toi un guichet"; then
  ok "12b — la garde contre le guichet reste écrite dans cette section"
else
  ko "12b — le motif « une question rendue nue fait de toi un guichet » a quitté sa section"
fi

# ── (c) Aucun identifiant technique sur la ligne.
if printf '%s' "$S_DER" | grep -qi "jamais d'identifiant technique" \
   && printf '%s' "$S_DER" | grep -qi 'pane' \
   && printf '%s' "$S_DER" | grep -qi 'canal' \
   && printf '%s' "$S_DER" | grep -qi 'commit'; then
  ok "12c — jamais d'identifiant technique sur la ligne (pane, canal, session, commit) : le nom de l'agent ou le code lisible"
else
  ko "12c — la section ne proscrit pas l'identifiant technique (pane, canal, commit) sur la ligne"
fi
if ! printf '%s' "$S_DER" | grep -qi "avant l'identifiant de pane" && [ -n "$S_DER" ]; then
  ok "12c — la section ne recommande plus de donner un identifiant de pane"
else
  ko "12c — la section recommande encore de donner l'identifiant de pane au dirigeant"
fi

# F — l'interdiction ne souffre AUCUNE exception dans sa phrase (sauf le pane, si le focus échoue…).
if printf '%s' "$S_DER" | grep -qF "**Jamais d'identifiant technique sur la ligne** — ni pane, ni canal, ni identifiant de session, ni commit." \
   && ! printf '%s' "$S_DER" | grep -iE "identifiant" | grep -qiE "sauf|ou le pane|si le focus"; then
  ok "12c — l'interdiction d'identifiant technique est entière, sans exception (sauf / ou le pane / si le focus)"
else
  ko "12c — l'interdiction d'identifiant technique n'est plus entière, ou une exception y est écrite"
fi
# I — la phrase entière du seuil : « une remontée sans date est une permission de se taire ».
if printf '%s' "$S_MONTE" | grep -qF "**Une remontée sans date est une permission de se taire ; une question rendue nue fait de toi un guichet**"; then
  ok "12b — « une remontée sans date est une permission de se taire » est entière"
else
  ko "12b — la phrase « une remontée sans date est une permission de se taire » n'est plus entière"
fi
# 1 — le LU rattrapé par la ronde est l'exception écrite à « jamais seul », dans la section de la ronde.
S_RATT="$(section 'Ta propre ligne et ta propre boîte de saisie')"
if printf '%s' "$S_RATT" | grep -qF "un LU rattrapé part quand même, seul s'il le faut" \
   && printf '%s' "$S_RATT" | grep -qF "vaut pour le LU de réception"; then
  ok "12f — le LU rattrapé par la ronde part quand même, seul s'il le faut : l'exception à « jamais seul » est écrite"
else
  ko "12f — la ronde n'écrit plus l'exception : « jamais seul » contredit « un LU tardif vaut mieux que pas de LU »"
fi
# 5 — la borne du doute : un exemple de ce qui n'attend rien.
if printf '%s' "$S_DER" | grep -qF "n'attend rien" && printf '%s' "$S_DER" | grep -qF "je continue"; then
  ok "12e — la borne du doute a son exemple : « j'ai tranché X, je continue » n'attend rien"
else
  ko "12e — le doute n'a plus de borne : aucun exemple de message qui n'attend rien"
fi
# m8 — la concision est le défaut, jamais un plafond (gardé aussi côté bash).
S_FAITS="$(section 'Des faits, pas ton raisonnement')"
if printf '%s' "$S_FAITS" | grep -qF "**Et la concision est le défaut, jamais un plafond.**" \
   && ! printf '%s' "$S_FAITS" | grep -qiE "réponds toujours court|jamais plus de trois lignes|même quand il demande une analyse"; then
  ok "12g — la concision est le défaut, jamais un plafond (phrase entière, contraire absent)"
else
  ko "12g — « la concision est le défaut, jamais un plafond » n'est plus entière, ou son contraire est écrit"
fi

# ── (d) Le LU part avec le PREMIER fait utile : jamais seul, jamais un message à lui.
S_LU="$(section 'Accuser LU')"
if printf '%s' "$S_LU" | grep -qF "**Aucun accusé seul** : le \`LU\` n'est jamais un message à lui. Il part dès la réception avec le PREMIER fait — « LU — je commence X », « LU — en cours, je regarde Y » —, jamais nu, jamais retardé jusqu'à la fin du travail." \
   && printf '%s' "$S_LU" | grep -qF "Jamais de \`LU\` nu, jamais de \`LU\` retardé jusqu'à la fin du travail." \
   && printf '%s' "$S_LU" | grep -qF "Un simple « merci », sans travail à faire, n'appelle aucun accusé : rien à porter, rien d'attendu." \
   && ! printf '%s' "$S_LU" | grep -qiE "peut être un message à lui|n'est pas exigé"; then
  ok "12d — aucun accusé seul : le LU part avec le premier fait utile (phrase entière, contraire absent)"
else
  ko "12d — la phrase « aucun accusé seul… dès la réception avec le premier fait » (ou ses deux compléments : LU nu, « merci ») n'est plus entière, ou son contraire est écrit : le LU redevient un message à lui"
fi
# A3 — un contraire écrit AILLEURS dans la section ne doit pas passer : on lit la section ENTIÈRE,
# hors la phrase « Aucun accusé seul » elle-même (qui nomme « message à lui » pour l'interdire).
if ! printf '%s' "$S_LU" | grep -v 'Aucun accusé seul' | grep -qiE "part seul|LU nu|LU seul|accusé seul (est|reste|peut)|message à lui"; then
  ok "12d — aucun contraire (« LU nu », « part seul », « message à lui ») n'est écrit ailleurs dans la section"
else
  ko "12d — un contraire (« un LU nu part seul »…) est écrit dans la section de l'accusé : l'accusé seul redevient permis"
fi
if printf '%s' "$S_LU" | grep -qF "le \`LU\` en est la première ligne" \
   && printf '%s' "$S_LU" | grep -qF "deux agents ont été réellement gelés"; then
  ok "12d — le LU est la première ligne du message qui porte le fait, et son motif (deux agents gelés) reste"
else
  ko "12d — « le LU en est la première ligne » ou son motif (deux agents gelés) a disparu : on a abrogé au lieu de préciser"
fi

# ── (e) « attend quelque chose » couvre le geste à poser ; dans le doute on écrit la ligne.
if printf '%s' "$S_DER" | grep -qF "**« Attend quelque chose » couvre aussi un geste à poser**" \
   && printf '%s' "$S_DER" | grep -qF "**Dans le doute, écris la ligne** : l'oubli est la faute grave, la ligne en trop le moindre mal."; then
  ok "12e — « attend quelque chose » couvre un geste à poser, et dans le doute on écrit la ligne"
else
  ko "12e — l'ambiguïté de l'oubli est rouverte : rien ne dit qu'un geste à poser compte, ni que dans le doute on écrit la ligne"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ⑬ Les SKILLS répètent la règle (ligne-directe, orchestrer-chantier) — D-20260925-0003.
#    Le métier était gardé, pas les skills : ils ont gardé « rien » et « lui appartient »
#    jusqu'à une revue. Assertions sur PHRASES ENTIÈRES, ancrées à la section du skill.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑬ les skills disent la même règle que le métier"
section_f() {  # section_f <fichier> <motif-de-titre>
  awk -v motif="$2" '
    /^#+ / {
      n = 0; while (substr($0, n+1, 1) == "#") n++
      if (dedans && n <= niv_ouvert) { dedans = 0 }
      if (!dedans && index($0, motif) > 0) { dedans = 1; niv_ouvert = n; next }
    }
    dedans { print }
  ' "$1"
}
SK_LD="$RACINE/.claude/skills/ligne-directe/SKILL.md"
SK_OC="$RACINE/.claude/skills/orchestrer-chantier/SKILL.md"
S_TON="$(section_f "$SK_LD" 'Le ton')"
S_TENIR="$(section_f "$SK_OC" 'Tenir le ServiceDesk')"
S_CLORE="$(section_f "$SK_OC" 'Clore')"

# S1 — le geste à poser compte, dans les deux skills.
if printf '%s' "$S_TON" | grep -qF "une décision, ou un geste à poser (pane gelé, login, dialogue à trancher)" \
   && printf '%s' "$S_TENIR" | grep -qF "une décision, ou un geste à poser (jamais un \`rien.\` de remplissage)"; then
  ok "13a — ligne-directe et orchestrer-chantier : « attend quelque chose » couvre le geste à poser"
else
  ko "13a — un skill ne dit plus que le geste à poser (pane gelé, login, dialogue) compte comme « attend quelque chose »"
fi
# S3 — toute autre question va au chef d'équipe ou se mesure.
if printf '%s' "$S_TON" | grep -qF "toute autre question va au chef d'équipe ou se mesure." \
   && ! printf '%s' "$S_TON" | grep -qiE "va aussi au dirigeant|ni au chef ni mesur"; then
  ok "13b — ligne-directe : toute autre question va au chef d'équipe ou se mesure"
else
  ko "13b — ligne-directe ne dit plus où va une question qui n'est pas une décision"
fi
# S5 — l'interdit d'identifiant est ÉNUMÉRÉ, sans exception.
if printf '%s' "$S_TON" | grep -qF "**Jamais d'identifiant technique sur la ligne** — ni pane, ni canal, ni identifiant de session, ni commit" \
   && ! printf '%s' "$S_TON" | grep -iE "identifiant" | grep -qiE "sauf|ou le pane|si le focus"; then
  ok "13c — ligne-directe : l'interdit d'identifiant technique est énuméré (pane, canal, session, commit), sans exception"
else
  ko "13c — ligne-directe n'énumère plus l'interdit d'identifiant technique, ou y écrit une exception"
fi
# B — la ligne du dirigeant et la ligne cliente ne se confondent pas : aucun code de chantier côté client.
if printf '%s' "$S_TON" | grep -qF "sur la ligne du dirigeant, le nom de l'agent ou le code lisible" \
   && printf '%s' "$S_TON" | grep -qF "sur une ligne cliente, aucun code de chantier."; then
  ok "13c — ligne-directe distingue la ligne du dirigeant (nom ou code lisible) de la ligne cliente (aucun code de chantier)"
else
  ko "13c — ligne-directe autorise le code lisible sans distinguer la ligne cliente, où le code du chantier n'entre nulle part"
fi
# le LU : première ligne du message porteur, jamais seul, renvoi au métier.
if printf '%s' "$S_TON" | grep -qF "**Le \`LU\` part dès la réception avec le premier fait (« je commence X », « en cours, je regarde Y »), jamais nu, jamais retardé jusqu'à la fin du travail : il est la première ligne du message qui porte le fait, jamais un message à lui. Un simple « merci » n'appelle aucun accusé ; un LU rattrapé en retard part quand même, seul s'il le faut.**" \
   && ! printf '%s' "$S_TON" | grep -qF "voir le métier"; then
  ok "13d — ligne-directe : la règle du LU est dite en autonome (première ligne du message porteur ; le LU rattrapé part quand même), sans renvoi à un métier"
else
  ko "13d — ligne-directe ne dit plus le LU en autonome (première ligne du message porteur, LU rattrapé), ou renvoie à un métier que les agents non-orchestrateurs n'ont pas"
fi
# le doute + l'exemple, dans les deux skills.
if printf '%s' "$S_TON" | grep -qF "**Dans le doute, écris la ligne** : l'oubli est la faute grave. *« J'ai tranché X, je continue »* n'attend rien ; *« dis-moi si tu veux le contraire »* attend." \
   && printf '%s' "$S_TENIR" | grep -qF "**Dans le doute, écris la ligne** : l'oubli est la faute grave. *« J'ai tranché X, je continue »* n'attend rien ; *« dis-moi si tu veux le contraire »* attend."; then
  ok "13e — les deux skills : dans le doute on écrit la ligne, avec l'exemple qui borne"
else
  ko "13e — un skill perd « dans le doute, écris la ligne » ou son exemple"
fi
# S11 — le bilan n'exige plus de « rien » ; il attend, ou il n'a pas la ligne.
if printf '%s' "$S_CLORE" | grep -qF "**seulement si le bilan attend quelque chose de lui** — une décision ou un geste à poser ; sinon il n'a pas cette ligne, et dans le doute on l'écrit : l'oubli est la faute grave." \
   && ! printf '%s' "$S_CLORE" | grep -qF 'rien.` s'"'"'il ne reste'; then
  ok "13f — orchestrer-chantier : le bilan n'a la ligne que s'il attend quelque chose, sans « rien » obligatoire"
else
  ko "13f — orchestrer-chantier : le bilan exige de nouveau la ligne ou son « rien », ou perd le critère « attend »"
fi
# renvoi de la règle du LU vers l'exception de la ronde, dans le métier.
if printf '%s' "$S_LU" | grep -qF "Exception : le LU rattrapé par la ronde (voir rondes)."; then
  ok "13g — le métier renvoie l'exception du LU rattrapé depuis la section du LU"
else
  ko "13g — la section du LU ne renvoie plus à l'exception de la ronde : « jamais seul » redevient contradictoire"
fi
# « lui appartient » : le critère est « attend », partout où le métier borne la ligne.
if ! grep -qF "qui lui appartienne" "$METIER" && ! grep -qF "si quelque chose lui appartient" "$METIER" && ! grep -qF "s'il reste quelque chose qui lui appartient" "$METIER" \
   && grep -qF "si le bilan attend quelque chose de lui" "$METIER" && grep -qF "si le topo attend quelque chose de lui" "$METIER"; then
  ok "13h — le topo et le bilan du métier bornent la ligne sur « attend », plus sur « lui appartient »"
else
  ko "13h — le topo ou le bilan du métier borne encore la ligne sur « lui appartient »"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ⑭ GARDES NÉGATIVES DE SECTION — génériques, appariées à la présence de la phrase.
#    Les gardes par phrase entière ne voient pas une phrase AJOUTÉE À CÔTÉ qui contredit
#    (« hormis le pane », « un LU seul reste toutefois permis »…). On ne liste pas les
#    contraires un à un : on interdit, dans la section, la FAMILLE de mots qui les portent.
#    ⚠️ Limite écrite plus bas : une contradiction en mots neufs échappe encore.
# ═══════════════════════════════════════════════════════════════════════════
echo "⑭ gardes négatives de section"
# (i) « J'ai besoin de toi : rien » n'est écrit nulle part — sauf exemple marqué « à ne pas écrire ».
RIEN_TROUVE="$(grep -hE "besoin de toi *: *\`?rien" "$METIER" "$SK_LD" "$SK_OC" 2>/dev/null | grep -viE "à ne pas écrire" || true)"
if [ -z "$RIEN_TROUVE" ] && printf '%s' "$S_DER" | grep -qF "y écrire « rien » est du bruit"; then
  ok "14i — « J'ai besoin de toi : rien » n'est écrit nulle part (métier + deux skills), et le motif « bruit » est présent"
else
  ko "14i — « J'ai besoin de toi : rien » est de nouveau écrit quelque part : $(printf '%s' "$RIEN_TROUVE" | head -1 | cut -c1-100)"
fi
# (ii) l'interdit d'identifiant : aucun mot d'exception dans SA section.
if printf '%s' "$S_DER" | grep -qF "**Jamais d'identifiant technique sur la ligne**" \
   && ! printf '%s' "$S_DER" | grep -qiE "sauf|hormis|excepté|à moins|si utile|quand tu demandes"; then
  ok "14ii — la section de l'interdit d'identifiant ne porte aucun mot d'exception (sauf/hormis/excepté/à moins/si utile/quand tu demandes)"
else
  ko "14ii — la section de l'interdit d'identifiant porte un mot d'exception, ou l'interdit a disparu"
fi
# (iii) les sections du LU : aucune permission de l'accusé seul.
if printf '%s' "$S_LU" | grep -qF "**Aucun accusé seul**" && printf '%s' "$S_RATT" | grep -qF "un LU rattrapé part quand même" \
   && ! printf '%s%s%s' "$S_LU" "$S_RATT" "$S_TON" | grep -qiE "toutefois|reste permis|peut être un message"; then
  ok "14iii — les sections du LU (métier, ronde, skill) ne portent ni « toutefois », ni « reste permis », ni « peut être un message »"
else
  ko "14iii — une section du LU porte « toutefois / reste permis / peut être un message » : l'accusé seul est permis par la bande"
fi
# (iv) topo et bilan : ANCRÉS à leur section, et jamais « toujours » / « même vide ».
S_TOPO="$(section 'Le topo du matin')"
S_CLORE_M="$(section 'Clore')"
if printf '%s' "$S_TOPO" | grep -qF "si le topo attend quelque chose de lui" \
   && printf '%s' "$S_CLORE_M" | grep -qF "si le bilan attend quelque chose de lui" \
   && ! printf '%s%s' "$S_TOPO" "$S_CLORE_M" | grep -qiE "toujours|même vide"; then
  ok "14iv — topo et bilan bornent la ligne sur « attend » dans LEUR section, sans « toujours » ni « même vide »"
else
  ko "14iv — le topo ou le bilan (dans sa section) n'est plus borné sur « attend », ou exige « toujours / même vide »"
fi
# (v) l'exception du LU rattrapé : phrase entière, sans négation collée devant.
if printf '%s' "$S_LU" | grep -qF "Exception : le LU rattrapé par la ronde (voir rondes)." \
   && ! printf '%s' "$S_LU" | grep -qE "Aucune? [Ee]xception"; then
  ok "14v — l'exception du LU rattrapé est entière et sans négation collée"
else
  ko "14v — l'exception du LU rattrapé n'est plus entière, ou un « Aucune exception » la nie"
fi
# (vi) le critère « attend » : ni « toujours » ni « même vide » collé au critère dans la section de la ligne.
if ! printf '%s' "$S_DER" | grep -qiE "toujours (la|cette) ligne|même vide|peut porter rien|sans dommage|question ouverte peut"; then
  ok "14vi — la section de la dernière ligne ne l'exige pas « même vide » et ne rouvre pas la question ouverte"
else
  ko "14vi — la section de la dernière ligne exige la ligne « même vide », ou rouvre les questions ouvertes"
fi

# ── Point 2 — ligne-directe : les cas de parole spontanée incluent l'accusé, la réponse, le geste à poser.
if grep -qF "Tu parles spontanément dans deux cas, plus l'accusé de réception (\`LU\` + premier fait), la réponse à une question du dirigeant et le geste à poser (pane gelé, login, dialogue) :" "$SK_LD" \
   && grep -qF "Le reste attend le prochain jalon." "$SK_LD" \
   && ! grep -qF "deux cas, et deux seulement" "$SK_LD"; then
  ok "15a — ligne-directe : deux cas spontanés PLUS l'accusé, la réponse et le geste à poser ; le reste attend le jalon"
else
  ko "15a — ligne-directe exclut de nouveau le LU, la réponse ou le geste à poser (« deux cas, et deux seulement »)"
fi
# ── Point 3 — rondes : un tour vide se termine sans message ; une question sans réponse n'est pas re-posée.
S_ROND1="$(section 'Tes agents et le travail qui tourne')"
if printf '%s' "$S_ROND1" | grep -qF "un tour vide se termine sans message." \
   && printf '%s' "$S_ROND1" | grep -qF "n'est pas re-posée à chaque tour : ré-adresse-la au plus une fois par échéance annoncée, ou sur un delta." \
   && printf '%s' "$S_ROND1" | grep -qF "Un tour qui trouve quelque chose se termine sur l'un des deux" \
   && printf '%s' "$S_ROND1" | grep -qF "ou un NOUVEAU blocage nommé" \
   && ! printf '%s' "$S_ROND1" | grep -qF "Chaque tour se termine sur"; then
  ok "15b — rondes : un tour vide se termine sans message, et une question sans réponse n'est pas re-posée à chaque tour"
else
  ko "15b — rondes : « chaque tour se termine sur un delta ou un arbitrage » contredit de nouveau « si tu ne trouves rien, tu te tais »"
fi

# ── 6e revue : geste à poser sans échéance, LU rattrapé sans merci, forme, compte de torts.
if printf '%s' "$S_ROND1" | grep -qF "Un geste à poser sans échéance (pane gelé, login) se repose UNE FOIS, puis seulement sur un delta de nature (l'écran ou l'état a changé — pas un compteur qui varie) ou, s'il bloque toujours, au plus UNE FOIS PAR HEURE et par message, tous les gestes en attente groupés — jamais à chaque tour ; « l'heure de la prochaine relance » tient lieu d'échéance." \
   && printf '%s' "$S_ROND1" | grep -qiF "une fois par heure" \
   && printf '%s' "$S_ROND1" | grep -qF "et par message, tous les gestes en attente groupés" \
   && ! printf '%s' "$S_ROND1" | grep -qiE "à chaque rappel de la ronde|repose-le à chaque tour|Jamais : un geste|par geste"; then
  ok "16a — rondes : un geste à poser sans échéance se repose UNE FOIS, puis sur un delta ou au plus une fois par heure, jamais à chaque tour"
else
  ko "16a — rondes : la borne du geste sans échéance (une fois, puis delta ou une fois par heure) a disparu (« par message, groupés » compris), ou « à chaque rappel / à chaque tour / par geste » est revenu"
fi
if printf '%s' "$S_RATT" | grep -qF "appelle son \`LU\` MAINTENANT** (sauf un simple merci, ou un message auquel tu as déjà répondu)" \
   && printf '%s' "$S_LU" | grep -qF "Il exclut un simple merci et un message auquel tu as déjà répondu (la réponse prouve la réception)."; then
  ok "16b — rondes : le LU rattrapé exclut le simple merci et le message déjà répondu"
else
  ko "16b — rondes : « tout message non accusé appelle son LU MAINTENANT » redevient sans exception (contredit rendre-compte)"
fi
# Défaut de forme lu à chaque naissance : un « ** » fermant collé à la phrase suivante (majuscule) après une
# lettre, un chiffre, « ) » ou « » » — ni « . » ni « ; » ni « : », qui sont la ponctuation légitime.
# Seul le motif précis de « **Répond de** RA-… » est neutralisé, jamais la ligne entière ; on couvre aussi
# les skills et le briefing RONDE.md du gabarit.
FORME=""
for f in "$METIER" "$SK_LD" "$SK_OC" "$GABARIT/RONDE.md"; do
  [ -f "$f" ] || continue
  r="$(sed 's/Répond de\*\* //' "$f" | grep -nE "[a-zàâçéèêëîïôûùü0-9)»]\*\* [A-ZÉÈÀ]" | head -1 | cut -c1-100)"
  [ -n "$r" ] && FORME="$(basename "$f"): $r" && break
done
if [ -z "$FORME" ] && grep -qF "jusqu'à ce que quelqu'un passe.** " "$METIER"; then
  ok "16c — aucun « ** » fermant collé à une majuscule sans ponctuation (métier, deux skills, RONDE.md)"
else
  ko "16c — deux phrases collées (« ** » sans ponctuation avant une majuscule) : $FORME"
fi
# 16f — le briefing RONDE.md (prompt de la /loop) n'impose plus un LU sur le simple merci.
if [ -f "$GABARIT/RONDE.md" ] \
   && grep -qF "accuser réception, en tête, de chaque message reçu qui appelle une réponse (pas un simple merci)." "$GABARIT/RONDE.md" \
   && ! grep -qF "accuser réception de chaque message reçu" "$GABARIT/RONDE.md" \
   && grep -qF "\`LU\` en tête de chaque message reçu qui appelle une réponse, jamais d'un simple merci" "$METIER" \
   && ! grep -qF "LU\` à chaque message reçu" "$METIER"; then
  ok "16f — RONDE.md (gabarit) et reflexes : le LU vaut pour le message qui appelle une réponse, jamais un simple merci"
else
  ko "16f — RONDE.md ou reflexes impose de nouveau un LU sur CHAQUE message reçu, merci compris"
fi
S_VOIS="$(section 'Coordonner les chantiers voisins')"
if printf '%s' "$S_VOIS" | grep -qF "Un compte de torts tenu d'un seul côté — les siens sans ceux de l'autre, ou l'inverse — était **faux**." \
   && ! printf '%s' "$S_VOIS" | grep -qiE "pour se placer moralement|tenu en s'attribuant"; then
  ok "16d — le compte de torts d'un pair : tenu d'un seul côté (les siens sans ceux de l'autre, ou l'inverse), sans mobile non attesté"
else
  ko "16d — le compte de torts n'est plus « tenu d'un seul côté — les siens sans ceux de l'autre, ou l'inverse », ou un mobile non attesté est revenu"
fi

# ── 9e revue : la règle de la ronde redite dans le socle, et le signalement du réveil, portent la même borne.
# Le socle rendu de la ronde vit en tête du chapitre, avant « # R5 » : on l'ancre sur cette tête.
S_R5="$(awk '/^# R5/{exit} {print}' "$GABARIT/metier/chapitres/rondes.md")"
if printf '%s' "$S_R5" | grep -qF "Un tour de ronde qui trouve quelque chose rend un avancement visible ou un NOUVEAU blocage nommé, décision demandée ; un tour vide ne rend rien" \
   && ! printf '%s' "$S_R5" | grep -qF "Chaque tour de ronde rend" \
   && ! printf '%s' "$S_R5" | grep -qiE "ou un arbitrage nommé au CTO"; then
  ok "17a — rondes (socle) : un tour qui trouve quelque chose rend un avancement ou un NOUVEAU blocage, un tour vide ne rend rien"
else
  ko "17a — rondes (socle) : « chaque tour de ronde rend… un arbitrage nommé » est revenu, ou « NOUVEAU blocage » / « un tour vide ne rend rien » a disparu"
fi
S_REVEIL="$(section 'La ronde — ce qui te réveille')"
if printf '%s' "$S_REVEIL" | grep -qF "tu signales qu'il manque (une fois, puis sur un delta de nature ou au plus une fois par heure et par message)"; then
  ok "17b — reflexes : le signalement du réveil manquant est borné (une fois, puis delta de nature ou une fois par heure et par message)"
else
  ko "17b — reflexes : le signalement du réveil manquant n'a plus de borne : il se répète à chaque tour"
fi

echo
if [ "$echecs" -eq 0 ]; then
  echo "✅ $total/$total — le métier prescrit des gestes qui tiennent"
  exit 0
else
  echo "❌ $echecs échec(s) sur $total"
  exit 1
fi
