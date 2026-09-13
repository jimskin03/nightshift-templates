-- Saved-site limit: cap current saved rows, while retaining creation events for audit.

create or replace function nightshift.remaining_site_slots()
returns integer
language plpgsql stable security definer
set search_path = pg_catalog, nightshift as $$
declare
  v_user uuid := auth.uid();
  v_used integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select count(*) into v_used
    from nightshift.sites
   where owner_id = v_user;

  return greatest(0, 5 - v_used);
end;
$$;

-- Keep the old RPC available for cached clients, but give it saved-site semantics.
create or replace function nightshift.remaining_creations_today()
returns integer
language plpgsql stable security definer
set search_path = pg_catalog, nightshift as $$
declare
  v_user uuid := auth.uid();
  v_used integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select count(*) into v_used
    from nightshift.sites
   where owner_id = v_user;

  return greatest(0, 5 - v_used);
end;
$$;

create or replace function nightshift.create_site(p_template_slug text, p_site_name text)
returns table(id uuid, remaining_today integer)
language plpgsql security definer
set search_path = pg_catalog, nightshift as $$
declare
  v_user uuid := auth.uid();
  v_used integer;
  v_slug text;
  v_site_id uuid;
  v_template_version integer;
  v_defaults jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select current_version, default_data
    into v_template_version, v_defaults
    from nightshift.template_catalog
   where slug = p_template_slug and enabled = true;
  if not found then
    raise exception 'unknown or disabled template' using errcode = 'P0002';
  end if;

  if char_length(btrim(coalesce(p_site_name, ''))) not between 1 and 80 then
    raise exception 'site name must be 1–80 characters';
  end if;

  -- Serialize the count+insert per user so concurrent tabs cannot exceed five sites.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select count(*) into v_used
    from nightshift.sites
   where owner_id = v_user;
  if v_used >= 5 then
    raise exception 'saved site limit reached' using errcode = 'P0001';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(btrim(p_site_name)), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'site'; end if;
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into nightshift.sites(owner_id, template_slug, template_version, name, slug, draft_data)
  values(v_user, p_template_slug, v_template_version, btrim(p_site_name), v_slug, v_defaults)
  returning nightshift.sites.id into v_site_id;

  -- Retain this append-only event as historical audit data.
  insert into nightshift.site_creation_events(user_id, site_id, template_slug)
  values(v_user, v_site_id, p_template_slug);

  return query select v_site_id, 4 - v_used;
end;
$$;

revoke all on function nightshift.remaining_site_slots() from public, anon;
revoke all on function nightshift.remaining_creations_today() from public, anon;
revoke all on function nightshift.create_site(text, text) from public, anon;
grant execute on function nightshift.remaining_site_slots() to authenticated;
grant execute on function nightshift.remaining_creations_today() to authenticated;
grant execute on function nightshift.create_site(text, text) to authenticated;
