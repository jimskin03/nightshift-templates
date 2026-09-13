-- Preserve append-only quota events when an owner deletes a site.
-- The site reference becomes nullable and is cleared on site deletion;
-- the ledger row remains so deletion never restores a creation slot.
alter table nightshift.site_creation_events alter column site_id drop not null;

alter table nightshift.site_creation_events drop constraint if exists site_creation_events_site_id_fkey;

alter table nightshift.site_creation_events
  add constraint site_creation_events_site_id_fkey
  foreign key (site_id) references nightshift.sites(id) on delete set null;
