"""One-time backfill: move inline base64 attachments on existing posts/comments to Supabase Storage.

Run storage-attachments-migration.sql first. Needs the project's service-role key
(Supabase dashboard > Project Settings > API); it is read from the environment and
never stored. Dry run by default:

    SUPABASE_SERVICE_KEY=... python3 migrate_attachments_to_storage.py          # report only
    SUPABASE_SERVICE_KEY=... python3 migrate_attachments_to_storage.py --apply  # upload + update rows
"""

import base64
import json
import mimetypes
import os
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

from build_share_pages import public_config

BUCKET = 'pulse-attachments'
TABLES = ('pulse_posts', 'pulse_comments')
PAGE = 10  # Rows carry large payloads; keep pages small.


def call(method, url, key, body=None, headers=None):
    request = Request(url, data=body, method=method, headers={
        'apikey': key, 'Authorization': f'Bearer {key}', **(headers or {}),
    })
    with urlopen(request, timeout=60) as response:
        return response.read()


def upload(base_url, key, attachment):
    header, _, payload = attachment['dataUrl'].partition(',')
    mime = header[5:].split(';')[0] or attachment.get('mimeType') or 'application/octet-stream'
    data = base64.b64decode(payload, validate=True)
    ext = (mimetypes.guess_extension(mime) or '.bin').lstrip('.')
    path = f'{uuid4()}.{ext}'
    call('POST', f'{base_url}/storage/v1/object/{BUCKET}/{path}', key, data,
         {'Content-Type': mime, 'Cache-Control': 'max-age=31536000'})
    return {**attachment, 'dataUrl': f'{base_url}/storage/v1/object/public/{BUCKET}/{path}'}


def main():
    apply = '--apply' in sys.argv
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not key:
        sys.exit('Set SUPABASE_SERVICE_KEY in the environment.')
    base_url = public_config()[0]
    moved = failed = 0
    for table in TABLES:
        # Ids first (tiny), then one row at a time so a huge row never loads alongside others.
        ids = []
        offset = 0
        while True:
            rows = json.loads(call('GET', f'{base_url}/rest/v1/{table}?' + urlencode({
                'select': 'id', 'order': 'id.asc', 'limit': PAGE * 10, 'offset': offset}), key))
            ids += [r['id'] for r in rows]
            if len(rows) < PAGE * 10:
                break
            offset += len(rows)
        for row_id in ids:
            row = json.loads(call('GET', f'{base_url}/rest/v1/{table}?' + urlencode({
                'select': 'id,attachments', 'id': f'eq.{row_id}'}), key))[0]
            attachments = row.get('attachments') or []
            inline = [a for a in attachments if isinstance(a, dict) and str(a.get('dataUrl', '')).startswith('data:')]
            if not inline:
                continue
            print(f'{table} {row_id}: {len(inline)} inline attachment(s)')
            if not apply:
                continue
            try:
                updated = [upload(base_url, key, a) if a in inline else a for a in attachments]
                # Rows are only rewritten after every upload succeeded.
                call('PATCH', f'{base_url}/rest/v1/{table}?' + urlencode({'id': f'eq.{row_id}'}), key,
                     json.dumps({'attachments': updated}).encode(),
                     {'Content-Type': 'application/json'})
                moved += len(inline)
            except (HTTPError, ValueError) as err:
                failed += 1
                print(f'  skipped: {err}')
    print(f'Done. moved={moved} failed_rows={failed}' if apply else 'Dry run only; pass --apply to migrate.')


if __name__ == '__main__':
    main()
