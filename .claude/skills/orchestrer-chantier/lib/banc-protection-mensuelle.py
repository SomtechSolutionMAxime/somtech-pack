#!/usr/bin/env python3
# ============================================================
# banc-protection-mensuelle.py — v1.0.0
# Compagnon python de banc-protection-mensuelle.sh (T-20260922-0106,
# garde 5/5 du lot 4, D-20260921-0017). Même parti pris que
# secret-key-scan.py / staging-secret-key-gate.sh (règle d'or n°15) :
# le .sh valide les entrées et gate le cas SOURCE_CASSEE / corpus
# illisible, CE fichier fait la mesure elle-même une fois les deux
# conditions ci-dessus écartées.
#
# CE QUE CE FICHIER NE FAIT PAS
#   • Aucun appel réseau — seul `git log` LOCAL est invoqué (sous-processus,
#     jamais un fetch/pull), pour dater le texte qui contredit une règle.
#   • Il ne répare rien : il classe protege|prose|contredit|non_etabli.
#   • Pour les regles SANS mecanisme_connu ni contredit_par déclaré dans le
#     corpus (la majorité — voir corpus-adr-std.json), il applique une
#     heuristique GÉNÉRIQUE (citations = citations_attendues ou, à défaut,
#     l'id nu ; protege seulement si une citation est trouvée à la fois
#     dans un fichier de code lib/hooks ET dans un fichier de test) —
#     ces classements-là ne sont PAS audités (voir corpus, champ
#     verifie_a_la_main=false) et ne comptent dans AUCUN chiffre
#     d'exactitude produit par les bancs de ce lot.
#
# LIMITE CONNUE — heuristique de citation, pas d'analyse sémantique. Un id
# ou un extrait de phrase peut apparaître dans un fichier sans rapport
# (faux positif), ou une paraphrase peut échapper à la recherche littérale
# (faux négatif) — documenté, pas corrigé : resserrer l'heuristique sans
# jeu de données plus large risquerait d'introduire d'autres biais.
#
# Usage : appelé par banc-protection-mensuelle.sh, jamais directement en
# production (mais exécutable seul pour debug — voir __main__).
# ============================================================
import json
import os
import re
import subprocess
import sys
import unicodedata

WITNESS_IDS = ["STD-038", "STD-030-MERGE", "STD-029", "GF-ORC-013"]

# Répertoires de recherche pour l'heuristique générique (documenté dans le
# ticket : ".claude/, scripts/" — jamais tout le dépôt).
SEARCH_SUBDIRS = [".claude", "scripts"]

CODE_HIT_RE = re.compile(r"/(lib|hooks)/[^/]*\.(sh|py)$")
TEST_HIT_RE = re.compile(r"(^|/)test[^/]*\.sh$")


def normaliser(texte):
    """Repli casse + accents, pour une comparaison littérale insensible aux
    deux (même esprit que vbc_normaliser_recherche, ré-implémenté ici en
    python plutôt que sourcé — ce fichier ne dépend d'aucun autre script)."""
    if texte is None:
        return ""
    nfkd = unicodedata.normalize("NFKD", texte)
    sans_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return sans_accents.lower()


def lister_fichiers(racine, exclus=(), dossiers_exclus=()):
    """Tous les fichiers texte sous racine/.claude et racine/scripts, triés
    (déterminisme garanti indépendamment de l'ordre de retour de l'OS).

    `exclus` : chemins absolus de FICHIERS précis à ne jamais compter comme
    citation (le corpus figé passé en argument, un état précédent/de sortie
    précis). `dossiers_exclus` : chemins absolus de DOSSIERS entiers à
    exclure, quel que soit leur contenu au moment de l'appel.

    LE DÉFAUT QUE CES DEUX EXCLUSIONS FERMENT — trouvé et corrigé par le
    chef d'équipe avant fusion, sur le premier passage réel (58/67 `prose`,
    beaucoup trop haut face aux 44 « absent » de l'analyse du 21 sept sur
    le même périmètre) : le corpus figé et les fichiers d'état vivent SOUS
    scripts/ et .claude/ (les répertoires scannés) et énumèrent chaque id
    ADR/STD en clair. Exclure seulement le fichier exact passé en argv ne
    suffit pas — un état LAISSÉ SUR DISQUE d'un passage antérieur (jamais
    référencé par l'appel courant) reste dans l'arbre scanné et pollue
    quand même. D'où `dossiers_exclus` : le dossier `etat/` du banc et le
    dossier des fixtures du corpus sont exclus EN BLOC, pas au cas par cas."""
    exclus_abs = {os.path.realpath(p) for p in exclus if p}
    dossiers_abs = [os.path.realpath(d) for d in dossiers_exclus if d]

    def _sous_dossier_exclu(chemin_abs):
        return any(
            chemin_abs == d or chemin_abs.startswith(d + os.sep)
            for d in dossiers_abs
        )

    fichiers = []
    for sous_dir in SEARCH_SUBDIRS:
        base = os.path.join(racine, sous_dir)
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__")]
            for fn in filenames:
                chemin = os.path.join(dirpath, fn)
                chemin_reel = os.path.realpath(chemin)
                if chemin_reel in exclus_abs or _sous_dossier_exclu(chemin_reel):
                    continue
                fichiers.append(chemin)
    return sorted(fichiers)


def grep_repo(racine, citations, fichiers_cache):
    """Retourne la liste triée des fichiers (chemins relatifs à racine) qui
    contiennent AU MOINS UNE des citations (comparaison normalisée,
    substring literal — pas de regex sur l'entrée utilisateur)."""
    citations_norm = [normaliser(c) for c in citations if c]
    if not citations_norm:
        return []
    trouves = []
    for chemin_abs in fichiers_cache:
        try:
            with open(chemin_abs, "r", encoding="utf-8", errors="ignore") as f:
                contenu = normaliser(f.read())
        except OSError:
            continue
        if any(c in contenu for c in citations_norm):
            rel = os.path.relpath(chemin_abs, racine)
            trouves.append(rel)
    return sorted(trouves)


def grep_fichier(racine, chemin_relatif, citations):
    """Vrai si au moins une citation (normalisée) apparaît dans CE fichier
    précis (utilisé pour les contradictions — la citation doit être dans le
    texte qui contredit, pas n'importe où dans le dépôt)."""
    chemin_abs = os.path.join(racine, chemin_relatif)
    if not os.path.isfile(chemin_abs):
        return False
    try:
        with open(chemin_abs, "r", encoding="utf-8", errors="ignore") as f:
            contenu = normaliser(f.read())
    except OSError:
        return False
    return any(normaliser(c) in contenu for c in citations if c)


def date_git_dernier_commit(racine, chemin_relatif):
    """Date (ISO 8601) du dernier commit git touchant ce fichier — la
    convention documentée : la date du texte CONTREDISANT n'est jamais figée
    dans le JSON, elle se mesure au moment de l'exécution. [non mesure] si
    git est indisponible, le fichier n'est pas suivi, ou hors dépôt git."""
    try:
        out = subprocess.run(
            ["git", "-C", racine, "log", "-1", "--format=%cI", "--", chemin_relatif],
            capture_output=True, text=True, timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return "[non mesure] (git indisponible)"
    if out.returncode != 0:
        return "[non mesure] (git log en echec)"
    date = out.stdout.strip()
    return date if date else "[non mesure] (aucun commit trouve pour ce fichier)"


def classer_entree(entree, racine, fichiers_cache):
    """Rend (classe, mecanisme_cite|None, date_a|None, date_b|None,
    detail_note). classe in {protege, prose, contredit, non_etabli}."""
    contredit_par = entree.get("contredit_par")
    mecanisme_connu = entree.get("mecanisme_connu")
    citations = entree.get("citations_attendues") or [entree["id"]]

    # Les contradictions sont prioritaires — un mecanisme_connu et un
    # contredit_par ne cohabitent jamais dans ce corpus (voir en-tête du
    # corpus), mais si un futur ajout les combinait, la contradiction (le
    # signal le plus grave) prime.
    if contredit_par:
        fichier = contredit_par.get("fichier", "")
        if not os.path.isfile(os.path.join(racine, fichier)):
            return ("non_etabli", None, None, None,
                    "le texte contredisant vit hors de ce depot, non verifiable par ce banc")
        if grep_fichier(racine, fichier, citations):
            date_a = entree.get("date_source") or "[non mesure] (date_source absente de la source ADR/STD)"
            date_b = date_git_dernier_commit(racine, fichier)
            return ("contredit", fichier, date_a, date_b, None)
        return ("non_etabli", None, None, None,
                f"fichier {fichier} present mais aucune des citations attendues n'y a ete trouvee")

    if mecanisme_connu:
        chemin = mecanisme_connu.get("chemin", "")
        banc = mecanisme_connu.get("banc", "")
        chemin_ok = os.path.isfile(os.path.join(racine, chemin))
        banc_ok = os.path.isfile(os.path.join(racine, banc))
        # DÉFAUT TROUVÉ EN REVUE DE FOND, CORRIGÉ ICI — la citation doit être
        # trouvée DANS le mécanisme ou son banc, PAS n'importe où dans le
        # dépôt scanné. `grep_repo` (ci-dessous, `hits`) sert seulement au
        # repli prose/non_etabli, jamais à décider `protege` : sans cette
        # distinction, un mécanisme VIDÉ DE SON CONTENU (fichier gardé, logique
        # retirée) continuait de rendre `protege` tant que la chaîne cherchée
        # traînait ailleurs dans le dépôt (ex. "service_role" cité dans un
        # SKILL.md ou un prompt d'audit, sans rapport avec le gate réel) —
        # exactement le défaut de silence que ce ticket existe pour détecter.
        cite_dans_mecanisme = (chemin_ok and grep_fichier(racine, chemin, citations)) or (
            banc_ok and grep_fichier(racine, banc, citations)
        )
        hits = grep_repo(racine, citations, fichiers_cache)
        if chemin_ok and banc_ok and cite_dans_mecanisme:
            return ("protege", chemin, None, None, None)
        if hits:
            manque = []
            if not chemin_ok:
                manque.append(f"mecanisme absent du disque: {chemin}")
            if not banc_ok:
                manque.append(f"banc absent du disque: {banc}")
            return ("prose", None, None, None, "; ".join(manque) if manque else "citation trouvee, mecanisme incomplet")
        return ("non_etabli", None, None, None, "aucune citation attendue trouvee dans le depot")

    # Heuristique générique — entrées non auditées (verifie_a_la_main=false).
    hits = grep_repo(racine, citations, fichiers_cache)
    if not hits:
        return ("non_etabli", None, None, None, None)
    code_hits = [h for h in hits if CODE_HIT_RE.search(h)]
    test_hits = [h for h in hits if TEST_HIT_RE.search(os.path.basename(h)) or TEST_HIT_RE.search(h)]
    if code_hits and test_hits:
        return ("protege", code_hits[0], None, None, None)
    return ("prose", None, None, None, None)


def sanitiser_cle(id_regle):
    return re.sub(r"[^A-Za-z0-9]", "_", id_regle).upper()


def main():
    if len(sys.argv) != 5:
        print("usage: banc-protection-mensuelle.py <corpus.json> <racine> <etat_precedent|-> <etat_sortie|->",
              file=sys.stderr)
        return 3

    corpus_path, racine, etat_precedent_path, etat_sortie_path = sys.argv[1:5]

    with open(corpus_path, "r", encoding="utf-8") as f:
        corpus = json.load(f)
    # Un JSON syntaxiquement valide mais sans schéma correct (ex. `{}`) ne
    # doit pas planter par KeyError non documenté (traceback = bruyant, mais
    # HORS du contrat de codes de retour du .sh, qui promet un rc=3 propre
    # pour tout corpus invalide) — trouvé en revue de fond, corrigé ici.
    entries = corpus.get("entries") if isinstance(corpus, dict) else None
    if not isinstance(entries, list):
        print("bpm: ERREUR — corpus invalide: cle 'entries' absente ou n'est pas une liste.", file=sys.stderr)
        return 3

    # Le corpus figé et les fichiers d'état énumèrent chaque id en clair —
    # jamais des citations valides du métier/des kits (voir lister_fichiers).
    # Les chemins reçus en argv sont relatifs au répertoire courant du
    # processus (convention shell normale), PAS forcément à `racine` :
    # résolus avec abspath (donc contre le CWD), jamais recomposés à la main.
    # Le banc lui-même (ce .py et son .sh compagnon) documente ses ids en
    # commentaire (ex. le motif de ce correctif) — sans son exclusion, CE
    # correctif recrée le défaut qu'il corrige, un cran plus loin.
    #
    # ⚠️ Ancré sur `racine` (l'argument CLI), JAMAIS sur `__file__` — trouvé
    # en revue de fond : le banc de mutation copie ce script dans un tmpdir
    # et l'exécute de LÀ (`BPM_PY=<copie tmp>`) pour éprouver chaque
    # variante ; `__file__` y vaudrait le chemin de la copie, pas celui du
    # dépôt réel, et l'exclusion du dossier `etat/` ÉCHOUERAIT SILENCIEUSEMENT
    # pour CETTE RAISON SEULE — un faux rouge sans rapport avec la mutation
    # testée, qui aurait rendu TOUTE mutation "tuée" à tort (le banc de
    # mutation aurait mesuré un artefact de son propre montage, pas la
    # mutation). `racine` est fourni par l'appelant à chaque exécution,
    # réelle ou sous mutation : lui seul est fiable ici.
    ici = os.path.join(racine, ".claude", "skills", "orchestrer-chantier", "lib")
    exclus = [
        os.path.abspath(corpus_path),
        os.path.join(ici, "banc-protection-mensuelle.py"),
        os.path.join(ici, "banc-protection-mensuelle.sh"),
    ]
    if etat_precedent_path and etat_precedent_path != "-":
        exclus.append(os.path.abspath(etat_precedent_path))
    if etat_sortie_path and etat_sortie_path != "-":
        exclus.append(os.path.abspath(etat_sortie_path))
    # Les 3 bancs de CE lot énumèrent aussi les 4 ids témoins en clair (pour
    # leurs propres assertions) — trouvé en revue de fond : sans leur
    # exclusion, une partie du signal "protege" des témoins peut venir du
    # banc de test lui-même plutôt que du mécanisme réel, affaiblissant
    # l'indépendance de la mesure (même si, au moment de ce commit, les 4
    # mécanismes réels sont de toute façon protégés par ailleurs).
    exclus += [
        os.path.join(racine, "scripts", "tests", "test-banc-protection-mensuelle.sh"),
        os.path.join(racine, "scripts", "tests", "test-banc-protection-mensuelle-corpus.sh"),
        os.path.join(racine, "scripts", "tests", "test-mutations-banc-protection-mensuelle.sh"),
    ]
    # Dossiers réservés au banc lui-même, exclus EN BLOC (voir lister_fichiers) :
    # le dossier d'état à côté de ce script, et le dossier des fixtures du
    # corpus figé de ce lot (chemin conventionnel, pas déduit de corpus_path —
    # un futur corpus pourrait vivre ailleurs sans que ce dossier-ci cesse
    # d'exister avec du contenu périmé).
    dossiers_exclus = [
        os.path.join(ici, "etat"),
        os.path.join(racine, "scripts", "tests", "fixtures", "corpus-protection-lot4"),
    ]
    fichiers_cache = lister_fichiers(racine, exclus=exclus, dossiers_exclus=dossiers_exclus)

    classement = {}
    lignes = []
    for entree in entries:
        rid = entree["id"]
        classe, mecanisme, date_a, date_b, _detail = classer_entree(entree, racine, fichiers_cache)
        classement[rid] = classe
        cle = sanitiser_cle(rid)
        lignes.append(f"REGLE_{cle}_CLASSE={classe}")
        if classe == "protege" and mecanisme:
            lignes.append(f"REGLE_{cle}_MECANISME={mecanisme}")
        if classe == "contredit":
            lignes.append(f"REGLE_{cle}_DATE_A={date_a}")
            lignes.append(f"REGLE_{cle}_DATE_B={date_b}")

    # ---- Témoin positif ----
    manquants = []
    for wid in WITNESS_IDS:
        if wid not in classement:
            manquants.append(f"{wid} absent du corpus")
        elif classement[wid] != "protege":
            manquants.append(f"{wid} classe {classement[wid]} (attendu protege)")
    if manquants:
        lignes.append("TEMOIN_POSITIF=ECHEC")
        lignes.append("TEMOIN_POSITIF_DETAIL=" + " ; ".join(manquants))
    else:
        lignes.append("TEMOIN_POSITIF=OK")

    # ---- Écart avec le passage précédent ----
    if etat_precedent_path == "-" or not etat_precedent_path:
        lignes.append("ECART_PRECEDENT=PREMIER_PASSAGE")
    elif not os.path.isfile(etat_precedent_path):
        lignes.append("ECART_PRECEDENT=PREMIER_PASSAGE (etat precedent introuvable: " + etat_precedent_path + ")")
    else:
        try:
            with open(etat_precedent_path, "r", encoding="utf-8") as f:
                precedent = json.load(f)
        except (OSError, json.JSONDecodeError):
            lignes.append("ECART_PRECEDENT=PREMIER_PASSAGE (etat precedent illisible: " + etat_precedent_path + ")")
        else:
            ecarts = []
            for rid in sorted(classement.keys()):
                ancien = precedent.get(rid)
                nouveau = classement[rid]
                if ancien is not None and ancien != nouveau:
                    ecarts.append(f"{rid}:{ancien}->{nouveau}")
            lignes.append("ECART_PRECEDENT=" + (",".join(ecarts) if ecarts else "AUCUN"))

    lignes.append("VERDICT_GLOBAL=OK")

    print("\n".join(lignes))

    if etat_sortie_path and etat_sortie_path != "-":
        with open(etat_sortie_path, "w", encoding="utf-8") as f:
            json.dump(classement, f, ensure_ascii=False, indent=2, sort_keys=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
