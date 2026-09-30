from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "social-preview.png"
W, H = 1200, 630


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


image = Image.new("RGB", (W, H))
pixels = image.load()
for y in range(H):
    for x in range(W):
        t = (x / W * 0.55 + y / H * 0.45)
        glow = max(0, 1 - (((x - 250) / 720) ** 2 + ((y - 80) / 470) ** 2) ** 0.5)
        pixels[x, y] = (
            int(10 + 8 * (1 - t) + 8 * glow),
            int(15 + 8 * (1 - t) + 24 * glow),
            int(30 + 20 * (1 - t) + 35 * glow),
        )

draw = ImageDraw.Draw(image, "RGBA")
# Subtle technical grid and outer keyline.
for x in range(28, W, 48):
    draw.line((x, 0, x, H), fill=(152, 180, 204, 10), width=1)
for y in range(18, H, 48):
    draw.line((0, y, W, y), fill=(152, 180, 204, 10), width=1)
rounded(draw, (18, 18, W - 18, H - 18), 28, None, (141, 177, 201, 35), 1)

# Brand lockup.
rounded(draw, (66, 48, 116, 98), 15, (17, 24, 44, 255), (87, 112, 155, 180), 1)
draw.polygon([(77, 85), (88, 59), (95, 59), (107, 85), (98, 85), (92, 69), (85, 85)], fill=(244, 247, 255, 255))
draw.line([(80, 83), (87, 76), (93, 80), (100, 69), (105, 73)], fill=(110, 231, 210, 255), width=4, joint="curve")
draw.ellipse((98, 67, 104, 73), fill=(138, 167, 255, 255))
draw.text((130, 52), "ALPHADYN", font=font(17, True), fill=(244, 247, 255, 255))
draw.text((131, 76), "APPLIED INTELLIGENCE", font=font(9, True), fill=(148, 169, 192, 255))
rounded(draw, (850, 55, 1135, 91), 18, (24, 36, 58, 230), (83, 106, 139, 120), 1)
draw.ellipse((867, 69, 875, 77), fill=(110, 231, 210, 255))
draw.text((885, 67), "35 INDEPENDENT PROJECTS", font=font(10, True), fill=(190, 208, 230, 255))
draw.line((66, 119, 1134, 119), fill=(136, 164, 194, 55), width=1)

# Headline and supporting copy.
draw.text((70, 165), "IDEAS, BUILT", font=font(12, True), fill=(110, 231, 210, 255))
draw.text((65, 198), "Intelligence,", font=font(57, True), fill=(246, 248, 255, 255), stroke_width=1)
draw.text((65, 263), "in motion.", font=font(57, True), fill=(110, 231, 210, 255), stroke_width=1)
draw.text((70, 355), "A collection of interactive tools, dashboards,", font=font(17), fill=(174, 188, 211, 255))
draw.text((70, 383), "reports, and experiments by Alphadyn AI.", font=font(17), fill=(174, 188, 211, 255))
rounded(draw, (70, 441, 300, 487), 13, (110, 231, 210, 255))
draw.text((89, 454), "EXPLORE THE COLLECTION", font=font(11, True), fill=(12, 31, 39, 255))
draw.text((71, 535), "TOOLS   /   IDEAS   /   EXPERIMENTS", font=font(10, True), fill=(137, 158, 184, 255))

# Portfolio interface panel.
rounded(draw, (583, 145, 1135, 538), 23, (15, 24, 42, 242), (92, 119, 154, 150), 1)
draw.text((610, 168), "PROJECT DIRECTORY", font=font(10, True), fill=(143, 164, 192, 255))
draw.text((610, 190), "A universe of useful ideas", font=font(20, True), fill=(241, 245, 255, 255))
rounded(draw, (969, 167, 1107, 194), 11, (23, 38, 57, 255), (66, 88, 118, 180), 1)
draw.text((983, 175), "CURATED WORK", font=font(8, True), fill=(173, 194, 222, 255))

cards = [
    ((610, 231, 862, 350), "MARKETS", "Market Curve Lab", "Trendlines & S&P 500 analysis", (110, 231, 210, 255), "chart"),
    ((878, 231, 1107, 350), "SOCIAL", "Pulse", "Stories & conversations", (138, 167, 255, 255), "pulse"),
    ((610, 365, 862, 484), "MAPS", "Experiences", "Places, moments & memories", (255, 188, 130, 255), "pin"),
    ((878, 365, 1107, 484), "WORKSPACE", "Nexus", "A home for your content", (195, 157, 255, 255), "diamond"),
]
for box, category, title, desc, accent, mark in cards:
    rounded(draw, box, 15, (22, 34, 55, 255), (63, 83, 112, 170), 1)
    x1, y1, x2, y2 = box
    rounded(draw, (x2 - 47, y1 + 15, x2 - 17, y1 + 45), 10, (13, 23, 40, 255), (68, 90, 124, 160), 1)
    cx, cy = x2 - 32, y1 + 30
    if mark == "chart":
        draw.line((cx - 8, cy + 7, cx - 8, cy - 7, cx + 8, cy - 7), fill=accent, width=2)
        draw.line((cx - 6, cy + 3, cx - 2, cy, cx + 1, cy + 2, cx + 7, cy - 5), fill=accent, width=2, joint="curve")
    elif mark == "pulse":
        draw.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), outline=accent, width=2)
        draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=accent)
    elif mark == "pin":
        draw.ellipse((cx - 7, cy - 9, cx + 7, cy + 5), outline=accent, width=2)
        draw.polygon([(cx - 5, cy + 1), (cx, cy + 11), (cx + 5, cy + 1)], fill=accent)
        draw.ellipse((cx - 2, cy - 4, cx + 2, cy), fill=(13, 23, 40, 255))
    else:
        draw.polygon([(cx, cy - 10), (cx + 10, cy), (cx, cy + 10), (cx - 10, cy)], outline=accent, fill=(22, 34, 55, 255), width=2)
    draw.text((x1 + 17, y1 + 18), category, font=font(9, True), fill=accent)
    draw.text((x1 + 17, y1 + 53), title, font=font(15, True), fill=(241, 245, 255, 255))
    draw.text((x1 + 17, y1 + 82), desc, font=font(10), fill=(164, 180, 205, 255))

# Accent chart line in the portfolio footer.
draw.line((610, 510, 1107, 510), fill=(73, 95, 124, 100), width=1)
draw.text((611, 516), "BUILT TO EXPLORE. MADE TO BE USEFUL.", font=font(8, True), fill=(137, 158, 184, 255))
for i, height in enumerate((9, 16, 12, 23, 18, 29, 24, 36)):
    x = 1026 + i * 10
    rounded(draw, (x, 528 - height, x + 5, 528), 2, (110, 231, 210, 190 if i < 6 else 255))

image.save(OUT, format="PNG", optimize=True)
print(f"Wrote {OUT} ({W}x{H})")
