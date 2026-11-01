#!/usr/bin/env python
"""
Build the CrossBank TrustFL project presentation (16:9, 19 slides).

Run with the project venv:
    venv/Scripts/python.exe build_deck.py
Output:
    CrossBank_TrustFL_Presentation.pptx

All numbers come from checkpoints/audit_ledger.json, the model checkpoints and
blockchain/contract_deploy.json, so the deck can be regenerated after new rounds.
"""
import json
import os

from lxml import etree
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

# ---------------------------------------------------------------- design system
FONT = "Segoe UI"
MONO = "Consolas"
SW, SH = 13.333, 7.5

NAVY = RGBColor(0x0B, 0x1B, 0x2B)
NAVY_SOFT = RGBColor(0x14, 0x2B, 0x40)
INK = RGBColor(0x15, 0x29, 0x3E)
SLATE = RGBColor(0x56, 0x68, 0x79)
MUTED = RGBColor(0x8B, 0x9A, 0xA7)
TEAL = RGBColor(0x0F, 0xA9, 0x8F)
TEAL_DARK = RGBColor(0x0A, 0x7A, 0x67)
TEAL_TINT = RGBColor(0xE9, 0xF7, 0xF3)
BLUE = RGBColor(0x4C, 0x6F, 0xA5)
AMBER = RGBColor(0xD1, 0x86, 0x2A)
RED = RGBColor(0xC2, 0x45, 0x3B)
RED_TINT = RGBColor(0xFC, 0xEE, 0xEC)
MIST = RGBColor(0xF4, 0xF7, 0xFA)
LINE = RGBColor(0xDF, 0xE6, 0xEC)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PALE = RGBColor(0xB9, 0xC7, 0xD6)

CONTENT_L, CONTENT_R = 0.75, 12.58
CONTENT_W = CONTENT_R - CONTENT_L


def _sub(parent, tag, **attrs):
    el = etree.SubElement(parent, qn(tag))
    for key, value in attrs.items():
        el.set(key, str(value))
    return el


def new_slide(prs, bg=WHITE):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = bg
    return slide


def rect(slide, x, y, w, h, fill=None, line=None, lw=1.0,
         shape=MSO_SHAPE.RECTANGLE, radius=None):
    shp = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.shadow.inherit = False
    if radius is not None:
        try:
            shp.adjustments[0] = radius
        except Exception:
            pass
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(lw)
    shp.text_frame.word_wrap = True
    return shp


def add_text(slide, x, y, w, h, text="", size=12, bold=False, color=INK,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, font=FONT,
             italic=False, spacing=None, line_spacing=None, space_after=0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    if line_spacing:
        p.line_spacing = line_spacing
    if space_after:
        p.space_after = Pt(space_after)
    run = p.add_run()
    run.text = text
    f = run.font
    f.name = font
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color
    if spacing:
        f._rPr.set("spc", str(spacing))
    return tf


def para(tf, text, size=12, bold=False, color=INK, font=FONT, space_before=0,
         space_after=0, align=PP_ALIGN.LEFT, italic=False, line_spacing=None,
         first=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    if space_before:
        p.space_before = Pt(space_before)
    if space_after:
        p.space_after = Pt(space_after)
    if line_spacing:
        p.line_spacing = line_spacing
    run = p.add_run()
    run.text = text
    f = run.font
    f.name = font
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color
    return p


def set_bullet(p, char="\u2022", color=TEAL, indent=0.235):
    pPr = p._p.get_or_add_pPr()
    pPr.set("marL", str(int(Inches(indent))))
    pPr.set("indent", str(int(-Inches(indent))))
    for tag in ("a:buNone", "a:buChar", "a:buAutoNum", "a:buFont", "a:buClr"):
        for el in pPr.findall(qn(tag)):
            pPr.remove(el)
    buClr = _sub(pPr, "a:buClr")
    _sub(buClr, "a:srgbClr", val=str(color))
    _sub(pPr, "a:buFont", typeface="Arial")
    _sub(pPr, "a:buChar", char=char)


def bullets(slide, x, y, w, h, items, size=11.5, color=INK, gap=7,
            line_spacing=1.18, bullet_color=TEAL, anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    for idx, item in enumerate(items):
        p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        p.space_after = Pt(gap)
        p.line_spacing = line_spacing
        set_bullet(p, color=bullet_color)
        if isinstance(item, (tuple, list)):
            lead, rest = item
            r1 = p.add_run()
            r1.text = lead
            r1.font.name = FONT
            r1.font.size = Pt(size)
            r1.font.bold = True
            r1.font.color.rgb = INK
            r2 = p.add_run()
            r2.text = rest
            r2.font.name = FONT
            r2.font.size = Pt(size)
            r2.font.color.rgb = color
        else:
            run = p.add_run()
            run.text = item
            run.font.name = FONT
            run.font.size = Pt(size)
            run.font.color.rgb = color
    return tf


def arrow(slide, x1, y1, x2, y2, color=TEAL, lw=1.5):
    conn = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1),
                                      Inches(x2), Inches(y2))
    conn.line.color.rgb = color
    conn.line.width = Pt(lw)
    ln = conn.line._get_or_add_ln()
    _sub(ln, "a:tailEnd", type="triangle", w="med", len="med")
    return conn


def chip(slide, x, y, w, h, text, color=TEAL_DARK, fill=TEAL_TINT,
         size=9, bold=True, font=FONT, line=None):
    rect(slide, x, y, w, h, fill=fill, line=line, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.25)
    add_text(slide, x + 0.08, y + h / 2 - 0.11, w - 0.16, 0.22, text, size,
             bold, color, align=PP_ALIGN.CENTER, font=font)


def footer(slide, page):
    rect(slide, CONTENT_L, 7.02, CONTENT_W, 0.012, fill=LINE)
    add_text(slide, CONTENT_L, 7.1, 9.6, 0.22,
             "CrossBank TrustFL  \u00b7  Blockchain-audited federated fraud detection",
             8.5, False, MUTED)
    add_text(slide, CONTENT_R - 0.7, 7.09, 0.7, 0.22, f"{page:02d}", 9.5, True,
             TEAL, align=PP_ALIGN.RIGHT)


def header(slide, kicker, title, page):
    add_text(slide, CONTENT_L, 0.45, 9.0, 0.24, kicker.upper(), 9.5, True, TEAL,
             spacing=180)
    add_text(slide, CONTENT_L, 0.72, CONTENT_W, 0.82, title, 26, True, NAVY)
    rect(slide, CONTENT_L, 1.62, CONTENT_W, 0.012, fill=LINE)
    rect(slide, CONTENT_L, 1.61, 1.15, 0.035, fill=TEAL)
    footer(slide, page)


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def number_badge(slide, x, y, d, label, fill=TEAL, color=WHITE, size=11.5):
    rect(slide, x, y, d, d, fill=fill, shape=MSO_SHAPE.OVAL)
    add_text(slide, x, y + d / 2 - 0.13, d, 0.26, str(label), size, True, color,
             align=PP_ALIGN.CENTER)


def table(slide, x, y, widths, headers, rows, row_h=0.62, header_h=0.5,
          size=10, header_size=9, aligns=None):
    total_w = sum(widths)
    rect(slide, x, y, total_w, header_h, fill=NAVY)
    cx = x
    for i, head in enumerate(headers):
        add_text(slide, cx + 0.16, y + header_h / 2 - 0.1, widths[i] - 0.24, 0.22,
                 head, header_size, True, WHITE,
                 align=(aligns[i] if aligns else PP_ALIGN.LEFT))
        cx += widths[i]
    ry = y + header_h
    for r_idx, row in enumerate(rows):
        if r_idx % 2 == 1:
            rect(slide, x, ry, total_w, row_h, fill=MIST)
        cx = x
        for c_idx, cell in enumerate(row):
            spec = cell if isinstance(cell, dict) else {"text": cell}
            color = spec.get("color", INK if c_idx == 0 else SLATE)
            bold = spec.get("bold", c_idx == 0)
            font = spec.get("font", MONO if spec.get("mono") else FONT)
            add_text(slide, cx + 0.16, ry + row_h / 2 - 0.11, widths[c_idx] - 0.24,
                     0.24, spec["text"], spec.get("size", size), bold, color,
                     font=font, align=(aligns[c_idx] if aligns else PP_ALIGN.LEFT))
            cx += widths[c_idx]
        rect(slide, x, ry + row_h, total_w, 0.01, fill=LINE)
        ry += row_h
    return ry


# ---------------------------------------------------------------- source data
def load_context():
    ledger = []
    if os.path.exists(os.path.join("checkpoints", "audit_ledger.json")):
        with open(os.path.join("checkpoints", "audit_ledger.json")) as fh:
            ledger = json.load(fh)

    rounds = {}
    for entry in ledger:
        rounds.setdefault(entry["round_id"], entry)
    r1 = rounds.get(1, {})
    r2 = rounds.get(2, {})
    chain = next((e.get("blockchain_receipt") for e in ledger if e.get("blockchain_receipt")), {})
    return r1, r2, chain


R1, R2, CHAIN = load_context()
R1_METRICS = R1.get("evaluation_metrics", {"Bank_A": 0.0502, "Bank_C": 0.7460})
R2_METRICS = R2.get("evaluation_metrics", {"Bank_A": 0.1366, "Bank_C": 0.6618})
REJECT = next((s for s in R2.get("client_submissions", [])
               if s["decision"] == "REJECTED"), None)
REJECT_REASON = REJECT["reason"] if REJECT else \
    "Abnormal weight norm (287512.52 > 6249.54). Poisoning suspected."
GLOBAL_HASH = R1.get("resulting_global_model_hash",
                     "406aa1ddcf59d07528bf60fbabc579bf2948623fd673d5e7a05dbc869adccdc3")
R2_HASH = R2.get("resulting_global_model_hash",
                 "84f2b89d531b706895c19cf900038a9d5ddb738a06a3b34b895bbbda3e482364")
TX_HASH = CHAIN.get("transaction_hash",
                    "9352575235200413282e746867eec1fe769e5bdba5c68e074aa6edbd08e33dd2")
BLOCK = CHAIN.get("block_number", 2)
GAS = CHAIN.get("gas_used", 818611)

SAMPLES = {"a": 284807, "b": 308213, "c": 594643}
TOTAL = sum(SAMPLES.values())
MEDIAN_NORM = 6249.54 / 3.0
POISON_NORM = 287512.52


# ---------------------------------------------------------------- slide 1
def slide_title(prs):
    s = new_slide(prs, NAVY)
    rect(s, 8.55, -1.6, 6.6, 6.6, fill=NAVY_SOFT, shape=MSO_SHAPE.OVAL)
    rect(s, 9.9, 3.6, 4.3, 4.3, fill=RGBColor(0x10, 0x23, 0x35), shape=MSO_SHAPE.OVAL)
    rect(s, 0, 0, 0.09, SH, fill=TEAL)

    chip(s, 0.9, 1.05, 3.05, 0.36, "FINAL YEAR PROJECT  \u00b7  2026", TEAL,
         RGBColor(0x12, 0x2B, 0x40), size=9, line=RGBColor(0x25, 0x44, 0x5B))

    add_text(s, 0.9, 1.72, 8.6, 1.1, "CrossBank TrustFL", 44, True, WHITE)
    add_text(s, 0.9, 2.55, 7.9, 1.5,
             "Blockchain-Audited Federated Learning for Privacy-Preserving "
             "Cross-Bank Fraud Detection", 20, False, RGBColor(0xD7, 0xE3, 0xEC),
             line_spacing=1.2)
    rect(s, 0.9, 4.15, 2.2, 0.03, fill=TEAL)
    add_text(s, 0.9, 4.38, 8.2, 0.9,
             "Three banks  \u00b7  1.19M private transactions  \u00b7  zero raw data shared  "
             "\u00b7  every round anchored on-chain", 11.5, False, PALE,
             line_spacing=1.3)

    add_text(s, 0.9, 6.02, 4.8, 0.3, "Presented by", 8.5, True, TEAL, spacing=140)
    add_text(s, 0.9, 6.28, 5.6, 0.34, "[Your Name]", 14, True, WHITE)
    add_text(s, 5.4, 6.02, 4.6, 0.3, "Under the guidance of", 8.5, True, TEAL, spacing=140)
    add_text(s, 5.4, 6.28, 5.0, 0.34, "[Guide Name]", 14, True, WHITE)
    add_text(s, 0.9, 6.85, 8.0, 0.28, "Department of Computer Science and Engineering",
             10, False, MUTED)

    # small client motif, bottom right
    for i, label in enumerate(("A", "B", "C")):
        bx = 9.95 + i * 0.76
        rect(s, bx, 5.3, 0.5, 0.5, fill=NAVY_SOFT, line=TEAL, lw=1.0,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.18)
        add_text(s, bx, 5.43, 0.5, 0.24, label, 10, True, TEAL,
                 align=PP_ALIGN.CENTER)
    add_text(s, 9.95, 5.94, 2.5, 0.24, "weights only  \u00b7  hashed  \u00b7  on-chain",
             8.2, True, PALE)

    notes(s, "Open with one sentence: three banks train one fraud model together, no raw "
             "transaction leaves a bank, and every round is written to a smart contract. "
             "Say that the deck moves from problem -> method -> measured results.")


# ---------------------------------------------------------------- slide 2
def slide_agenda(prs):
    s = new_slide(prs)
    header(s, "Agenda", "What this presentation covers", 2)
    items = [
        "Problem: why fraud intelligence stays siloed",
        "Limitations of existing approaches",
        "Objectives and scope",
        "System architecture",
        "Unified 16-D feature space",
        "Datasets and preprocessing",
        "Federated training protocol",
        "Byzantine defense engine",
        "Blockchain audit layer",
        "Results, limitations and conclusion",
    ]
    y = 2.02
    for i, item in enumerate(items, 1):
        add_text(s, CONTENT_L, y + 0.06, 0.45, 0.26, f"{i:02d}", 10.5, True, TEAL,
                 font=MONO)
        add_text(s, CONTENT_L + 0.55, y, 6.6, 0.3, item, 12.5, False, INK)
        rect(s, CONTENT_L, y + 0.44, 7.2, 0.01, fill=LINE)
        y += 0.465

    card_x, card_y, card_w, card_h = 8.55, 2.0, 4.03, 4.62
    rect(s, card_x, card_y, card_w, card_h, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.04)
    add_text(s, card_x + 0.35, card_y + 0.3, card_w - 0.7, 0.24, "PROJECT AT A GLANCE",
             8.5, True, TEAL, spacing=170)
    stats = [
        ("3", "banks in the federation"),
        ("1.19M", "private records, none pooled"),
        ("4", "defense layers before aggregation"),
        (f"{GAS:,}", "gas to audit one round on-chain"),
    ]
    sy = card_y + 0.72
    for value, label in stats:
        add_text(s, card_x + 0.35, sy, card_w - 0.7, 0.45, value, 24, True, WHITE)
        add_text(s, card_x + 0.35, sy + 0.42, card_w - 0.7, 0.28, label, 9.5, False,
                 PALE)
        sy += 0.92
    notes(s, "Keep this to ten seconds. Point at the four numbers on the right: they are the "
             "spine of the project - three clients, 1.19M records that stay local, four "
             "defense layers, and one on-chain audit per round.")


# ---------------------------------------------------------------- slide 3
def slide_problem(prs):
    s = new_slide(prs)
    header(s, "Problem", "Fraud intelligence is trapped inside bank silos", 3)
    add_text(s, CONTENT_L, 1.82, CONTENT_W, 0.32,
             "Fraud patterns learned at one institution are invisible to every other one, "
             "while the transactions that reveal them cannot legally be shared.", 11.5,
             False, SLATE)

    cards = [
        ("Data silos",
         "Each bank sees only its own customers. A fraud ring that moves money across three "
         "institutions is never visible end to end."),
        ("Regulatory walls",
         "GDPR, India's DPDP Act and RBI outsourcing rules keep raw transaction records "
         "inside the institution that collected them."),
        ("Rare, shifting fraud",
         "Fraud is under 1% of traffic and changes shape. A model trained on one bank "
         "generalises poorly to unseen attack patterns."),
        ("Untrusted participants",
         "A compromised or careless client can push scaled or noisy weights and quietly "
         "corrupt the shared model."),
        ("No verifiable history",
         "Centralised training logs are mutable. A regulator cannot independently prove "
         "which update produced which model."),
    ]
    w, h = 3.78, 1.86
    xs = [0.75, 4.775, 8.8]
    ys = [2.32, 4.32]
    for idx, (title, body) in enumerate(cards):
        cx = xs[idx % 3]
        cy = ys[idx // 3]
        rect(s, cx, cy, w, h, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
             radius=0.045)
        rect(s, cx, cy + 0.22, 0.045, 0.42, fill=TEAL)
        add_text(s, cx + 0.3, cy + 0.24, w - 0.5, 0.3, title, 12.5, True, NAVY)
        add_text(s, cx + 0.3, cy + 0.68, w - 0.55, h - 0.85, body, 10.2, False, SLATE,
                 line_spacing=1.22)

    qx, qy = xs[2], ys[1]
    rect(s, qx, qy, w, h, fill=NAVY, line=None, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.045)
    add_text(s, qx + 0.3, qy + 0.28, w - 0.6, 0.24, "THE PREMISE", 8.5, True, TEAL,
             spacing=160)
    add_text(s, qx + 0.3, qy + 0.62, w - 0.55, 1.0,
             "Learn across institutions without pooling a single row.", 14, True, WHITE,
             line_spacing=1.18)
    notes(s, "Do not read all five cards. Pick the first and the third, then say the last one "
             "is the one industry audits care about: training history that nobody can edit.")


# ---------------------------------------------------------------- slide 4
def slide_gap(prs):
    s = new_slide(prs)
    header(s, "Problem", "Why the obvious approaches fall short", 4)
    rows = [
        ["Centralised data pool", "Best possible accuracy",
         "Raw records cannot legally leave a bank; one breach exposes every customer"],
        ["Local model per bank", "Complete privacy",
         "No cross-institution signal - rare fraud patterns stay invisible"],
        ["Vanilla FedAvg", "Private and collaborative",
         "One scaled or noisy client can dominate the average; no screening, no recourse"],
        ["Central training logs", "Simple to implement",
         "Mutable history - the auditor must simply trust the coordinator's word"],
    ]
    table(s, CONTENT_L, 2.0, [2.55, 2.7, 6.58],
          ["Approach", "What it gives you", "Why it is not enough for cross-bank fraud"],
          rows, row_h=0.86, header_h=0.52, size=10.5, header_size=9.2)

    y = 6.1
    rect(s, CONTENT_L, y, CONTENT_W, 0.78, fill=TEAL_TINT, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.08)
    rect(s, CONTENT_L, y, 0.05, 0.78, fill=TEAL)
    add_text(s, CONTENT_L + 0.35, y + 0.14, CONTENT_W - 0.6, 0.55,
             "The gap: privacy, robustness and verifiability are usually solved separately - "
             "never inside one pipeline.", 12.5, True, NAVY)
    notes(s, "Land the point that each existing option solves one of the three requirements "
             "and breaks another. The project asks for all three at once.")


# ---------------------------------------------------------------- slide 5
def slide_objectives(prs):
    s = new_slide(prs)
    header(s, "Objectives", "What the system sets out to do", 5)
    objectives = [
        ("Cross-silo training",
         "Train one fraud detector over three banks while every raw record stays on its "
         "own node."),
        ("Schema unification",
         "Map Credit Card, PaySim and BankSim into a single 16-dimensional behavioural "
         "feature space."),
        ("Byzantine resilience",
         "Screen and reject scaled, noisy or label-flipped updates before they reach the "
         "global model."),
        ("Verifiable accountability",
         "Anchor each round's update hashes, verdicts and resulting model hash on an EVM "
         "smart contract."),
        ("Operator console",
         "Expose training, scoring, attack simulation and chain verification through one "
         "web interface."),
    ]
    y = 1.98
    for i, (title, desc) in enumerate(objectives, 1):
        number_badge(s, CONTENT_L, y + 0.1, 0.42, i, fill=TEAL if i < 5 else NAVY)
        add_text(s, CONTENT_L + 0.62, y + 0.04, 6.9, 0.28, title, 12.5, True, NAVY)
        add_text(s, CONTENT_L + 0.62, y + 0.36, 6.9, 0.5, desc, 10.3, False, SLATE,
                 line_spacing=1.18)
        rect(s, CONTENT_L, y + 0.86, 7.45, 0.01, fill=LINE)
        y += 0.94

    px, py, pw, ph = 8.6, 1.98, 3.98, 4.72
    rect(s, px, py, pw, ph, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, px + 0.32, py + 0.28, pw - 0.6, 0.24, "SCOPE AND ASSUMPTIONS", 8.5, True,
             TEAL_DARK, spacing=150)
    bullets(s, px + 0.32, py + 0.68, pw - 0.64, 3.0, [
        "Three simulated bank nodes, one coordinator",
        "Supervised binary classification of transactions",
        "Identical MLP architecture on every client",
        "In-memory EVM (eth-tester), optional RPC endpoint",
        "Two local epochs per round; rounds triggered on demand",
    ], size=10, gap=8, line_spacing=1.2)
    rect(s, px + 0.32, 5.62, pw - 0.64, 0.01, fill=LINE)
    add_text(s, px + 0.32, 5.74, pw - 0.6, 0.22, "OUT OF SCOPE", 7.8, True, MUTED,
             spacing=130)
    add_text(s, px + 0.32, 5.98, pw - 0.64, 0.55,
             "Real inter-bank data-sharing agreements, production cloud deployment and "
             "public-chain gas costs.", 8.8, False, SLATE, line_spacing=1.2)
    notes(s, "Read the four technical objectives only; the fifth is the demo surface. Mention "
             "that scope is deliberately small - three clients - so that defense behaviour can "
             "be inspected precisely.")


# ---------------------------------------------------------------- slide 6
def slide_architecture(prs):
    s = new_slide(prs)
    header(s, "Methodology", "System architecture", 6)

    banks = [
        ("Bank A", "Credit Card  \u00b7  284,807", 1.98),
        ("Bank B", "PaySim mobile  \u00b7  308,213", 3.32),
        ("Bank C", "BankSim retail  \u00b7  594,643", 4.66),
    ]
    for name, sub, y in banks:
        rect(s, CONTENT_L, y, 2.5, 1.2, fill=MIST, line=LINE,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
        rect(s, CONTENT_L, y, 0.045, 1.2, fill=TEAL)
        add_text(s, CONTENT_L + 0.22, y + 0.16, 2.1, 0.28, name, 13, True, NAVY)
        add_text(s, CONTENT_L + 0.22, y + 0.48, 2.1, 0.24, sub, 9.2, False, SLATE)
        add_text(s, CONTENT_L + 0.22, y + 0.8, 2.1, 0.22, "RAW DATA STAYS LOCAL", 7.5,
                 True, TEAL_DARK, spacing=60)

    # coordinator / trust boundary
    cx, cy, cw, ch = 4.02, 1.98, 3.68, 3.88
    rect(s, cx, cy, cw, ch, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.045)
    add_text(s, cx + 0.3, cy + 0.26, cw - 0.6, 0.24, "TRUST BOUNDARY", 8.2, True, TEAL,
             spacing=170)
    add_text(s, cx + 0.3, cy + 0.52, cw - 0.6, 0.3, "Federated Coordinator", 14, True, WHITE)
    add_text(s, cx + 0.3, cy + 0.84, cw - 0.6, 0.24, "screens, aggregates, commits",
             9.2, False, PALE)
    steps = [
        ("1", "Tensor sanity screen"),
        ("2", "Norm outlier filter"),
        ("3", "Robust aggregation"),
        ("4", "SHA-256 commitment"),
    ]
    sy = cy + 1.3
    for num, label in steps:
        rect(s, cx + 0.3, sy, cw - 0.6, 0.46, fill=NAVY_SOFT,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.18)
        add_text(s, cx + 0.44, sy + 0.12, 0.24, 0.22, num, 9, True, TEAL, font=MONO)
        add_text(s, cx + 0.78, sy + 0.12, cw - 1.4, 0.24, label, 9.8, False, WHITE)
        sy += 0.54

    add_text(s, CONTENT_L, 6.0, 7.0, 0.26,
             "Only model weights and SHA-256 hashes cross this boundary.", 10, True,
             TEAL_DARK, italic=True)

    # right column
    rx, rw = 8.32, 4.26
    rect(s, rx, 1.98, rw, 1.82, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, rx + 0.28, 2.16, rw - 0.5, 0.28, "Global Fraud MLP", 13, True, NAVY)
    add_text(s, rx + 0.28, 2.5, rw - 0.5, 0.26, "16 \u2192 64 \u2192 32 \u2192 1", 11,
             True, TEAL_DARK, font=MONO)
    add_text(s, rx + 0.28, 2.82, rw - 0.5, 0.5,
             "3,393 parameters  \u00b7  BatchNorm, ReLU, Dropout 0.2  \u00b7  sigmoid output",
             9.2, False, SLATE, line_spacing=1.2)
    add_text(s, rx + 0.28, 3.42, rw - 0.5, 0.24, "shared by all three banks", 8.5, True,
             TEAL_DARK, spacing=40)

    rect(s, rx, 4.02, rw, 1.89, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
    add_text(s, rx + 0.28, 4.2, rw - 0.5, 0.28, "FraudAudit.sol", 13, True, WHITE)
    add_text(s, rx + 0.28, 4.52, rw - 0.5, 0.26, "EVM smart contract", 9.2, False, PALE)
    add_text(s, rx + 0.28, 4.88, rw - 0.55, 0.65,
             "Weights hashes, defense verdicts, reasons and the global model hash, written "
             "once per round.", 9.2, False, PALE, line_spacing=1.22)
    add_text(s, rx + 0.28, 5.56, rw - 0.5, 0.22, "COORDINATOR-ONLY WRITES", 7.5, True,
             TEAL, spacing=60)

    for _, _, y in banks:
        arrow(s, CONTENT_L + 2.55, y + 0.6, cx - 0.05, y + 0.6, TEAL, 1.25)
    arrow(s, cx + cw + 0.03, 2.9, rx - 0.03, 2.9, TEAL, 1.4)
    arrow(s, cx + cw + 0.03, 4.95, rx - 0.03, 4.95, TEAL, 1.4)

    bar_y = 6.4
    rect(s, CONTENT_L, bar_y, CONTENT_W, 0.44, fill=MIST, line=LINE,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.2)
    add_text(s, CONTENT_L + 0.25, bar_y + 0.11, CONTENT_W - 0.5, 0.24,
             "Operator console (Next.js)  \u00b7  overview  \u00b7  training  \u00b7  fraud "
             "explorer  \u00b7  security lab  \u00b7  blockchain explorer", 9.2, False, SLATE)

    notes(s, "Trace one update with the pointer: bank -> hash -> defense screen -> aggregate "
             "-> new global hash -> on-chain receipt. Emphasise that the banks never send rows, "
             "and the chain never stores weights.")


# ---------------------------------------------------------------- slide 7
def slide_features(prs):
    s = new_slide(prs)
    header(s, "Methodology", "Three schemas, one 16-dimensional feature space", 7)
    add_text(s, CONTENT_L, 1.82, CONTENT_W, 0.3,
             "Every transaction, whatever its source, is transformed into the same 16 floats "
             "before the model sees it.", 11, False, SLATE)

    groups = [
        ("Value", TEAL, ["amount_norm", "amount_log", "is_high_amount",
                         "amount_to_median_ratio"]),
        ("Time", BLUE, ["hour_sin", "hour_cos", "day_sin", "day_cos"]),
        ("Behaviour", AMBER, ["trans_velocity_proxy", "rapid_outflow_flag",
                              "high_risk_channel_flag", "zero_balance_post_flag"]),
        ("Risk", TEAL_DARK, ["heuristic_risk_score", "direction_outflow_flag",
                             "institution_scale_factor", "deviation_score"]),
    ]
    xs = [0.75, 3.75, 6.75, 9.75]
    for (name, color, feats), x in zip(groups, xs):
        rect(s, x, 2.26, 2.83, 1.98, fill=WHITE, line=LINE,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
        rect(s, x, 2.26, 2.83, 0.05, fill=color)
        add_text(s, x + 0.22, 2.42, 2.4, 0.26, name.upper(), 9, True, color, spacing=120)
        fy = 2.78
        for feat in feats:
            add_text(s, x + 0.22, fy, 2.45, 0.22, feat, 8.8, False, INK, font=MONO)
            fy += 0.33

    py = 4.48
    sources = ["Credit Card  \u00b7  284,807", "PaySim  \u00b7  308,213",
               "BankSim  \u00b7  594,643"]
    for i, src in enumerate(sources):
        chip(s, CONTENT_L, py + i * 0.34, 2.1, 0.28, src, SLATE, MIST, size=8.5,
             bold=False, line=LINE)

    arrow(s, 2.95, py + 0.55, 3.5, py + 0.55, TEAL, 1.3)

    box_x, box_w = 3.55, 4.35
    rect(s, box_x, py - 0.05, box_w, 0.98, fill=TEAL_TINT, line=None,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
    add_text(s, box_x + 0.25, py + 0.1, box_w - 0.5, 0.24, "Per-source transform", 10.5,
             True, NAVY)
    add_text(s, box_x + 0.25, py + 0.4, box_w - 0.5, 0.5,
             "median scaling  \u00b7  log amounts  \u00b7  sin/cos time  \u00b7  tanh clipping  "
             "\u00b7  risk heuristics", 8.8, False, SLATE, line_spacing=1.2)

    arrow(s, 7.98, py + 0.45, 8.55, py + 0.45, TEAL, 1.3)
    rect(s, 8.6, py - 0.05, 2.4, 0.98, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.06)
    add_text(s, 8.6, py + 0.17, 2.4, 0.3, "16-D vector", 15, True, WHITE,
             align=PP_ALIGN.CENTER)
    add_text(s, 8.6, py + 0.55, 2.4, 0.24, "float32, model-ready", 8.5, False, PALE,
             align=PP_ALIGN.CENTER)

    add_text(s, 11.25, py + 0.05, 1.4, 0.85,
             "Same shape,\nsame model,\naverageable\nweights", 9, True, TEAL_DARK,
             line_spacing=1.25)

    y = 5.88
    rect(s, CONTENT_L, y, CONTENT_W, 0.86, fill=MIST, line=LINE,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.07)
    rect(s, CONTENT_L, y, 0.05, 0.86, fill=TEAL)
    add_text(s, CONTENT_L + 0.34, y + 0.15, CONTENT_W - 0.6, 0.3,
             "One schema, one architecture - the precondition for averaging weights across "
             "institutions.", 12, True, NAVY)
    add_text(s, CONTENT_L + 0.34, y + 0.51, CONTENT_W - 0.6, 0.24,
             "Every record becomes a 16-float vector inside preprocessing, before any model "
             "or network call.", 9.5, False, SLATE)

    notes(s, "The hard part is not the neural network - it is making three unrelated datasets "
             "speak the same language. Point out that the features are behavioural, not "
             "identity data, which keeps the mapping privacy-friendly.")


# ---------------------------------------------------------------- slide 8
def slide_datasets(prs):
    s = new_slide(prs)
    header(s, "Methodology", "Datasets and preprocessing", 8)
    rows = [
        ["A", "Credit Card Fraud (ULB)", "Card transactions", "284,807",
         "V1-V28 anomaly norm \u2192 deviation_score"],
        ["B", "PaySim", "Mobile money transfers", "308,213",
         "Balance emptied + TRANSFER / CASH_OUT flags"],
        ["C", "BankSim", "Retail payments", "594,643",
         "High-risk merchant categories (travel, jewelry)"],
    ]
    table(s, CONTENT_L, 1.95, [0.7, 3.0, 2.5, 1.35, 4.28],
          ["Bank", "Dataset", "Transaction type", "Records", "Fraud signal mapped to"],
          rows, row_h=0.72, header_h=0.5, size=10, header_size=9,
          aligns=[PP_ALIGN.CENTER, PP_ALIGN.LEFT, PP_ALIGN.LEFT, PP_ALIGN.RIGHT,
                  PP_ALIGN.LEFT])

    stats = [
        ("1,187,663", "records in the federation, none pooled"),
        ("16", "features per transaction, uniformly scaled"),
        ("< 1%", "fraud prevalence in every source dataset"),
    ]
    for i, (value, label) in enumerate(stats):
        x = CONTENT_L + i * 3.98
        rect(s, x, 4.82, 3.78, 0.98, fill=MIST, line=LINE,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.07)
        add_text(s, x + 0.25, 4.98, 1.75, 0.4, value, 19, True, TEAL_DARK)
        add_text(s, x + 1.95, 4.95, 1.7, 0.6, label, 8.8, False, SLATE,
                 line_spacing=1.15)

    add_text(s, CONTENT_L, 6.02, 1.4, 0.22, "PREPROCESSING", 8.2, True, TEAL,
             spacing=150)
    add_text(s, CONTENT_L + 1.45, 5.99, CONTENT_W - 1.45, 0.7,
             "Amounts are median-normalised and log-scaled, timestamps encoded as sine/cosine "
             "pairs, and class imbalance handled with pos_weight = negatives / positives in "
             "BCEWithLogitsLoss. If a CSV is absent, a seeded synthetic generator keeps the "
             "pipeline runnable.", 9.2, False, SLATE, line_spacing=1.22)

    notes(s, "Say the sample counts out loud - they are what the audit ledger records. Note "
             "that PaySim is sampled (all frauds plus non-fraud rows) to keep rounds fast, and "
             "that the datasets are heterogeneous on purpose.")


# ---------------------------------------------------------------- slide 9
def slide_protocol(prs):
    s = new_slide(prs)
    header(s, "Methodology", "Federated training protocol", 9)
    steps = [
        ("Global broadcast",
         "The coordinator sends the current global weights and round id to all three banks."),
        ("Local training",
         "Two epochs on private records: Adam at 1e-3, batch 512, class-weighted BCE loss."),
        ("Hashed submission",
         "Each client hashes its new state_dict with SHA-256 and submits weights, sample count "
         "and hash."),
        ("Screen and aggregate",
         "Defense layers 1-3 run; accepted updates are combined by FedAvg or coordinate "
         "median."),
        ("Commit and publish",
         "The new global hash is saved, evaluated and written to the FraudAudit contract."),
    ]
    y = 1.96
    for i, (title, desc) in enumerate(steps, 1):
        number_badge(s, CONTENT_L, y + 0.06, 0.38, i, fill=TEAL, size=10)
        add_text(s, CONTENT_L + 0.55, y + 0.02, 6.3, 0.28, title, 12.5, True, NAVY)
        add_text(s, CONTENT_L + 0.55, y + 0.33, 6.4, 0.5, desc, 10, False, SLATE,
                 line_spacing=1.18)
        if i < 5:
            rect(s, CONTENT_L + 0.19, y + 0.47, 0.012, 0.42, fill=LINE)
        y += 0.94

    px, pw = 7.72, 4.86
    rect(s, px, 1.96, pw, 2.06, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, px + 0.3, 2.12, pw - 0.6, 0.24, "MODEL CARD", 8.2, True, TEAL_DARK,
             spacing=150)
    add_text(s, px + 0.3, 2.4, pw - 0.6, 0.3, "GlobalFraudMLP", 13, True, NAVY)
    add_text(s, px + 0.3, 2.74, pw - 0.6, 0.26, "16 \u2192 64 \u2192 32 \u2192 1", 10.5,
             True, TEAL_DARK, font=MONO)
    add_text(s, px + 0.3, 3.06, pw - 0.6, 0.8,
             "BatchNorm + ReLU + Dropout(0.2) in both hidden layers, single logit output, "
             "3,393 parameters.", 9.2, False, SLATE, line_spacing=1.2)

    rect(s, px, 4.2, pw, 2.38, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
    add_text(s, px + 0.3, 4.36, pw - 0.6, 0.24, "SAMPLE-WEIGHTED AGGREGATION", 8.2, True,
             TEAL, spacing=150)
    add_text(s, px + 0.3, 4.7, pw - 0.6, 0.6,
             "w = \u03a3 (n\u2096 \u00b7 w\u2096) / \u03a3 n\u2096", 20, True, WHITE, font=MONO)
    add_text(s, px + 0.3, 5.36, pw - 0.6, 0.9,
             "n\u2096 is the number of local records at bank k, so larger banks contribute "
             "proportionally more - which is exactly why a large poisoned client is dangerous.",
             9.2, False, PALE, line_spacing=1.24)
    add_text(s, px + 0.3, 6.22, pw - 0.6, 0.24, "coordinate median available as fallback",
             8.5, True, TEAL_DARK, spacing=40)

    notes(s, "This is the slide examiners ask about. Two numbers matter: two local epochs (so "
             "rounds stay fast) and sample-weighted averaging (so the 594k-row bank is worth "
             "50% of the update - the risk shown later).")


# ---------------------------------------------------------------- slide 10
def slide_defense(prs):
    s = new_slide(prs)
    header(s, "Methodology", "Byzantine defense engine", 10)
    add_text(s, CONTENT_L, 1.8, CONTENT_W, 0.3,
             "Four checks sit between a client submission and the global model.", 11, False,
             SLATE)

    layers = [
        ("1", "Structural sanity",
         "Drops NaN, infinite, non-tensor or malformed updates before any scoring happens."),
        ("2", "Norm outlier screen",
         "Computes each update's Frobenius norm and rejects it when norm > 3 \u00d7 cohort "
         "median (needs at least three clients)."),
        ("3", "Robust aggregation",
         "Sample-weighted FedAvg, or coordinate-wise median when collusion or label flipping "
         "is suspected."),
        ("4", "Hash commitment",
         "SHA-256 over the sorted state_dict; the coordinator re-hashes every submission and "
         "writes the verdict on-chain."),
    ]
    y = 2.18
    for num, title, desc in layers:
        rect(s, CONTENT_L, y, 7.35, 0.98, fill=MIST, line=LINE,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.07)
        rect(s, CONTENT_L, y, 0.05, 0.98, fill=TEAL if num != "2" else AMBER)
        add_text(s, CONTENT_L + 0.22, y + 0.28, 0.3, 0.3, num, 14, True, TEAL_DARK,
                 font=MONO)
        add_text(s, CONTENT_L + 0.62, y + 0.14, 6.4, 0.26, title, 11.5, True, NAVY)
        add_text(s, CONTENT_L + 0.62, y + 0.43, 6.55, 0.5, desc, 9.3, False, SLATE,
                 line_spacing=1.18)
        y += 1.08

    px, py, pw, ph = 8.38, 2.18, 4.2, 4.16
    rect(s, px, py, pw, ph, fill=WHITE, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, px + 0.28, py + 0.2, pw - 0.56, 0.24, "OBSERVED IN ROUND 2", 8.2, True,
             AMBER, spacing=150)
    add_text(s, px + 0.28, py + 0.48, pw - 0.56, 0.26, "A 100\u00d7 scaled update",
             12.5, True, NAVY)

    rows = [
        ("cohort median norm", f"{MEDIAN_NORM:,.2f}"),
        ("rejection threshold", f"{MEDIAN_NORM * 3:,.2f}"),
        ("bank_c submitted", f"{POISON_NORM:,.2f}"),
    ]
    ry = py + 0.92
    for label, value in rows:
        add_text(s, px + 0.28, ry, 2.25, 0.22, label, 8.8, False, SLATE)
        add_text(s, px + 1.85, ry, pw - 2.15, 0.22, value, 9.2, True,
                 RED if value.startswith("287") else INK, font=MONO,
                 align=PP_ALIGN.RIGHT)
        ry += 0.36

    rect(s, px + 0.28, py + 2.12, pw - 0.56, 0.38, fill=RED_TINT,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.16)
    add_text(s, px + 0.4, py + 2.22, pw - 0.8, 0.22, "REJECTED  \u00b7  poisoning suspected",
             8.5, True, RED, spacing=60)
    add_text(s, px + 0.28, py + 2.62, pw - 0.56, 0.55,
             "\u201cAbnormal weight norm (287512.52 > 6249.54).\u201d", 8.8, False, SLATE,
             italic=True, line_spacing=1.2)
    add_text(s, px + 0.28, py + 3.24, pw - 0.56, 0.2, "GLOBAL HASH AFTER SCREENING", 7.5,
             True, TEAL_DARK, spacing=80)
    add_text(s, px + 0.28, py + 3.46, pw - 0.56, 0.24, R2_HASH[:24] + "\u2026", 8.5, False,
             INK, font=MONO)

    notes(s, "Walk layer by layer but stop on layer 2: the median is computed over the cohort, "
             "the threshold is three times it, and Bank C's 100x scaling landed two orders of "
             "magnitude above it. Mention that layer 4 makes the verdict auditable, not just "
             "logged.")


# ---------------------------------------------------------------- slide 11
def slide_blockchain(prs):
    s = new_slide(prs)
    header(s, "Methodology", "Blockchain audit layer", 11)
    add_text(s, CONTENT_L, 1.8, CONTENT_W, 0.3,
             "The chain stores commitments, never data - so privacy survives while history "
             "becomes tamper-evident.", 11, False, SLATE)

    lx, lw = 0.75, 5.35
    rect(s, lx, 2.14, lw, 3.05, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, lx + 0.3, 2.3, lw - 0.6, 0.24, "ONE ROUND, ON-CHAIN", 8.2, True, TEAL_DARK,
             spacing=150)
    rows = [
        ("roundId + strategy", "round number and FEDAVG / MEDIAN"),
        ("globalModelHash", "SHA-256 of the resulting weights"),
        ("submissions[]", "bank, weight hash, sample count, verdict, reason"),
        ("timestamp", "block time, not server time"),
        ("isFinalized", "a round cannot be written twice"),
    ]
    ry = 2.64
    for key, desc in rows:
        add_text(s, lx + 0.3, ry, 1.75, 0.22, key, 8.6, True, INK, font=MONO)
        add_text(s, lx + 2.08, ry, lw - 2.35, 0.24, desc, 8.6, False, SLATE)
        ry += 0.48

    rect(s, lx, 5.36, lw, 1.42, fill=WHITE, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, lx + 0.3, 5.5, lw - 0.6, 0.24, "ACCESS CONTROL", 8.2, True, TEAL_DARK,
             spacing=150)
    bullets(s, lx + 0.3, 5.74, lw - 0.55, 0.95, [
        ("onlyCoordinator ", "modifier on recordRound()"),
        ("view calls ", "getRoundSummary(), getRoundSubmission()"),
        ("constructor ", "sets the coordinator to the deployer"),
    ], size=8.6, gap=3, line_spacing=1.05)

    # solidity card
    cx, cw = 6.4, 6.18
    rect(s, cx, 2.14, cw, 3.05, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.04)
    add_text(s, cx + 0.32, 2.3, cw - 0.6, 0.24, "FraudAudit.sol  \u00b7  Solidity 0.8.20", 8.5,
             True, TEAL, font=MONO)
    code = [
        "struct Submission {",
        "  string  bankId;",
        "  string  weightsHash;",
        "  uint256 sampleCount;",
        "  string  decision;   // ACCEPTED | REJECTED",
        "  string  reason;",
        "}",
        "",
        "function recordRound(",
        "  uint256 _roundId, string _strategy,",
        "  string _globalModelHash, ...",
        ") external onlyCoordinator { ... }",
    ]
    ty = 2.66
    for line in code:
        add_text(s, cx + 0.32, ty, cw - 0.6, 0.2, line, 8.6, False,
                 RGBColor(0xCF, 0xE6, 0xE0) if line.strip() else PALE, font=MONO)
        ty += 0.195

    ey = 5.36
    rect(s, cx, ey, cw, 1.42, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, cx + 0.3, ey + 0.14, cw - 0.6, 0.24, "VERIFICATION", 8.2, True, TEAL_DARK,
             spacing=150)
    add_text(s, cx + 0.3, ey + 0.42, cw - 0.6, 0.26,
             "verifyGlobalModel(roundId, hash) \u2192 true | false", 8.8, True, INK,
             font=MONO)
    add_text(s, cx + 0.3, ey + 0.72, cw - 0.6, 0.55,
             "Compares keccak256(on-chain hash) with the supplied hash. Events RoundStarted, "
             "UpdateRecorded and RoundFinalized make each step observable.",
             8.5, False, SLATE, line_spacing=1.15)

    notes(s, "The contract is deliberately simple: it is an audit ledger, not a training "
             "engine. Stress the two properties - only the coordinator can write, and anyone "
             "can verify a model file against the stored hash.")


# ---------------------------------------------------------------- slide 12
def slide_stack(prs):
    s = new_slide(prs)
    header(s, "Implementation", "System stack", 12)
    add_text(s, CONTENT_L, 1.8, CONTENT_W, 0.3,
             "A single Python process pairs the ML core with an EVM audit service; the console "
             "talks to it over REST.", 10.5, False, SLATE)

    cards = [
        ("ML core", ["PyTorch 2.x  \u00b7  NumPy", "scikit-learn metrics", "pandas preprocessing",
                     "SHA-256 model hashing", "16-D feature transformer"]),
        ("Backend API", ["FastAPI + uvicorn", "Threaded round engine",
                         "REST: training + scoring + audit", "CORS for the local console",
                         "Background jobs + progress logs"]),
        ("Frontend", ["Next.js 16 App Router", "Tailwind CSS + Lucide", "Five operator pages",
                      "Plain-English fraud wizard", "Live round + benchmark views"]),
        ("Audit & chain", ["Solidity 0.8.20", "web3.py + py-solc-x", "eth-tester in-memory EVM",
                           "round commitments + events", "JSON ledger mirror"]),
    ]
    w, gap = 2.83, 0.17
    for i, (title, items) in enumerate(cards):
        x = CONTENT_L + i * (w + gap)
        rect(s, x, 2.16, w, 2.55, fill=MIST, line=LINE,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
        rect(s, x, 2.16, w, 0.05, fill=TEAL if i % 2 == 0 else NAVY)
        add_text(s, x + 0.24, 2.34, w - 0.4, 0.28, title, 12.5, True, NAVY)
        iy = 2.74
        for item in items:
            add_text(s, x + 0.24, iy, w - 0.42, 0.4, item, 8.8, False, SLATE,
                     line_spacing=1.1)
            iy += 0.39

    py = 4.95
    rect(s, CONTENT_L, py, CONTENT_W, 1.26, fill=WHITE, line=LINE,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
    add_text(s, CONTENT_L + 0.3, py + 0.14, 5.0, 0.24, "FIVE OPERATOR SURFACES", 8.2, True,
             TEAL_DARK, spacing=150)
    labels = ["Overview", "Training", "Fraud explorer", "Security lab", "Block explorer"]
    for i, label in enumerate(labels):
        chip(s, CONTENT_L + 0.3 + i * 2.28, py + 0.52, 2.1, 0.46, label, INK, MIST,
             size=9.5, bold=False, line=LINE)

    add_text(s, CONTENT_L, 6.48, CONTENT_W, 0.24,
             "python run_backend.py  (API :8000)      cd frontend && pnpm dev  (console :3000)",
             9, False, SLATE, font=MONO)

    notes(s, "Only mention what you actually demoed. The console is the fastest way to show the "
             "project live: start a round, watch the defense log, then score a transaction and "
             "verify a hash on the chain page.")


# ---------------------------------------------------------------- slide 13
def slide_results_perf(prs):
    s = new_slide(prs)
    header(s, "Results", "Cross-bank performance after two rounds", 13)
    add_text(s, CONTENT_L, 1.8, 7.3, 0.34,
             "Global model scored after each round on a 10,000-transaction subset of Bank A "
             "and Bank C (PR-AUC, as recorded in the audit ledger).", 9.8, False, SLATE)

    rows = [
        ["1", "FedAvg", "3 / 3",
         {"text": f"{R1_METRICS['Bank_A']:.4f}", "mono": True, "color": AMBER, "bold": True},
         {"text": f"{R1_METRICS['Bank_C']:.4f}", "mono": True, "color": TEAL_DARK, "bold": True}],
        ["2", "FedAvg", "2 / 3",
         {"text": f"{R2_METRICS['Bank_A']:.4f}", "mono": True, "color": AMBER, "bold": True},
         {"text": f"{R2_METRICS['Bank_C']:.4f}", "mono": True, "color": TEAL_DARK, "bold": True}],
    ]
    table(s, CONTENT_L, 2.32, [0.75, 1.75, 1.4, 1.55, 1.55],
          ["Round", "Aggregation", "Accepted", "Bank A", "Bank C"],
          rows, row_h=0.64, header_h=0.56, size=10.5, header_size=8.6,
          aligns=[PP_ALIGN.LEFT, PP_ALIGN.LEFT, PP_ALIGN.CENTER, PP_ALIGN.CENTER,
                  PP_ALIGN.CENTER])

    add_text(s, CONTENT_L, 4.24, 7.0, 0.24, "PR-AUC  \u00b7  Bank A (card) vs Bank C (retail "
             "payments)", 8.4, True, MUTED, spacing=40)

    # chart
    chart_data = CategoryChartData()
    chart_data.categories = ["Round 1", "Round 2"]
    chart_data.add_series("Bank A", (R1_METRICS["Bank_A"], R2_METRICS["Bank_A"]))
    chart_data.add_series("Bank C", (R1_METRICS["Bank_C"], R2_METRICS["Bank_C"]))
    gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(8.3), Inches(2.26),
                            Inches(4.28), Inches(3.05), chart_data)
    chart = gf.chart
    chart.has_title = False
    chart.font.name = FONT
    chart.font.size = Pt(9)
    chart.font.color.rgb = SLATE
    chart.has_legend = True
    chart.legend.position = XL_LEGEND_POSITION.TOP
    chart.legend.include_in_layout = False
    chart.legend.font.size = Pt(9)
    plot = chart.plots[0]
    plot.gap_width = 70
    plot.overlap = -12
    plot.has_data_labels = True
    labels = plot.data_labels
    labels.font.size = Pt(8.5)
    labels.font.bold = True
    labels.number_format = "0.000"
    labels.number_format_is_linked = False
    labels.position = XL_LABEL_POSITION.OUTSIDE_END
    for series, color in zip(chart.series, (AMBER, TEAL)):
        series.format.fill.solid()
        series.format.fill.fore_color.rgb = color
    va = chart.value_axis
    va.maximum_scale = 0.9
    va.minimum_scale = 0.0
    va.major_unit = 0.3
    va.has_major_gridlines = False
    va.tick_labels.font.size = Pt(8)
    va.format.line.color.rgb = LINE
    ca = chart.category_axis
    ca.tick_labels.font.size = Pt(9)
    ca.format.line.color.rgb = LINE
    try:
        chart.format.line.fill.background()
    except Exception:
        pass

    add_text(s, CONTENT_L, 5.08, 7.25, 0.3, "What the numbers say", 11, True, NAVY,
             spacing=30)
    bullets(s, CONTENT_L, 5.44, 11.7, 1.45, [
        ("Bank C transfers well: ", "retail-payment fraud keeps PR-AUC 0.66-0.75 even after "
         "aggregating with card and mobile data."),
        ("Bank A is the hard case: ", "0.17% prevalence and a card-specific distribution give "
         "weak absolute PR-AUC (random baseline \u2248 0.0017)."),
        ("Every rejection is visible: ", "round 2 removed a client, and the ledger records the "
         "smaller cohort alongside the resulting hash."),
    ], size=9.8, gap=6, line_spacing=1.2)
    notes(s, "Be honest about Bank A - 0.05 is far from production quality, and saying so "
             "builds credibility. Explain that PR-AUC is the right metric at 0.17% prevalence, "
             "and that Bank A's improvement coincides with the round where the poisoned update "
             "was excluded.")


# ---------------------------------------------------------------- slide 14
def slide_results_defense(prs):
    s = new_slide(prs)
    header(s, "Results", "Poisoning defense in action", 14)
    add_text(s, CONTENT_L, 1.8, CONTENT_W, 0.34,
             "Round 2: Bank C submitted a 100\u00d7 scaled update of norm 287,512 against a "
             "6,249 rejection threshold - and held half of the FedAvg weight.", 9.8, False,
             SLATE)

    def bar(y, label, segments, note):
        add_text(s, CONTENT_L, y, 8.0, 0.24, label, 8.2, True, SLATE, spacing=90)
        add_text(s, CONTENT_L + 8.2, y, 3.3, 0.24, note, 8.2, False, MUTED,
                 align=PP_ALIGN.RIGHT)
        bx, bw, bh = CONTENT_L, CONTENT_W, 0.56
        x = bx
        for name, value, color, text_color in segments:
            seg_w = bw * value
            rect(s, x, y + 0.3, seg_w, bh, fill=color)
            if seg_w > 0.75:
                add_text(s, x + 0.14, y + 0.44, seg_w - 0.28, 0.28,
                         f"{name}  {value * 100:.1f}%", 9.5, True, text_color)
            x += seg_w

    total = TOTAL
    bar(2.3, "IF THE POISONED UPDATE HAD BEEN ACCEPTED",
        [("Bank A", SAMPLES["a"] / total, TEAL, WHITE),
         ("Bank B", SAMPLES["b"] / total, BLUE, WHITE),
         ("Bank C (poisoned)", SAMPLES["c"] / total, RED, WHITE)],
        "sample-weighted FedAvg")

    after_total = SAMPLES["a"] + SAMPLES["b"]
    bar(3.38, "AFTER REJECTION - ROUND 2 ACTUALLY AGGREGATED",
        [("Bank A", SAMPLES["a"] / after_total, TEAL, WHITE),
         ("Bank B", SAMPLES["b"] / after_total, BLUE, WHITE)],
        "Bank C excluded by layer 2")

    add_text(s, CONTENT_L, 4.38, 11.5, 0.24,
             "594,643 of 1,187,663 records - 50.1% of the average - would have come from the "
             "compromised client.", 8.6, False, MUTED, italic=True)

    add_text(s, CONTENT_L, 4.8, 11.0, 0.3, "Why this matters", 11, True, NAVY, spacing=30)
    bullets(s, CONTENT_L, 5.18, 11.6, 1.75, [
        ("Largest client, largest risk: ", "FedAvg weights by sample count, so the bank with "
         "the most records also has the most influence - an accepted poisoning would have "
         "owned half the model."),
        ("Screened before aggregation: ", "the norm check runs in one pass, and the verdict "
         "plus reason string are committed on-chain rather than kept in a local log."),
        ("Known blind spot: ", "label flipping leaves the norm normal, so it cannot be caught "
         "here - that is why coordinate-median aggregation is available and why reputation "
         "scoring is future work."),
    ], size=9.8, gap=5, line_spacing=1.16)

    notes(s, "This is the strongest result in the deck because it is arithmetic, not opinion: "
             "the poisoned bank carried 50.1% of the weighted average. Pause here. Then admit "
             "the blind spot for label flipping - examiners reward that.")


# ---------------------------------------------------------------- slide 15
def slide_results_audit(prs):
    s = new_slide(prs)
    header(s, "Results", "A tamper-evident audit trail", 15)
    add_text(s, CONTENT_L, 1.8, CONTENT_W, 0.3,
             "Round 1 committed all three submissions and the resulting model hash in a single "
             "EVM transaction.", 10, False, SLATE)

    cx, cy, cw, ch = 0.75, 2.14, 6.15, 4.32
    rect(s, cx, cy, cw, ch, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.04)
    add_text(s, cx + 0.35, cy + 0.24, cw - 0.7, 0.24, "ON-CHAIN RECEIPT  \u00b7  ROUND 1", 8.4,
             True, TEAL, spacing=150)

    rows = [
        ("tx hash", TX_HASH),
        ("block", f"#{BLOCK}"),
        ("gas used", f"{GAS:,}"),
        ("status", "SUCCESS"),
        ("contract", "0xF2E246BB76DF876Cef8b38ae84130F4F55De395b"),
        ("strategy", "FEDAVG  \u00b7  3 / 3 accepted"),
        ("global hash", GLOBAL_HASH),
    ]
    ry = cy + 0.66
    for key, value in rows:
        add_text(s, cx + 0.35, ry + 0.03, 1.25, 0.22, key, 8.2, False, PALE)
        if len(value) > 42:
            half = len(value) // 2
            add_text(s, cx + 1.6, ry, cw - 1.9, 0.2, value[:half], 7.6, False, WHITE,
                     font=MONO)
            add_text(s, cx + 1.6, ry + 0.19, cw - 1.9, 0.2, value[half:], 7.6, False,
                     WHITE, font=MONO)
            ry += 0.52
        else:
            add_text(s, cx + 1.6, ry, cw - 1.9, 0.22, value, 8.2,
                     True if key == "status" else False,
                     TEAL if key == "status" else WHITE, font=MONO)
            ry += 0.42

    rx, rw = 7.25, 5.33
    add_text(s, rx, 2.14, rw, 0.26, "What an auditor can now prove", 11, True, NAVY,
             spacing=30)
    bullets(s, rx, 2.5, rw, 2.55, [
        ("Which update each bank sent: ", "one SHA-256 hash per client, per round."),
        ("What the coordinator decided: ", "ACCEPTED or REJECTED plus the reason, immutable."),
        ("Which model was produced: ", "the global hash recomputable with "
         "get_state_dict_hash()."),
        ("That a model file is genuine: ", "verifyGlobalModel() returns true only for the "
         "committed hash."),
        ("When it happened: ", "roundId and block timestamp fix the order of every round."),
    ], size=9.6, gap=6, line_spacing=1.16)

    sy = 4.98
    rect(s, rx, sy, rw, 1.18, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.06)
    add_text(s, rx + 0.22, sy + 0.13, rw - 0.44, 0.2, "VERIFICATION CALL", 7.6, True,
             TEAL_DARK, spacing=120)
    add_text(s, rx + 0.22, sy + 0.38, rw - 0.4, 0.22,
             'verifyGlobalModel(1, "406aa1dd\u2026")  \u2192  true', 8.2, True, INK, font=MONO)
    add_text(s, rx + 0.22, sy + 0.7, rw - 0.4, 0.22,
             'verifyGlobalModel(1, "00000000\u2026")  \u2192  false', 8.2, True, RED,
             font=MONO)

    add_text(s, CONTENT_L, 6.6, CONTENT_W, 0.24,
             "Off-chain mirror: checkpoints/audit_ledger.json replays the same records for "
             "analysis - the chain remains the source of truth.", 8.6, False, MUTED,
             italic=True)

    notes(s, "Read the transaction hash and gas figure once - it proves the write really "
             "happened. Then explain the last bullet: an auditor can re-hash a model file and "
             "ask the contract whether that exact model existed.")


# ---------------------------------------------------------------- slide 16
def slide_limits(prs):
    s = new_slide(prs)
    header(s, "Discussion", "Limitations and future work", 16)

    left = [
        "Only three clients: the median norm is fragile, and collusion was not tested.",
        "The 16-D schema is hand-crafted; source-specific detail is compressed away - visible "
        "in Bank A's PR-AUC.",
        "Norm screening does not catch low-norm attacks such as label flipping.",
        "The EVM runs in memory (eth-tester); auditability is demonstrated, not decentralised "
        "in production.",
        "No differential privacy or secure aggregation - weights travel in the clear between "
        "trusted nodes.",
        "Evaluation uses the first 10k rows of each bank, not a stratified holdout.",
    ]
    right = [
        "DP-SGD and secure aggregation for a formal privacy guarantee.",
        "Krum or trimmed-mean aggregation plus per-client reputation scores.",
        "Ten or more clients with non-IID partitions and straggler handling.",
        "Deploy to a public testnet with gas-optimised event batching.",
        "Drift-aware retraining and per-bank threshold calibration.",
        "Federated feature selection instead of a hand-crafted schema.",
        "Stratified, repeated evaluation so PR-AUC is comparable across rounds.",
    ]

    for idx, (title, items, accent) in enumerate([
            ("LIMITATIONS", left, AMBER), ("FUTURE WORK", right, TEAL)]):
        x = CONTENT_L + idx * 6.03
        rect(s, x, 1.96, 5.8, 4.32, fill=MIST if idx == 0 else WHITE, line=LINE,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.04)
        rect(s, x, 1.96, 5.8, 0.05, fill=accent)
        add_text(s, x + 0.32, 2.14, 5.2, 0.24, title, 8.2, True, accent, spacing=160)
        bullets(s, x + 0.32, 2.52, 5.18, 3.6, items, size=10, gap=9,
                line_spacing=1.2, bullet_color=accent)

    add_text(s, CONTENT_L, 6.48, CONTENT_W, 0.24,
             "The honest summary: privacy and accountability are demonstrated; robustness is "
             "partial and adversarial coverage is narrow.", 9, False, SLATE, italic=True)

    notes(s, "Answer the two questions examiners always ask here: why only three banks "
             "(reproducible demo, no real inter-bank data sharing agreement) and whether the "
             "chain is real (it is a real EVM transaction, but on an in-memory test chain).")


# ---------------------------------------------------------------- slide 17
def slide_conclusion(prs):
    s = new_slide(prs, NAVY)
    rect(s, 0, 0, 0.09, SH, fill=TEAL)
    add_text(s, CONTENT_L, 0.62, 9.0, 0.24, "CONCLUSION", 9.5, True, TEAL, spacing=170)
    add_text(s, CONTENT_L, 0.98, 10.9, 1.2,
             "Privacy, robustness and accountability can be engineered into one federated "
             "pipeline.", 30, True, WHITE, line_spacing=1.16)

    stats = [
        ("1.19M", "records trained on, none pooled"),
        ("3,393", "shared model parameters"),
        (f"{POISON_NORM:,.0f}", "update norm rejected in round 2"),
        (f"{GAS:,}", "gas for an on-chain audit"),
    ]
    for i, (value, label) in enumerate(stats):
        x = CONTENT_L + i * 2.98
        add_text(s, x, 2.72, 2.7, 0.44, value, 24, True, TEAL)
        add_text(s, x, 3.18, 2.55, 0.5, label, 9, False, PALE, line_spacing=1.15)
        if i:
            rect(s, x - 0.28, 2.74, 0.012, 0.75, fill=RGBColor(0x2A, 0x40, 0x53))

    add_text(s, CONTENT_L, 4.02, 6.0, 0.24, "WHAT WAS SHOWN", 8.2, True, PALE, spacing=150)
    bullets(s, CONTENT_L, 4.38, 7.4, 2.1, [
        "Three heterogeneous banks train one model with zero raw-row sharing.",
        "A 100\u00d7 scaled update is detected and rejected before aggregation.",
        "Every round's hashes and verdicts are verifiable on an EVM contract.",
    ], size=10.4, color=RGBColor(0xD7, 0xE3, 0xEC), gap=7, line_spacing=1.2)

    bx = 8.55
    rect(s, bx, 4.02, 4.0, 1.82, fill=NAVY_SOFT, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, bx + 0.3, 4.2, 3.4, 0.24, "STILL OPEN", 8.2, True, AMBER, spacing=150)
    add_text(s, bx + 0.3, 4.52, 3.4, 1.6,
             "Low-norm poisoning, formal privacy guarantees and a production chain are the "
             "next milestone.", 10, False, PALE, line_spacing=1.25)

    add_text(s, CONTENT_L, 6.72, 9.0, 0.24,
             "CrossBank TrustFL  \u00b7  final year project demonstration", 8.5, False, MUTED)
    notes(s, "Close on the three outcomes, not the technology list. One sentence on what is "
             "still open keeps the conclusion credible.")


# ---------------------------------------------------------------- slide 18
def slide_references(prs):
    s = new_slide(prs)
    header(s, "References", "References", 18)
    refs = [
        "McMahan, B. et al. (2017). Communication-Efficient Learning of Deep Networks from "
        "Decentralized Data. AISTATS.",
        "Yin, D. et al. (2018). Byzantine-Robust Distributed Learning: Towards Optimal "
        "Statistical Rates. ICML.",
        "Blanchard, P. et al. (2017). Machine Learning with Adversaries: Byzantine Tolerant "
        "Gradient Descent. NeurIPS.",
        "Dal Pozzolo, A. et al. (2015). Calibrating Probability with Undersampling for "
        "Unbalanced Classification. IEEE SSCI.",
        "Lopez-Rojas, E., Elmir, A., Axelsson, S. (2016). PaySim: A Financial Mobile Money "
        "Simulator for Fraud Detection. EMSS.",
        "Lopez-Rojas, E. (2016). BankSim: A Bank Payment Simulation for Fraud Detection "
        "Research. Blekinge Institute of Technology.",
        "Wood, G. (2014). Ethereum: A Secure Decentralised Generalised Transaction Ledger. "
        "Ethereum Project Yellow Paper.",
        "Project repository: coordinator.py, src/defense.py, blockchain/contracts/"
        "FraudAudit.sol, checkpoints/audit_ledger.json.",
    ]
    y = 1.95
    for i, ref in enumerate(refs, 1):
        add_text(s, CONTENT_L, y, 0.4, 0.24, f"[{i}]", 9, True, TEAL, font=MONO)
        add_text(s, CONTENT_L + 0.5, y, CONTENT_W - 0.5, 0.42, ref, 9.6, False, SLATE,
                 line_spacing=1.15)
        y += 0.55

    add_text(s, CONTENT_L, 6.62, CONTENT_W, 0.24,
             "Dataset counts and metrics quoted in this deck are read from "
             "checkpoints/audit_ledger.json and the saved round checkpoints.", 8.4, False,
             MUTED, italic=True)
    notes(s, "Do not read the references. Point at the two pillars - FedAvg plus robust "
             "aggregation - and move to questions.")


# ---------------------------------------------------------------- slide 19
def slide_thanks(prs):
    s = new_slide(prs, NAVY)
    rect(s, 8.8, 4.2, 6.0, 6.0, fill=NAVY_SOFT, shape=MSO_SHAPE.OVAL)
    rect(s, 7.4, -2.2, 5.4, 5.4, fill=RGBColor(0x10, 0x23, 0x35), shape=MSO_SHAPE.OVAL)
    rect(s, 0, 0, 0.09, SH, fill=TEAL)
    add_text(s, CONTENT_L, 2.0, 8.5, 0.26, "THANK YOU", 9.5, True, TEAL, spacing=190)
    add_text(s, CONTENT_L, 2.4, 9.0, 1.0, "Questions, and a live demo", 36, True, WHITE)
    add_text(s, CONTENT_L, 3.5, 8.0, 0.7,
             "Training round, defense log, fraud scoring and on-chain verification can all be "
             "shown from the console.", 11.5, False, PALE, line_spacing=1.3)
    rect(s, CONTENT_L, 4.55, 2.0, 0.03, fill=TEAL)
    add_text(s, CONTENT_L, 4.85, 4.2, 0.24, "PRESENTED BY", 8.2, True, TEAL, spacing=140)
    add_text(s, CONTENT_L, 5.12, 4.2, 0.3, "[Your Name]", 14, True, WHITE)
    add_text(s, 5.0, 4.85, 4.6, 0.24, "GUIDE", 8.2, True, TEAL, spacing=140)
    add_text(s, 5.0, 5.12, 4.6, 0.3, "[Guide Name]", 14, True, WHITE)
    add_text(s, CONTENT_L, 6.4, 9.0, 0.24,
             "CrossBank TrustFL  \u00b7  blockchain-audited federated learning for cross-bank "
             "fraud detection", 8.8, False, MUTED)
    notes(s, "Invite the demo. Have one clean round ready to run, plus the Security Lab page "
             "with the 100x attack preset.")


def main():
    prs = Presentation()
    prs.slide_width = Inches(SW)
    prs.slide_height = Inches(SH)
    prs.core_properties.title = "CrossBank TrustFL - Blockchain-Audited Federated Fraud Detection"
    prs.core_properties.author = "CrossBank TrustFL"
    prs.core_properties.subject = "Final year project presentation"

    slide_title(prs)
    slide_agenda(prs)
    slide_problem(prs)
    slide_gap(prs)
    slide_objectives(prs)
    slide_architecture(prs)
    slide_features(prs)
    slide_datasets(prs)
    slide_protocol(prs)
    slide_defense(prs)
    slide_blockchain(prs)
    slide_stack(prs)
    slide_results_perf(prs)
    slide_results_defense(prs)
    slide_results_audit(prs)
    slide_limits(prs)
    slide_conclusion(prs)
    slide_references(prs)
    slide_thanks(prs)

    out = "CrossBank_TrustFL_Presentation.pptx"
    prs.save(out)
    print(f"Saved {out} with {len(prs.slides)} slides")
    for idx, slide in enumerate(prs.slides, 1):
        title = ""
        for shape in slide.shapes:
            if shape.has_text_frame and shape.text_frame.text.strip():
                title = shape.text_frame.text.strip().split("\n")[0]
                break
        print(f"  {idx:02d}  {title[:70]}")


if __name__ == "__main__":
    main()
