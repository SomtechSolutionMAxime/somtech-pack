#!/usr/bin/env python3
"""
Générateur de rapport PDF professionnel — Audit Loi 25 (P-39.1)
Plugin audit-loi25 / Somtech — v0.4.0

Usage:
    python generate_pdf_report.py <rapport-markdown> [--output <fichier.pdf>] [--client <nom>] [--projet <nom>]
    python generate_pdf_report.py --auto [--output <fichier.pdf>] [--client <nom>] [--projet <nom>]

Lit un rapport d'audit Markdown (généré par /audit-loi25) et produit un PDF
professionnel destiné au client. Supporte le format à deux volets (Technique / Gouvernance).

Si --auto est utilisé, cherche le rapport le plus récent dans security/audit/.
"""

import argparse
import re
import os
import sys
import glob
from datetime import datetime

# ─── Dépendances ───────────────────────────────────────────────
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        PageBreak, HRFlowable
    )
    from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
except ImportError:
    print("ERREUR: reportlab non installé. Exécuter: pip install reportlab --break-system-packages")
    sys.exit(1)


# ─── Couleurs Somtech (charte graphique officielle) ───────────
SOMTECH_BLEU = HexColor("#3b82f6")
SOMTECH_ORANGE = HexColor("#d97706")
SOMTECH_ANTHRACITE = HexColor("#111827")
SOMTECH_VERT = HexColor("#10b981")
SOMTECH_BLEU_CIEL = HexColor("#60a5fa")
SOMTECH_JAUNE = HexColor("#fbbf24")
SOMTECH_VIOLET = HexColor("#8b5cf6")
SOMTECH_RED = HexColor("#ef4444")
SOMTECH_LIGHT_BG = HexColor("#f8f9fa")
SOMTECH_BORDER = HexColor("#dee2e6")
WHITE = white
BLACK = black

SOMTECH_PRIMARY = SOMTECH_BLEU
SOMTECH_ACCENT = SOMTECH_BLEU_CIEL
SOMTECH_HIGHLIGHT = SOMTECH_ORANGE


# ─── Conversion Markdown → ReportLab XML ─────────────────────
def safe_md_to_rl(line: str) -> str:
    """Convertit le Markdown inline (bold, italic, code) en XML ReportLab.

    L'ordre est crucial : on protège d'abord le contenu des backticks
    pour éviter que les * à l'intérieur du code ne soient interprétés
    comme du gras/italique, ce qui produirait du XML mal imbriqué.
    """
    # 1. Protéger les fragments `code` → placeholders
    code_fragments = []
    def _protect_code(m):
        idx = len(code_fragments)
        # Échapper < et > dans le code pour éviter les conflits XML
        safe = m.group(1).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        code_fragments.append(f"<font face='Courier' size='9'>{safe}</font>")
        return f"\x00CODE{idx}\x00"
    line = re.sub(r"`(.+?)`", _protect_code, line)

    # 2. Convertir bold/italic (ordre: *** avant ** avant *)
    line = re.sub(r"\*\*\*(.+?)\*\*\*", r"<b><i>\1</i></b>", line)
    line = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line)
    line = re.sub(r"\*(.+?)\*", r"<i>\1</i>", line)

    # 3. Restaurer les fragments code
    for idx, frag in enumerate(code_fragments):
        line = line.replace(f"\x00CODE{idx}\x00", frag)

    return line


SEVERITY_COLORS = {
    "CRITIQUE": SOMTECH_RED,
    "MAJEUR": SOMTECH_ORANGE,
    "MODÉRÉ": SOMTECH_JAUNE,
    "MODERE": SOMTECH_JAUNE,
    "MINEUR": HexColor("#9ca3af"),
    "CONFORME": SOMTECH_VERT,
}

# ─── Logo ─────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLUGIN_DIR = os.path.dirname(SCRIPT_DIR)
LOGO_PATH = os.path.join(PLUGIN_DIR, "assets", "logo-somtech.png")
ICON_PATH = os.path.join(PLUGIN_DIR, "assets", "icon-somtech.png")


# ─── Styles ────────────────────────────────────────────────────
def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="SectionTitle", fontName="Helvetica-Bold", fontSize=16, leading=20,
        textColor=SOMTECH_PRIMARY, spaceBefore=20, spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        name="SubsectionTitle", fontName="Helvetica-Bold", fontSize=12, leading=16,
        textColor=SOMTECH_ACCENT, spaceBefore=14, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="BodyText2", fontName="Helvetica", fontSize=10, leading=14,
        textColor=BLACK, alignment=TA_JUSTIFY, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="SmallText", fontName="Helvetica", fontSize=8, leading=10,
        textColor=HexColor("#6c757d"),
    ))
    styles.add(ParagraphStyle(
        name="LegalRef", fontName="Helvetica-Oblique", fontSize=9, leading=12,
        textColor=HexColor("#495057"), leftIndent=12, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="ConstatText", fontName="Helvetica", fontSize=10, leading=13,
        textColor=BLACK, leftIndent=8, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="VoletTitle", fontName="Helvetica-Bold", fontSize=18, leading=22,
        textColor=SOMTECH_ANTHRACITE, spaceBefore=24, spaceAfter=14,
    ))
    return styles


# ─── Auto-détection du rapport ─────────────────────────────────
def find_latest_report():
    """Cherche le rapport d'audit le plus récent dans security/audit/."""
    patterns = [
        "security/audit/audit-loi25_*.md",
        "audit-loi25-rapport-*.md",
        "audit-loi25_*.md",
    ]
    for pattern in patterns:
        files = sorted(glob.glob(pattern))
        if files:
            return files[-1]  # Le plus récent (tri alphabétique = tri chronologique)
    return None


# ─── Parsing du rapport Markdown ────────────────────────────────
def parse_markdown_report(filepath):
    """Parse le rapport MD v2 (deux volets) et extrait les données structurées."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    report = {
        "projet": "",
        "client": "",
        "date": "",
        "score_global": 0,
        "score_technique": 0,
        "score_gouvernance": 0,
        "critiques": 0,
        "majeurs": 0,
        "moderes": 0,
        "mineurs": 0,
        "critiques_tech": 0,
        "majeurs_tech": 0,
        "moderes_tech": 0,
        "mineurs_tech": 0,
        "critiques_gouv": 0,
        "majeurs_gouv": 0,
        "moderes_gouv": 0,
        "mineurs_gouv": 0,
        "sections_tech": [],
        "sections_gouv": [],
        "plan_tech": [],
        "plan_gouv": [],
        "raw": content,
        "has_volets": False,
    }

    # Extraire métadonnées
    m = re.search(r"\*\*Projet\*\*\s*:\s*(.+)", content)
    if m:
        report["projet"] = m.group(1).strip()

    m = re.search(r"\*\*Client\*\*\s*:\s*(.+)", content)
    if m:
        report["client"] = m.group(1).strip()

    m = re.search(r"\*\*Date\*\*\s*:\s*(.+)", content)
    if m:
        report["date"] = m.group(1).strip()

    # Détecter le format deux volets
    report["has_volets"] = bool(re.search(r"#\s*VOLET\s*A", content))

    # ── Extraire les scores ──
    # Format volets: | **A — Technique** | 52/100 |
    m_tech = re.search(r"\*\*A\s*[—–-]\s*Technique\*\*\s*\|\s*(\d+)", content)
    if m_tech:
        report["score_technique"] = int(m_tech.group(1))

    m_gouv = re.search(r"\*\*B\s*[—–-]\s*Gouvernance\*\*\s*\|\s*(\d+)", content)
    if m_gouv:
        report["score_gouvernance"] = int(m_gouv.group(1))

    m_global = re.search(r"\*\*Global\*\*\s*\|\s*(\d+)", content)
    if m_global:
        report["score_global"] = int(m_global.group(1))

    # Fallback: ancien format
    if report["score_global"] == 0:
        for pat in [r"\*\*Score de conformité\*\*\s*:\s*(\d+)", r"##\s*Score de conformité\s*:\s*(\d+)", r"Score de conformité\s*:\s*(\d+)"]:
            m = re.search(pat, content)
            if m:
                report["score_global"] = int(m.group(1))
                break

    # ── Extraire les totaux par volet ──
    # Ligne: | A — Technique | 2 | 4 | 3 | 2 |
    m_tech_counts = re.search(r"A\s*[—–-]\s*Technique\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)", content)
    if m_tech_counts:
        report["critiques_tech"] = int(m_tech_counts.group(1))
        report["majeurs_tech"] = int(m_tech_counts.group(2))
        report["moderes_tech"] = int(m_tech_counts.group(3))
        report["mineurs_tech"] = int(m_tech_counts.group(4))

    m_gouv_counts = re.search(r"B\s*[—–-]\s*Gouvernance\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)", content)
    if m_gouv_counts:
        report["critiques_gouv"] = int(m_gouv_counts.group(1))
        report["majeurs_gouv"] = int(m_gouv_counts.group(2))
        report["moderes_gouv"] = int(m_gouv_counts.group(3))
        report["mineurs_gouv"] = int(m_gouv_counts.group(4))

    # Totaux globaux
    total_line = re.search(r"\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*", content)
    if total_line:
        report["critiques"] = int(total_line.group(1))
        report["majeurs"] = int(total_line.group(2))
        report["moderes"] = int(total_line.group(3))
        report["mineurs"] = int(total_line.group(4))
    else:
        report["critiques"] = report["critiques_tech"] + report["critiques_gouv"]
        report["majeurs"] = report["majeurs_tech"] + report["majeurs_gouv"]
        report["moderes"] = report["moderes_tech"] + report["moderes_gouv"]
        report["mineurs"] = report["mineurs_tech"] + report["mineurs_gouv"]

    # Fallback: compter depuis **Niveau :**
    if report["critiques"] == 0 and report["majeurs"] == 0:
        level_map = {"CRITIQUE": "critiques", "MAJEUR": "majeurs", "MODÉRÉ": "moderes", "MODERE": "moderes", "MINEUR": "mineurs"}
        all_levels = re.findall(r"\*\*Niveau\s*:\s*\[?(\w+)", content)
        for lev in all_levels:
            key = level_map.get(lev.upper())
            if key:
                report[key] += 1

    # ── Extraire les sections par volet ──
    if report["has_volets"]:
        # Séparer Volet A et Volet B
        volet_a_match = re.search(r"#\s*VOLET\s*A\s*[—–-]\s*TECHNIQUE(.*?)(?=#\s*VOLET\s*B|$)", content, re.DOTALL | re.IGNORECASE)
        volet_b_match = re.search(r"#\s*VOLET\s*B\s*[—–-]\s*GOUVERNANCE(.*?)(?=##\s*Plan d'action|$)", content, re.DOTALL | re.IGNORECASE)

        if volet_a_match:
            report["sections_tech"] = _parse_volet_sections(volet_a_match.group(1))
        if volet_b_match:
            report["sections_gouv"] = _parse_volet_sections(volet_b_match.group(1))
    else:
        # Ancien format: tout dans sections_tech
        report["sections_tech"] = _parse_volet_sections(content)

    # ── Extraire les plans d'action par volet ──
    # Plan Volet A
    plan_a_match = re.search(r"###\s*Volet\s*A\s*[—–-]\s*Technique\s*\n((?:\|.+\n)+)", content, re.IGNORECASE)
    if plan_a_match:
        report["plan_tech"] = _parse_plan_table(plan_a_match.group(1))

    # Plan Volet B
    plan_b_match = re.search(r"###\s*Volet\s*B\s*[—–-]\s*Gouvernance\s*\n((?:\|.+\n)+)", content, re.IGNORECASE)
    if plan_b_match:
        report["plan_gouv"] = _parse_plan_table(plan_b_match.group(1))

    # Fallback: plan unique
    if not report["plan_tech"] and not report["plan_gouv"]:
        plan_match = re.search(r"##\s*\d*\.?\s*Plan d'action[^\n]*\n((?:\|.+\n)+)", content, re.DOTALL)
        if plan_match:
            report["plan_tech"] = _parse_plan_table(plan_match.group(1))

    return report


def _parse_volet_sections(text):
    """Parse les sous-sections ### d'un volet et retourne une liste structurée."""
    sections = []
    parts = re.split(r"\n### ([\w\d]+\.[\d]+\s+.+)", text)
    for i in range(1, len(parts), 2):
        title = parts[i].strip()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        level_match = re.search(r"\*\*Niveau\s*:\s*\[?(\w+)", body)
        level = level_match.group(1) if level_match else "N/A"
        sections.append({"title": title, "level": level, "body": body.strip()})
    return sections


def _parse_plan_table(table_text):
    """Parse un tableau de plan d'action Markdown."""
    plan = []
    rows = re.findall(r"\|\s*(\d+)\s*\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|", table_text)
    if rows:
        for row in rows:
            plan.append({
                "num": row[0].strip(), "constat": row[1].strip(),
                "niveau": row[2].strip(), "article": row[3].strip(),
                "action": row[4].strip(), "effort": row[5].strip(),
                "echeance": row[6].strip(),
            })
    else:
        rows5 = re.findall(r"\|\s*(\d+)\s*\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|", table_text)
        for row in rows5:
            plan.append({
                "num": row[0].strip(), "constat": row[1].strip(),
                "niveau": row[2].strip(), "article": "",
                "action": row[1].strip(), "effort": row[3].strip(),
                "echeance": row[4].strip(),
            })
    return plan


# ─── Composants PDF ─────────────────────────────────────────────
def make_severity_badge(level, styles):
    color = SEVERITY_COLORS.get(level, HexColor("#999"))
    return Paragraph(f'<font color="{color.hexval()}"><b>{level}</b></font>', styles["ConstatText"])


def make_score_display(score, label="SCORE GLOBAL"):
    """Crée un affichage visuel du score."""
    if score >= 90: color, text = SOMTECH_VERT, "CONFORME"
    elif score >= 70: color, text = SOMTECH_JAUNE, "PARTIELLEMENT CONFORME"
    elif score >= 50: color, text = SOMTECH_ORANGE, "NON CONFORME"
    else: color, text = SOMTECH_RED, "RISQUE ÉLEVÉ"

    data = [[
        Paragraph(f'<font size="36" color="{color.hexval()}"><b>{score}</b></font><font size="14" color="#999">/100</font>', ParagraphStyle("s", alignment=TA_CENTER)),
    ], [
        Paragraph(f'<font size="11" color="{color.hexval()}"><b>{text}</b></font>', ParagraphStyle("s", alignment=TA_CENTER)),
    ], [
        Paragraph(f'<font size="7" color="#9ca3af">{label}</font>', ParagraphStyle("s", alignment=TA_CENTER)),
    ]]

    t = Table(data, colWidths=[2.5 * inch])
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 1, SOMTECH_BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), SOMTECH_LIGHT_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return t


def make_scores_row(report):
    """Crée une rangée de 3 scores: Technique, Global, Gouvernance."""
    scores = [
        (report["score_technique"], "TECHNIQUE", SOMTECH_BLEU),
        (report["score_global"], "GLOBAL", SOMTECH_ANTHRACITE),
        (report["score_gouvernance"], "GOUVERNANCE", SOMTECH_VIOLET),
    ]
    cells = []
    for score, label, accent in scores:
        if score >= 90: color = SOMTECH_VERT
        elif score >= 70: color = SOMTECH_JAUNE
        elif score >= 50: color = SOMTECH_ORANGE
        else: color = SOMTECH_RED

        cell = Paragraph(
            f'<font size="28" color="{color.hexval()}"><b>{score}</b></font>'
            f'<font size="10" color="#999">/100</font><br/>'
            f'<font size="8" color="{accent.hexval()}">{label}</font>',
            ParagraphStyle("s", alignment=TA_CENTER)
        )
        cells.append(cell)

    t = Table([cells], colWidths=[2.1 * inch, 2.1 * inch, 2.1 * inch])
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, SOMTECH_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, SOMTECH_BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), SOMTECH_LIGHT_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return t


def make_summary_table(report, styles):
    """Crée le tableau récapitulatif par volet."""
    header = ["Volet", "Critiques", "Majeurs", "Modérés", "Mineurs"]
    data = [header]

    if report["has_volets"]:
        data.append([
            Paragraph("A — Technique", styles["ConstatText"]),
            Paragraph(f'<font color="{SOMTECH_RED.hexval()}"><b>{report["critiques_tech"]}</b></font>', styles["ConstatText"]),
            Paragraph(f'<font color="{SOMTECH_ORANGE.hexval()}"><b>{report["majeurs_tech"]}</b></font>', styles["ConstatText"]),
            Paragraph(f'<font color="#e9c46a"><b>{report["moderes_tech"]}</b></font>', styles["ConstatText"]),
            Paragraph(f'<b>{report["mineurs_tech"]}</b>', styles["ConstatText"]),
        ])
        data.append([
            Paragraph("B — Gouvernance", styles["ConstatText"]),
            Paragraph(f'<font color="{SOMTECH_RED.hexval()}"><b>{report["critiques_gouv"]}</b></font>', styles["ConstatText"]),
            Paragraph(f'<font color="{SOMTECH_ORANGE.hexval()}"><b>{report["majeurs_gouv"]}</b></font>', styles["ConstatText"]),
            Paragraph(f'<font color="#e9c46a"><b>{report["moderes_gouv"]}</b></font>', styles["ConstatText"]),
            Paragraph(f'<b>{report["mineurs_gouv"]}</b>', styles["ConstatText"]),
        ])

    data.append([
        Paragraph("<b>Total</b>", styles["ConstatText"]),
        Paragraph(f'<font color="{SOMTECH_RED.hexval()}"><b>{report["critiques"]}</b></font>', styles["ConstatText"]),
        Paragraph(f'<font color="{SOMTECH_ORANGE.hexval()}"><b>{report["majeurs"]}</b></font>', styles["ConstatText"]),
        Paragraph(f'<font color="#e9c46a"><b>{report["moderes"]}</b></font>', styles["ConstatText"]),
        Paragraph(f'<b>{report["mineurs"]}</b>', styles["ConstatText"]),
    ])

    t = Table(data, colWidths=[2.2 * inch, 1.1 * inch, 1.1 * inch, 1.1 * inch, 1.1 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SOMTECH_PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, SOMTECH_BORDER),
        ("BACKGROUND", (0, 1), (-1, -1), SOMTECH_LIGHT_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def make_sanctions_table(styles):
    data = [
        ["Type de sanction", "Personne physique", "Personne morale"],
        [Paragraph("Sanction administrative<br/><font size='8' color='#666'>(art. 90.1, 90.12)</font>", styles["ConstatText"]),
         "Max 50 000 $", Paragraph("<b>Max 10 000 000 $</b><br/>ou 2 % du CA mondial", styles["ConstatText"])],
        [Paragraph("Sanction pénale<br/><font size='8' color='#666'>(art. 91)</font>", styles["ConstatText"]),
         "5 000 $ — 100 000 $", Paragraph("<b>15 000 $ — 25 000 000 $</b><br/>ou 4 % du CA mondial", styles["ConstatText"])],
        [Paragraph("Récidive<br/><font size='8' color='#666'>(art. 92.1)</font>", styles["ConstatText"]),
         "Montants doublés", "Montants doublés"],
        [Paragraph("Dommages punitifs<br/><font size='8' color='#666'>(art. 93.1)</font>", styles["ConstatText"]),
         "Min 1 000 $", "Min 1 000 $"],
    ]
    t = Table(data, colWidths=[2.4 * inch, 1.8 * inch, 2.4 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SOMTECH_RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, SOMTECH_BORDER),
        ("BACKGROUND", (0, 1), (-1, -1), HexColor("#fff5f5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def make_plan_action_table(plan, styles):
    if not plan:
        return Paragraph("<i>Aucun plan d'action extrait.</i>", styles["BodyText2"])

    header = ["#", "Constat", "Niveau", "Réf.", "Action corrective", "Échéance"]
    data = [header]
    for item in plan:
        niveau = item["niveau"]
        color = SEVERITY_COLORS.get(niveau, HexColor("#999"))
        data.append([
            item["num"],
            Paragraph(item["constat"], styles["SmallText"]),
            Paragraph(f'<font color="{color.hexval()}"><b>{niveau}</b></font>', styles["SmallText"]),
            Paragraph(f'<font size="7">{item["article"]}</font>', styles["SmallText"]),
            Paragraph(item["action"], styles["SmallText"]),
            item["echeance"],
        ])
    t = Table(data, colWidths=[0.35 * inch, 1.5 * inch, 0.7 * inch, 0.7 * inch, 2.2 * inch, 0.8 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SOMTECH_PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, SOMTECH_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, SOMTECH_LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


# ─── Page Templates ─────────────────────────────────────────────
class CoverPage:
    """Dessine la page de couverture sobre — inspirée de somtech.solutions."""

    @staticmethod
    def draw(canvas_obj, doc, report, client_name, projet_name):
        canvas_obj.saveState()
        w, h = letter

        # ── Fond blanc ──
        canvas_obj.setFillColor(WHITE)
        canvas_obj.rect(0, 0, w, h, fill=1, stroke=0)

        # ── Filigrane ──
        if os.path.exists(ICON_PATH):
            canvas_obj.saveState()
            canvas_obj.setFillAlpha(0.03)
            icon_size = 400
            canvas_obj.drawImage(ICON_PATH, (w - icon_size) / 2, (h - icon_size) / 2 - 30,
                                width=icon_size, height=icon_size, preserveAspectRatio=True, mask='auto')
            canvas_obj.restoreState()

        # ── Fine ligne bleue en haut ──
        canvas_obj.setFillColor(SOMTECH_BLEU)
        canvas_obj.rect(0, h - 3, w, 3, fill=1, stroke=0)

        # ── Logo ──
        logo_y = h - 80
        if os.path.exists(LOGO_PATH):
            canvas_obj.drawImage(LOGO_PATH, 60, logo_y, width=160, height=50,
                                preserveAspectRatio=True, mask='auto')
        else:
            canvas_obj.setFont("Helvetica-Bold", 18)
            canvas_obj.setFillColor(SOMTECH_ANTHRACITE)
            canvas_obj.drawString(60, logo_y + 15, "Somtech Solutions")

        canvas_obj.setStrokeColor(SOMTECH_BORDER)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(60, logo_y - 12, w - 60, logo_y - 12)

        # ── Titre ──
        canvas_obj.setFont("Helvetica-Bold", 28)
        canvas_obj.setFillColor(SOMTECH_ANTHRACITE)
        canvas_obj.drawCentredString(w / 2, h - 180, "Rapport d'audit")

        canvas_obj.setFont("Helvetica-Bold", 22)
        canvas_obj.setFillColor(SOMTECH_ORANGE)
        canvas_obj.drawCentredString(w / 2, h - 212, "Conformité Loi 25")

        canvas_obj.setFont("Helvetica", 11)
        canvas_obj.setFillColor(HexColor("#6b7280"))
        canvas_obj.drawCentredString(w / 2, h - 238, "Loi sur la protection des renseignements personnels")
        canvas_obj.drawCentredString(w / 2, h - 254, "dans le secteur privé (RLRQ, c. P-39.1)")

        # ── Trois scores côte à côte ──
        if report.get("has_volets") and report.get("score_technique", 0) > 0:
            scores = [
                (report["score_technique"], "TECHNIQUE", SOMTECH_BLEU),
                (report["score_global"], "GLOBAL", SOMTECH_ANTHRACITE),
                (report["score_gouvernance"], "GOUVERNANCE", SOMTECH_VIOLET),
            ]
            box_w, box_h = 120, 90
            gap = 20
            total_w = 3 * box_w + 2 * gap
            start_x = (w - total_w) / 2

            for idx, (score, label, accent) in enumerate(scores):
                cx = start_x + idx * (box_w + gap) + box_w / 2
                cy = h - 340

                if score >= 90: sc = SOMTECH_VERT
                elif score >= 70: sc = SOMTECH_JAUNE
                elif score >= 50: sc = SOMTECH_ORANGE
                else: sc = SOMTECH_RED

                canvas_obj.setFillColor(HexColor("#f9fafb"))
                canvas_obj.setStrokeColor(SOMTECH_BORDER)
                canvas_obj.setLineWidth(0.5)
                canvas_obj.roundRect(cx - box_w / 2, cy - box_h / 2, box_w, box_h, 6, fill=1, stroke=1)

                canvas_obj.setFont("Helvetica-Bold", 36)
                canvas_obj.setFillColor(sc)
                canvas_obj.drawCentredString(cx, cy + 10, str(score))

                canvas_obj.setFont("Helvetica", 10)
                canvas_obj.setFillColor(HexColor("#9ca3af"))
                canvas_obj.drawCentredString(cx, cy - 10, "/ 100")

                canvas_obj.setFont("Helvetica-Bold", 7)
                canvas_obj.setFillColor(accent)
                canvas_obj.drawCentredString(cx, cy - 34, label)
        else:
            # Score unique (ancien format)
            score = report.get("score_global", 0)
            if score >= 90: sc = SOMTECH_VERT
            elif score >= 70: sc = SOMTECH_JAUNE
            elif score >= 50: sc = SOMTECH_ORANGE
            else: sc = SOMTECH_RED

            cx, cy = w / 2, h - 340
            box_w, box_h = 140, 100
            canvas_obj.setFillColor(HexColor("#f9fafb"))
            canvas_obj.setStrokeColor(SOMTECH_BORDER)
            canvas_obj.setLineWidth(0.5)
            canvas_obj.roundRect(cx - box_w / 2, cy - box_h / 2, box_w, box_h, 6, fill=1, stroke=1)
            canvas_obj.setFont("Helvetica-Bold", 48)
            canvas_obj.setFillColor(sc)
            canvas_obj.drawCentredString(cx, cy + 5, str(score))
            canvas_obj.setFont("Helvetica", 13)
            canvas_obj.setFillColor(HexColor("#9ca3af"))
            canvas_obj.drawCentredString(cx, cy - 18, "/ 100")
            canvas_obj.setFont("Helvetica", 8)
            canvas_obj.setFillColor(HexColor("#9ca3af"))
            canvas_obj.drawCentredString(cx, cy - 42, "SCORE DE CONFORMITÉ")

        # ── Infos projet ──
        y = h - 450
        infos = [
            ("Client", client_name or report.get("client", "—")),
            ("Projet", projet_name or report.get("projet", "—")),
            ("Date", report.get("date", datetime.now().strftime("%d %B %Y"))),
            ("Auditeur", "Orbit (logiciel d'audit)"),
        ]
        label_x = w / 2 - 100
        value_x = w / 2 + 10
        for label, value in infos:
            canvas_obj.setFont("Helvetica", 9)
            canvas_obj.setFillColor(HexColor("#9ca3af"))
            canvas_obj.drawRightString(label_x, y, label.upper())
            canvas_obj.setFont("Helvetica-Bold", 11)
            canvas_obj.setFillColor(SOMTECH_ANTHRACITE)
            canvas_obj.drawString(value_x, y, value)
            y -= 28

        # ── Pied de page ──
        canvas_obj.setStrokeColor(SOMTECH_BORDER)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(60, 55, w - 60, 55)
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(HexColor("#9ca3af"))
        canvas_obj.drawString(60, 40, "CONFIDENTIEL — Somtech Solutions inc.")
        canvas_obj.drawRightString(w - 60, 40, f"Généré le {datetime.now().strftime('%d %B %Y')}")

        canvas_obj.restoreState()


def add_header_footer(canvas_obj, doc, report, client_name):
    canvas_obj.saveState()
    w, h = letter

    canvas_obj.setStrokeColor(SOMTECH_ORANGE)
    canvas_obj.setLineWidth(2)
    canvas_obj.line(50, h - 40, w - 50, h - 40)

    canvas_obj.setFont("Helvetica-Bold", 8)
    canvas_obj.setFillColor(SOMTECH_BLEU)
    canvas_obj.drawString(50, h - 35, "AUDIT LOI 25 — CONFIDENTIEL")

    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(HexColor("#6b7280"))
    canvas_obj.drawRightString(w - 50, h - 35, client_name or report.get("projet", ""))

    canvas_obj.setStrokeColor(SOMTECH_BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(50, 45, w - 50, 45)

    if os.path.exists(ICON_PATH):
        canvas_obj.drawImage(ICON_PATH, 50, 26, width=14, height=14, preserveAspectRatio=True, mask='auto')
        left_x = 68
    else:
        left_x = 50

    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.setFillColor(HexColor("#9ca3af"))
    canvas_obj.drawString(left_x, 32, "Somtech Solutions — Rapport de conformité P-39.1")
    canvas_obj.drawRightString(w - 50, 32, f"Page {doc.page}")

    canvas_obj.restoreState()


# ─── Rendu des sections ─────────────────────────────────────────
def render_sections(story, sections, styles):
    """Rend une liste de sections de constats en éléments Platypus."""
    for section in sections:
        story.append(Paragraph(section["title"], styles["SubsectionTitle"]))

        if section["level"] and section["level"] != "N/A":
            story.append(make_severity_badge(section["level"], styles))

        lines = section["body"].split("\n")
        for line in lines:
            line = line.strip()
            if not line or line.startswith("|") or line.startswith("---") or line.startswith("```"):
                continue
            if re.match(r"\*\*Niveau\s*:", line):
                continue
            line = safe_md_to_rl(line)
            if line.startswith("- "):
                line = "  \u2022  " + line[2:]
            story.append(Paragraph(line, styles["ConstatText"]))

    return story


# ─── Construction du document ───────────────────────────────────
def build_pdf(report, output_path, client_name=None, projet_name=None):
    styles = build_styles()

    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        topMargin=60, bottomMargin=60, leftMargin=50, rightMargin=50,
        title=f"Audit Loi 25 — {projet_name or report.get('projet', 'Projet')}",
        author="Somtech inc.",
        subject="Rapport de conformité Loi 25 (P-39.1)",
    )

    story = []

    # ── Couverture ──
    story.append(Spacer(1, 650))
    story.append(PageBreak())

    # ── Table des matières ──
    story.append(Paragraph("Table des matières", styles["SectionTitle"]))
    story.append(Spacer(1, 12))

    if report["has_volets"]:
        toc = [
            ("1.", "Sommaire exécutif"),
            ("2.", "Scores de conformité et exposition aux sanctions"),
            ("", ""),
            ("", "VOLET A — TECHNIQUE"),
            ("3.", "Inventaire des données personnelles"),
            ("4.", "Constats — Base de données"),
            ("5.", "Constats — API et Backend"),
            ("6.", "Constats — Frontend"),
            ("", ""),
            ("", "VOLET B — GOUVERNANCE"),
            ("7.", "Constats de gouvernance"),
            ("", ""),
            ("8.", "Plan d'action recommandé"),
            ("9.", "Références légales et méthodologie"),
        ]
    else:
        toc = [
            ("1.", "Sommaire exécutif"),
            ("2.", "Score de conformité et exposition aux sanctions"),
            ("3.", "Constats détaillés"),
            ("4.", "Plan d'action recommandé"),
            ("5.", "Références légales et méthodologie"),
        ]

    for num, title in toc:
        if not num and not title:
            story.append(Spacer(1, 6))
        elif not num:
            story.append(Paragraph(f'<b><font color="{SOMTECH_PRIMARY.hexval()}">{title}</font></b>', styles["BodyText2"]))
        else:
            story.append(Paragraph(f'<b>{num}</b>  {title}', styles["BodyText2"]))
    story.append(PageBreak())

    # ── 1. Sommaire exécutif ──
    story.append(Paragraph("1. Sommaire exécutif", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))

    projet_display = projet_name or report.get("projet", "—")
    story.append(Paragraph(
        f"Le présent rapport présente les résultats de l'audit de conformité à la "
        f"<b>Loi sur la protection des renseignements personnels dans le secteur privé</b> "
        f"(RLRQ, c. P-39.1), communément appelée <b>Loi 25</b>, réalisé sur le projet "
        f"<b>{projet_display}</b>.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 8))

    if report["has_volets"]:
        story.append(Paragraph(
            f"L'audit a produit un <b>score technique de {report['score_technique']}/100</b> "
            f"et un <b>score de gouvernance de {report['score_gouvernance']}/100</b>, "
            f"pour un <b>score global de {report['score_global']}/100</b>. "
            f"Au total : <b>{report['critiques']}</b> constat(s) critique(s), "
            f"<b>{report['majeurs']}</b> majeur(s), "
            f"<b>{report['moderes']}</b> modéré(s) et "
            f"<b>{report['mineurs']}</b> mineur(s).",
            styles["BodyText2"]
        ))
    else:
        story.append(Paragraph(
            f"L'audit a identifié <b>{report['critiques']}</b> constat(s) critique(s), "
            f"<b>{report['majeurs']}</b> majeur(s), <b>{report['moderes']}</b> modéré(s) et "
            f"<b>{report['mineurs']}</b> mineur(s), pour un <b>score de {report['score_global']}/100</b>.",
            styles["BodyText2"]
        ))

    story.append(Spacer(1, 12))
    story.append(make_summary_table(report, styles))
    story.append(Spacer(1, 12))

    # ── 2. Scores et sanctions ──
    story.append(Paragraph("2. Scores de conformité et exposition aux sanctions", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))

    if report["has_volets"]:
        story.append(make_scores_row(report))
    else:
        story.append(make_score_display(report["score_global"]))
    story.append(Spacer(1, 16))

    bareme = [
        ("90-100", "Conforme", SOMTECH_VERT),
        ("70-89", "Partiellement conforme — corrections mineures requises", SOMTECH_JAUNE),
        ("50-69", "Non conforme — corrections majeures requises", SOMTECH_ORANGE),
        ("0-49", "Risque élevé — actions immédiates requises", SOMTECH_RED),
    ]
    story.append(Paragraph("Barème des scores :", styles["SubsectionTitle"]))
    for plage, desc, color in bareme:
        story.append(Paragraph(f'<font color="{color.hexval()}"><b>{plage}</b></font> : {desc}', styles["ConstatText"]))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Exposition aux sanctions (P-39.1) :", styles["SubsectionTitle"]))
    story.append(make_sanctions_table(styles))
    story.append(PageBreak())

    # ── Constats ──
    if report["has_volets"]:
        # VOLET A — TECHNIQUE
        story.append(Paragraph("VOLET A — TECHNIQUE", styles["VoletTitle"]))
        story.append(Paragraph(
            "Ce volet couvre les constats liés au code source, à la base de données, aux API et à l'interface utilisateur.",
            styles["BodyText2"]
        ))
        story.append(HRFlowable(width="100%", thickness=2, color=SOMTECH_BLEU, spaceAfter=12))

        # Séparer les sections par catégorie (A1, A2, A3, A4)
        volet_a_text = ""
        volet_a_match = re.search(r"#\s*VOLET\s*A\s*[—–-]\s*TECHNIQUE(.*?)(?=#\s*VOLET\s*B|$)", report["raw"], re.DOTALL | re.IGNORECASE)
        if volet_a_match:
            volet_a_text = volet_a_match.group(1)

        # Rendre les sections ## du volet A
        a_sections = re.split(r"\n## (A\d+\..+)", volet_a_text)
        for i in range(1, len(a_sections), 2):
            section_title = a_sections[i].strip()
            section_body = a_sections[i + 1] if i + 1 < len(a_sections) else ""
            story.append(Paragraph(section_title, styles["SectionTitle"]))
            story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=8))

            subsections = _parse_volet_sections(section_body)
            render_sections(story, subsections, styles)

        story.append(PageBreak())

        # VOLET B — GOUVERNANCE
        story.append(Paragraph("VOLET B — GOUVERNANCE", styles["VoletTitle"]))
        story.append(Paragraph(
            "Ce volet couvre les constats liés aux processus organisationnels, aux politiques et à la conformité administrative.",
            styles["BodyText2"]
        ))
        story.append(HRFlowable(width="100%", thickness=2, color=SOMTECH_VIOLET, spaceAfter=12))

        volet_b_text = ""
        volet_b_match = re.search(r"#\s*VOLET\s*B\s*[—–-]\s*GOUVERNANCE(.*?)(?=##\s*Plan d'action|$)", report["raw"], re.DOTALL | re.IGNORECASE)
        if volet_b_match:
            volet_b_text = volet_b_match.group(1)

        b_sections = re.split(r"\n## (B\d+\..+)", volet_b_text)
        for i in range(1, len(b_sections), 2):
            section_title = b_sections[i].strip()
            section_body = b_sections[i + 1] if i + 1 < len(b_sections) else ""
            story.append(Paragraph(section_title, styles["SectionTitle"]))
            story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=8))

            lines = section_body.strip().split("\n")
            for line in lines:
                line = line.strip()
                if not line or line.startswith("|") or line.startswith("---") or line.startswith("```"):
                    continue
                level_match = re.match(r"\*\*Niveau\s*:\s*\[?(\w+)", line)
                if level_match:
                    story.append(make_severity_badge(level_match.group(1), styles))
                    continue
                line = safe_md_to_rl(line)
                if line.startswith("- "):
                    line = "  \u2022  " + line[2:]
                story.append(Paragraph(line, styles["ConstatText"]))

        story.append(PageBreak())
    else:
        # Ancien format: sections linéaires
        sections_md = re.split(r"\n## (.+)", report["raw"])
        for i in range(1, len(sections_md), 2):
            section_title = sections_md[i].strip()
            section_body = sections_md[i + 1] if i + 1 < len(sections_md) else ""
            skip_kw = ["score de conformité", "annexe", "plan d'action", "sommaire"]
            if not any(kw in section_title.lower() for kw in skip_kw):
                story.append(Paragraph(section_title, styles["SectionTitle"]))
                story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))
                subsections = re.split(r"\n### (\d+\.\d+\s+.+)", section_body)
                for j in range(0, len(subsections)):
                    block = subsections[j].strip()
                    if not block:
                        continue
                    if re.match(r"\d+\.\d+\s+", block):
                        story.append(Paragraph(block, styles["SubsectionTitle"]))
                        continue
                    level_match = re.search(r"\*\*Niveau\s*:\s*\[?(\w+)", block)
                    if level_match:
                        story.append(make_severity_badge(level_match.group(1), styles))
                    lines = block.split("\n")
                    for line in lines:
                        line = line.strip()
                        if not line or line.startswith("|") or line.startswith("---"):
                            continue
                        if line.startswith("**") and line.endswith("**"):
                            continue
                        line = safe_md_to_rl(line)
                        if line.startswith("- "):
                            line = "  \u2022  " + line[2:]
                        story.append(Paragraph(line, styles["ConstatText"]))
                story.append(PageBreak())

    # ── Plan d'action ──
    story.append(Paragraph("Plan d'action recommandé", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))
    story.append(Paragraph(
        "Les actions correctives sont priorisées par niveau de sévérité. Les constats critiques doivent être corrigés immédiatement.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 8))

    if report["has_volets"] and (report["plan_tech"] or report["plan_gouv"]):
        if report["plan_tech"]:
            story.append(Paragraph("Volet A — Technique", styles["SubsectionTitle"]))
            story.append(make_plan_action_table(report["plan_tech"], styles))
            story.append(Spacer(1, 16))
        if report["plan_gouv"]:
            story.append(Paragraph("Volet B — Gouvernance", styles["SubsectionTitle"]))
            story.append(make_plan_action_table(report["plan_gouv"], styles))
    else:
        story.append(make_plan_action_table(report["plan_tech"] or report["plan_gouv"], styles))

    story.append(PageBreak())

    # ── Références ──
    story.append(Paragraph("Références légales et méthodologie", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))

    story.append(Paragraph("Références légales", styles["SubsectionTitle"]))
    for ref in [
        "<b>P-39.1</b> — Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1), mise à jour au 11 décembre 2025",
        "<b>Loi 25</b> — Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (2021, c. 25)",
        "<b>CAI</b> — Commission d'accès à l'information du Québec",
        "<b>Guide EFVP</b> — Guide d'évaluation des facteurs relatifs à la vie privée (CAI, v3.1, avril 2024)",
    ]:
        story.append(Paragraph(f"  \u2022  {ref}", styles["LegalRef"]))

    story.append(Spacer(1, 12))
    story.append(Paragraph("Méthodologie d'audit", styles["SubsectionTitle"]))
    for item in [
        "Scan des migrations SQL pour l'inventaire PII (art. 2, 12)",
        "Vérification des politiques RLS (art. 20)",
        "Analyse statique du code frontend et backend (art. 10)",
        "Vérification de la configuration des services tiers (art. 17, 18.3)",
        "Vérification de la gouvernance (art. 3.1, 3.2, 3.3)",
    ]:
        story.append(Paragraph(f"  \u2022  {item}", styles["LegalRef"]))

    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=SOMTECH_BORDER, spaceAfter=8))
    story.append(Paragraph(
        "<b>AVERTISSEMENT</b> : Ce rapport est généré par un outil d'audit automatisé. "
        "Il ne constitue pas un avis juridique. Pour une analyse complète, "
        "consulter un conseiller juridique spécialisé en protection des renseignements personnels.",
        styles["SmallText"]
    ))

    # ── Build ──
    def on_first_page(canvas_obj, doc_obj):
        CoverPage.draw(canvas_obj, doc_obj, report, client_name, projet_name)

    def on_later_pages(canvas_obj, doc_obj):
        add_header_footer(canvas_obj, doc_obj, report, client_name)

    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
    return output_path


# ─── Main ───────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Générer un rapport PDF professionnel d'audit Loi 25")
    parser.add_argument("rapport", nargs="?", help="Chemin du rapport Markdown (.md)")
    parser.add_argument("--auto", action="store_true", help="Auto-détecter le rapport le plus récent dans security/audit/")
    parser.add_argument("--output", "-o", help="Chemin du PDF de sortie")
    parser.add_argument("--client", "-c", help="Nom du client")
    parser.add_argument("--projet", "-p", help="Nom du projet")

    args = parser.parse_args()

    # Trouver le rapport
    rapport_path = args.rapport
    if not rapport_path and args.auto:
        rapport_path = find_latest_report()
        if rapport_path:
            print(f"Auto-détection: {rapport_path}")
        else:
            print("ERREUR: Aucun rapport trouvé dans security/audit/")
            sys.exit(1)
    elif not rapport_path:
        print("ERREUR: Spécifier un fichier ou utiliser --auto")
        sys.exit(1)

    if not os.path.exists(rapport_path):
        print(f"ERREUR: Fichier non trouvé: {rapport_path}")
        sys.exit(1)

    output = args.output or os.path.splitext(rapport_path)[0] + ".pdf"

    print(f"Lecture du rapport: {rapport_path}")
    report = parse_markdown_report(rapport_path)

    print(f"Format détecté: {'Deux volets (Technique/Gouvernance)' if report['has_volets'] else 'Format classique'}")
    if report["has_volets"]:
        print(f"Scores: Technique={report['score_technique']}/100, Gouvernance={report['score_gouvernance']}/100, Global={report['score_global']}/100")
    else:
        print(f"Score: {report['score_global']}/100")

    print(f"Génération du PDF: {output}")
    build_pdf(report, output, client_name=args.client, projet_name=args.projet)

    size_kb = os.path.getsize(output) / 1024
    print(f"Rapport PDF généré avec succès: {output} ({size_kb:.0f} Ko)")
    return output


if __name__ == "__main__":
    main()
