from pathlib import Path


def test_pulse_uses_namespaced_supabase_objects():
    schema = (Path(__file__).with_name('supabase-schema.sql')).read_text()
    app_js = Path(__file__).with_name('app.js').read_text()
    admin_migration = (Path(__file__).with_name('admin-role-migration.sql')).read_text()

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
    assert 'state.user = await pulse.me()' in app_js
    assert "normalizeRole(metadata.role || metadata.user_role || appMetadata.role || appMetadata.user_role || 'user')" in app_js
    assert 'role: normalizeRole(profile.role)' in app_js
    assert "rpcFetch('is_admin', {})" in app_js
    assert "if (session.role === 'admin') return true" in app_js
    assert "state.user.role = 'admin'" in app_js
    assert '<button class="btn ghost" id="admin-nav-btn" type="button">Admin</button>' in app_js
    assert 'if (!await pulse.isAdmin()) { toast(\'Admin access required.\'); return; }' not in app_js
    assert "auth.jwt()->'app_metadata'->>'role'" in schema
    assert "grant execute on function public.pulse_is_admin()" in schema
    assert "auth.jwt()->'app_metadata'->>'role'" in admin_migration
    assert "grant execute on function public.pulse_is_admin()" in admin_migration
    assert "prefer: 'return=minimal'" in app_js
    assert 'const updated = await fetchProfile(session.user_id)' in app_js
    assert 'user-${String(userId).slice(0, 8)}' in app_js
    assert 'profile-row-migration.sql' not in app_js
    assert 'Profile could not be created: ${lastError ? lastError.message' in app_js
    assert "const names = [namespacedName(value), value]" not in app_js
    assert 'drop table if exists public.profiles' not in schema
    assert 'drop table if exists public.posts' not in schema
