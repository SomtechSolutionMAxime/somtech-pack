#!/bin/bash
# ============================================================
# install_user_skills.sh
# Installe les skills globaux Somtech dans ~/.claude/skills/
# Usage: ./scripts/install_user_skills.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
USER_SKILLS_SRC="$PACK_ROOT/.claude/user-skills"
USER_SKILLS_DST="$HOME/.claude/skills"

echo "🔧 Installation des skills globaux Somtech"
echo "   Source : $USER_SKILLS_SRC"
echo "   Destination : $USER_SKILLS_DST"
echo ""

if [ ! -d "$USER_SKILLS_SRC" ]; then
  echo "❌ Dossier source introuvable : $USER_SKILLS_SRC"
  exit 1
fi

mkdir -p "$USER_SKILLS_DST"

count=0
for skill_dir in "$USER_SKILLS_SRC"/*/; do
  skill_name=$(basename "$skill_dir")
  dest="$USER_SKILLS_DST/$skill_name"

  if [ -d "$dest" ]; then
    echo "  ♻️  $skill_name — mise à jour"
  else
    echo "  ✅ $skill_name — installation"
  fi

  mkdir -p "$dest"
  cp -f "$skill_dir/SKILL.md" "$dest/SKILL.md"
  count=$((count + 1))
done

echo ""
echo "✅ $count skill(s) installé(s) dans $USER_SKILLS_DST"
echo ""
echo "Claude Code chargera ces skills automatiquement dans tous tes projets."
