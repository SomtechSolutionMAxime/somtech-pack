# shellcheck shell=bash
# ============================================================
# classifier.sh — v1.1.0
# Classe la reponse de `applications get_applicable_texts` en TROIS etats,
# jamais deux — T-20260922-0135 (D-20260921-0016 Q2b).
#
# POURQUOI CE FICHIER EXISTE
# La conception initiale du lot supposait qu'aucun support natif n'existait
# pour les "textes applicables" d'une application ServiceDesk, et proposait
# d'en inventer un dans `metadata` (cle libre, non validee). Mesure contre le
# reel : le support existe deja, nativement, valide cote serveur
# (`applications` actions get/set/list_applicable_texts,
# applicable_texts_coverage) et deja peuple pour 11 applications sur 44
# (arbitrage batiscan/T-20260922-0135, 2026-09-22 — la conception initiale du
# ticket est superseded). Le risque de "cle mal nommee" tombe avec elle : le
# champ est structure et valide cote serveur, pas une cle libre. Ce qui reste
# a batir, c'est le CHEF qui lit ce support directement a sa propre naissance
# (Q2 le fait deja, mais en prose, cote ORCHESTRATEUR, colle a la main dans
# chaque brief — ce lot le rend appelable et testable, sans dependre de ce
# copier-coller).
#
# LES TROIS ETATS, ET POURQUOI DEUX NE SUFFISENT PAS :
#   textes-declares (rc=0) — l'appel a reussi, au moins un pointeur existe.
#   aucun-declare   (rc=1) — l'appel a reussi, la liste est vide. LEGITIME :
#                            33 applications sur 44 n'ont simplement rien a
#                            declarer, ce n'est pas une panne.
#   non-mesure      (rc=2) — l'appel a echoue (ServiceDesk injoignable), OU sa
#                            reponse est absente/illisible. Confondre cet etat
#                            avec "aucun-declare" ferait passer une panne pour
#                            un etat normal — c'est le risque que la garde
#                            doit fermer en premier.
#
# 🔴 LA PANNE PRIME TOUJOURS SUR LE CONTENU : meme si un fichier de reponse
# perime traine avec des pointeurs dedans, un appel signale en echec par
# l'appelant (rc_appel != 0) classe en non-mesure sans jamais lire ce fichier
# comme une verite. Un JSON present mais invalide (parse jq en echec) tombe
# dans la meme case — jamais en "aucun-declare" par defaut silencieux.
#
# Lib PURE : ne fait aucun appel MCP elle-meme (elle n'a pas les moyens d'en
# faire depuis un script shell). Le SKILL.md decrit comment le CHEF (qui a,
# lui, acces au MCP `mcp__servicedesk__applications`) appelle
# `get_applicable_texts`, ecrit sa reponse brute dans un fichier JSON, et
# passe ce fichier + son propre code de succes a `tap_classifie`.
#
# Fonctions publiques :
#   tap_classifie <fichier-json> <rc-appel>
#     stdout : le rendu (voir contrat par etat ci-dessus).
#     rc=0 : textes-declares — stdout porte un pointeur par ligne, au format
#            "<text_ref> — <title> (<somcraft_uuid>)". JAMAIS de contenu
#            recopie : les champs libres de la reponse (application_note,
#            version_or_date) ne sont jamais rendus, seule l'IDENTITE du
#            pointeur l'est.
#     rc=1 : aucun-declare — stdout = "aucun texte declare".
#     rc=2 : non-mesure — stdout = "[non mesure]" (appel echoue, fichier
#            absent, ou JSON illisible).
# ============================================================

# tap_classifie <fichier-json> <rc-appel>
tap_classifie() {
  local fichier="${1:?fichier reponse requis}"
  local rc_appel="${2:?code de retour de l appel requis}"

  # UNE SEULE porte, pas trois gardes qui se recouvrent : la panne de
  # l'appelant (rc_appel != 0), un fichier absent, un JSON illisible et une
  # reponse success=false convergent tous ici vers "valide" vide — verifie par
  # mutation (test-mutations-classifier.sh) : chaque garde retiree separement
  # etait deja couverte par celle-ci, donc morte. On ne garde pas une garde
  # qui ne garde rien (cf. memoire "muter ce dont la garde depend").
  #
  # 🔴 CORRECTIF (revue de fond, T-20260922-0135) : la decision et le rendu
  # doivent porter sur le MEME champ, jamais deux lectures independantes. La
  # v1 lisait `.count` pour decider et `.applicable_texts` pour rendre — une
  # reponse avec `count` non nul mais `applicable_texts` absent/null tombait
  # en "textes-declares" (SUCCES) avec un stdout vide, silencieusement, en
  # violation directe de la garantie "la panne prime toujours sur le contenu"
  # ecrite plus haut. Desormais tout — validite, compte, rendu — derive de
  # `.applicable_texts` et RIEN d'autre ; `.count` du serveur n'est jamais lu.
  # 🔴 CORRECTIF (verification independante post-correctif, T-20260922-0135) :
  # un ELEMENT individuel de applicable_texts avec text_ref/title/somcraft_uuid
  # null ou absent se rendait avant silencieusement avec le litteral "null"
  # (rc=0, succes) — un pointeur mal forme cote serveur DOIT faire basculer en
  # non-mesure, pas se glisser dans un rendu qui se pretend fiable.
  local valide=""
  if [ "$rc_appel" -eq 0 ]; then
    valide="$(jq -r 'if .success == true and (.applicable_texts | type) == "array" and (.applicable_texts | all(.text_ref != null and .title != null and .somcraft_uuid != null)) then "ok" else empty end' "$fichier" 2>/dev/null)"
  fi

  if [ "$valide" != "ok" ]; then
    printf '[non mesure]\n'
    return 2
  fi

  local count
  count="$(jq -r '.applicable_texts | length' "$fichier" 2>/dev/null)"
  if ! [[ "$count" =~ ^[0-9]+$ ]]; then
    printf '[non mesure]\n'
    return 2
  fi

  if [ "$count" -eq 0 ]; then
    printf 'aucun texte declare\n'
    return 1
  fi

  local rendu
  rendu="$(jq -r '.applicable_texts[] | "\(.text_ref) — \(.title) (\(.somcraft_uuid))"' "$fichier" 2>/dev/null)"
  if [ $? -ne 0 ]; then
    printf '[non mesure]\n'
    return 2
  fi
  printf '%s\n' "$rendu"
  return 0
}
