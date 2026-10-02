"""Build crawler-readable GitHub Pages previews for public Experiences."""

import html
import json
from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID


ROOT = Path(__file__).resolve().parent
APP_URL = 'https://alphadyn.github.io/ai/experiences/'
FALLBACK_IMAGE = APP_URL + 'assets/experience-pin-photos.png'
PAGE_SIZE = 1000
BATCH_SIZE = 100
SHARE_KEY_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,180}$')


def public_config(path=ROOT / 'supabase-config.js'):
    config = path.read_text(encoding='utf-8')
    values = {}
    for key in ('url', 'anonKey'):
        match = re.search(r'\b' + key + r"\s*:\s*'([^']+)'", config)
        if not match:
            raise ValueError(f'Missing public Supabase {key} in Experiences config')
        values[key] = match.group(1)
    if not values['url'].startswith('https://'):
        raise ValueError('Supabase URL must use HTTPS')
    return values['url'].rstrip('/'), values['anonKey']


def fetch_rows(table, params, supabase_url, api_key):
    offset = 0
    while True:
        query = urlencode({**params, 'limit': str(PAGE_SIZE), 'offset': str(offset)})
        request = Request(
            f'{supabase_url}/rest/v1/{table}?{query}',
            headers={'apikey': api_key, 'Authorization': f'Bearer {api_key}'},
        )
        with urlopen(request, timeout=40) as response:
            rows = json.load(response)
        if not isinstance(rows, list):
            raise ValueError(f'Supabase did not return rows for {table}')
        yield from rows
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE


def fetch_experiences(supabase_url, api_key):
    return list(fetch_rows('checkin_map_experiences', {
        'select': 'id,name,description,public_slug,is_public',
        'is_public': 'eq.true',
        'order': 'id.asc',
    }, supabase_url, api_key))


def fetch_locations(experience_ids, supabase_url, api_key):
    locations = []
    for start in range(0, len(experience_ids), BATCH_SIZE):
        identifiers = ','.join(experience_ids[start:start + BATCH_SIZE])
        locations.extend(fetch_rows('checkin_map_locations', {
            'select': 'id,experience_id',
            'experience_id': f'in.({identifiers})',
            'order': 'timestamp.asc',
        }, supabase_url, api_key))
    return locations


def fetch_media(location_ids, supabase_url, api_key):
    media = []
    for start in range(0, len(location_ids), BATCH_SIZE):
        identifiers = ','.join(location_ids[start:start + BATCH_SIZE])
        media.extend(fetch_rows('checkin_map_media', {
            'select': 'checkin_id,public_url,mime_type,created_at',
            'checkin_id': f'in.({identifiers})',
            'order': 'created_at.asc',
        }, supabase_url, api_key))
    return media


def safe_cover_url(value):
    prefix = 'https://vftmcftccahjlxbxcnsf.supabase.co/storage/v1/object/public/checkin-map-media/'
    return value if isinstance(value, str) and value.startswith(prefix) else FALLBACK_IMAGE


def render_page(experience, share_url, image_url, image_type, event_count):
    public_slug = str(experience['public_slug'])
    name = str(experience.get('name') or 'Shared Experience')[:160]
    description = str(experience.get('description') or '').strip()[:280]
    if not description:
        description = f'{event_count} {"moment" if event_count == 1 else "moments"} mapped. Explore the places and story in Experiences.'
    app_url = APP_URL + '?' + urlencode({'experience': public_slug})
    safe_name = html.escape(name, quote=True)
    safe_description = html.escape(description, quote=True)
    safe_share = html.escape(share_url, quote=True)
    safe_app = html.escape(app_url, quote=True)
    safe_image = html.escape(image_url, quote=True)
    safe_image_type = html.escape(image_type, quote=True)
    image_alt = html.escape(f'Photos attached to the places in {name}', quote=True)
    event_summary = f'{event_count} {"moment" if event_count == 1 else "moments"} on the map' if event_count else 'A personal map of places and memories'
    twitter_image = FALLBACK_IMAGE if image_type == 'image/webp' else image_url
    destination = json.dumps(app_url).replace('<', '\\u003c')
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f3f6f1">
  <meta name="description" content="{safe_description}">
  <meta name="robots" content="noindex,follow">
  <link rel="canonical" href="{safe_share}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Experiences">
  <meta property="og:url" content="{safe_share}">
  <meta property="og:title" content="{safe_name} · Experiences">
  <meta property="og:description" content="{safe_description}">
  <meta property="og:image" content="{safe_image}">
  <meta property="og:image:secure_url" content="{safe_image}">
  <meta property="og:image:type" content="{safe_image_type}">
  <meta property="og:image:alt" content="{image_alt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{safe_name} · Experiences">
  <meta name="twitter:description" content="{safe_description}">
  <meta name="twitter:image" content="{html.escape(twitter_image, quote=True)}">
  <title>{safe_name} · Experiences</title>
  <style>
    :root{{color-scheme:light;--ink:#17212b;--muted:#68756f;--accent:#0f766e;--border:#d8e1dc;--paper:#fffdf8;--wash:#f3f6f1}}
    *{{box-sizing:border-box}}
    body{{margin:0;min-height:100vh;min-height:100svh;padding:24px 16px;display:grid;place-items:center;background:radial-gradient(ellipse at 90% 0%,#dff4ef 0,transparent 36%),var(--wash);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
    main{{width:min(100%,520px);overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--paper);box-shadow:0 24px 64px #1f34251c}}
    .brand{{padding:18px 20px;color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}}
    .cover{{display:block;width:100%;aspect-ratio:1.91;object-fit:cover;background:#eaf1ed}}
    section{{padding:20px 22px 22px}}
    h1{{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:32px;line-height:1.12;overflow-wrap:anywhere}}
    p{{margin:10px 0;color:var(--muted);overflow-wrap:anywhere}}
    .count{{margin:18px 0;color:#48615a;font-size:13px;font-weight:700}}
    a{{display:flex;min-height:50px;align-items:center;justify-content:center;padding:12px 18px;border-radius:10px;background:var(--accent);color:white;font-weight:750;text-decoration:none}}
  </style>
</head>
<body>
  <main>
    <div class="brand">Experiences · Location Journal</div>
    <img class="cover" src="{safe_image}" alt="A photo from {safe_name}">
    <section>
      <h1>{safe_name}</h1>
      <p>{safe_description}</p>
      <p class="count">{html.escape(event_summary)}</p>
      <a href="{safe_app}">Open this Experience</a>
    </section>
  </main>
  <script>location.replace({destination});</script>
</body>
</html>
'''


def build_pages(output=ROOT / 'share', experiences=None, locations=None, media=None):
    if experiences is None:
        supabase_url, api_key = public_config()
        experiences = fetch_experiences(supabase_url, api_key)
        valid_ids = [str(UUID(str(item['id']))) for item in experiences if item.get('is_public')]
        locations = fetch_locations(valid_ids, supabase_url, api_key)
        location_ids = [str(UUID(str(item['id']))) for item in locations]
        media = fetch_media(location_ids, supabase_url, api_key)
    locations_by_experience = {}
    for location in locations or []:
        locations_by_experience.setdefault(location.get('experience_id'), []).append(location)
    media_by_location = {}
    for item in media or []:
        media_by_location.setdefault(item.get('checkin_id'), []).append(item)

    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='experience-share-', dir=output.parent) as staging_name:
        staging = Path(staging_name)
        count = 0
        for experience in experiences:
            if not experience.get('is_public'):
                continue
            try:
                experience_id = str(UUID(str(experience['id'])))
            except (KeyError, ValueError, TypeError) as error:
                raise ValueError('Invalid Experience ID') from error
            public_slug = str(experience.get('public_slug') or '')
            if not SHARE_KEY_PATTERN.fullmatch(public_slug):
                raise ValueError('Invalid Experience public slug')
            experience_locations = locations_by_experience.get(experience_id, [])
            image_url = FALLBACK_IMAGE
            image_type = 'image/png'
            for location in experience_locations:
                for item in media_by_location.get(location.get('id'), []):
                    mime_type = str(item.get('mime_type') or '').lower()
                    if mime_type not in {'image/jpeg', 'image/png', 'image/webp'} or not item.get('public_url'):
                        continue
                    image_url = safe_cover_url(item['public_url'])
                    image_type = mime_type
                    break
                if image_url != FALLBACK_IMAGE:
                    break

            share_url = APP_URL + 'share/' + public_slug + '/'
            page_dir = staging / public_slug
            page_dir.mkdir()
            page = render_page(experience, share_url, image_url, image_type, len(experience_locations))
            (page_dir / 'index.html').write_text(page, encoding='utf-8')
            count += 1

        if output.exists():
            shutil.rmtree(output)
        shutil.move(str(staging), str(output))
    return count


if __name__ == '__main__':
    print(f'Generated {build_pages()} Experiences share pages')