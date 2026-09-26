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
import tempfile
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID

from PIL import Image, ImageOps, UnidentifiedImageError


ROOT = Path(__file__).resolve().parent
APP_URL = 'https://alphadyn.github.io/ai/pulse/'
FALLBACK_IMAGE = APP_URL + 'social-preview-mobile.png'
PAGE_SIZE = 20  # Attachments can be large; do not load hundreds of posts at once.
IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/gif'}
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


def cover_image(post, post_dir, share_url):
    for attachment in post.get('attachments') or []:
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
                background = Image.new('RGB', image.size, '#0f181f')
                background.paste(image, mask=image.getchannel('A'))
                output = BytesIO()
                background.save(output, format='JPEG', quality=85, optimize=True)
            content = output.getvalue()
            filename = f'cover-{hashlib.sha256(content).hexdigest()[:16]}.jpg'
            (post_dir / filename).write_bytes(content)
            return share_url + filename
        except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError):
            continue
    return FALLBACK_IMAGE


def render_page(post, share_url, image_url):
    title = str(post.get('title') or 'Pulse post')[:140]
    description = plain_text(post.get('body'))[:280] or f"Shared by {post.get('author_name') or 'Anonymous'} on Pulse."
    app_url = APP_URL + '?post=' + post['id']
    escaped_title = html.escape(title, quote=True)
    escaped_desc = html.escape(description, quote=True)
    escaped_image = html.escape(image_url, quote=True)
    escaped_share = html.escape(share_url, quote=True)
    escaped_app = html.escape(app_url, quote=True)
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
  <meta name="description" content="{escaped_desc}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Pulse">
  <meta property="og:url" content="{escaped_share}">
  <meta property="og:title" content="{escaped_title}">
  <meta property="og:description" content="{escaped_desc}">
  <meta property="og:image" content="{escaped_image}">
  <meta property="og:image:secure_url" content="{escaped_image}">
  <meta property="og:image:type" content="{image_type}">
  <meta property="og:image:alt" content="Image from the Pulse post {escaped_title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escaped_title}">
  <meta name="twitter:description" content="{escaped_desc}">
  <meta name="twitter:image" content="{escaped_image}">
  <title>{escaped_title} · Pulse</title>
  <style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#071117;color:#edf4f8;font:16px/1.5 system-ui,sans-serif}}main{{width:min(90%,480px);padding:24px;border:1px solid #30414c;border-radius:20px;background:#101c24}}img{{width:100%;max-height:350px;object-fit:cover;border-radius:12px}}a{{color:#8fe7ab}}h1{{overflow-wrap:anywhere}}</style>
</head>
<body>
  <main>
    <img src="{escaped_image}" alt="Preview image for {escaped_title}">
    <h1>{escaped_title}</h1>
    <p>{escaped_desc}</p>
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
