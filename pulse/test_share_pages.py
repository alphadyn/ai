import base64
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont
import pytest

from pulse import build_share_pages as previews


POST_ID = 'c21a369b-fee1-468f-8331-fee5f02b4858'


def test_build_generates_safe_post_metadata_and_jpeg_cover(tmp_path):
    picture = BytesIO()
    Image.new('RGB', (480, 320), '#aabbcc').save(picture, format='WEBP')
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
    assert 'og:description' not in page
    assert 'og:url" content="https://alphadyn.github.io/ai/pulse/share/' + POST_ID + '/"' in page
    assert 'og:image:type" content="image/jpeg"' in page
    assert 'location.replace("https://alphadyn.github.io/ai/pulse/?post=' + POST_ID + '")' in page
    assert '<script>alert(1)' not in page
    assert 'Flying fast' not in page
    assert page.index('<h1>') < page.index('<img src=') < page.index('<p class="domain">')
    cover = next((output / POST_ID).glob('cover-*.jpg'))
    with Image.open(cover) as image:
        assert image.format == 'JPEG'
        top_pixel = image.getpixel((image.width // 2, 1))
        overlay_pixel = image.getpixel((image.width // 2, image.height - 1))
        assert all(abs(actual - expected) < 20 for actual, expected in zip(top_pixel, (170, 187, 204)))
        assert sum(overlay_pixel) < sum(top_pixel)


def test_first_video_attachment_supplies_screenshot_for_cover(monkeypatch, tmp_path):
    video_bytes = b'video fixture'
    encoded_video = base64.b64encode(video_bytes).decode()
    later_image = BytesIO()
    Image.new('RGB', (48, 32), '#aabbcc').save(later_image, format='PNG')
    extracted = []

    def fake_video_screenshot(data):
        extracted.append(data)
        return Image.new('RGBA', (48, 32), '#33aa66')

    monkeypatch.setattr(previews, 'video_screenshot', fake_video_screenshot)
    post_dir = tmp_path / POST_ID
    post_dir.mkdir()
    cover_url = previews.cover_image(
        {
            'body': '',
            'attachments': [
                {'mimeType': 'video/mp4', 'dataUrl': f'data:video/mp4;base64,{encoded_video}'},
                {'mimeType': 'image/png', 'dataUrl': 'data:image/png;base64,' + base64.b64encode(later_image.getvalue()).decode()},
            ],
        },
        post_dir,
        previews.APP_URL + 'share/' + POST_ID + '/',
    )

    assert extracted == [video_bytes]
    cover = post_dir / cover_url.rsplit('/', 1)[-1]
    with Image.open(cover) as image:
        pixel = image.getpixel((image.width // 2, 1))
        assert all(abs(actual - expected) < 20 for actual, expected in zip(pixel, (51, 170, 102)))


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


def test_rendered_card_keeps_body_text_outside_image_and_metadata():
    page = previews.render_page(
        {'id': POST_ID, 'title': 'Safe', 'body': '<p>A &quot;quote&quot; &amp; &lt;word&gt;</p>'},
        previews.APP_URL + 'share/' + POST_ID + '/',
        previews.FALLBACK_IMAGE,
    )
    assert 'og:description' not in page
    assert 'A &quot;quote&quot; &amp; &lt;word&gt;' not in page
    assert 'og:image:type" content="image/png"' in page
    assert page.index('<h1>Safe</h1>') < page.index('<img src=') < page.index('<p class="domain">alphadyn.github.io</p>')


def test_fallback_preview_displays_post_text_overlay(tmp_path):
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
        assert sum(image.getpixel(sample)) < sum(expected)


def test_preview_excerpt_is_limited_to_two_lines():
    image = Image.new('RGB', (240, 120))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=14)
    lines = previews.wrap_preview_text('Pulse post text ' * 30, draw, font, 150)
    assert len(lines) == 2
    assert lines[-1].endswith('…')
