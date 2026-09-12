# Nightshift live studio manual test checklist

## Static / unauthenticated checks (no live account required)

- [ ] Serve the repository with `python3 -m http.server 8080` and open `/cafe/studio.html`.
- [ ] Confirm the page has no console syntax or manifest-load errors.
- [ ] Confirm the unauthenticated state says **Sign in required**, disables editor/save/publish, and does not write `localStorage`.
- [ ] Confirm the isolated preview can send READY/ACK messages only from the expected origin/window.
- [ ] Run `node --check cafe/auth-adapter.js`, `node --check cafe/studio.js`, and `node tests/test_auth_adapter.mjs`.

## Live authenticated E2E (requires an approved CryptGreg/Supabase account)

- [ ] Sign in through the approved CryptGreg flow, then open `/cafe/studio.html`; confirm the user identity and gallery load.
- [ ] Confirm the quota indicator reflects `nightshift.remaining_creations_today` and Create Cafe is disabled at zero.
- [ ] Create a Cafe; confirm the UI reports success, selects it, and loads its server draft.
- [ ] Edit fields, click Save draft, refresh, and confirm the draft is restored from `nightshift.sites` (not browser storage).
- [ ] Click Publish; confirm the UI reports success and the site status changes to published.
- [ ] In a second account, verify the first account's site cannot be listed, loaded, saved, or published.
- [ ] Exercise quota exhaustion and RPC/network failure; confirm clear error states and no false success.

Do not treat static checks as evidence of live authentication, RLS ownership, quota, or RPC success.
