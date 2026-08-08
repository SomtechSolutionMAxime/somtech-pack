#!/usr/bin/env python3
"""
migrate-mcp-secrets.py — sort les jetons en clair du fichier de configuration du
poste et les remplace par une variable d'environnement (E-20260807-0009, livrable 3).

CE QU'IL FAIT
  ~/.claude.json déclare des serveurs MCP dont l'en-tête Authorization (ou l'URL)
  porte un jeton EN CLAIR. Ce script :
    1. déplace chaque jeton vers le lieu unique du poste (~/.somtech/mcp-env, 0600) ;
    2. remplace sa valeur par une référence ${VAR} dans ~/.claude.json ;
    3. laisse tout le reste du fichier strictement identique.

POURQUOI C'EST ÉCRIT AVEC AUTANT DE GARDES
  ~/.claude.json est PARTAGÉ et VIVANT : plus de cent projets y sont décrits, et
  toute session Claude Code ouverte peut le réécrire pendant qu'on le modifie.
  Une écriture naïve efface le travail d'une autre session sans que personne ne
  le voie. D'où : empreinte avant/après, écriture atomique, et vérification que
  RIEN d'autre n'a bougé — sinon on annule et on restaure.

CE QU'IL N'IMPRIME JAMAIS
  Une valeur de jeton. Ni en sortie, ni dans un message d'erreur, ni dans le
  résumé. Il ne nomme que des serveurs et des variables.

Usage :
  migrate-mcp-secrets.py                 # inspection seule (défaut) — n'écrit rien
  migrate-mcp-secrets.py --apply         # applique
  migrate-mcp-secrets.py --config <f> --env-file <f>   # points d'injection (tests)
  migrate-mcp-secrets.py --from-env <.env> --apply     # importe aussi les jetons d'un .env de dépôt
  migrate-mcp-secrets.py --from-env <.env> --adopter SOMTECH_DESK_API_KEY --apply
                                                       # arbitrage : cette source fait foi

IMPORTER DEPUIS UN .env DE DÉPÔT (--from-env)
  Un serveur peut ne jamais avoir été déclaré au poste : son jeton vit alors dans
  le .env du dépôt, que seul le lanceur claude-swt sait charger. Les trois autres
  portes de naissance ne le voient pas, et ce serveur-là reste muet. --from-env
  recopie ces valeurs dans le lieu unique — le .env du dépôt n'est jamais modifié,
  et une valeur déjà présente sous un autre contenu n'est jamais écrasée.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile

VAR_REF = re.compile(r"^\s*(?:Bearer\s+)?\$\{[A-Za-z_][A-Za-z0-9_]*\}\s*$")

# Nom de variable par serveur connu. Un serveur inconnu reçoit un nom dérivé de
# son propre nom — jamais un nom inventé qui entrerait en collision.
KNOWN = {
    "servicedesk": "SOMTECH_DESK_API_KEY",
    "somcraft": "SOMCRAFT_MCP_API_KEY",
}


def var_name_for(server: str) -> str:
    if server in KNOWN:
        return KNOWN[server]
    slug = re.sub(r"[^A-Za-z0-9]+", "_", server).strip("_").upper()
    return f"SOMTECH_MCP_{slug}_KEY"


def find_secrets(conf: dict):
    """Repère les jetons en clair. Retourne [(serveur, emplacement, valeur, variable)].

    Deux emplacements possibles, ce sont les deux que Claude Code résout :
      - headers.Authorization  (« Bearer <jeton> »)
      - url                    (« …?key=<jeton> »)
    Une valeur DÉJÀ sous forme ${VAR} n'est pas un secret : on la laisse.
    """
    out = []
    for name, cfg in (conf.get("mcpServers") or {}).items():
        if not isinstance(cfg, dict):
            continue
        auth = (cfg.get("headers") or {}).get("Authorization")
        if isinstance(auth, str) and auth.strip() and not VAR_REF.match(auth):
            out.append((name, "headers.Authorization", auth, var_name_for(name)))
        url = cfg.get("url")
        if isinstance(url, str):
            m = re.search(r"([?&]key=)([^&\s]+)", url)
            if m and not m.group(2).startswith("${"):
                out.append((name, "url:key", m.group(2), var_name_for(name)))
    return out


def token_of(location: str, raw: str) -> str:
    """Extrait le jeton nu de la valeur brute (sans le préfixe Bearer)."""
    return re.sub(r"^\s*Bearer\s+", "", raw).strip() if location.endswith("Authorization") else raw


def load_env_file(path: str) -> dict:
    """Lit le lieu unique. Format shell simple : VAR=valeur, une par ligne."""
    vals = {}
    if not os.path.exists(path):
        return vals
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def write_env_file(path: str, vals: dict) -> None:
    """Écrit le lieu unique en 0600, atomiquement (jamais lisible en 0644, même
    une fraction de seconde : on crée le temporaire avec les bons droits)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".mcp-env.")
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write("# Lieu unique des jetons MCP du poste — somtech-pack.\n")
            fh.write("# Chargé par ~/.somtech/mcp-env.sh, donc par tout shell du poste.\n")
            fh.write("# NE JAMAIS committer. Droits attendus : 600.\n")
            for k in sorted(vals):
                fh.write(f"{k}={vals[k]}\n")
        os.replace(tmp, path)
        os.chmod(path, 0o600)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def skeleton(conf: dict, secrets) -> str:
    """Empreinte de TOUT le fichier SAUF les emplacements qu'on a le droit de
    toucher. Si elle change entre la lecture et l'écriture, une autre session est
    passée — on annule plutôt que d'écraser son travail."""
    clone = json.loads(json.dumps(conf))
    for name, location, _raw, _var in secrets:
        cfg = clone.get("mcpServers", {}).get(name, {})
        if location.endswith("Authorization"):
            cfg.get("headers", {})["Authorization"] = "<NORMALISE>"
        else:
            cfg["url"] = re.sub(r"([?&]key=)([^&\s]+)", r"\1<NORMALISE>", cfg.get("url", ""))
    return hashlib.sha256(
        json.dumps(clone, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=os.path.expanduser("~/.claude.json"))
    ap.add_argument("--env-file", default=os.path.expanduser("~/.somtech/mcp-env"))
    ap.add_argument("--apply", action="store_true", help="applique (sans ce drapeau : inspection seule)")
    ap.add_argument("--from-env", action="append", default=[], metavar="FICHIER",
                    help="importe aussi les jetons de ce .env dans le lieu unique (répétable)")
    ap.add_argument("--adopter", action="append", default=[], metavar="VARIABLE",
                    help="pour CETTE variable, la source --from-env fait foi et remplace "
                         "la valeur en place (répétable ; c'est le geste d'arbitrage)")
    args = ap.parse_args()

    if not os.path.exists(args.config):
        print(f"⛔ configuration introuvable : {args.config}", file=sys.stderr)
        return 1

    with open(args.config, encoding="utf-8") as fh:
        raw_before = fh.read()
    try:
        conf = json.loads(raw_before)
    except json.JSONDecodeError as exc:
        print(f"⛔ {args.config} contient du JSON invalide (ligne {exc.lineno}) — édition refusée.", file=sys.stderr)
        return 1

    # Import préalable depuis les .env de dépôt. Indépendant de la migration de la
    # configuration : un poste peut n'avoir aucun jeton en clair à sortir et
    # pourtant manquer entièrement le jeton d'un serveur déclaré au seul niveau
    # projet — c'est exactement le cas de Somcraft.
    imported = []
    conflicts = []
    adopted = []
    for src in args.from_env:
        if not os.path.exists(src):
            print(f"⚠️  {src} introuvable — ignoré.", file=sys.stderr)
            continue
        incoming = load_env_file(src)
        if not incoming:
            continue
        if not args.apply:
            imported.extend(k for k in incoming)
            continue
        current = load_env_file(args.env_file)
        added = []
        for k, v in incoming.items():
            if k in current and current[k] != v and k in set(args.adopter):
                # Arbitrage explicite : quelqu'un a tranché, en nommant la variable.
                # On ne le fait jamais en gros, jamais par défaut — nommer la variable
                # EST la décision.
                adopted.append(k)
                current[k] = v
                continue
            if k in current and current[k] != v:
                # Deux déclarations vivantes pour la même variable. Choisir à la
                # place de l'humain, c'est risquer de basculer tout le poste sur
                # une clé qu'il s'apprête peut-être à révoquer. On garde celle
                # déjà en place, on nomme le conflit, et on continue : bloquer
                # l'import des AUTRES variables ferait un dommage collatéral —
                # c'est précisément le demi-fix qu'on cherche à éviter.
                conflicts.append((k, src))
                continue
            if k not in current:
                added.append(k)
            current[k] = v
        write_env_file(args.env_file, current)
        imported.extend(added)
    if imported:
        verbe = "importerait" if not args.apply else "importé(s) dans " + args.env_file
        print(f"Jeton(s) {verbe} : {', '.join(sorted(set(imported)))}")
    if adopted:
        print(f"Arbitrage appliqué — la source nommée fait foi pour : {', '.join(sorted(set(adopted)))}")
    if conflicts:
        print("\n⚠️  À TRANCHER — deux déclarations vivantes pour la même variable :", file=sys.stderr)
        for k, src in conflicts:
            print(f"  · {k} : {args.env_file} porte une valeur, {src} en porte une AUTRE.", file=sys.stderr)
        print("  La valeur déjà en place a été CONSERVÉE — rien n'a été écrasé.", file=sys.stderr)
        print("  Pour trancher : relance avec --adopter <VARIABLE> — la source --from-env", file=sys.stderr)
        print("  fera alors foi pour CETTE variable, nommée explicitement.", file=sys.stderr)

    secrets = find_secrets(conf)
    if not secrets:
        if not imported and not conflicts:
            print("✅ aucun jeton en clair dans la configuration du poste — rien à faire.")
        elif not args.apply:
            print("\n(inspection seule — rien n'a été écrit. Relance avec --apply.)")
        return 1 if conflicts else 0

    print(f"Jetons en clair repérés dans {args.config} :")
    for name, location, _raw, var in secrets:
        print(f"  · serveur « {name} » → {location} remplacé par ${{{var}}}")

    if not args.apply:
        print("\n(inspection seule — rien n'a été écrit. Relance avec --apply.)")
        return 0

    # 1. Le lieu unique D'ABORD. Si l'on écrivait la configuration en premier et
    #    que cette étape échouait, le poste se retrouverait avec une référence
    #    ${VAR} vers une variable qui n'existe nulle part : registre mort partout.
    env_vals = load_env_file(args.env_file)
    for name, location, raw, var in secrets:
        tok = token_of(location, raw)
        existing = env_vals.get(var)
        if existing and existing != tok:
            print(
                f"⛔ {var} existe déjà dans {args.env_file} avec une AUTRE valeur "
                f"(serveur « {name} »). Deux jetons se disputent la même variable — "
                "tranche à la main, je n'écrase pas.",
                file=sys.stderr,
            )
            return 1
        env_vals[var] = tok
    write_env_file(args.env_file, env_vals)
    print(f"→ jetons déposés dans {args.env_file} (droits 600)")

    # 2. Relire la configuration : une session a pu la réécrire pendant qu'on
    #    travaillait. On compare le squelette, pas l'octet — les compteurs de
    #    session (coûts, durées) bougent légitimement en permanence.
    with open(args.config, encoding="utf-8") as fh:
        raw_now = fh.read()
    try:
        conf_now = json.loads(raw_now)
    except json.JSONDecodeError:
        print("⛔ la configuration est devenue illisible entre-temps — abandon, rien réécrit.", file=sys.stderr)
        return 1
    secrets_now = find_secrets(conf_now)
    if {(n, l) for n, l, _, _ in secrets_now} != {(n, l) for n, l, _, _ in secrets}:
        print(
            "⛔ les serveurs déclarés ont changé pendant l'opération (une autre "
            "session est passée) — abandon, la configuration n'a pas été touchée.",
            file=sys.stderr,
        )
        return 1

    # Référence de comparaison : l'état RELU, pas l'état lu au démarrage. Entre
    # les deux, une autre session a pu écrire ses compteurs de coût/durée — c'est
    # légitime, et le lui reprocher ferait échouer la migration sans raison.
    before_skeleton = skeleton(conf_now, secrets_now)

    # 3. Construire la nouvelle configuration EN MÉMOIRE, et la vérifier AVANT
    #    d'écrire quoi que ce soit.
    #
    #    Vérifier après coup obligerait, en cas d'écart, à restaurer une sauvegarde
    #    — et si une session tierce a écrit entre-temps, cette restauration
    #    effacerait SON travail pour réparer le nôtre. On ne se met pas dans cette
    #    position : ce qui est faux n'est jamais écrit.
    conf_new = json.loads(json.dumps(conf_now))
    for name, location, raw, var in secrets_now:
        cfg = conf_new["mcpServers"][name]
        if location.endswith("Authorization"):
            cfg["headers"]["Authorization"] = f"Bearer ${{{var}}}"
        else:
            cfg["url"] = re.sub(r"([?&]key=)([^&\s]+)", rf"\1${{{var}}}", cfg["url"])

    # Second point d'injection RÉSERVÉ AUX TESTS : abîme volontairement la
    # configuration reconstruite, pour que la garde ci-dessous ait quelque chose
    # à attraper. Sans lui, cette garde ne serait jamais mise à l'épreuve — et la
    # revue de fond a montré qu'on pouvait la retirer sans qu'un seul test bronche.
    if os.environ.get("SOMTECH_MIGRATE_TEST_ABIME"):
        conf_new.pop("projects", None)

    if find_secrets(conf_new):
        print("⛔ un jeton en clair subsisterait après réécriture — rien n'a été écrit.", file=sys.stderr)
        return 1
    if skeleton(conf_new, secrets_now) != before_skeleton:
        print("⛔ la réécriture toucherait autre chose que les emplacements attendus "
              "— rien n'a été écrit.", file=sys.stderr)
        return 1

    # Sauvegarde, puis écriture ATOMIQUE (temporaire dans le MÊME dossier puis
    # renommage) : jamais de fenêtre où le fichier est tronqué ou à moitié écrit.
    backup = f"{args.config}.somtech.bak"
    shutil.copy2(args.config, backup)
    print(f"→ sauvegarde : {backup}")

    # Point d'injection RÉSERVÉ AUX TESTS : simule une session tierce qui écrit
    # juste avant notre bascule. Sans lui, la garde ci-dessous ne serait jamais
    # mise à l'épreuve — et une garde qu'aucun test ne fait mordre n'est pas une
    # garde, c'est un commentaire (constat de la revue de fond).
    hook = os.environ.get("SOMTECH_MIGRATE_TEST_HOOK")
    if hook:
        os.system(hook)

    # DERNIÈRE VÉRIFICATION, au plus près de la bascule. Notre édition est fondée
    # sur les octets lus plus haut ; si le fichier a changé depuis, une session
    # tierce a écrit et notre écriture l'effacerait — sans que ça se voie, et sans
    # que la sauvegarde (prise avant son écriture) permette de la récupérer.
    # On préfère ne rien faire : le jeton en clair reste une seconde de plus,
    # le travail de l'autre session est intact, et on peut relancer.
    with open(args.config, encoding="utf-8") as fh:
        raw_juste_avant = fh.read()
    if raw_juste_avant != raw_now:
        print("⛔ la configuration a été réécrite par une autre session pendant "
              "l'opération — abandon avant écriture, rien n'a été touché. Relance.",
              file=sys.stderr)
        return 1

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(args.config) or ".", prefix=".claude.json.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(conf_new, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp, args.config)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise

    # 4. Relire ce qu'on vient d'écrire — le disque a le dernier mot. On ne
    #    restaure PAS ici : à ce stade, un écart signifie qu'une autre session a
    #    déjà réécrit le fichier, et lui rendre notre version effacerait son
    #    travail. On le dit, et on laisse l'humain trancher avec la sauvegarde
    #    sous la main.
    try:
        with open(args.config, encoding="utf-8") as fh:
            conf_after = json.load(fh)
    except json.JSONDecodeError:
        print(f"⚠️  la configuration relue est illisible. Sauvegarde intacte : {backup}", file=sys.stderr)
        return 1
    if find_secrets(conf_after):
        print(f"⚠️  un jeton en clair subsiste à la relecture — une autre session a "
              f"probablement réécrit le fichier. Sauvegarde : {backup}", file=sys.stderr)
        return 1

    n_projects = len(conf_after.get("projects") or {})
    print(f"✅ configuration réécrite : {len(secrets_now)} jeton(s) sorti(s), "
          f"{n_projects} projets intacts (vérifié après relecture).")
    print("↻ ouvre une NOUVELLE session — les serveurs MCP se connectent au démarrage.")
    return 1 if conflicts else 0


if __name__ == "__main__":
    sys.exit(main())
