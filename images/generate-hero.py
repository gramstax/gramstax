#!/usr/bin/env python3
"""Generate images/gramstax.png — the README hero.

Code-built, not AI-generated: flat shapes, the project's real logo mark,
the README's own words, and the real StartPage template from
example/2-helloworld, with the handler calling renderText directly
(no gdefault.show indirection) and data from Math.random(). No gradients,
no glow, no fake UI, no hallucinated text.

Regenerate: python3 images/generate-hero.py  (needs Pillow + the Liberation fonts)
Output: images/gramstax.png, 2752x1536.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 2752, 1536
BG = (11, 14, 19)
GRID = (18, 22, 29)
PANEL = (16, 22, 30)
BORDER = (35, 46, 61)
WHITE = (255, 255, 255)
MUTED = (154, 167, 180)
CODE = (201, 212, 224)
DIM = (122, 138, 154)
BLUE = (108, 182, 255)
GREEN = (143, 206, 155)
AMBER = (229, 181, 103)
ARROW = (42, 171, 238)

FONT_DIR = "/usr/share/fonts/truetype/liberation"


def font(name, size):
    return ImageFont.truetype(f"{FONT_DIR}/{name}.ttf", size)


SANS_BOLD = lambda s: font("LiberationSans-Bold", s)
SANS = lambda s: font("LiberationSans-Regular", s)
MONO = lambda s: font("LiberationMono-Regular", s)
MONO_BOLD = lambda s: font("LiberationMono-Bold", s)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# Faint graph-paper grid: flat 1px lines, no glow, no blobs.
for x in range(0, W + 1, 128):
    d.line([(x, 0), (x, H)], fill=GRID, width=1)
for y in range(0, H + 1, 128):
    d.line([(0, y), (W, y)], fill=GRID, width=1)

# --- Left: real logo mark + wordmark + tagline (README's own words) ---
logo = Image.open("images/gramstax-logo.png").convert("RGBA").resize((220, 220), Image.LANCZOS)
mask = Image.new("L", (220, 220), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 219, 219], radius=32, fill=255)
img.paste(logo, (180, 150), mask)

wordmark = SANS_BOLD(170)
d.text((440, 178), "Gramstax", font=wordmark, fill=WHITE)

tag = SANS(62)
tag_lines = [
    "A modern Telegram bot framework",
    "built around page-based routing",
    "and a powerful template system",
]
y = 520
for line in tag_lines:
    d.text((180, y), line, font=tag, fill=MUTED)
    y += 88

# --- Left bottom: Pages -> Routes -> Templates, flat pills, no glow ---
pill_font = SANS_BOLD(54)
arrow_font = SANS_BOLD(60)
pills = ["Pages", "Routes", "Templates"]
x = 180
py = 1240
for i, label in enumerate(pills):
    tw = d.textlength(label, font=pill_font)
    pw = int(tw + 96)
    d.rounded_rectangle([x, py, x + pw, py + 104], radius=52, fill=(20, 27, 36), outline=(42, 54, 70), width=2)
    d.text((x + 48, py + 24), label, font=pill_font, fill=WHITE)
    x += pw
    if i < 2:
        d.text((x + 18, py + 20), "→", font=arrow_font, fill=ARROW)
        x += 88

# --- Right: code panel with the real StartPage template, handler calling
# renderText directly (no gdefault.show indirection), data from Math.random() ---
px0, py0, px1, py1 = 1330, 150, 2572, 1440
d.rounded_rectangle([px0, py0, px1, py1], radius=18, fill=PANEL, outline=BORDER, width=2)
d.text((1372, 182), "start.ts · excerpt", font=MONO(40), fill=DIM)
d.line([(px0, 248), (px1, 248)], fill=BORDER, width=2)

KW, ST, TG, AT, BS = BLUE, GREEN, BLUE, AMBER, CODE
code_lines = [
    [("export ", KW), ("class ", KW), ("StartPage ", BS), ("extends ", KW), ("PageBase ", BS), ("{", BS)],
    [("  static ", KW), ("data ", BS), ("= ", BS), ("this.buildData()", BS)],
    [],
    [("  async ", KW), ("handleCommandText", BS), ("() {", BS)],
    [("    await ", KW), ("this.renderText({", BS)],
    [("      data: { ", BS), ("time", BS), (": ", BS), ("Math.random()", BS), (" },", BS)],
    [("    })", BS)],
    [("  }", BS)],
    [],
    [("  static ", KW), ("template ", BS), ("= ", BS), ("`", ST)],
    [("    <g-base>", TG)],
    [("      <g-message>", TG)],
    [("        Hello World!", BS)],
    [("        Time now: ", BS), ("{{time}}", BS)],
    [("      </g-message>", TG)],
    [("      <g-message ", TG), ("lang", AT), ("=", BS), ('"id"', ST), (">", TG)],
    [("        Halo Dunia!", BS)],
    [("        Waktu: ", BS), ("{{time}}", BS)],
    [("      </g-message>", TG)],
    [("    </g-base>", TG)],
    [("  `", ST)],
    [("}", BS)],
]
mono = MONO(42)
cy = 280
for segments in code_lines:
    cx = 1372
    for text, color in segments:
        d.text((cx, cy), text, font=mono, fill=color)
        cx += d.textlength(text, font=mono)
    cy += 52

img.save("images/gramstax.png", optimize=True)
print(f"saved images/gramstax.png {img.size}")
