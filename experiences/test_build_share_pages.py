from experiences import build_share_pages as previews


EXPERIENCE_ID = '3c2d410d-3ee3-4832-8880-fffe0b0f7293'
DATABASE_ID = '3c06187a-c0de-437a-89c2-50938f746aa7'
LOCATION_ID = '04adee84-27eb-4677-8465-be9947e9974a'
IMAGE_URL = 'https://vftmcftccahjlxbxcnsf.supabase.co/storage/v1/object/public/checkin-map-media/user/location/photo.jpg'


def test_build_generates_experience_specific_page_and_cover(tmp_path):
    experiences = [{
        'id': DATABASE_ID,
        'public_slug': EXPERIENCE_ID,
        'name': 'Greece <script>alert(1)</script>',
        'description': 'Mediterranean adventure',
        'is_public': True,
    }]
    locations = [{'id': LOCATION_ID, 'experience_id': DATABASE_ID}]
    media = [{'checkin_id': LOCATION_ID, 'public_url': IMAGE_URL, 'mime_type': 'image/jpeg'}]

    assert previews.build_pages(tmp_path / 'share', experiences, locations, media) == 1
    page = (tmp_path / 'share' / EXPERIENCE_ID / 'index.html').read_text()

    assert '<meta property="og:title" content="Greece &lt;script&gt;alert(1)&lt;/script&gt; · Experiences">' in page
    assert '<meta property="og:description" content="Mediterranean adventure">' in page
    assert f'<meta property="og:url" content="{previews.APP_URL}share/{EXPERIENCE_ID}/">' in page
    assert f'<meta property="og:image" content="{IMAGE_URL}">' in page
    assert f'location.replace("{previews.APP_URL}?experience={EXPERIENCE_ID}")' in page
    assert '<script>alert(1)' not in page


def test_build_skips_private_experiences_and_removes_stale_pages(tmp_path):
    output = tmp_path / 'share'
    public = {'id': DATABASE_ID, 'public_slug': EXPERIENCE_ID, 'name': 'Public', 'is_public': True}
    private = {'id': 'de2eb71f-b52d-491f-b925-17664f46db92', 'public_slug': 'private-uuid', 'name': 'Private', 'is_public': False}

    assert previews.build_pages(output, [public, private]) == 1
    assert (output / EXPERIENCE_ID / 'index.html').exists()
    assert not (output / private['public_slug']).exists()

    assert previews.build_pages(output, []) == 0
    assert list(output.iterdir()) == []


def test_invalid_experience_id_does_not_replace_existing_pages(tmp_path):
    output = tmp_path / 'share'
    previews.build_pages(output, [{'id': DATABASE_ID, 'public_slug': EXPERIENCE_ID, 'name': 'Safe', 'is_public': True}])

    try:
        previews.build_pages(output, [{'id': DATABASE_ID, 'public_slug': '../../outside', 'name': 'Bad', 'is_public': True}])
    except ValueError as error:
        assert str(error) == 'Invalid Experience public slug'
    else:
        raise AssertionError('Expected invalid Experience ID to fail')

    assert (output / EXPERIENCE_ID / 'index.html').exists()