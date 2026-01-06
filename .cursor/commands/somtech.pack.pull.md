Met à jour le projet courant depuis `somtech-pack`.

## Usage

- Mettre à jour depuis `main` :
  - `./scripts/somtech_pack_pull.sh --target .`

- Mettre à jour depuis un tag :
  - `./scripts/somtech_pack_pull.sh --target . --ref v0.1.0`

- Voir ce qui va changer (dry-run) :
  - `./scripts/somtech_pack_pull.sh --target . --dry-run`

## Notes

- Par défaut, c’est un **full-pack** (mise à jour `.cursor/`, `docs/`, `scripts/`, `README.md`).
- Le script s’appuie sur `scripts/install_somtech_pack.sh` (backup automatique des fichiers écrasés).
