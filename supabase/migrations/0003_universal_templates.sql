-- Universal Nightshift templates: make every vertical creatable/editable without changing the quota model.
create table if not exists nightshift.template_catalog (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  display_name text not null,
  current_version integer not null check (current_version > 0),
  default_data jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into nightshift.template_catalog(slug, display_name, current_version, default_data, enabled) values
  ('cafe', 'Cafe / Kopi Lane', 2, '{"brandName":"Kopi Lane","eyebrow":"Cafe · Coffee shop","tagline":"Single-origin espresso, bread baked in-house, and a room that doesn''t mind if you stay.","primaryCta":"See the menu","secondaryCta":"Find us","featuresTitle":"On the bar today","featuresSubtitle":"Why people keep coming back.","features":[{"title":"Roasted weekly","description":"We pull from a rotating single origin and change it when the bag runs out, not on a schedule."},{"title":"Baked here","description":"Bread, pastry, and the sausage rolls people queue for — all made in the back."},{"title":"Actually good wifi","description":"Power at every table and no time limit on your cup."}],"galleryTitle":"On the menu","gallerySubtitle":"Coffee, bread, and the things we make each morning.","galleryItems":[{"label":"Coffee","title":"Espresso & filter","description":"A rotating single origin, pulled properly."},{"label":"Bakery","title":"Bread & pastry","description":"Baked in the back before the doors open."},{"label":"Kitchen","title":"All-day food","description":"Toasties, soup, and the sausage rolls people queue for."},{"label":"Space","title":"Work-friendly room","description":"Power at every table and no time limit on your cup."}],"ctaTitle":"7am–4pm daily. Last coffee at 3.45pm.","ctaButton":"See the menu","contactTitle":"Find us","contactText":"Open daily from 7am. 22 Mill Road, city centre. Free wifi, power at every table.","primaryColor":"#8a4b26","secondaryColor":"#976838"}'::jsonb, true),
  ('florist', 'Florist / Bloom & Co', 2, '{"brandName":"Bloom & Co","eyebrow":"Florist · Flower shop","tagline":"Seasonal stems from local growers, hand-tied and delivered across the city before noon.","primaryCta":"Order a bouquet","secondaryCta":"See this week''s stems","featuresTitle":"This week''s stems","featuresSubtitle":"What you get when you order from us.","features":[{"title":"Cut this morning","description":"We buy at the market daily, so nothing in the shop is older than a day."},{"title":"Delivered before noon","description":"Order by 9am for same-day delivery anywhere inside the city."},{"title":"Arranged by hand","description":"Every bouquet is tied in the shop — no pre-made bundles from a warehouse."}],"galleryTitle":"This week in the shop","gallerySubtitle":"Seasonal stems, wrapped and ready to go.","galleryItems":[{"label":"Bouquets","title":"Hand-tied bouquets","description":"Seasonal stems wrapped the way you''d want to receive them."},{"label":"Weddings","title":"Weddings & events","description":"Ceremony, table, and buttonhole work, planned with you."},{"label":"Subscriptions","title":"Standing orders","description":"Fresh flowers on your desk or counter every week."},{"label":"Plants","title":"House plants","description":"Potted greenery that survives an ordinary flat."}],"ctaTitle":"Open Tuesday to Sunday, 8am until the flowers run out.","ctaButton":"Order a bouquet","contactTitle":"Find us","contactText":"Open Tuesday to Sunday, 9am to 6pm. 14 Rose Lane, city centre. Order by 9am for same-day delivery.","primaryColor":"#be6590","secondaryColor":"#d98ca8"}'::jsonb, true),
  ('barber', 'Barbershop / Sharp & Sons', 2, '{"brandName":"Sharp & Sons","eyebrow":"Barbershop · Salon","tagline":"Classic cuts, hot-towel shaves, and a chair that''s yours for the next half hour.","primaryCta":"Book a chair","secondaryCta":"See prices","featuresTitle":"Cuts & shaves","featuresSubtitle":"What you get in the chair.","features":[{"title":"No appointment needed","description":"Walk-ins take the next free chair. Book ahead only if you want a specific barber."},{"title":"Straight-razor finish","description":"Every cut ends with a hot towel and a razor line, not a quick tidy with clippers."},{"title":"Cash or card","description":"Flat pricing on the board. No upsells, no product pitch at the till."}],"galleryTitle":"Cuts & shaves","gallerySubtitle":"Straightforward services, priced on the board.","galleryItems":[{"label":"Cuts","title":"Classic cuts","description":"Scissor and clipper work, finished with a razor line."},{"label":"Shaves","title":"Hot-towel shaves","description":"Straight razor, hot towel, no rush."},{"label":"Beards","title":"Beard trims","description":"Shaped and tidied, or taken right back."},{"label":"Kids","title":"Kids'' cuts","description":"Quick, calm, and priced lower."}],"ctaTitle":"Tuesday to Saturday, 9am to 7pm. Last cut 30 minutes before close.","ctaButton":"Book a chair","contactTitle":"Find us","contactText":"Tuesday to Saturday, 9am to 7pm. 8 High Street. Walk-ins welcome, last cut 30 min before close.","primaryColor":"#1f3a5f","secondaryColor":"#8d7146"}'::jsonb, true),
  ('fitness', 'Fitness / Iron Room', 2, '{"brandName":"Iron Room","eyebrow":"Gym · Personal training","tagline":"Small-group strength training with a coach on the floor, not a screen on the wall.","primaryCta":"Start a trial week","secondaryCta":"See the timetable","featuresTitle":"How training works","featuresSubtitle":"How training actually works here.","features":[{"title":"Coached, not supervised","description":"A coach writes your programme and corrects your lifts. You are never left with a printout."},{"title":"Six people per session","description":"Capped group sizes so everyone gets eyes on their form and a rack of their own."},{"title":"Cancel any month","description":"No twelve-month contract. Pause or leave with a month''s notice, no retention call."}],"galleryTitle":"Sessions & timetable","gallerySubtitle":"Small groups, coached on the floor, six days a week.","galleryItems":[{"label":"Strength","title":"Small-group strength","description":"Six people per session, coached on the floor."},{"label":"1:1","title":"Personal training","description":"A programme written for you and corrected weekly."},{"label":"Conditioning","title":"Conditioning","description":"Short, hard sessions that don''t wreck your week."},{"label":"Trial","title":"Trial week","description":"Seven days on the floor before you commit."}],"ctaTitle":"Open 6am to 9pm weekdays, 8am to 2pm weekends.","ctaButton":"Start a trial week","contactTitle":"Find us","contactText":"Open 5am to 11pm, seven days. 3 Ironworks Yard. First session on the house.","primaryColor":"#3ddbb4","secondaryColor":"#7ef0d2"}'::jsonb, true),
  ('trades', 'Trades & Services / Calloway Plumbing', 2, '{"brandName":"Calloway Plumbing","eyebrow":"Trades · Plumbing, electrical, building","tagline":"Licensed, insured, and honest about what a job actually costs before we start it.","primaryCta":"Get a callout","secondaryCta":"See service areas","featuresTitle":"What we handle","featuresSubtitle":"What you get when you call us.","features":[{"title":"Quoted before we start","description":"You get a written price before any work begins. If it changes, we stop and ask first."},{"title":"Licensed and insured","description":"Full public liability cover and licence numbers on every invoice."},{"title":"Same-day emergencies","description":"Burst pipes and dead circuits get seen the same day, including weekends."}],"galleryTitle":"Services we handle","gallerySubtitle":"Plumbing, electrical, and the jobs nobody else turns up for.","galleryItems":[{"label":"Plumbing","title":"Plumbing","description":"Leaks, burst pipes, and bathroom installs."},{"label":"Electrical","title":"Electrical","description":"Consumer units, sockets, and dead circuits."},{"label":"Heating","title":"Heating","description":"Boiler servicing, radiators, and thermostats."},{"label":"Emergency","title":"24/7 emergencies","description":"Same-day callouts, including weekends."}],"ctaTitle":"Emergency callouts 24/7. Standard bookings weekdays 8am to 5pm.","ctaButton":"Get a callout","contactTitle":"Find us","contactText":"Mon to Fri, 8am to 5pm. Licensed and insured across the metro area. Quotes returned within one day.","primaryColor":"#14448f","secondaryColor":"#f59e0b"}'::jsonb, true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  current_version = excluded.current_version,
  default_data = excluded.default_data,
  enabled = excluded.enabled,
  updated_at = now();

-- Remove the original Cafe-only check and replace it with a catalog foreign key.
alter table nightshift.sites drop constraint if exists sites_template_slug_check;
alter table nightshift.sites drop constraint if exists sites_template_slug_fkey;
alter table nightshift.sites
  add constraint sites_template_slug_fkey foreign key (template_slug) references nightshift.template_catalog(slug);

grant select on nightshift.template_catalog to authenticated;

create or replace function nightshift.create_site(p_template_slug text, p_site_name text)
returns table(id uuid, remaining_today integer)
language plpgsql security definer set search_path = pg_catalog, nightshift as $$
declare
 v_user uuid := auth.uid();
 v_start timestamptz;
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

 if char_length(btrim(coalesce(p_site_name,''))) not between 1 and 80 then
   raise exception 'site name must be 1–80 characters';
 end if;

 -- Keep the existing five-per-day quota global across all templates.
 perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
 v_start := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
 select count(*) into v_used
   from nightshift.site_creation_events
  where user_id = v_user and created_at >= v_start;
 if v_used >= 5 then
   raise exception 'daily site creation limit reached' using errcode = 'P0001';
 end if;

 v_slug := trim(both '-' from regexp_replace(lower(btrim(p_site_name)), '[^a-z0-9]+', '-', 'g'));
 if v_slug = '' then v_slug := 'site'; end if;
 v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

 insert into nightshift.sites(owner_id, template_slug, template_version, name, slug, draft_data)
 values(v_user, p_template_slug, v_template_version, btrim(p_site_name), v_slug, v_defaults)
 returning nightshift.sites.id into v_site_id;

 insert into nightshift.site_creation_events(user_id, site_id, template_slug)
 values(v_user, v_site_id, p_template_slug);

 return query select v_site_id, 4 - v_used;
end;
$$;

revoke all on function nightshift.create_site(text, text) from public, anon;
grant execute on function nightshift.create_site(text, text) to authenticated;
