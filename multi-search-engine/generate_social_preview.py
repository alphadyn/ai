from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "social-preview.png"
WIDTH, HEIGHT = 1200, 630

BG = (17, 23, 20)
PANEL = (26, 33, 29)
PANEL_ALT = (20, 27, 23)
LINE = (49, 61, 53)
TEXT = (237, 243, 239)
MUTED = (161, 176, 166)
DIM = (119, 137, 125)
GREEN = (76, 178, 132)


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Neue Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica Neue.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


image = Image.new("RGB", (WIDTH, HEIGHT), BG)
draw = ImageDraw.Draw(image, "RGBA")

for x in range(24, WIDTH, 48):
    draw.line((x, 0, x, HEIGHT), fill=(198, 224, 207, 7), width=1)
for y in range(24, HEIGHT, 48):
    draw.line((0, y, WIDTH, y), fill=(198, 224, 207, 7), width=1)
rounded(draw, (18, 18, WIDTH - 18, HEIGHT - 18), 22, None, (108, 132, 115, 75), 1)

rounded(draw, (66, 62, 122, 118), 15, (35, 132, 95, 255))
rounded(draw, (66, 62, 122, 118), 15, None, (126, 210, 163, 100), 1)
draw.ellipse((81, 76, 104, 99), outline=(255, 255, 255, 255), width=3)
draw.line((101, 96, 111, 106), fill=(255, 255, 255, 255), width=3)
draw.line((92, 82, 92, 94), fill=(255, 255, 255, 255), width=2)
draw.line((86, 88, 98, 88), fill=(255, 255, 255, 255), width=2)
draw.text((140, 67), "RESEARCH WORKSPACE", font=font(12, True), fill=GREEN)
draw.text((138, 89), "Multi-Search Engine", font=font(23, True), fill=TEXT)
draw.line((66, 151, 475, 151), fill=(137, 158, 142, 70), width=1)

draw.text((66, 194), "One query.", font=font(48, True), fill=TEXT)
draw.text((66, 251), "More perspectives.", font=font(43, True), fill=GREEN)
draw.text((70, 337), "Compare findings from web, research,", font=font(17), fill=MUTED)
draw.text((70, 365), "and community sources in one place.", font=font(17), fill=MUTED)

for label, x, width in (("WEB", 70, 72), ("RESEARCH", 154, 112), ("COMMUNITY", 280, 128)):
    rounded(draw, (x, 424, x + width, 454), 7, (24, 34, 28, 255), (60, 82, 67, 200), 1)
    draw.text((x + 11, 432), label, font=font(9, True), fill=(174, 195, 179, 255))

draw.text((70, 546), "SEARCH  /  COMPARE  /  DISCOVER", font=font(10, True), fill=DIM)

rounded(draw, (520, 62, 1135, 568), 18, PANEL, (70, 86, 75, 220), 1)
rounded(draw, (520, 62, 1135, 109), 18, (30, 39, 33, 255))
draw.rectangle((521, 91, 1134, 109), fill=(30, 39, 33, 255))
for dot_x, color in ((545, (222, 133, 128, 255)), (561, (226, 174, 97, 255)), (577, (98, 189, 142, 255))):
    draw.ellipse((dot_x, 80, dot_x + 8, 88), fill=color)
draw.text((600, 77), "MULTI-SEARCH ENGINE", font=font(10, True), fill=MUTED)
rounded(draw, (1054, 73, 1113, 96), 7, (37, 132, 95, 255))
draw.text((1068, 79), "READY", font=font(8, True), fill=TEXT)

# Query field and action.
rounded(draw, (548, 128, 1107, 176), 8, PANEL_ALT, LINE, 1)
draw.ellipse((565, 143, 579, 157), outline=(137, 158, 142, 255), width=2)
draw.line((576, 154, 583, 161), fill=(137, 158, 142, 255), width=2)
draw.text((596, 143), "quantum computing", font=font(14), fill=TEXT)
rounded(draw, (1006, 135, 1098, 169), 6, GREEN)
draw.text((1027, 145), "Search", font=font(11, True), fill=(14, 35, 24, 255))

draw.text((550, 194), "SELECTED SOURCES", font=font(9, True), fill=DIM)
draw.text((1048, 194), "3 / 5", font=font(9, True), fill=GREEN)

sources = [
    ("DDG", "DuckDuckGo", (222, 88, 51, 255)),
    ("W", "Wikipedia", (82, 91, 86, 255)),
    ("GH", "GitHub", (67, 78, 71, 255)),
]
for index, (mark, label, color) in enumerate(sources):
    x = 548 + index * 181
    rounded(draw, (x, 211, x + 171, 258), 7, (22, 30, 25, 255), (55, 70, 60, 255), 1)
    rounded(draw, (x + 10, 220, x + 38, 248), 6, color)
    draw.text((x + 13, 227), mark, font=font(8, True), fill=(255, 255, 255, 255))
    draw.text((x + 47, 228), label, font=font(10, True), fill=TEXT)
    rounded(draw, (x + 148, 226, x + 160, 238), 3, GREEN)
    draw.line((x + 151, 232, x + 154, 235), fill=(255, 255, 255, 255), width=1)
    draw.line((x + 154, 235, x + 158, 229), fill=(255, 255, 255, 255), width=1)

draw.line((548, 277, 1107, 277), fill=(55, 70, 60, 220), width=1)
draw.text((550, 291), "SEARCH RESULTS", font=font(9, True), fill=DIM)
draw.text((1041, 291), "12 findings", font=font(9), fill=MUTED)

results = [
    ("Wikipedia", "A field of physics and computer science that studies", "the behavior of matter and energy at the quantum scale."),
    ("DuckDuckGo", "Quantum computing uses quantum mechanics to solve", "problems beyond the reach of classical computers."),
]
for index, (source, line_one, line_two) in enumerate(results):
    y = 316 + index * 102
    rounded(draw, (548, y, 1107, y + 88), 7, (22, 30, 25, 255), (48, 62, 53, 240), 1)
    draw.text((564, y + 12), source.upper(), font=font(8, True), fill=GREEN if index == 0 else (224, 146, 116, 255))
    draw.text((564, y + 31), line_one, font=font(10), fill=TEXT)
    draw.text((564, y + 49), line_two, font=font(10), fill=MUTED)
    draw.text((1076, y + 62), "OPEN  >", font=font(8, True), fill=GREEN)

image.save(OUT, format="PNG", optimize=True)
print(f"Wrote {OUT} ({WIDTH}x{HEIGHT})")