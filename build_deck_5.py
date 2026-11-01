#!/usr/bin/env python
"""
Build the 5-slide version of the CrossBank TrustFL presentation.

    venv/Scripts/python.exe build_deck_5.py
Output:
    CrossBank_TrustFL_5Slides.pptx

Reuses the design system from build_deck.py so both decks stay visually identical.
"""
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

import build_deck as bd
from build_deck import (
    AMBER, BLUE, CONTENT_L, CONTENT_R, CONTENT_W, GAS, GLOBAL_HASH, INK, LINE, MIST,
    MUTED, NAVY, NAVY_SOFT, PALE, R1_METRICS, R2_METRICS, RED, RED_TINT, SLATE, TEAL,
    TEAL_DARK, TEAL_TINT, TOTAL, TX_HASH, WHITE, add_text, arrow, bullets, chip,
    footer, header, new_slide, notes, number_badge, rect, table,
)
from build_deck import SAMPLES, POISON_NORM, MEDIAN_NORM

FONT, MONO = bd.FONT, bd.MONO


# ---------------------------------------------------------------- slide 1
def slide_cover(prs):
    s = new_slide(prs, NAVY)
    rect(s, 8.55, -1.6, 6.6, 6.6, fill=NAVY_SOFT, shape=MSO_SHAPE.OVAL)
    rect(s, 9.9, 3.6, 4.3, 4.3, fill=bd.RGBColor(0x10, 0x23, 0x35), shape=MSO_SHAPE.OVAL)
    rect(s, 0, 0, 0.09, 7.5, fill=TEAL)

    chip(s, 0.9, 1.05, 3.05, 0.36, "FINAL YEAR PROJECT  \u00b7  2026", TEAL,
         bd.RGBColor(0x12, 0x2B, 0x40), size=9, line=bd.RGBColor(0x25, 0x44, 0x5B))
    add_text(s, 0.9, 1.7, 8.6, 1.05, "CrossBank TrustFL", 44, True, WHITE)
    add_text(s, 0.9, 2.52, 7.9, 1.4,
             "Blockchain-Audited Federated Learning for Privacy-Preserving "
             "Cross-Bank Fraud Detection", 20, False, bd.RGBColor(0xD7, 0xE3, 0xEC),
             line_spacing=1.2)
    rect(s, 0.9, 4.01, 2.2, 0.03, fill=TEAL)
    add_text(s, 0.9, 4.24, 8.2, 0.9,
             "Three banks  \u00b7  1.19M private transactions  \u00b7  zero raw data shared  "
             "\u00b7  every round anchored on-chain", 11.5, False, PALE, line_spacing=1.3)

    for i, label in enumerate(("A", "B", "C")):
        bx = 9.95 + i * 0.76
        rect(s, bx, 5.2, 0.5, 0.5, fill=NAVY_SOFT, line=TEAL, lw=1.0,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.18)
        add_text(s, bx, 5.33, 0.5, 0.24, label, 10, True, TEAL, align=PP_ALIGN.CENTER)
    add_text(s, 9.95, 5.84, 2.5, 0.24, "weights only  \u00b7  hashed  \u00b7  on-chain",
             8.2, True, PALE)

    add_text(s, 0.9, 5.92, 4.8, 0.28, "Presented by", 8.5, True, TEAL, spacing=140)
    add_text(s, 0.9, 6.18, 5.2, 0.32, "[Your Name]", 14, True, WHITE)
    add_text(s, 5.3, 5.92, 4.6, 0.28, "Under the guidance of", 8.5, True, TEAL,
             spacing=140)
    add_text(s, 5.3, 6.18, 4.4, 0.32, "[Guide Name]", 14, True, WHITE)
    add_text(s, 0.9, 6.72, 8.0, 0.28, "Department of Computer Science and Engineering",
             10, False, MUTED)

    notes(s, "Five-slide version. One sentence: three banks train one fraud model together, "
             "raw transactions never leave a bank, and every round is anchored on a smart "
             "contract.")


# ---------------------------------------------------------------- slide 2
def slide_problem(prs):
    s = new_slide(prs)
    header(s, "Problem", "Fraud data cannot leave the bank that owns it", 2)
    add_text(s, CONTENT_L, 1.8, CONTENT_W, 0.32,
             "A fraud ring that moves money across three institutions is invisible to each of "
             "them, while the records that reveal it cannot legally be shared.", 11, False,
             SLATE)

    cards = [
        ("Data silos",
         "Each bank sees only its own customers, so cross-institution fraud rings never "
         "appear as one pattern."),
        ("Regulatory walls",
         "GDPR, India's DPDP Act and RBI rules keep raw transaction data inside the "
         "institution that collected it."),
        ("Rare, shifting fraud",
         "Fraud is under 1% of traffic and changes shape; a single bank's model misses "
         "unseen attack patterns."),
        ("Poisoning, no audit trail",
         "One compromised client can corrupt the average, and central training logs can be "
         "edited by the coordinator."),
    ]
    w, h = 5.8, 1.34
    for idx, (title, body) in enumerate(cards):
        x = 0.75 if idx % 2 == 0 else 6.78
        y = 2.3 if idx < 2 else 3.78
        rect(s, x, y, w, h, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
             radius=0.06)
        rect(s, x, y + 0.24, 0.045, 0.42, fill=TEAL)
        add_text(s, x + 0.26, y + 0.2, w - 0.5, 0.28, title, 12, True, NAVY)
        add_text(s, x + 0.26, y + 0.58, w - 0.55, 0.65, body, 9.8, False, SLATE,
                 line_spacing=1.2)

    add_text(s, CONTENT_L, 5.34, 2.2, 0.24, "OBJECTIVE", 8.2, True, TEAL, spacing=160)
    objectives = [
        ("Train", "one model over three heterogeneous banks; every raw row stays local."),
        ("Defend", "aggregation by rejecting scaled, noisy or poisoned updates."),
        ("Prove", "each round with hashes and verdicts committed on an EVM contract."),
    ]
    for i, (lead, rest) in enumerate(objectives):
        x = CONTENT_L + i * 3.98
        number_badge(s, x, 5.66, 0.34, i + 1, fill=TEAL, size=9.5)
        add_text(s, x + 0.48, 5.63, 3.35, 0.24, lead, 11.5, True, NAVY)
        add_text(s, x + 0.48, 5.93, 3.35, 0.62, rest, 9.2, False, SLATE,
                 line_spacing=1.2)

    notes(s, "Pick two cards - data silos and poisoning - then read the three objectives. "
             "Pressure comes from needing privacy, robustness and auditability at the same "
             "time.")


# ---------------------------------------------------------------- slide 3
def slide_method(prs):
    s = new_slide(prs)
    header(s, "Methodology", "Three banks, one model, four checks, one audit trail", 3)
    add_text(s, CONTENT_L, 1.78, CONTENT_W, 0.3,
             "Clients train locally and submit hashed weights; the coordinator screens, "
             "aggregates and writes the round to a smart contract.", 10.2, False, SLATE)

    # flow
    for i, (name, sub) in enumerate([("Bank A", "Credit Card  \u00b7  284,807"),
                                     ("Bank B", "PaySim  \u00b7  308,213"),
                                     ("Bank C", "BankSim  \u00b7  594,643")]):
        y = 2.16 + i * 0.5
        rect(s, CONTENT_L, y, 2.15, 0.42, fill=MIST, line=LINE,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.18)
        add_text(s, CONTENT_L + 0.18, y + 0.04, 1.0, 0.2, name, 9.6, True, NAVY)
        add_text(s, CONTENT_L + 0.18, y + 0.22, 1.9, 0.18, sub, 7.8, False, SLATE)
    arrow(s, 2.96, 2.6, 3.36, 2.6, TEAL, 1.3)

    cx, cw = 3.42, 3.36
    rect(s, cx, 2.12, cw, 1.42, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
    add_text(s, cx + 0.24, 2.26, cw - 0.45, 0.22, "COORDINATOR", 7.8, True, TEAL,
             spacing=150)
    add_text(s, cx + 0.24, 2.52, cw - 0.45, 0.28, "screen \u2192 aggregate \u2192 hash", 10.5,
             True, WHITE)
    add_text(s, cx + 0.24, 2.86, cw - 0.48, 0.55,
             "Tensor sanity  \u00b7  norm outlier check  \u00b7  FedAvg / median", 8.6, False,
             PALE, line_spacing=1.2)
    arrow(s, 6.86, 2.83, 7.24, 2.83, TEAL, 1.3)

    rx, rw = 7.3, 5.27
    rect(s, rx, 2.12, rw, 0.64, fill=MIST, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.1)
    add_text(s, rx + 0.22, 2.2, rw - 0.44, 0.22, "Global Fraud MLP", 10.5, True, NAVY)
    add_text(s, rx + 0.22, 2.46, rw - 0.44, 0.22,
             "16 \u2192 64 \u2192 32 \u2192 1  \u00b7  3,393 parameters  \u00b7  shared by "
             "all clients", 8.4, False, SLATE, font=MONO)
    rect(s, rx, 2.88, rw, 0.64, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
    add_text(s, rx + 0.22, 2.96, rw - 0.44, 0.22, "FraudAudit.sol  \u00b7  EVM", 10.5, True,
             WHITE)
    add_text(s, rx + 0.22, 3.22, rw - 0.44, 0.22,
             "weight hashes + verdicts + global model hash, once per round", 8.4, False,
             PALE)

    add_text(s, CONTENT_L, 3.66, 5.0, 0.24,
             "Only weights and hashes cross the trust boundary.", 9.5, True, TEAL_DARK,
             italic=True)

    pillars = [
        ("Unified 16-D schema",
         "Amount, time, behaviour and risk features map Credit Card, PaySim and BankSim into "
         "one vector."),
        ("Local training",
         "Two epochs per round, Adam 1e-3, batch 512, class-weighted BCE; client hashes its "
         "state_dict."),
        ("Four-layer defense",
         "NaN/Inf check, norm > 3\u00d7 median rejection, robust aggregation, then hash "
         "verification."),
        ("Immutable audit",
         "Coordinator-only recordRound() commits hashes and decisions; anyone can verify a "
         "model file."),
    ]
    x0, pw, gap = 0.75, 2.83, 0.17
    for i, (title, body) in enumerate(pillars):
        x = x0 + i * (pw + gap)
        rect(s, x, 4.04, pw, 1.52, fill=WHITE, line=LINE,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
        rect(s, x, 4.04, pw, 0.05, fill=TEAL if i % 2 == 0 else BLUE)
        add_text(s, x + 0.22, 4.2, pw - 0.4, 0.26, title, 10.3, True, NAVY)
        add_text(s, x + 0.22, 4.52, pw - 0.42, 0.95, body, 8.4, False, SLATE,
                 line_spacing=1.2)

    y = 5.82
    rect(s, CONTENT_L, y, CONTENT_W, 0.86, fill=MIST, line=LINE,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08)
    add_text(s, CONTENT_L + 0.3, y + 0.16, 5.4, 0.26,
             "w = \u03a3 (n\u2096 \u00b7 w\u2096) / \u03a3 n\u2096", 15, True, NAVY, font=MONO)
    add_text(s, CONTENT_L + 0.3, y + 0.52, 5.4, 0.22,
             "sample-weighted averaging, so larger banks count more", 8.4, False, SLATE)
    add_text(s, CONTENT_L + 6.1, y + 0.18, 5.4, 0.24,
             "1.19M records  \u00b7  none pooled  \u00b7  50.1% weight would have come from "
             "the poisoned client", 8.8, True, TEAL_DARK)
    add_text(s, CONTENT_L + 6.1, y + 0.5, 5.4, 0.24,
             "SHA-256 per submission  \u00b7  round hash recomputable offline", 8.4, False,
             SLATE)

    notes(s, "Trace the flow left to right. The two numbers to defend here are 3,393 "
             "parameters (why rounds are fast) and 3x median (the only poisoning test in "
             "layer 2).")


# ---------------------------------------------------------------- slide 4
def slide_results(prs):
    s = new_slide(prs)
    header(s, "Results", "What the two recorded rounds show", 4)
    add_text(s, CONTENT_L, 1.78, 6.4, 0.3,
             "PR-AUC on a 10,000-transaction subset per bank, read from the audit ledger.",
             9.2, False, SLATE)

    rows = [
        ["1", "3 / 3",
         {"text": f"{R1_METRICS['Bank_A']:.4f}", "mono": True, "color": AMBER, "bold": True},
         {"text": f"{R1_METRICS['Bank_C']:.4f}", "mono": True, "color": TEAL_DARK, "bold": True}],
        ["2", "2 / 3",
         {"text": f"{R2_METRICS['Bank_A']:.4f}", "mono": True, "color": AMBER, "bold": True},
         {"text": f"{R2_METRICS['Bank_C']:.4f}", "mono": True, "color": TEAL_DARK, "bold": True}],
    ]
    table(s, CONTENT_L, 2.2, [0.9, 1.5, 1.9, 1.9],
          ["Round", "Accepted", "Bank A", "Bank C"], rows, row_h=0.56, header_h=0.48,
          size=10, header_size=8.6,
          aligns=[PP_ALIGN.LEFT, PP_ALIGN.CENTER, PP_ALIGN.CENTER, PP_ALIGN.CENTER])
    add_text(s, CONTENT_L, 3.92, 6.2, 0.24,
             "Bank A = card fraud (0.17% prevalence)  \u00b7  Bank C = retail payments",
             8.2, False, MUTED)

    chart_data = CategoryChartData()
    chart_data.categories = ["Round 1", "Round 2"]
    chart_data.add_series("Bank A", (R1_METRICS["Bank_A"], R2_METRICS["Bank_A"]))
    chart_data.add_series("Bank C", (R1_METRICS["Bank_C"], R2_METRICS["Bank_C"]))
    gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(7.05), Inches(2.12),
                            Inches(5.5), Inches(2.22), chart_data)
    chart = gf.chart
    chart.has_title = False
    chart.font.name = FONT
    chart.font.size = Pt(9)
    chart.font.color.rgb = SLATE
    chart.has_legend = True
    chart.legend.position = XL_LEGEND_POSITION.TOP
    chart.legend.include_in_layout = False
    chart.legend.font.size = Pt(8.5)
    plot = chart.plots[0]
    plot.gap_width = 70
    plot.overlap = -12
    plot.has_data_labels = True
    plot.data_labels.font.size = Pt(8)
    plot.data_labels.font.bold = True
    plot.data_labels.number_format = "0.000"
    plot.data_labels.number_format_is_linked = False
    plot.data_labels.position = XL_LABEL_POSITION.OUTSIDE_END
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
    chart.category_axis.tick_labels.font.size = Pt(8.5)
    chart.category_axis.format.line.color.rgb = LINE
    try:
        chart.format.line.fill.background()
    except Exception:
        pass

    # poisoning card
    px, py, pw, ph = 0.75, 4.6, 6.0, 1.95
    rect(s, px, py, pw, ph, fill=WHITE, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    rect(s, px, py, pw, 0.05, fill=RED)
    add_text(s, px + 0.28, py + 0.18, pw - 0.5, 0.24, "POISONING REJECTED  \u00b7  ROUND 2",
             7.8, True, RED, spacing=130)
    add_text(s, px + 0.28, py + 0.46, pw - 0.5, 0.26,
             f"bank_c submitted {POISON_NORM:,.2f} against a {MEDIAN_NORM * 3:,.2f} "
             f"threshold", 9.6, True, NAVY)

    segs = [(SAMPLES["a"] / TOTAL), (SAMPLES["b"] / TOTAL), (SAMPLES["c"] / TOTAL)]
    bx, by, bw, bh = px + 0.28, py + 0.86, pw - 0.56, 0.28
    cx = bx
    for value, color in zip(segs, (TEAL, BLUE, RED)):
        rect(s, cx, by, bw * value, bh, fill=color)
        cx += bw * value
    add_text(s, px + 0.28, py + 1.2, pw - 0.5, 0.22,
             "weight share if accepted:  Bank A 24.0%  \u00b7  Bank B 26.0%  \u00b7  "
             "Bank C 50.1%", 8.2, False, SLATE)
    add_text(s, px + 0.28, py + 1.56, pw - 0.5, 0.26,
             "Screened before aggregation; verdict and reason committed on-chain.", 8.6,
             False, SLATE, italic=True)

    # audit card
    ax, aw = 6.98, 5.6
    rect(s, ax, py, aw, ph, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
    add_text(s, ax + 0.28, py + 0.18, aw - 0.5, 0.24, "ON-CHAIN AUDIT RECEIPT", 7.8, True,
             TEAL, spacing=130)
    audit_rows = [
        ("block", f"#{2}"),
        ("gas used", f"{GAS:,}"),
        ("tx hash", TX_HASH[:20] + "\u2026" + TX_HASH[-10:]),
        ("model hash", GLOBAL_HASH[:20] + "\u2026" + GLOBAL_HASH[-10:]),
    ]
    ry = py + 0.48
    for key, value in audit_rows:
        add_text(s, ax + 0.28, ry, 1.0, 0.2, key, 8, False, PALE)
        add_text(s, ax + 1.3, ry, aw - 1.55, 0.2, value, 8.2, False, WHITE, font=MONO)
        ry += 0.3
    add_text(s, ax + 0.28, py + 1.66, aw - 0.5, 0.22,
             "verifyGlobalModel(1, hash)  \u2192  true | false", 8.2, True, TEAL,
             font=MONO)

    add_text(s, CONTENT_L, 6.7, CONTENT_W, 0.24,
             "Bank C transfers well (0.66-0.75); Bank A remains weak at 0.05-0.14, close to "
             "the 0.0017 random baseline.", 8.6, False, MUTED, italic=True)

    notes(s, "Two stories in one slide. Left: Bank C's retail fraud transfers across banks, "
             "Bank A's card fraud does not - say so plainly. Right: the defense and the audit "
             "are arithmetic and a transaction receipt, not claims.")


# ---------------------------------------------------------------- slide 5
def slide_close(prs):
    s = new_slide(prs, NAVY)
    rect(s, 0, 0, 0.09, 7.5, fill=TEAL)
    add_text(s, CONTENT_L, 0.6, 9.0, 0.24, "CONCLUSION", 9.2, True, TEAL, spacing=170)
    add_text(s, CONTENT_L, 0.94, 10.6, 1.2,
             "Privacy, robustness and accountability can be engineered into one federated "
             "pipeline.", 27, True, WHITE, line_spacing=1.16)

    stats = [
        ("1.19M", "records trained on, none pooled"),
        ("3,393", "shared model parameters"),
        (f"{POISON_NORM:,.0f}", "update norm rejected in round 2"),
        (f"{GAS:,}", "gas for an on-chain audit"),
    ]
    for i, (value, label) in enumerate(stats):
        x = CONTENT_L + i * 2.98
        add_text(s, x, 2.42, 2.7, 0.42, value, 22, True, TEAL)
        add_text(s, x, 2.84, 2.55, 0.5, label, 8.8, False, PALE, line_spacing=1.15)
        if i:
            rect(s, x - 0.28, 2.44, 0.012, 0.72, fill=bd.RGBColor(0x2A, 0x40, 0x53))

    add_text(s, CONTENT_L, 3.72, 5.6, 0.24, "WHAT WAS SHOWN", 8.2, True, PALE, spacing=150)
    bullets(s, CONTENT_L, 4.06, 6.4, 1.9, [
        "Three heterogeneous banks train one model with zero raw-row sharing.",
        "A 100\u00d7 scaled update is rejected before it reaches the aggregate.",
        "Every round's hashes and verdicts are verifiable on an EVM contract.",
    ], size=10.2, color=bd.RGBColor(0xD7, 0xE3, 0xEC), gap=7, line_spacing=1.2)

    bx = 7.55
    rect(s, bx, 3.72, 5.03, 1.8, fill=NAVY_SOFT, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.05)
    add_text(s, bx + 0.3, 3.9, 4.4, 0.24, "NEXT", 8.2, True, AMBER, spacing=150)
    bullets(s, bx + 0.3, 4.22, 4.4, 1.5, [
        "DP-SGD and secure aggregation for formal privacy.",
        "Krum / trimmed-mean plus client reputation.",
        "Public testnet deployment and stratified evaluation.",
    ], size=9.2, color=PALE, gap=4, line_spacing=1.15, bullet_color=AMBER)

    add_text(s, CONTENT_L, 6.32, 9.0, 0.24, "Thank you  \u00b7  questions and live demo",
             11, True, WHITE)
    add_text(s, CONTENT_L, 6.66, 9.6, 0.24,
             "CrossBank TrustFL  \u00b7  blockchain-audited federated learning for cross-bank "
             "fraud detection", 8.4, False, MUTED)

    notes(s, "Close on the three outcomes and one honest gap: low-norm poisoning. Invite the "
             "demo - one round and the Security Lab page are enough.")


def main():
    prs = Presentation()
    prs.slide_width = Inches(bd.SW)
    prs.slide_height = Inches(bd.SH)
    prs.core_properties.title = "CrossBank TrustFL - 5 slide summary"
    prs.core_properties.author = "CrossBank TrustFL"
    prs.core_properties.subject = "Final year project presentation (5 slides)"

    slide_cover(prs)
    slide_problem(prs)
    slide_method(prs)
    slide_results(prs)
    slide_close(prs)

    out = "CrossBank_TrustFL_5Slides.pptx"
    prs.save(out)
    print(f"Saved {out} with {len(prs.slides)} slides")


if __name__ == "__main__":
    main()
