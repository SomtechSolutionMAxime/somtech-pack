#!/usr/bin/env python3
"""Récolteur — config de déploiement → grain topologie (racine + depends_on).

Modèle vivant Somtech (STD-031 §2.7.7, I16). Lit la config d'infra d'un repo
(fly.toml, netlify.toml, .mcp.json, .env.example) et émet un manifeste RÉCOLTÉ :
l'élément racine (le service/webapp) + ses dépendances SORTANTES vers des systèmes
externes CONNUS (registre de la couche curée somtech.c4). Lecture seule.

Ne mappe QUE les externes de l'enum canonique (schema/architecture-manifest.schema.json,
externalId). Un fournisseur détecté hors enum est SIGNALÉ (stderr) — jamais inventé
en dépendance (il faudrait d'abord l'ajouter au registre côté Architecture).

⚠️ RÈGLE 7 : exécuter DEPUIS le repo applicatif cible. Aucune règle métier extraite (I17).

Usage :
  python3 harvest-config.py <racine_repo> --app <slug> [options]
  options : --root-kind service|webapp (défaut service) · --root-name "<nom>"
            --out architecture.yaml (défaut: stdout)
"""
import argparse
import json
import os
import re
import sys

# Externes CONNUS (doit rester aligné sur schema/architecture-manifest.schema.json → externalId).
KNOWN_EXTERNALS = {
    "anthropic", "cohere", "do_tor1", "flyio", "github",
    "slack", "netlify", "assemblyai", "mapbox", "microsoft_graph",
}

# Signatures de FOURNISSEURS (API/services consommés) → externe connu. Ordre = spécifique
# d'abord. NE contient PAS les externes d'HÉBERGEMENT (flyio, netlify) : ceux-là ne se
# déduisent QUE de la présence d'un fichier de déploiement (F2). Une app qui APPELLE un
# MCP hébergé sur Netlify (ex. ServiceDesk) ne déploie pas pour autant sur Netlify.
PROVIDER_SIGNATURES = [
    (re.compile(r"api\.anthropic\.com|anthropic", re.I), "anthropic"),
    (re.compile(r"api\.cohere\.(com|ai)|\bcohere\b", re.I), "cohere"),
    (re.compile(r"graph\.microsoft\.com|microsoft[_-]?graph|ms[_-]?graph", re.I), "microsoft_graph"),
    (re.compile(r"api\.assemblyai\.com|assemblyai", re.I), "assemblyai"),
    (re.compile(r"api\.mapbox\.com|mapbox", re.I), "mapbox"),
    (re.compile(r"slack\.com|slack", re.I), "slack"),
    (re.compile(r"api\.github\.com|github\.com|\bgithub\b", re.I), "github"),
]

# Noms de variables d'env / secrets → externe connu (fournisseurs uniquement, pas d'hébergement).
ENVVAR_SIGNATURES = [
    (re.compile(r"ANTHROPIC", re.I), "anthropic"),
    (re.compile(r"COHERE", re.I), "cohere"),
    (re.compile(r"ASSEMBLYAI|ASSEMBLY_AI", re.I), "assemblyai"),
    (re.compile(r"MAPBOX", re.I), "mapbox"),
    (re.compile(r"MICROSOFT_GRAPH|MS_GRAPH|GRAPH_(CLIENT|TENANT)", re.I), "microsoft_graph"),
    (re.compile(r"SLACK", re.I), "slack"),
    (re.compile(r"GITHUB|\bGH_", re.I), "github"),
    (re.compile(r"DIGITALOCEAN|\bDO_SPACES|SPACES_(KEY|SECRET)|TOR1", re.I), "do_tor1"),
]

# Fournisseurs hors registre qu'on VEUT signaler (pas inventer).
UNREGISTERED_HINTS = [
    (re.compile(r"supabase", re.I), "supabase"),
    (re.compile(r"openai", re.I), "openai"),
    (re.compile(r"stripe", re.I), "stripe"),
    (re.compile(r"railway", re.I), "railway"),
    (re.compile(r"cloudrun|run\.googleapis", re.I), "google_cloud_run"),
]


def read_text(path):
    try:
        return open(path, encoding="utf-8", errors="ignore").read()
    except OSError:
        return ""


def detect_fly(root):
    """(present, app_name, runtime_hint)."""
    fly = os.path.join(root, "fly.toml")
    if not os.path.isfile(fly):
        return False, None, None
    txt = read_text(fly)
    m = re.search(r"^\s*app\s*=\s*[\"']([^\"']+)[\"']", txt, re.M)
    runtime = None
    if re.search(r"dockerfile|Dockerfile", txt):
        runtime = "Docker (Fly.io)"
    else:
        runtime = "Fly.io"
    return True, (m.group(1) if m else None), runtime


def scan_signatures(text, found, reported):
    """Scanne un contenu pour des FOURNISSEURS connus (jamais d'hébergement — F2)."""
    for rx, ext in PROVIDER_SIGNATURES:
        if rx.search(text):
            found.add(ext)
    for rx, name in UNREGISTERED_HINTS:
        if rx.search(text):
            reported.add(name)


def harvest(root):
    found = set()          # externes connus (→ depends_on)
    reported = set()       # fournisseurs hors registre (→ signalés)
    runtime = None

    # fly.toml
    fly_present, _fly_app, fly_runtime = detect_fly(root)
    if fly_present:
        found.add("flyio")
        runtime = fly_runtime
        scan_signatures(read_text(os.path.join(root, "fly.toml")), found, reported)

    # netlify.toml
    if os.path.isfile(os.path.join(root, "netlify.toml")):
        found.add("netlify")
        runtime = runtime or "Netlify"

    # .mcp.json — serveurs MCP consommés
    mcp_path = os.path.join(root, ".mcp.json")
    if os.path.isfile(mcp_path):
        raw = read_text(mcp_path)
        scan_signatures(raw, found, reported)
        try:
            data = json.loads(raw)
            for name, cfg in (data.get("mcpServers") or {}).items():
                blob = name + " " + json.dumps(cfg)
                scan_signatures(blob, found, reported)
        except (json.JSONDecodeError, AttributeError):
            pass

    # env d'exemple (committé) — noms de variables seulement
    for env_name in (".env.example", ".env.sample", ".env.template"):
        env_path = os.path.join(root, env_name)
        if os.path.isfile(env_path):
            for line in read_text(env_path).splitlines():
                key = line.split("=", 1)[0].strip()
                if not key or key.startswith("#"):
                    continue
                for rx, ext in ENVVAR_SIGNATURES:
                    if rx.search(key):
                        found.add(ext)
                for rx, name in UNREGISTERED_HINTS:
                    if rx.search(key):
                        reported.add(name)

    # package.json — indice de runtime (Next.js / Express)
    pkg = os.path.join(root, "package.json")
    if os.path.isfile(pkg):
        try:
            deps = json.loads(read_text(pkg))
            alldeps = {**(deps.get("dependencies") or {}), **(deps.get("devDependencies") or {})}
            if "next" in alldeps:
                runtime = runtime or "Next.js"
            elif "express" in alldeps:
                runtime = runtime or "Express"
        except (json.JSONDecodeError, AttributeError):
            pass

    found &= KNOWN_EXTERNALS
    return sorted(found), runtime, sorted(reported)


def emit_yaml(app, root_kind, root_name, runtime, externals):
    L = [
        "# RÉCOLTÉ — ne pas éditer (source : config d'infra). STD-031 §2.7.7 / I16.",
        "# Régénéré par scripts/archi-ci/harvest-config.py. Modifier la CONFIG, pas ce fichier.",
        f"app: {app}",
        "elements:",
        f"  - id: {app}",
        f"    kind: {root_kind}",
        f"    name: {root_name}",
    ]
    if runtime:
        L.append(f"    technology: {runtime}")
    L.append("    audience: internal")
    if externals:
        L.append("depends_on:")
        for ext in externals:
            L += [f"  - from: {app}", f"    to: {ext}", "    label: dépend de"]
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("root", nargs="?", default=".", help="Racine du repo à scanner (défaut: .)")
    ap.add_argument("--app", required=True, help="Slug ServiceDesk (racine de namespace)")
    ap.add_argument("--root-kind", default="service", choices=["service", "webapp", "system"])
    ap.add_argument("--root-name", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    root = args.root
    if not os.path.isdir(root):
        print(f"❌ Racine introuvable : {root}", file=sys.stderr)
        sys.exit(1)

    externals, runtime, reported = harvest(root)

    if reported:
        print(f"ℹ️  Fournisseurs détectés HORS registre (non ajoutés — étendre externalId "
              f"côté Architecture si pertinent) : {', '.join(reported)}", file=sys.stderr)
    if not externals and not runtime:
        print("⚠️  Aucune config d'infra reconnue (fly.toml/netlify.toml/.mcp.json/.env.example). "
              "Grain topologie non vérifié.", file=sys.stderr)

    yaml_out = emit_yaml(args.app, args.root_kind, args.root_name or args.app, runtime, externals)
    if args.out:
        with open(args.out, "w") as f:
            f.write(yaml_out)
        print(f"✅ Récolté racine ({runtime or 'runtime inconnu'}) + {len(externals)} "
              f"dépendance(s) externe(s) → {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(yaml_out)


if __name__ == "__main__":
    main()
