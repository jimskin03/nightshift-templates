# Apply the Nightshift Universal Studio overlay

This package is an overlay for the current `jimskin03/nightshift-templates` main branch at commit `90e65ea`.

1. Copy/extract the package contents into the repository root, allowing the included files to overwrite the matching files.
2. From the repository root, run:

```bash
python scripts/apply_entrypoints.py
node --check studio/studio.js
node --check shared/auth-adapter.js
node tests/test_auth_adapter.mjs
python -m pytest -q tests
```

3. Review `git diff`.
4. Apply `supabase/migrations/0003_universal_templates.sql` and `supabase/migrations/0004_saved_site_limit.sql` through the same Supabase migration workflow used for the first two Nightshift migrations.
5. Deploy the static site.
6. Follow `MANUAL_TEST_CHECKLIST.md` for live authentication/RLS/quota checks.

The migration keeps the five-creations-per-UTC-day quota global across all template types and preserves existing Cafe sites. The Studio contains a v1 Cafe draft normalizer for `accent`, `menu`, `hours`, and `address` before saving as manifest version 2.
