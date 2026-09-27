"""Build per-post, crawler-readable GitHub Pages previews from public Pulse posts."""

import base64
import hashlib
import html
from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from uuid import UUID

from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError


ROOT = Path(__file__).resolve().parent
APP_URL = 'https://alphadyn.github.io/ai/pulse/'
FALLBACK_IMAGE = APP_URL + 'social-preview-mobile.png'
PAGE_SIZE = 20  # Attachments can be large; do not load hundreds of posts at once.
IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/gif'}
MAX_VIDEO_BYTES = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 24_000_000


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def plain_text(value):
    extractor = TextExtractor()
    extractor.feed(str(value or ''))
    return ' '.join(' '.join(extractor.parts).split())


def public_config(path=ROOT / 'supabase-config.js'):
    config = path.read_text()
    values = {}
    for key in ('url', 'anonKey'):
        match = re.search(r'\b' + key + r"\s*:\s*'([^']+)'", config)
        if not match:
            raise ValueError(f'Missing public Supabase {key} in Pulse config')
        values[key] = match.group(1)
    if not values['url'].startswith('https://'):
        raise ValueError('Supabase URL must use HTTPS')
    return values['url'].rstrip('/'), values['anonKey']


def fetch_posts(supabase_url, api_key):
    offset = 0
    while True:
        query = urlencode({
            'select': 'id,title,body,author_name,attachments,is_deleted',
            'is_deleted': 'eq.false',
            'order': 'id.asc',
            'limit': str(PAGE_SIZE),
            'offset': str(offset),
        })
        request = Request(
            f'{supabase_url}/rest/v1/pulse_posts?{query}',
            headers={'apikey': api_key, 'Authorization': f'Bearer {api_key}'},
        )
        with urlopen(request, timeout=40) as response:
            posts = json.load(response)
        if not isinstance(posts, list):
            raise ValueError('Supabase did not return a post list')
        yield from posts
        if len(posts) < PAGE_SIZE:
            break
        offset += PAGE_SIZE


def wrap_preview_text(text, draw, font, max_width, max_lines=2):
    words = str(text or '').split()
    lines = []
    current = ''
    for word in words:
        candidate = f'{current} {word}'.strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
            continue

        if current:
            lines.append(current)
        current = word
        while draw.textlength(current, font=font) > max_width and len(current) > 1:
            split_at = len(current) - 1
            while split_at > 1 and draw.textlength(current[:split_at], font=font) > max_width:
                split_at -= 1
            lines.append(current[:split_at])
            current = current[split_at:]

    if current:
        lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and draw.textlength(last + '…', font=font) > max_width:
            last = last[:-1]
        lines[-1] = last.rstrip() + '…'
    return lines


def overlay_post_text(image, text):
    image = image.convert('RGBA')
    width, height = image.size
    font_size = max(12, round(min(width, height) * 0.04))
    font = ImageFont.load_default(size=font_size)
    draw = ImageDraw.Draw(image)
    padding = round(width * 0.055)
    line_height = round(font_size * 1.35)
    lines = wrap_preview_text(text, draw, font, width - padding * 2)
    if not lines:
        return image

    panel_height = min(height, line_height * len(lines) + padding * 2)
    gradient = Image.new('RGBA', (width, panel_height))
    gradient_draw = ImageDraw.Draw(gradient)
    for y in range(panel_height):
        alpha = round(225 * (y / max(1, panel_height - 1)) ** 0.65)
        gradient_draw.line((0, y, width, y), fill=(4, 11, 16, alpha))
    image.alpha_composite(gradient, (0, height - panel_height))

    draw = ImageDraw.Draw(image)
    first_y = height - padding - line_height * len(lines)
    for index, line in enumerate(lines):
        draw.text(
            (padding, first_y + index * line_height),
            line,
            font=font,
            fill=(255, 255, 255, 255),
            stroke_width=max(1, font_size // 18),
            stroke_fill=(0, 0, 0, 180),
        )
    return image


def video_screenshot(video_bytes):
    try:
        import imageio_ffmpeg

        with tempfile.NamedTemporaryFile(suffix='.video') as video_file:
            video_file.write(video_bytes)
            video_file.flush()
            result = subprocess.run(
                [
                    imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error',
                    '-i', video_file.name, '-frames:v', '1', '-vf',
                    'scale=1200:1200:force_original_aspect_ratio=decrease',
                    '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1',
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                timeout=20,
            )
        if result.returncode != 0 or not result.stdout:
            return None
        with Image.open(BytesIO(result.stdout)) as frame:
            frame.load()
            frame = ImageOps.exif_transpose(frame)
            frame.thumbnail((1200, 1200))
            return frame.convert('RGBA')
    except (ImportError, OSError, RuntimeError, subprocess.SubprocessError,
            ValueError, UnidentifiedImageError, Image.DecompressionBombError):
        return None


def cover_image(post, post_dir, share_url):
    image = None
    attachments = post.get('attachments') or []
    if not isinstance(attachments, list):
        attachments = []

    first_attachment = attachments[0] if attachments else None
    first_mime = str(first_attachment.get('mimeType') or '').lower() if isinstance(first_attachment, dict) else ''
    if first_mime.startswith('video/'):
        data_url = first_attachment.get('dataUrl') or ''
        prefix = f'data:{first_mime};base64,'
        if isinstance(data_url, str) and data_url.startswith(prefix) and len(data_url) <= MAX_VIDEO_BYTES * 4 // 3 + 16:
            try:
                video_bytes = base64.b64decode(data_url[len(prefix):], validate=True)
                if len(video_bytes) <= MAX_VIDEO_BYTES:
                    image = video_screenshot(video_bytes)
            except ValueError:
                pass
    else:
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue
            mime = str(attachment.get('mimeType') or '').lower()
            data_url = attachment.get('dataUrl') or ''
            if (mime not in IMAGE_TYPES or not isinstance(data_url, str)
                    or len(data_url) > 3 * 1024 * 1024
                    or not data_url.startswith(f'data:{mime};base64,')):
                continue
            try:
                data = base64.b64decode(data_url.split(',', 1)[1], validate=True)
                if len(data) > 2 * 1024 * 1024:
                    continue
                with Image.open(BytesIO(data)) as original:
                    if original.format.lower() != mime.split('/')[-1]:
                        continue
                    original.seek(0)  # The first frame is the preview for animations.
                    image = ImageOps.exif_transpose(original)
                    image.thumbnail((1200, 1200))
                    image = image.convert('RGBA')
                break
            except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError):
                continue

    if image is None:
        with Image.open(ROOT / 'social-preview-mobile.png') as original:
            image = ImageOps.exif_transpose(original).convert('RGBA')
            image.thumbnail((1200, 1200))

    image = overlay_post_text(image, plain_text(post.get('body')))
    background = Image.new('RGB', image.size, '#0f181f')
    background.paste(image, mask=image.getchannel('A'))
    output = BytesIO()
    background.save(output, format='JPEG', quality=85, optimize=True)
    content = output.getvalue()
    filename = f'cover-{hashlib.sha256(content).hexdigest()[:16]}.jpg'
    (post_dir / filename).write_bytes(content)
    return share_url + filename


def render_page(post, share_url, image_url):
    title = str(post.get('title') or 'Pulse post')[:140]
    app_url = APP_URL + '?post=' + post['id']
    escaped_title = html.escape(title, quote=True)
    escaped_image = html.escape(image_url, quote=True)
    escaped_share = html.escape(share_url, quote=True)
    escaped_app = html.escape(app_url, quote=True)
    domain = html.escape(urlsplit(share_url).hostname or '', quote=True)
    image_type = 'image/jpeg' if image_url != FALLBACK_IMAGE else 'image/png'
    # JSON is safe in a script element only after escaping '<' (including </script>).
    destination = json.dumps(app_url).replace('<', '\\u003c')
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <link rel="canonical" href="{escaped_share}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Pulse">
  <meta property="og:url" content="{escaped_share}">
  <meta property="og:title" content="{escaped_title}">
  <meta property="og:image" content="{escaped_image}">
  <meta property="og:image:secure_url" content="{escaped_image}">
  <meta property="og:image:type" content="{image_type}">
  <meta property="og:image:alt" content="Image from the Pulse post {escaped_title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escaped_title}">
  <meta name="twitter:image" content="{escaped_image}">
  <title>{escaped_title} · Pulse</title>
    <style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#071117;color:#edf4f8;font:16px/1.5 system-ui,sans-serif}}main{{width:min(90%,480px);padding:24px;border:1px solid #30414c;border-radius:20px;background:#101c24}}img{{display:block;width:100%;height:auto;border-radius:12px}}a{{color:#8fe7ab}}h1{{overflow-wrap:anywhere}}.domain{{margin:10px 0 0;color:#7c909c;font-size:12px;text-align:center}}</style>
</head>
<body>
  <main>
    <h1>{escaped_title}</h1>
    <img src="{escaped_image}" alt="Preview image for {escaped_title}">
    <p class="domain">{domain}</p>
    <a href="{escaped_app}">Open in Pulse</a>
  </main>
  <script>location.replace({destination});</script>
</body>
</html>
'''


def build_pages(output=ROOT / 'share', posts=None):
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pulse-share-', dir=output.parent) as staging_name:
        staging = Path(staging_name)
        source = posts if posts is not None else fetch_posts(*public_config())
        count = 0
        for post in source:
            if post.get('is_deleted'):
                continue
            try:
                post_id = str(UUID(str(post['id'])))
            except (KeyError, ValueError, TypeError) as error:
                raise ValueError('Invalid Pulse post ID') from error
            post_dir = staging / post_id
            post_dir.mkdir()
            share_url = APP_URL + 'share/' + post_id + '/'
            image_url = cover_image(post, post_dir, share_url)
            (post_dir / 'index.html').write_text(render_page({**post, 'id': post_id}, share_url, image_url), encoding='utf-8')
            count += 1
        # Remove pages for deleted posts and stale image filenames on each build.
        if output.exists():
            shutil.rmtree(output)
        shutil.move(str(staging), str(output))
    return count


if __name__ == '__main__':
    print(f'Generated {build_pages()} Pulse share pages')
