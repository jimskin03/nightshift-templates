-- Nightshift MVP phase 1. Apply through the Supabase migration workflow; never in the browser.
create schema if not exists nightshift;
revoke all on schema nightshift from public;
grant usage on schema nightshift to authenticated;

create table if not exists nightshift.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_slug text not null check (template_slug in ('cafe')),
  template_version integer not null default 1 check (template_version > 0),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null,
  draft_data jsonb not null default '{}'::jsonb,
  published_data jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (owner_id, slug)
);

create table if not exists nightshift.site_creation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  site_id uuid not null unique references nightshift.sites(id) on delete restrict,
  template_slug text not null,
  created_at timestamptz not null default now()
);

create table if not exists nightshift.site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references nightshift.sites(id) on delete cascade,
  version integer not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (site_id, version)
);

create table if not exists nightshift.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references nightshift.sites(id) on delete cascade,
  bucket_id text not null default 'nightshift-assets',
  object_path text not null,
  content_type text,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create index if not exists site_creation_events_user_created_idx
  on nightshift.site_creation_events(user_id, created_at);

create or replace function nightshift.touch_site_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, nightshift as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists sites_touch_updated_at on nightshift.sites;
create trigger sites_touch_updated_at before update on nightshift.sites
for each row execute function nightshift.touch_site_updated_at();

create or replace function nightshift.prevent_site_owner_change()
returns trigger language plpgsql set search_path = pg_catalog, nightshift as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'site ownership cannot be changed';
  end if;
  return new;
end; $$;

drop trigger if exists sites_owner_immutable on nightshift.sites;
create trigger sites_owner_immutable before update on nightshift.sites
for each row execute function nightshift.prevent_site_owner_change();

-- The creation ledger is append-only: deletion never restores a quota slot.
alter table nightshift.sites enable row level security;
alter table nightshift.site_creation_events enable row level security;
alter table nightshift.site_versions enable row level security;
alter table nightshift.assets enable row level security;

drop policy if exists sites_owner_select on nightshift.sites;
create policy sites_owner_select on nightshift.sites for select to authenticated using (owner_id = auth.uid());
drop policy if exists sites_owner_update on nightshift.sites;
create policy sites_owner_update on nightshift.sites for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists sites_owner_delete on nightshift.sites;
create policy sites_owner_delete on nightshift.sites for delete to authenticated using (owner_id = auth.uid());

drop policy if exists versions_owner_select on nightshift.site_versions;
create policy versions_owner_select on nightshift.site_versions for select to authenticated using (
 exists (select 1 from nightshift.sites s where s.id = site_id and s.owner_id = auth.uid())
);
drop policy if exists assets_owner_all on nightshift.assets;
create policy assets_owner_all on nightshift.assets for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- No client policy is granted for site_creation_events: only the definer RPC writes it.

create or replace function nightshift.remaining_creations_today()
returns integer language plpgsql stable security definer set search_path = pg_catalog, nightshift as $$
declare v_user uuid := auth.uid(); v_used integer;
begin
 if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
 select count(*) into v_used from nightshift.site_creation_events
  where user_id = v_user and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
 return greatest(0, 5 - v_used);
end; $$;

create or replace function nightshift.create_site(p_template_slug text, p_site_name text)
returns table(id uuid, remaining_today integer)
language plpgsql security definer set search_path = pg_catalog, nightshift as $$
declare
 v_user uuid := auth.uid(); v_start timestamptz;
 v_used integer; v_slug text; v_site_id uuid;
 v_defaults jsonb := '{"brandName":"Kopi Lane","tagline":"Single-origin espresso, bread baked in-house, and a room that does not mind if you stay.","hours":"7am–4pm daily","address":"22 Mill Road, city centre","accent":"#b85c38","menu":[]}'::jsonb;
begin
 if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
 if p_template_slug <> 'cafe' then raise exception 'unknown template'; end if;
 if char_length(btrim(coalesce(p_site_name,''))) not between 1 and 80 then raise exception 'site name must be 1–80 characters'; end if;
 -- A transaction-scoped per-user lock makes the count+insert atomic across tabs.
 perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
 v_start := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
 select count(*) into v_used from nightshift.site_creation_events where user_id = v_user and created_at >= v_start;
 if v_used >= 5 then raise exception 'daily site creation limit reached' using errcode = 'P0001'; end if;
 v_slug := trim(both '-' from regexp_replace(lower(btrim(p_site_name)), '[^a-z0-9]+', '-', 'g'));
 if v_slug = '' then v_slug := 'site'; end if;
 v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
 insert into nightshift.sites(owner_id, template_slug, name, slug, draft_data)
 values(v_user, p_template_slug, btrim(p_site_name), v_slug, v_defaults) returning nightshift.sites.id into v_site_id;
 insert into nightshift.site_creation_events(user_id, site_id, template_slug) values(v_user, v_site_id, p_template_slug);
 return query select v_site_id, 4 - v_used;
end; $$;

create or replace function nightshift.publish_site(p_site_id uuid)
returns nightshift.sites language plpgsql security definer set search_path = pg_catalog, nightshift as $$
declare v_site nightshift.sites; v_next_version integer;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
 select * into v_site from nightshift.sites where id = p_site_id and owner_id = auth.uid() for update;
 if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
 update nightshift.sites set published_data = v_site.draft_data, status = 'published', published_at = now() where id = p_site_id returning * into v_site;
 select coalesce(max(version), 0) + 1 into v_next_version from nightshift.site_versions where site_id = p_site_id;
 insert into nightshift.site_versions(site_id, version, data) values(p_site_id, v_next_version, v_site.published_data);
 return v_site;
end; $$;

revoke all on function nightshift.create_site(text, text) from public, anon;
revoke all on function nightshift.publish_site(uuid) from public, anon;
revoke all on function nightshift.remaining_creations_today() from public, anon;
grant execute on function nightshift.create_site(text, text) to authenticated;
grant execute on function nightshift.publish_site(uuid) to authenticated;
grant execute on function nightshift.remaining_creations_today() to authenticated;

insert into storage.buckets(id, name, public) values ('nightshift-assets', 'nightshift-assets', false) on conflict (id) do nothing;
drop policy if exists nightshift_assets_owner_select on storage.objects;
create policy nightshift_assets_owner_select on storage.objects for select to authenticated using (bucket_id = 'nightshift-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists nightshift_assets_owner_insert on storage.objects;
create policy nightshift_assets_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'nightshift-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists nightshift_assets_owner_update on storage.objects;
create policy nightshift_assets_owner_update on storage.objects for update to authenticated using (bucket_id = 'nightshift-assets' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'nightshift-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists nightshift_assets_owner_delete on storage.objects;
create policy nightshift_assets_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'nightshift-assets' and (storage.foldername(name))[1] = auth.uid()::text);
