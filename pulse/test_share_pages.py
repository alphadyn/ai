import base64
from io import BytesIO

from PIL import Image
import pytest

from pulse import build_share_pages as previews


POST_ID = 'c21a369b-fee1-468f-8331-fee5f02b4858'


def test_build_generates_safe_post_metadata_and_jpeg_cover(tmp_path):
    picture = BytesIO()
    Image.new('RGB', (48, 32), '#aabbcc').save(picture, format='WEBP')
    post = {
        'id': POST_ID,
        'title': '</title><script>alert(1)</script> & Plane',
        'body': '<p>Flying <strong>fast</strong> &amp; far.</p>',
        'author_name': 'Anonymous',
        'attachments': [{'mimeType': 'image/webp', 'dataUrl': 'data:image/webp;base64,' + base64.b64encode(picture.getvalue()).decode()}],
        'is_deleted': False,
    }
    output = tmp_path / 'share'
    assert previews.build_pages(output, [post]) == 1
    page = (output / POST_ID / 'index.html').read_text()
    assert 'og:title" content="&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; Plane"' in page
    assert 'og:description" content="Flying fast &amp; far."' in page
    assert 'og:url" content="https://alphadyn.github.io/ai/pulse/share/' + POST_ID + '/"' in page
    assert 'og:image:type" content="image/jpeg"' in page
    assert 'location.replace("https://alphadyn.github.io/ai/pulse/?post=' + POST_ID + '")' in page
    assert '<script>alert(1)' not in page
    cover = next((output / POST_ID).glob('cover-*.jpg'))
    with Image.open(cover) as image:
        assert image.format == 'JPEG'


def test_rebuild_removes_deleted_posts_and_old_images(tmp_path):
    output = tmp_path / 'share'
    post = {'id': POST_ID, 'title': 'Old', 'body': '', 'author_name': 'A', 'attachments': [], 'is_deleted': False}
    previews.build_pages(output, [post])
    (output / POST_ID / 'old-image.jpg').write_bytes(b'old')
    assert previews.build_pages(output, [{**post, 'title': 'New'}]) == 1
    assert not (output / POST_ID / 'old-image.jpg').exists()
    assert '<title>New · Pulse</title>' in (output / POST_ID / 'index.html').read_text()
    assert previews.build_pages(output, [{**post, 'is_deleted': True}]) == 0
    assert not (output / POST_ID).exists()


def test_rejects_invalid_ids_without_overwriting_previous_build(tmp_path):
    output = tmp_path / 'share'
    previews.build_pages(output, [{'id': POST_ID, 'title': 'Safe'}])
    with pytest.raises(ValueError, match='Invalid Pulse post ID'):
        previews.build_pages(output, [{'id': '../../outside', 'title': 'Bad'}])
    assert (output / POST_ID / 'index.html').exists()


def test_description_and_redirect_escaping():
    page = previews.render_page(
        {'id': POST_ID, 'title': 'Safe', 'body': '<p>A &quot;quote&quot; &amp; &lt;word&gt;</p>'},
        previews.APP_URL + 'share/' + POST_ID + '/',
        previews.FALLBACK_IMAGE,
    )
    assert 'A &quot;quote&quot; &amp; &lt;word&gt;' in page
    assert 'og:image:type" content="image/png"' in page
