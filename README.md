# Nightshift Templates

Static template showcase plus the universal Nightshift Studio.

## Universal Studio

`/studio/` edits every current vertical: Cafe, Florist, Barbershop, Fitness, and Trades & Services. The editor is manifest-driven and previews the real same-origin template page in an iframe, so typing updates the actual template DOM without a separate preview implementation.

Each template owns a `nightshift.manifest.json` containing its editor schema, defaults, and DOM bindings. `/shared/templates.json` is the registry used by Studio.

## Backend

Supabase migrations `0003_universal_templates.sql` and `0004_saved_site_limit.sql` add the template catalog, make every vertical creatable, and enforce a maximum of five currently saved sites per account. The creation ledger remains append-only for audit history, but it no longer controls the limit.

## Local preview

Serve this directory with any static web server, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/studio/`.

## Tests

```bash
node --check studio/studio.js
node --check shared/auth-adapter.js
node tests/test_auth_adapter.mjs
python3 -m pytest -q tests
```

## GitHub Pages

The `CNAME` file configures the custom domain: `template.cryptgregresearch.org`.
