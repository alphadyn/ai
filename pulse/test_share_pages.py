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
    assert page.index('<h1>') < page.index('<p class="description">Flying fast &amp; far.</p>') < page.index('<p class="domain">')
    cover = next((output / POST_ID).glob('cover-*.jpg'))
    with Image.open(cover) as image:
        assert image.format == 'JPEG'
        pixel = image.getpixel((image.width // 2, image.height - 2))
        assert all(abs(actual - expected) < 20 for actual, expected in zip(pixel, (170, 187, 204)))


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


def test_rendered_card_places_post_text_after_title_and_before_domain():
    page = previews.render_page(
        {'id': POST_ID, 'title': 'Safe', 'body': '<p>A &quot;quote&quot; &amp; &lt;word&gt;</p>'},
        previews.APP_URL + 'share/' + POST_ID + '/',
        previews.FALLBACK_IMAGE,
    )
    assert 'og:description" content="A &quot;quote&quot; &amp; &lt;word&gt;"' in page
    assert 'og:image:type" content="image/png"' in page
    assert page.index('<h1>Safe</h1>') < page.index('<p class="description">A &quot;quote&quot; &amp; &lt;word&gt;</p>') < page.index('<p class="domain">alphadyn.github.io</p>')


def test_fallback_preview_has_no_post_text_overlay(tmp_path):
    post_dir = tmp_path / POST_ID
    post_dir.mkdir()
    cover_url = previews.cover_image(
        {'title': 'Fallback post', 'body': '<p>Post text on the preview.</p>', 'attachments': []},
        post_dir,
        previews.APP_URL + 'share/' + POST_ID + '/',
    )
    cover = post_dir / cover_url.rsplit('/', 1)[-1]
    with Image.open(cover) as image, Image.open(previews.ROOT / 'social-preview-mobile.png') as original:
        assert image.format == 'JPEG'
        sample = (image.width // 2, image.height - 1)
        expected = original.convert('RGB').getpixel(sample)
        assert all(abs(actual - source) < 30 for actual, source in zip(image.getpixel(sample), expected))
