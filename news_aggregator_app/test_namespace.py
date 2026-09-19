from pathlib import Path


def test_pulse_uses_namespaced_supabase_objects():
    schema = (Path(__file__).with_name('supabase-schema.sql')).read_text()
    app_js = Path(__file__).with_name('app.js').read_text()

    assert 'public.pulse_profiles' in schema
    assert 'public.pulse_posts' in schema
    assert 'public.pulse_comments' in schema
    assert 'public.pulse_cast_post_vote' in schema
    assert 'public.pulse_cast_comment_vote' in schema
    assert 'pulse_on_auth_user_created' in schema
    assert 'users can create own profile' in schema
    assert 'for insert with check (auth.uid() = id)' in schema

    assert 'namespacedName' in app_js
    assert 'tableCandidates' in app_js
    assert 'functionCandidates' in app_js
    assert 'authUserToUser' in app_js
    assert 'Could not find the table' in app_js or 'schema cache' in app_js
    assert 'ensureProfileRow(id, state.user.username)' in app_js
    assert "prefer: 'return=minimal'" in app_js
    assert 'const updated = await fetchProfile(session.user_id)' in app_js
