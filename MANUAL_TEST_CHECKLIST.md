# Nightshift universal studio manual test checklist

## Static checks

- [ ] Serve the repository with `python3 -m http.server 8080` and open `/studio/`.
- [ ] Confirm the template selector lists Cafe, Florist, Barbershop, Fitness, and Trades & Services.
- [ ] Open each template and confirm the iframe shows the real template page, not a simplified preview page.
- [ ] Edit brand, hero, features, gallery, CTA/contact, and theme fields; confirm the iframe updates immediately without reloading.
- [ ] Add, remove, and reorder feature/gallery items and confirm the live preview follows.
- [ ] Switch Desktop / Tablet / Mobile and confirm only the preview width changes.
- [ ] Confirm links/forms inside the preview do not navigate away while editing.
- [ ] Open `/cafe/studio.html`; confirm it redirects to `/studio/?template=cafe` (or infers the referring template).

## Authentication / persistence

- [ ] Signed out: editor and live preview remain usable, but Create/Save/Publish are unavailable.
- [ ] Sign in and confirm My sites lists every template type owned by the account.
- [ ] Confirm the Studio shows `0 of 5 saved sites used` with no saved sites.
- [ ] Create one site from each template and confirm each receives that template's defaults.
- [ ] Confirm the limit is five currently saved sites across all template types.
- [ ] Save a draft, refresh, reload it, and confirm the draft is restored.
- [ ] Publish and confirm status changes to published and `site_versions` receives a new immutable version.
- [ ] Delete a site and confirm a slot is immediately available again.
- [ ] Confirm historical `site_creation_events` rows do not consume saved-site slots.
- [ ] In a second account, confirm the first account's sites cannot be listed, loaded, saved, published, or deleted.

## Failure states

- [ ] Break network access after loading Studio; confirm live preview continues while Save reports failure.
- [ ] Enter invalid/empty required values; confirm preview still renders the local draft but Save/Publish are blocked with validation errors.
- [ ] Reload the preview iframe and confirm the current in-memory draft is re-applied automatically.
