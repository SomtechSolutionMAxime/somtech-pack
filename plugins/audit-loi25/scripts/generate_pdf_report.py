#!/usr/bin/env python3
"""
Générateur de rapport PDF professionnel — Audit Loi 25 (P-39.1)
Plugin audit-loi25 / Somtech

Usage:
    python generate_pdf_report.py <rapport-markdown> [--output <fichier.pdf>] [--client <nom>] [--projet <nom>]

Lit un rapport d'audit Markdown (généré par /audit-loi25) et produit un PDF
professionnel destiné au client.
"""

import argparse
import re
import os
import sys
from datetime import datetime

# ─── Dépendances ───────────────────────────────────────────────
try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.units import inch, mm
    from reportlab.lib.colors import HexColor, black, white, Color
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        PageBreak, KeepTogether, HRFlowable, Image
    )
    from reportlab.pdfgen import canvas
    from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
except ImportError:
    print("ERREUR: reportlab non installé. Exécuter: pip install reportlab --break-system-packages")
    sys.exit(1)


# ─── Couleurs Somtech (charte graphique officielle) ───────────
# Couleurs principales
SOMTECH_BLEU = HexColor("#3b82f6")        # Bleu technologie
SOMTECH_ORANGE = HexColor("#d97706")      # Orange innovation
SOMTECH_ANTHRACITE = HexColor("#111827")  # Gris anthracite
SOMTECH_VERT = HexColor("#10b981")        # Vert succès
# Couleurs secondaires
SOMTECH_BLEU_CIEL = HexColor("#60a5fa")   # Bleu ciel numérique
SOMTECH_JAUNE = HexColor("#fbbf24")       # Jaune solaire
SOMTECH_VIOLET = HexColor("#8b5cf6")      # Violet créatif
# Couleurs utilitaires
SOMTECH_RED = HexColor("#ef4444")         # Rouge alerte (erreurs/critiques)
SOMTECH_LIGHT_BG = HexColor("#f8f9fa")
SOMTECH_BORDER = HexColor("#dee2e6")
WHITE = white
BLACK = black

# Aliases pour compatibilité interne
SOMTECH_DARK = SOMTECH_ANTHRACITE
SOMTECH_PRIMARY = SOMTECH_BLEU
SOMTECH_ACCENT = SOMTECH_BLEU_CIEL
SOMTECH_HIGHLIGHT = SOMTECH_ORANGE        # Accent visuel principal = orange

SEVERITY_COLORS = {
    "CRITIQUE": SOMTECH_RED,
    "MAJEUR": SOMTECH_ORANGE,
    "MODÉRÉ": SOMTECH_JAUNE,
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
        name="CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        textColor=WHITE,
        alignment=TA_LEFT,
        spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        name="CoverSubtitle",
        fontName="Helvetica",
        fontSize=14,
        leading=18,
        textColor=HexColor("#c0c0c0"),
        alignment=TA_LEFT,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="CoverMeta",
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=HexColor("#a0a0a0"),
        alignment=TA_LEFT,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="SectionTitle",
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=SOMTECH_PRIMARY,
        spaceBefore=20,
        spaceAfter=10,
        borderWidth=0,
        borderPadding=0,
    ))
    styles.add(ParagraphStyle(
        name="SubsectionTitle",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=SOMTECH_ACCENT,
        spaceBefore=14,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="BodyText2",
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=BLACK,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="SmallText",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=HexColor("#6c757d"),
    ))
    styles.add(ParagraphStyle(
        name="LegalRef",
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=12,
        textColor=HexColor("#495057"),
        leftIndent=12,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="ConstatText",
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=BLACK,
        leftIndent=8,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="Footer",
        fontName="Helvetica",
        fontSize=7,
        leading=9,
        textColor=HexColor("#999999"),
        alignment=TA_CENTER,
    ))
    return styles


# ─── Parsing du rapport Markdown ────────────────────────────────
def parse_markdown_report(filepath):
    """Parse le rapport MD généré par /audit-loi25 et extrait les données structurées."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    report = {
        "projet": "",
        "date": "",
        "score": 0,
        "critiques": 0,
        "majeurs": 0,
        "moderes": 0,
        "mineurs": 0,
        "sections": [],
        "plan_action": [],
        "pii_inventory": [],
        "raw": content,
    }

    # Extraire le projet
    m = re.search(r"\*\*Projet\*\*\s*:\s*(.+)", content)
    if m:
        report["projet"] = m.group(1).strip()

    # Extraire la date
    m = re.search(r"\*\*Date\*\*\s*:\s*(.+)", content)
    if m:
        report["date"] = m.group(1).strip()

    # Extraire le score — plusieurs formats possibles
    # Format 1: **Score de conformité** : 58
    # Format 2: ## Score de conformité : 58 / 100
    # Format 3: Score de conformité : 58/100
    score_patterns = [
        r"\*\*Score de conformité\*\*\s*:\s*(\d+)",
        r"##\s*Score de conformité\s*:\s*(\d+)",
        r"Score de conformité\s*:\s*(\d+)",
    ]
    for pat in score_patterns:
        m = re.search(pat, content)
        if m:
            report["score"] = int(m.group(1))
            break

    # Extraire les totaux — d'abord essayer le format tableau **Total**
    total_line = re.search(r"\|\s*\*\*Total\*\*\s*\|(.+)\|", content)
    if total_line:
        nums = re.findall(r"\*\*(\d+)\*\*", total_line.group(1))
        if len(nums) >= 4:
            report["critiques"] = int(nums[0])
            report["majeurs"] = int(nums[1])
            report["moderes"] = int(nums[2])
            report["mineurs"] = int(nums[3])

    # Extraire les sections de constats (### headers sous ## sections)
    section_pattern = re.compile(
        r"###\s+(\d+\.\d+)\s+(.+?)(?:\n\n\*\*Niveau\s*:\s*\[?)(\w+)", re.DOTALL
    )
    for m in section_pattern.finditer(content):
        report["sections"].append({
            "num": m.group(1),
            "title": m.group(2).strip().rstrip("(").strip(),
            "level": m.group(3) if m.group(3) else "N/A",
        })

    # Si les totaux n'ont pas été extraits du tableau, les compter depuis les sections
    if report["critiques"] == 0 and report["majeurs"] == 0 and report["moderes"] == 0 and report["mineurs"] == 0:
        level_map = {
            "CRITIQUE": "critiques",
            "MAJEUR": "majeurs",
            "MODÉRÉ": "moderes",  # avec accent
            "MODERE": "moderes",  # sans accent (fallback)
            "MINEUR": "mineurs",
        }
        for section in report["sections"]:
            key = level_map.get(section["level"].upper(), None)
            if key:
                report[key] += 1
        # Aussi scanner les occurrences **Niveau : [XXX]** qui n'ont pas été captées par le section_pattern
        all_levels = re.findall(r"\*\*Niveau\s*:\s*\[?(\w+)", content)
        if all_levels and sum(report[k] for k in ["critiques", "majeurs", "moderes", "mineurs"]) == 0:
            for lev in all_levels:
                key = level_map.get(lev.upper(), None)
                if key:
                    report[key] += 1

    # Extraire le plan d'action — chercher la section avec différents formats
    plan_patterns = [
        r"##\s*\d*\.?\s*Plan d'action[^\n]*\n((?:\|.+\n)+)",  # Avec ou sans numéro
        r"## Plan d'action[^\n]*\n[^\|]*\n((?:\|.+\n)+)",      # Avec texte intermédiaire
    ]
    plan_block = None
    for pat in plan_patterns:
        plan_block = re.search(pat, content, re.DOTALL)
        if plan_block:
            break

    if plan_block:
        table_text = plan_block.group(0)
        # Format 7 colonnes: | # | Constat | Niveau | Article | Action | Effort | Échéance |
        rows_7 = re.findall(r"\|\s*(\d+)\s*\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|", table_text)
        if rows_7:
            for row in rows_7:
                report["plan_action"].append({
                    "num": row[0].strip(),
                    "constat": row[1].strip(),
                    "niveau": row[2].strip(),
                    "article": row[3].strip(),
                    "action": row[4].strip(),
                    "effort": row[5].strip(),
                    "echeance": row[6].strip(),
                })
        else:
            # Format 5 colonnes: | # | Action | Sévérité | Effort | Échéance |
            rows_5 = re.findall(r"\|\s*(\d+)\s*\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|", table_text)
            for row in rows_5:
                report["plan_action"].append({
                    "num": row[0].strip(),
                    "constat": row[1].strip(),
                    "niveau": row[2].strip(),
                    "article": "",
                    "action": row[1].strip(),
                    "effort": row[3].strip(),
                    "echeance": row[4].strip(),
                })

    return report


# ─── Composants PDF ─────────────────────────────────────────────
def make_severity_badge(level, styles):
    """Retourne un Paragraph formaté comme un badge de sévérité."""
    color = SEVERITY_COLORS.get(level, HexColor("#999"))
    hex_color = color.hexval() if hasattr(color, 'hexval') else str(color)
    return Paragraph(
        f'<font color="{hex_color}"><b>{level}</b></font>',
        styles["ConstatText"]
    )


def make_score_display(score):
    """Crée un tableau visuel du score."""
    if score >= 90:
        color = SOMTECH_VERT
        label = "CONFORME"
    elif score >= 70:
        color = SOMTECH_JAUNE
        label = "PARTIELLEMENT CONFORME"
    elif score >= 50:
        color = SOMTECH_ORANGE
        label = "NON CONFORME"
    else:
        color = SOMTECH_RED
        label = "RISQUE ÉLEVÉ"

    data = [[
        Paragraph(f'<font size="36" color="{color.hexval()}"><b>{score}</b></font><font size="14" color="#999">/100</font>', ParagraphStyle("s", alignment=TA_CENTER)),
    ], [
        Paragraph(f'<font size="11" color="{color.hexval()}"><b>{label}</b></font>', ParagraphStyle("s", alignment=TA_CENTER)),
    ]]

    t = Table(data, colWidths=[3 * inch])
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 1, SOMTECH_BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), SOMTECH_LIGHT_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return t


def make_summary_table(report, styles):
    """Crée le tableau récapitulatif des constats."""
    header = ["Catégorie", "Critiques", "Majeurs", "Modérés", "Mineurs"]
    data = [header]

    categories = ["Base de données", "API / Backend", "Frontend", "Gouvernance"]
    # On ne peut pas parser par catégorie depuis le rapport brut facilement,
    # donc on affiche juste le total
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
    """Crée le tableau des sanctions."""
    data = [
        ["Type de sanction", "Personne physique", "Personne morale"],
        [
            Paragraph("Sanction administrative<br/><font size='8' color='#666'>(art. 90.1, 90.12)</font>", styles["ConstatText"]),
            "Max 50 000 $",
            Paragraph("<b>Max 10 000 000 $</b><br/>ou 2 % du CA mondial", styles["ConstatText"]),
        ],
        [
            Paragraph("Sanction pénale<br/><font size='8' color='#666'>(art. 91)</font>", styles["ConstatText"]),
            "5 000 $ — 100 000 $",
            Paragraph("<b>15 000 $ — 25 000 000 $</b><br/>ou 4 % du CA mondial", styles["ConstatText"]),
        ],
        [
            Paragraph("Récidive<br/><font size='8' color='#666'>(art. 92.1)</font>", styles["ConstatText"]),
            "Montants doublés",
            "Montants doublés",
        ],
        [
            Paragraph("Dommages punitifs<br/><font size='8' color='#666'>(art. 93.1)</font>", styles["ConstatText"]),
            "Min 1 000 $",
            "Min 1 000 $",
        ],
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
    """Crée le tableau du plan d'action."""
    if not plan:
        return Paragraph("<i>Aucun plan d'action extrait du rapport.</i>", styles["BodyText2"])

    header = ["#", "Constat", "Niveau", "Article", "Action corrective", "Échéance"]
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

        # ── Fond blanc propre ──
        canvas_obj.setFillColor(WHITE)
        canvas_obj.rect(0, 0, w, h, fill=1, stroke=0)

        # ── Filigrane géométrique subtil (icône très pâle, centré) ──
        if os.path.exists(ICON_PATH):
            canvas_obj.saveState()
            canvas_obj.setFillAlpha(0.03)
            icon_size = 400
            canvas_obj.drawImage(ICON_PATH,
                                (w - icon_size) / 2, (h - icon_size) / 2 - 30,
                                width=icon_size, height=icon_size,
                                preserveAspectRatio=True, mask='auto')
            canvas_obj.restoreState()

        # ── Fine ligne bleue en haut ──
        canvas_obj.setFillColor(SOMTECH_BLEU)
        canvas_obj.rect(0, h - 3, w, 3, fill=1, stroke=0)

        # ── Logo Somtech (haut gauche) ──
        logo_y = h - 80
        if os.path.exists(LOGO_PATH):
            canvas_obj.drawImage(LOGO_PATH, 60, logo_y, width=160, height=50,
                                preserveAspectRatio=True, mask='auto')
        else:
            canvas_obj.setFont("Helvetica-Bold", 18)
            canvas_obj.setFillColor(SOMTECH_ANTHRACITE)
            canvas_obj.drawString(60, logo_y + 15, "Somtech Solutions")

        # ── Séparateur fin sous le logo ──
        canvas_obj.setStrokeColor(SOMTECH_BORDER)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(60, logo_y - 12, w - 60, logo_y - 12)

        # ── Titre principal (centré, sobre) ──
        canvas_obj.setFont("Helvetica-Bold", 28)
        canvas_obj.setFillColor(SOMTECH_ANTHRACITE)
        canvas_obj.drawCentredString(w / 2, h - 190, "Rapport d'audit")

        canvas_obj.setFont("Helvetica-Bold", 22)
        canvas_obj.setFillColor(SOMTECH_ORANGE)
        canvas_obj.drawCentredString(w / 2, h - 222, "Conformité Loi 25")

        canvas_obj.setFont("Helvetica", 11)
        canvas_obj.setFillColor(HexColor("#6b7280"))
        canvas_obj.drawCentredString(w / 2, h - 248, "Loi sur la protection des renseignements personnels")
        canvas_obj.drawCentredString(w / 2, h - 264, "dans le secteur privé (RLRQ, c. P-39.1)")

        # ── Score (centré, dans un cadre sobre) ──
        score = report.get("score", 0)
        if score >= 90:
            score_color = SOMTECH_VERT
        elif score >= 70:
            score_color = SOMTECH_JAUNE
        elif score >= 50:
            score_color = SOMTECH_ORANGE
        else:
            score_color = SOMTECH_RED

        score_cx = w / 2
        score_cy = h - 350
        box_w, box_h = 140, 100
        canvas_obj.setFillColor(HexColor("#f9fafb"))
        canvas_obj.setStrokeColor(SOMTECH_BORDER)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.roundRect(score_cx - box_w / 2, score_cy - box_h / 2,
                            box_w, box_h, 6, fill=1, stroke=1)

        canvas_obj.setFont("Helvetica-Bold", 48)
        canvas_obj.setFillColor(score_color)
        canvas_obj.drawCentredString(score_cx, score_cy + 5, str(score))
        canvas_obj.setFont("Helvetica", 13)
        canvas_obj.setFillColor(HexColor("#9ca3af"))
        canvas_obj.drawCentredString(score_cx, score_cy - 18, "/ 100")
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.setFillColor(HexColor("#9ca3af"))
        canvas_obj.drawCentredString(score_cx, score_cy - 42, "SCORE DE CONFORMITÉ")

        # ── Infos projet (tableau sobre centré) ──
        y = h - 460
        infos = [
            ("Client", client_name or "—"),
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

        # ── Pied de page sobre ──
        canvas_obj.setStrokeColor(SOMTECH_BORDER)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(60, 55, w - 60, 55)

        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(HexColor("#9ca3af"))
        canvas_obj.drawString(60, 40, "CONFIDENTIEL — Somtech Solutions inc.")
        canvas_obj.drawRightString(w - 60, 40, f"Généré le {datetime.now().strftime('%d %B %Y')}")

        canvas_obj.restoreState()


def add_header_footer(canvas_obj, doc, report, client_name):
    """En-tête et pied de page pour les pages intérieures."""
    canvas_obj.saveState()
    w, h = letter

    # ── En-tête ──
    # Ligne orange en haut
    canvas_obj.setStrokeColor(SOMTECH_ORANGE)
    canvas_obj.setLineWidth(2)
    canvas_obj.line(50, h - 40, w - 50, h - 40)

    # En-tête gauche (bleu Somtech)
    canvas_obj.setFont("Helvetica-Bold", 8)
    canvas_obj.setFillColor(SOMTECH_BLEU)
    canvas_obj.drawString(50, h - 35, "AUDIT LOI 25 — CONFIDENTIEL")

    # En-tête droite
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(HexColor("#6b7280"))
    canvas_obj.drawRightString(w - 50, h - 35, client_name or report.get("projet", ""))

    # ── Pied de page ──
    canvas_obj.setStrokeColor(SOMTECH_BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(50, 45, w - 50, 45)

    # Logo icône dans le footer (petit)
    if os.path.exists(ICON_PATH):
        canvas_obj.drawImage(ICON_PATH, 50, 26, width=14, height=14,
                            preserveAspectRatio=True, mask='auto')
        left_x = 68
    else:
        left_x = 50

    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.setFillColor(HexColor("#9ca3af"))
    canvas_obj.drawString(left_x, 32, "Somtech Solutions — Rapport de conformité P-39.1")
    canvas_obj.drawRightString(w - 50, 32, f"Page {doc.page}")

    canvas_obj.restoreState()


# ─── Construction du document ───────────────────────────────────
def build_pdf(report, output_path, client_name=None, projet_name=None):
    """Construit le PDF complet."""
    styles = build_styles()

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        topMargin=60,
        bottomMargin=60,
        leftMargin=50,
        rightMargin=50,
        title=f"Audit Loi 25 — {projet_name or report.get('projet', 'Projet')}",
        author="Somtech inc.",
        subject="Rapport de conformité Loi 25 (P-39.1)",
    )

    story = []

    # ── Page de couverture (gérée dans onFirstPage) ──
    story.append(Spacer(1, 650))  # Placeholder pour la page de couverture
    story.append(PageBreak())

    # ── Table des matières ──
    story.append(Paragraph("Table des matières", styles["SectionTitle"]))
    story.append(Spacer(1, 12))

    toc_items = [
        ("1.", "Sommaire exécutif"),
        ("2.", "Score de conformité et exposition aux sanctions"),
        ("3.", "Inventaire des données personnelles"),
        ("4.", "Constats — Base de données"),
        ("5.", "Constats — API et Backend"),
        ("6.", "Constats — Frontend"),
        ("7.", "Constats — Gouvernance"),
        ("8.", "Plan d'action recommandé"),
        ("9.", "Références légales et méthodologie"),
    ]
    for num, title in toc_items:
        story.append(Paragraph(f'<b>{num}</b>  {title}', styles["BodyText2"]))
    story.append(PageBreak())

    # ── 1. Sommaire exécutif ──
    story.append(Paragraph("1. Sommaire exécutif", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))
    story.append(Paragraph(
        f"Le présent rapport présente les résultats de l'audit de conformité à la "
        f"<b>Loi sur la protection des renseignements personnels dans le secteur privé</b> "
        f"(RLRQ, c. P-39.1), communément appelée <b>Loi 25</b>, réalisé sur le projet "
        f"<b>{projet_name or report.get('projet', '—')}</b>.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"L'audit a identifié <b>{report['critiques']}</b> constat(s) critique(s), "
        f"<b>{report['majeurs']}</b> constat(s) majeur(s), "
        f"<b>{report['moderes']}</b> constat(s) modéré(s) et "
        f"<b>{report['mineurs']}</b> constat(s) mineur(s), "
        f"pour un <b>score de conformité de {report['score']}/100</b>.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 12))
    story.append(make_summary_table(report, styles))
    story.append(Spacer(1, 12))

    # ── 2. Score et sanctions ──
    story.append(Paragraph("2. Score de conformité et exposition aux sanctions", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))

    # Score
    story.append(make_score_display(report["score"]))
    story.append(Spacer(1, 16))

    # Barème
    story.append(Paragraph("Barème des scores :", styles["SubsectionTitle"]))
    bareme = [
        ("90-100", "Conforme", SOMTECH_VERT),
        ("70-89", "Partiellement conforme — corrections mineures requises", SOMTECH_JAUNE),
        ("50-69", "Non conforme — corrections majeures requises", SOMTECH_ORANGE),
        ("0-49", "Risque élevé — actions immédiates requises", SOMTECH_RED),
    ]
    for plage, desc, color in bareme:
        story.append(Paragraph(
            f'<font color="{color.hexval()}"><b>{plage}</b></font> : {desc}',
            styles["ConstatText"]
        ))
    story.append(Spacer(1, 16))

    # Tableau des sanctions
    story.append(Paragraph("Exposition aux sanctions (P-39.1) :", styles["SubsectionTitle"]))
    story.append(make_sanctions_table(styles))
    story.append(PageBreak())

    # ── 3-7. Constats (contenu brut du rapport) ──
    # On parse les sections ## du markdown et les reformate
    # Supporte les sections numérotées (## 1. Titre) et non-numérotées (## Plan d'action)
    sections_md = re.split(r"\n## (.+)", report["raw"])
    for i in range(1, len(sections_md), 2):
        section_title = sections_md[i].strip()
        section_body = sections_md[i + 1] if i + 1 < len(sections_md) else ""

        # Filtrer les sections pertinentes — sauter métadonnées, score, plan d'action (traité séparément)
        skip_kw = ["score de conformité", "annexe", "plan d'action"]
        if not any(kw in section_title.lower() for kw in skip_kw):
            story.append(Paragraph(section_title, styles["SectionTitle"]))
            story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))

            # Parser les sous-sections ###
            subsections = re.split(r"\n### (\d+\.\d+\s+.+)", section_body)
            for j in range(0, len(subsections)):
                block = subsections[j].strip()
                if not block:
                    continue

                # C'est un titre de sous-section
                if re.match(r"\d+\.\d+\s+", block):
                    story.append(Paragraph(block, styles["SubsectionTitle"]))
                    continue

                # C'est le contenu
                # Extraire le niveau de sévérité
                level_match = re.search(r"\*\*Niveau\s*:\s*\[?(\w+)", block)
                if level_match:
                    level = level_match.group(1)
                    story.append(make_severity_badge(level, styles))

                # Nettoyer et ajouter le texte (sans les tables Markdown complexes)
                lines = block.split("\n")
                for line in lines:
                    line = line.strip()
                    if not line or line.startswith("|") or line.startswith("---"):
                        continue
                    if line.startswith("**") and line.endswith("**"):
                        continue  # Skip les titres déjà traités
                    # Convertir le bold/italic Markdown basique
                    line = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line)
                    line = re.sub(r"\*(.+?)\*", r"<i>\1</i>", line)
                    line = re.sub(r"`(.+?)`", r"<font face='Courier' size='9'>\1</font>", line)
                    if line.startswith("- "):
                        line = "  \u2022  " + line[2:]
                    story.append(Paragraph(line, styles["ConstatText"]))

            story.append(PageBreak())

    # ── 8. Plan d'action ──
    story.append(Paragraph("8. Plan d'action recommandé", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))
    story.append(Paragraph(
        "Le tableau ci-dessous présente les actions correctives priorisées par niveau de sévérité. "
        "Les constats critiques doivent être corrigés immédiatement.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 8))
    story.append(make_plan_action_table(report["plan_action"], styles))
    story.append(PageBreak())

    # ── 9. Références légales ──
    story.append(Paragraph("9. Références légales et méthodologie", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SOMTECH_HIGHLIGHT, spaceAfter=12))

    story.append(Paragraph("Références légales", styles["SubsectionTitle"]))
    refs = [
        "<b>P-39.1</b> — Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1), mise à jour au 11 décembre 2025",
        "<b>Loi 25</b> — Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (2021, c. 25)",
        "<b>CAI</b> — Commission d'accès à l'information du Québec",
        "<b>Guide EFVP</b> — Guide d'évaluation des facteurs relatifs à la vie privée (CAI, v3.1, avril 2024)",
    ]
    for ref in refs:
        story.append(Paragraph(f"  \u2022  {ref}", styles["LegalRef"]))

    story.append(Spacer(1, 12))
    story.append(Paragraph("Méthodologie d'audit", styles["SubsectionTitle"]))
    methodo = [
        "Scan des migrations SQL pour l'inventaire PII (art. 2, 12)",
        "Vérification des politiques RLS (art. 20)",
        "Analyse statique du code frontend et backend (art. 10)",
        "Vérification de la configuration des services tiers (art. 17, 18.3)",
        "Vérification de la gouvernance (art. 3.1, 3.2, 3.3)",
    ]
    for item in methodo:
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
    parser = argparse.ArgumentParser(
        description="Générer un rapport PDF professionnel d'audit Loi 25"
    )
    parser.add_argument("rapport", help="Chemin du rapport Markdown (.md)")
    parser.add_argument("--output", "-o", help="Chemin du PDF de sortie")
    parser.add_argument("--client", "-c", help="Nom du client")
    parser.add_argument("--projet", "-p", help="Nom du projet")

    args = parser.parse_args()

    if not os.path.exists(args.rapport):
        print(f"ERREUR: Fichier non trouvé: {args.rapport}")
        sys.exit(1)

    # Déterminer le nom de sortie
    output = args.output
    if not output:
        base = os.path.splitext(args.rapport)[0]
        output = f"{base}.pdf"

    print(f"Lecture du rapport: {args.rapport}")
    report = parse_markdown_report(args.rapport)

    print(f"Génération du PDF: {output}")
    build_pdf(report, output, client_name=args.client, projet_name=args.projet)

    print(f"Rapport PDF généré avec succès: {output}")
    return output


if __name__ == "__main__":
    main()
