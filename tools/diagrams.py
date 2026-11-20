#!/usr/bin/env python3
"""Draw the case-study diagrams in index.html, in a hand-drawn sketchnote style.

Each diagram is drawn twice: a wide version for desktop and a tall version
for phones. Edit DIAGRAMS below, then run from the repo root:

    python tools/diagrams.py

The script replaces whatever sits between <!-- diagram:NAME --> and
<!-- /diagram:NAME --> in index.html. Nothing else in the page is touched.
The wobble is seeded, so running it twice gives the same drawing.

Node text: (title, subtitle). In the tall version, side boxes are narrow, so
"tall" gives their subtitle with "|" marking line breaks.

Motion (driven by assets/js/site.js):
  - boxes and arrows draw themselves in order when the diagram scrolls in
  - then a dot carries "the data" along the arrows in a loop (SVG animateMotion)
"""
from html import escape
from pathlib import Path
import math
import random
import re
import sys

DIAGRAMS = {
    "agent": dict(
        title="How the AI agent answers a question",
        desc=(
            "A question in plain English goes to the agent, which finds the "
            "relevant data and writes a query. Guardrails allow only safe, "
            "read-only access, the data source runs it, and the answer comes "
            "back. Each step is logged."
        ),
        chain=[
            ("Question", "in plain English"),
            ("Find the data", "what's relevant"),
            ("Write a query", "by the AI"),
            ("Guardrails", "read-only checks"),
            ("Data source", "runs the query"),
            ("Answer", "back to the user"),
        ],
        log=dict(node=("Log", "every step is recorded"),
                 tall=("Log", "every step|is recorded"),
                 at=[1, 2, 3, 4]),
    ),
    "notes": dict(
        title="How free-text notes become tracked tasks",
        desc=(
            "Free-text notes go to an AI step that returns tasks in a fixed "
            "format. The tasks are created in the team's task tracker, ready "
            "to assign."
        ),
        chain=[
            ("Notes", "free text"),
            ("AI step", "reads the notes"),
            ("Tasks", "fixed format"),
            ("Task tracker", "creates them"),
            ("Team", "ready to assign"),
        ],
        feed=dict(node=("Task format", "the fields every task needs"),
                  tall=("Task format", "fields every|task needs"),
                  at=1),
    ),
    "platform": dict(
        title="How internal apps get built and released",
        desc=(
            "Apps built at the same time all start from one shared foundation "
            "covering sign-in, settings and deployment. One pipeline builds "
            "and checks each app, a release check approves it, and it goes live."
        ),
        chain=[
            ("Apps", "built at once"),
            ("Shared foundation", "the basics, once"),
            ("Pipeline", "build and check"),
            ("Release check", "before go-live"),
            ("Live", "for the team"),
        ],
        stack=0,
        feed=dict(node=("Shared UI", "common components"),
                  tall=("Shared UI", "common|components"),
                  at=1),
    ),
}

NODE_STEP = 0.28   # seconds between boxes drawing in
SEG = 0.85         # seconds for the data dot to cross one arrow
PAUSE = 0.9        # rest at the end of each loop

# Caveat metrics, as a share of font size, for centring text in a box.
ASCENT, DESCENT = 0.74, 0.22
SUB_GAP, SUB_STEP = 20, 17


def f(n):
    return f"{n:.1f}".rstrip("0").rstrip(".")


class Pen:
    """Seeded hand-drawn strokes."""

    def __init__(self, seed):
        self.rnd = random.Random(seed)

    def j(self, v, amount=1.7):
        return v + self.rnd.uniform(-amount, amount)

    def side(self, x1, y1, x2, y2, bow=2.8):
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        length = math.hypot(x2 - x1, y2 - y1) or 1
        nx, ny = -(y2 - y1) / length, (x2 - x1) / length
        b = self.rnd.uniform(-bow, bow)
        return f"Q{f(mx + nx * b)} {f(my + ny * b)} {f(self.j(x2))} {f(self.j(y2))}"

    def rect(self, x, y, w, h, r=10):
        j = self.j
        d = [f"M{f(j(x + r + 3))} {f(j(y))}"]
        d.append(self.side(x + r, y, x + w - r, y))
        d.append(f"Q{f(j(x + w))} {f(j(y))} {f(j(x + w))} {f(j(y + r))}")
        d.append(self.side(x + w, y + r, x + w, y + h - r))
        d.append(f"Q{f(j(x + w))} {f(j(y + h))} {f(j(x + w - r))} {f(j(y + h))}")
        d.append(self.side(x + w - r, y + h, x + r, y + h))
        d.append(f"Q{f(j(x))} {f(j(y + h))} {f(j(x))} {f(j(y + h - r))}")
        d.append(self.side(x, y + h - r, x, y + r))
        # overshoot past the start, the way a pen closes a box
        d.append(f"Q{f(j(x))} {f(j(y))} {f(j(x + r + 9, 2))} {f(j(y - 0.8, 0.8))}")
        return "".join(d)

    def arrow(self, x1, y1, x2, y2, bend=5):
        """A slightly curved arrow: returns (line path, head path)."""
        length = math.hypot(x2 - x1, y2 - y1) or 1
        nx, ny = -(y2 - y1) / length, (x2 - x1) / length
        b = self.rnd.uniform(-bend, bend) * min(1, length / 60)
        cx, cy = (x1 + x2) / 2 + nx * b, (y1 + y2) / 2 + ny * b
        line = f"M{f(self.j(x1, .6))} {f(self.j(y1, .6))}Q{f(cx)} {f(cy)} {f(x2)} {f(y2)}"
        ang = math.atan2(y2 - cy, x2 - cx)
        heads = []
        for side in (-1, 1):
            a = ang + math.pi + side * math.radians(self.rnd.uniform(24, 32))
            hl = self.rnd.uniform(8, 10.5)
            heads.append((x2 + math.cos(a) * hl, y2 + math.sin(a) * hl))
        head = f"M{f(heads[0][0])} {f(heads[0][1])}L{f(x2)} {f(y2)}L{f(heads[1][0])} {f(heads[1][1])}"
        return line, head


def label(cx, cy, title, subs, ts, ss):
    if subs:
        below = SUB_GAP + SUB_STEP * (len(subs) - 1) + DESCENT * ss
    else:
        below = DESCENT * ts
    ty = cy + (ASCENT * ts - below) / 2
    out = [f'<text class="dg-text dg-title" x="{f(cx)}" y="{f(ty)}" font-size="{ts}">{escape(title)}</text>']
    for k, line in enumerate(subs):
        out.append(f'<text class="dg-text dg-sub" x="{f(cx)}" y="{f(ty + SUB_GAP + k * SUB_STEP)}" font-size="{ss}">{escape(line)}</text>')
    return "".join(out)


def node(pen, x, y, w, h, title, sub, delay, ts, ss, aux=False):
    subs = [s for s in sub.split("|") if s] if sub else []
    cls = "dg-node is-aux" if aux else "dg-node"
    parts = [f'<g class="{cls}" style="--d:{delay:.2f}s">']
    if not aux:
        parts.append(f'<rect class="dg-shadow" x="{f(x + 5)}" y="{f(y + 5)}" width="{f(w)}" height="{f(h)}" rx="10"/>')
    parts.append(f'<rect class="dg-bg" x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="10"/>')
    length = "" if aux else ' pathLength="1"'
    parts.append(f'<path class="dg-stroke" d="{pen.rect(x, y, w, h)}"{length}/>')
    if not aux:
        parts.append(f'<path class="dg-stroke is-second" d="{pen.rect(x + 1.4, y - 1.1, w - 1.6, h + 1.4)}" pathLength="1"/>')
    parts.append(label(x + w / 2, y + h / 2, title, subs, ts, ss))
    parts.append("</g>")
    return "".join(parts)


def connector(pen, pid, x1, y1, x2, y2, delay, dashed=False):
    line, head = pen.arrow(x1, y1, x2, y2, bend=2 if dashed else 5)
    cls = "dg-line is-dashed" if dashed else "dg-line"
    length = "" if dashed else ' pathLength="1"'
    return (f'<path id="{pid}" class="{cls}" d="{line}"{length} style="--d:{delay:.2f}s"/>'
            f'<path class="dg-head{" is-dashed" if dashed else ""}" d="{head}" style="--d:{delay:.2f}s"/>')


def dot(pid, start, end, total, soft=False):
    """A dot that crosses path `pid` between `start` and `end` seconds of each loop."""
    a, b = start / total, end / total
    if a <= 0:
        kp, kt = "0;1;1", f"0;{b:.4f};1"
        ov, okt = "1;0", f"0;{b:.4f}"
    else:
        kp, kt = "0;0;1;1", f"0;{a:.4f};{b:.4f};1"
        ov, okt = "0;1;0", f"0;{a:.4f};{b:.4f}"
    cls = "dg-dot is-soft" if soft else "dg-dot"
    r = 3.5 if soft else 4.5
    return (f'<circle class="{cls}" r="{r}" cx="0" cy="0" opacity="0">'
            f'<animateMotion dur="{total:.2f}s" repeatCount="indefinite" calcMode="linear" '
            f'keyPoints="{kp}" keyTimes="{kt}"><mpath href="#{pid}"/></animateMotion>'
            f'<animate attributeName="opacity" dur="{total:.2f}s" repeatCount="indefinite" '
            f'calcMode="discrete" values="{ov}" keyTimes="{okt}"/></circle>')


def loop_length(spec):
    return (len(spec["chain"]) - 1) * SEG + PAUSE


def svg(name, variant, spec, width, height, body):
    tid, did = f"dg-{name}-{variant}-t", f"dg-{name}-{variant}-d"
    return (
        f'<svg class="dg dg-{variant}" viewBox="0 0 {width} {f(height)}" role="img" '
        f'aria-labelledby="{tid} {did}"><title id="{tid}">{escape(spec["title"])}</title>'
        f'<desc id="{did}">{escape(spec["desc"])}</desc>{"".join(body)}</svg>'
    )


def build(name, spec, variant):
    pen = Pen(f"{name}-{variant}")
    chain, feed, log = spec["chain"], spec.get("feed"), spec.get("log")
    n = len(chain)
    total = loop_length(spec)
    body, dots = [], []
    pid = lambda k: f"dg-{name}-{variant[0]}-{k}"

    if variant == "wide":
        W, pad, gap, nh = 1000, 6, 34, 72
        nw = (W - 2 * pad - 5 - gap * (n - 1)) / n
        xs = [pad + i * (nw + gap) for i in range(n)]
        boxes = [(xs[i], 0, nw, nh) for i in range(n)]
        top = 8
        if feed:
            fw, fh = max(nw, 230), 62
            fx = min(max(xs[feed["at"]] + nw / 2 - fw / 2, pad), W - pad - fw)
            cy0 = top + fh + 44
        else:
            cy0 = top + (14 if "stack" in spec else 0)
        boxes = [(x, cy0, w, h) for (x, _, w, h) in boxes]
        ts, ss = 22, 16.5
    else:
        W, nh, gap = 320, 66, 36
        side = feed or log
        cw = 170 if side else 240
        cx0 = 6 if side else (W - cw) / 2
        sx = cx0 + cw + 36
        sw = W - sx - 6
        y0 = 8 + (14 if "stack" in spec else 0)
        boxes = [(cx0, y0 + i * (nh + gap), cw, nh) for i in range(n)]
        ts, ss = 21, 16

    # stacked "many apps" look behind the first box
    if "stack" in spec:
        x, y, w, h = boxes[spec["stack"]]
        for off in (12, 6):
            body.append(f'<g class="dg-node is-ghost" style="--d:0s"><rect class="dg-bg" x="{f(x + off)}" y="{f(y - off)}" '
                        f'width="{f(w)}" height="{f(h)}" rx="10"/><path class="dg-stroke" d="{pen.rect(x + off, y - off, w, h)}" pathLength="1"/></g>')

    for i, (t, s) in enumerate(chain):
        x, y, w, h = boxes[i]
        body.append(node(pen, x, y, w, h, t, s, i * NODE_STEP, ts, ss))

    for i in range(n - 1):
        x, y, w, h = boxes[i]
        nx_, ny_, nw_, nh_ = boxes[i + 1]
        d = i * NODE_STEP + 0.2
        if variant == "wide":
            body.append(connector(pen, pid(f"c{i}"), x + w + 4, y + h / 2, nx_ - 4, ny_ + nh_ / 2, d))
        else:
            body.append(connector(pen, pid(f"c{i}"), x + w / 2, y + h + 4, nx_ + nw_ / 2, ny_ - 4, d))
        dots.append(dot(pid(f"c{i}"), i * SEG, (i + 1) * SEG, total))

    bottom = max(y + h for (x, y, w, h) in boxes)

    if feed:
        at = feed["at"]
        x, y, w, h = boxes[at]
        d = max(at - 1, 0) * NODE_STEP + 0.1
        if variant == "wide":
            body.append(node(pen, fx, top, fw, fh, *feed["node"], d, ts - 1, ss, aux=True))
            body.append(connector(pen, pid("f"), x + w / 2, top + fh + 4, x + w / 2, y - 5, d + 0.2))
        else:
            body.append(node(pen, sx, y, sw, h, *feed["tall"], d, ts - 2, ss - 1, aux=True))
            body.append(connector(pen, pid("f"), sx - 4, y + h / 2, x + w + 5, y + h / 2, d + 0.2))
        dots.append(dot(pid("f"), max(at - 1, 0) * SEG, at * SEG, total, soft=True))

    if log:
        at = log["at"]
        d0 = (n - 1) * NODE_STEP + 0.3
        if variant == "wide":
            ly, lh = bottom + 48, 58
            lx = boxes[at[0]][0]
            lw = boxes[at[-1]][0] + boxes[at[-1]][2] - lx
            body.append(node(pen, lx, ly, lw, lh, *log["node"], d0, ts - 1, ss, aux=True))
            for k, i in enumerate(at):
                x, y, w, h = boxes[i]
                body.append(connector(pen, pid(f"l{i}"), x + w / 2, y + h + 5, x + w / 2, ly - 5, d0 + 0.1 + k * 0.1, dashed=True))
                dots.append(dot(pid(f"l{i}"), i * SEG, i * SEG + 0.7 * SEG, total, soft=True))
            bottom = ly + lh
        else:
            ly = boxes[at[0]][1]
            lh = boxes[at[-1]][1] + nh - ly
            body.append(node(pen, sx, ly, sw, lh, *log["tall"], d0, ts - 2, ss - 1, aux=True))
            for k, i in enumerate(at):
                x, y, w, h = boxes[i]
                body.append(connector(pen, pid(f"l{i}"), x + w + 5, y + h / 2, sx - 5, y + h / 2, d0 + 0.1 + k * 0.1, dashed=True))
                dots.append(dot(pid(f"l{i}"), i * SEG, i * SEG + 0.7 * SEG, total, soft=True))

    body.extend(dots)
    return svg(name, variant, spec, W, bottom + 10, body)


def main():
    page = Path(__file__).resolve().parent.parent / "index.html"
    html = page.read_text(encoding="utf-8")
    for name, spec in DIAGRAMS.items():
        start, end = f"<!-- diagram:{name} -->", f"<!-- /diagram:{name} -->"
        pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
        if not pattern.search(html):
            sys.exit(f"Markers for '{name}' not found in index.html")
        figure = f"{start}\n{build(name, spec, 'wide')}\n{build(name, spec, 'tall')}\n{end}"
        html = pattern.sub(lambda _: figure, html)
    page.write_text(html, encoding="utf-8", newline="\n")
    print(f"Updated {len(DIAGRAMS)} diagrams in {page.name}")


if __name__ == "__main__":
    main()
