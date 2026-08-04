#!/usr/bin/env python3
"""Émission YAML sans dépendance — commun aux récolteurs.

Les récolteurs écrivent leur YAML à la main pour tourner partout sans `pip install`
(cf. scripts/archi-ci/README.md). Depuis qu'ils émettent des `description:` récoltées
dans le code et les commentaires SQL, ce texte est arbitraire : il contient des `:`, des
apostrophes, des `#`, parfois un saut de ligne. Concaténé tel quel, il casse le document
ou, pire, le rend valide mais faux. D'où ce point de passage unique.
"""
import re

_NEEDS_QUOTE = re.compile(
    r"^[-?:,\[\]{}#&*!|>'\"%@`]"      # premier caractère significatif en YAML
    r"|[:#]\s|\s#"                     # séparateur clé/valeur ou commentaire en cours de ligne
    r"|^\s|\s$"                        # espaces de bord (perdus sinon)
    r"|^(true|false|null|yes|no|on|off|~)$"   # scalaires typés malgré nous
    r"|^[-+]?[0-9.,]+([eE][-+]?[0-9]+)?$",    # nombre malgré nous
    re.IGNORECASE,
)


def yaml_str(value):
    """Scalaire YAML sûr : replié sur une ligne, quoté dès qu'il pourrait changer de sens."""
    s = " ".join(str(value).split())
    if not s:
        return '""'
    if _NEEDS_QUOTE.search(s):
        return "'" + s.replace("'", "''") + "'"
    return s
