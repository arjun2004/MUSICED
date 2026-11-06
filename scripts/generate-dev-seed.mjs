#!/usr/bin/env node
/**
 * Generates supabase/seed.sql — DEVELOPMENT SEED DATA ONLY.
 *
 * Catalog rows (albums, artists, tracks, genres, cover URLs) are fetched from
 * the real MusicBrainz API and Cover Art Archive, so no catalog data is
 * invented. Users, ratings, diary entries and reviews are FAKE development
 * fixtures and are labelled as such. Never run seed.sql against production.
 *
 * Usage:  node scripts/generate-dev-seed.mjs
 * Respects MusicBrainz rate limits (~1 req/s) and identifies itself via
 * User-Agent as required: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const UA = process.env.MUSICBRAINZ_USER_AGENT || "MUSICED/0.1 ( dev seed generator )";
const MB = "https://musicbrainz.org/ws/2";
const CAA = "https://coverartarchive.org";

/** Albums to seed: deliberately global and cross-genre, incl. multi-artist credits. */
const WANTED = [
  ["In Rainbows", "Radiohead"],
  ["To Pimp a Butterfly", "Kendrick Lamar"],
  ["Blonde", "Frank Ocean"],
  ["Kind of Blue", "Miles Davis"],
  ["Rumours", "Fleetwood Mac"],
  ["Discovery", "Daft Punk"],
  ["Loveless", "My Bloody Valentine"],
  ["Homogenic", "Björk"],
  ["The Miseducation of Lauryn Hill", "Lauryn Hill"],
  ["African Giant", "Burna Boy"],
  ["Be the Cowboy", "Mitski"],
  ["Selected Ambient Works 85-92", "Aphex Twin"],
  ["Blue", "Joni Mitchell"],
  ["The Low End Theory", "A Tribe Called Quest"],
  ["Renaissance", "Beyoncé"],
  ["Transa", "Caetano Veloso"],
  ["El mal querer", "Rosalía"],
  ["Remain in Light", "Talking Heads"],
  ["Un verano sin ti", "Bad Bunny"],
  ["Carrie & Lowell", "Sufjan Stevens"],
  ["Dummy", "Portishead"],
  ["Watch the Throne", "JAY-Z"],
  ["Ella and Louis", "Ella Fitzgerald"],
  ["Madvillainy", "Madvillain"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function mb(path) {
  const wait = Math.max(0, last + 1100 - Date.now());
  if (wait) await sleep(wait);
  last = Date.now();
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await withRetry(
      () =>
        fetch(`${MB}${path}${path.includes("?") ? "&" : "?"}fmt=json`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
        }),
      path,
    );
    if (res.status === 503 || res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`MusicBrainz ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`MusicBrainz kept throttling ${path}`);
}

async function withRetry(fn, label) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`  retrying ${label} (${err.cause?.code || err.message})`);
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(`Gave up on ${label}`);
}

async function hasFrontCover(rgid) {
  const res = await withRetry(
    () =>
      fetch(`${CAA}/release-group/${rgid}/front-500`, {
        method: "HEAD",
        redirect: "manual",
        headers: { "User-Agent": UA },
      }),
    `cover ${rgid}`,
  );
  return res.status >= 300 && res.status < 400;
}

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (xs) => `array[${xs.map(q).join(", ")}]::text[]`;

function slugify(text) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const usedSlugs = new Set();
function uniqueSlug(base, fallback) {
  let slug = slugify(base) || fallback;
  let n = 2;
  const root = slug;
  while (usedSlugs.has(slug)) slug = `${root}-${n++}`;
  usedSlugs.add(slug);
  return slug;
}

function albumType(primary, secondary = []) {
  const s = secondary.map((t) => t.toLowerCase());
  if (s.includes("compilation")) return "compilation";
  if (s.includes("live")) return "live";
  if (s.includes("soundtrack")) return "soundtrack";
  if (s.includes("remix")) return "remix";
  if (s.includes("mixtape/street")) return "mixtape";
  switch ((primary || "").toLowerCase()) {
    case "album": return "album";
    case "ep": return "ep";
    case "single": return "single";
    case "broadcast": return "broadcast";
    default: return "other";
  }
}

const partialDate = (d) => (d && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(d) ? d : null);

async function main() {
  const albums = [];
  const artists = new Map();
  const genres = new Map();

  for (const [title, artist] of WANTED) {
    const query = encodeURIComponent(`releasegroup:"${title}" AND artist:"${artist}"`);
    const search = await mb(`/release-group/?query=${query}&limit=5`);
    const hit = search["release-groups"]?.find((rg) => rg.score >= 90);
    if (!hit) {
      console.warn(`! no confident match for ${title} — ${artist}, skipping`);
      continue;
    }

    const rg = await mb(`/release-group/${hit.id}?inc=artist-credits+genres+releases`);
    const official = (rg.releases || [])
      .filter((r) => r.status === "Official")
      .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    const representative = official[0] || rg.releases?.[0];

    let release = null;
    if (representative) {
      release = await mb(`/release/${representative.id}?inc=recordings+labels`);
    }

    const cover = await hasFrontCover(rg.id);
    const credit = rg["artist-credit"] || [];
    const creditText = credit.map((c) => `${c.name}${c.joinphrase || ""}`).join("").trim();

    for (const c of credit) {
      if (!artists.has(c.artist.id)) {
        const a = await mb(`/artist/${c.artist.id}`);
        artists.set(a.id, a);
      }
    }

    const albumGenres = (rg.genres || [])
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    for (const g of albumGenres) genres.set(slugify(g.name), g.name);

    const tracks = [];
    for (const medium of release?.media || []) {
      for (const t of medium.tracks || []) {
        tracks.push({
          disc: medium.position || 1,
          position: t.position,
          number: t.number || null,
          title: t.title,
          length: Number.isFinite(t.length) ? t.length : null,
          recording: t.recording?.id || null,
        });
      }
    }

    const date = partialDate(rg["first-release-date"]);
    albums.push({
      mbid: rg.id,
      slug: uniqueSlug(`${creditText}-${rg.title}`, `album-${rg.id.slice(0, 8)}`),
      title: rg.title,
      credit: creditText,
      credits: credit.map((c, i) => ({ artist: c.artist.id, name: c.name, join: c.joinphrase || "", position: i })),
      type: albumType(rg["primary-type"], rg["secondary-types"]),
      secondary: rg["secondary-types"] || [],
      date,
      year: date ? Number(date.slice(0, 4)) : null,
      label: release?.["label-info"]?.find((l) => l.label)?.label?.name || null,
      country: release?.country && /^[A-Z]{2}$/.test(release.country) ? release.country : null,
      cover: cover ? `${CAA}/release-group/${rg.id}/front-500` : null,
      releaseMbid: release?.id || null,
      tracks,
      genres: albumGenres.map((g) => ({ slug: slugify(g.name), weight: g.count })),
    });
    console.log(`✓ ${rg.title} — ${creditText}${cover ? "" : " (no cover)"} · ${tracks.length} tracks`);
  }

  writeFileSync(resolve("supabase/seed.sql"), render({ albums, artists, genres }), "utf8");
  console.log(`\nWrote supabase/seed.sql with ${albums.length} albums and ${artists.size} artists.`);
}

/* ------------------------------------------------------------------------ */
/* SQL rendering                                                              */
/* ------------------------------------------------------------------------ */

const DEV_USERS = [
  ["ava", "Ava Moreno", "Vinyl hoarder. Jazz on Sundays, shoegaze the rest of the week."],
  ["kofi", "Kofi Mensah", "Afrobeats, highlife and anything with a horn section."],
  ["mei", "Mei Tanaka", "Electronic and ambient. I review albums I'd put on at 2am."],
  ["leo", "Leo Hartmann", "Krautrock evangelist. Rating everything I own, slowly."],
  ["priya", "Priya Raman", "Pop maximalist. Will defend every album I've rated 5 stars."],
  ["sam", "Sam Okafor", "Hip-hop head since '94. Liner notes are my love language."],
];

function render({ albums, artists, genres }) {
  const out = [];
  out.push(`-- =============================================================================
-- MUSICED · DEVELOPMENT SEED DATA ONLY — DO NOT RUN IN PRODUCTION
-- Generated by scripts/generate-dev-seed.mjs on ${new Date().toISOString().slice(0, 10)}.
--
-- * Catalog (artists, albums, tracks, genres, cover URLs) is real data fetched
--   from MusicBrainz (CC0) and the Cover Art Archive.
-- * Users, ratings, diary entries, reviews and follows below are FAKE fixtures
--   for local development. All dev accounts use the password: musiced-dev-1
-- =============================================================================
`);

  out.push("-- Catalog: genres discovered on seeded albums (non-featured)");
  for (const [slug, name] of genres) {
    if (!slug) continue;
    out.push(`insert into public.genres (slug, name) values (${q(slug)}, ${q(name.replace(/\b\w/g, (c) => c.toUpperCase()))}) on conflict (slug) do nothing;`);
  }

  out.push("\n-- Catalog: artists");
  for (const a of artists.values()) {
    const slug = uniqueSlug(a.name, `artist-${a.id.slice(0, 8)}`);
    a._slug = slug;
    const country = a.country && /^[A-Z]{2}$/.test(a.country) ? a.country : null;
    out.push(`with a as (
  insert into public.artists (slug, name, sort_name, disambiguation, artist_type, country, begin_date, end_date, synced_at)
  values (${q(slug)}, ${q(a.name)}, ${q(a["sort-name"])}, ${q(a.disambiguation || null)}, ${q(a.type ? a.type.toLowerCase() : null)}, ${q(country)}, ${q(partialDate(a["life-span"]?.begin))}, ${q(partialDate(a["life-span"]?.end))}, now())
  returning id
)
insert into public.catalog_sources (entity_type, entity_id, provider, external_id, url)
select 'artist', id, 'musicbrainz', ${q(a.id)}, ${q(`https://musicbrainz.org/artist/${a.id}`)} from a;`);
  }

  out.push("\n-- Catalog: albums (release groups), credits, tracks, genres");
  for (const al of albums) {
    out.push(`with al as (
  insert into public.albums (slug, title, artist_credit, album_type, secondary_types, release_date, release_year, label, country, cover_url, cover_status, track_count, duration_ms, synced_at, tracks_synced_at)
  values (${q(al.slug)}, ${q(al.title)}, ${q(al.credit)}, ${q(al.type)}, ${arr(al.secondary)}, ${q(al.date)}, ${al.year ?? "null"}, ${q(al.label)}, ${q(al.country)}, ${q(al.cover)}, ${q(al.cover ? "available" : "missing")}, ${al.tracks.length || "null"}, ${al.tracks.reduce((s, t) => s + (t.length || 0), 0) || "null"}, now(), now())
  returning id
)
insert into public.catalog_sources (entity_type, entity_id, provider, external_id, url)
select 'album', id, 'musicbrainz', ${q(al.mbid)}, ${q(`https://musicbrainz.org/release-group/${al.mbid}`)} from al;`);

    const albumId = `(select entity_id from public.catalog_sources where provider = 'musicbrainz' and entity_type = 'album' and external_id = ${q(al.mbid)})`;
    if (al.releaseMbid) {
      out.push(`insert into public.catalog_sources (entity_type, entity_id, provider, external_id, url) values ('release', ${albumId}, 'musicbrainz', ${q(al.releaseMbid)}, ${q(`https://musicbrainz.org/release/${al.releaseMbid}`)});`);
    }
    for (const c of al.credits) {
      out.push(`insert into public.album_artists (album_id, artist_id, position, credited_name, join_phrase) values (${albumId}, (select entity_id from public.catalog_sources where provider = 'musicbrainz' and entity_type = 'artist' and external_id = ${q(c.artist)}), ${c.position}, ${q(c.name)}, ${q(c.join)});`);
    }
    if (al.tracks.length) {
      const rows = al.tracks.map(
        (t) => `(${albumId}, ${t.disc}, ${t.position}, ${q(t.number)}, ${q(t.title)}, ${t.length ?? "null"}, ${t.recording ? q(t.recording) : "null"})`,
      );
      out.push(`insert into public.tracks (album_id, disc_number, position, number, title, duration_ms, recording_mbid) values\n  ${rows.join(",\n  ")};`);
    }
    for (const g of al.genres) {
      if (!g.slug) continue;
      out.push(`insert into public.album_genres (album_id, genre_id, weight) select ${albumId}, id, ${g.weight} from public.genres where slug = ${q(g.slug)} on conflict do nothing;`);
    }
  }

  out.push(`
-- -----------------------------------------------------------------------------
-- FAKE development users (password: musiced-dev-1)
-- -----------------------------------------------------------------------------`);
  DEV_USERS.forEach(([username, name, bio], i) => {
    const id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
    out.push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${username}@dev.musiced.local', extensions.crypt('musiced-dev-1', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"${username}","display_name":${JSON.stringify(name).replace(/'/g, "''")}}', now() - interval '${60 - i * 7} days', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '${id}', '${id}', '{"sub":"${id}","email":"${username}@dev.musiced.local"}', 'email', now(), now(), now());
update public.profiles set bio = ${q(bio)}, onboarded_at = now(), created_at = now() - interval '${60 - i * 7} days' where id = '${id}';`);
  });

  out.push(`
-- Fake taste profiles, follows, ratings, diary entries and reviews.
do $$
declare
  users uuid[] := array(select id from public.profiles where username in (${DEV_USERS.map(([u]) => q(u)).join(", ")}) order by username);
  albums uuid[] := array(select id from public.albums order by slug);
  u uuid;
  a uuid;
  r numeric;
  i int;
  j int;
begin
  -- Taste
  foreach u in array users loop
    insert into public.user_favorite_genres (user_id, genre_id)
    select u, id from public.genres where is_featured order by md5(u::text || slug) limit 4
    on conflict do nothing;
  end loop;

  -- Follows: everyone follows the next two people.
  for i in 1 .. array_length(users, 1) loop
    for j in 1 .. 2 loop
      insert into public.user_follows (follower_id, following_id)
      values (users[i], users[((i + j - 1) % array_length(users, 1)) + 1])
      on conflict do nothing;
    end loop;
  end loop;

  -- Ratings + diary: each user rates ~2/3 of the catalog, deterministic.
  for i in 1 .. array_length(users, 1) loop
    u := users[i];
    for j in 1 .. array_length(albums, 1) loop
      a := albums[j];
      if abs(hashtext(a::text || u::text)) % 3 <> 0 then
        r := 2.0 + (abs(hashtext(u::text || a::text)) % 7) * 0.5;
        insert into public.album_ratings (user_id, album_id, rating) values (u, a, r) on conflict do nothing;
        insert into public.listening_logs (user_id, album_id, listened_on, rating, is_relisten, is_favorite, visibility)
        values (
          u, a, current_date - ((i * 11 + j * 5) % 90),
          r, (j % 4 = 0), (r >= 4.5),
          case when (i + j) % 9 = 0 then 'private'::public.visibility
               when (i + j) % 7 = 0 then 'followers'::public.visibility
               else 'public'::public.visibility end
        );
      end if;
    end loop;
  end loop;

  -- Favorites showcase (first four rated-5 albums).
  foreach u in array users loop
    insert into public.favorite_albums (user_id, album_id, position)
    select u, album_id, row_number() over (order by rating desc, album_id)
    from public.album_ratings where user_id = u order by rating desc, album_id limit 4;
  end loop;
end $$;

-- A handful of FAKE reviews (development text).
insert into public.reviews (user_id, album_id, title, body, rating, contains_spoilers, visibility)
select p.id, al.id, v.title, v.body, v.rating, false, 'public'
from (values
  ('ava', 'my-bloody-valentine-loveless', 'A wall you can live inside', 'Dev seed review. The guitars smear into one another until melody becomes weather. Best heard loud, in the dark, front to back.', 5.0),
  ('kofi', 'burna-boy-african-giant', null, 'Dev seed review. Confident, generous and endlessly replayable. The run from the opener onwards barely lets up.', 4.5),
  ('mei', 'aphex-twin-selected-ambient-works-85-92', 'Still the blueprint', 'Dev seed review. Thirty-plus years on, these tracks still sound like they were recorded inside a memory.', 4.5),
  ('sam', 'a-tribe-called-quest-the-low-end-theory', 'Bass, how low can you go', 'Dev seed review. Jazz samples, tight verses, zero filler. The template for so much of what came after.', 5.0),
  ('priya', 'beyonce-renaissance', null, 'Dev seed review. A ballroom history lesson that never forgets to be a party. Sequencing is immaculate.', 4.5),
  ('leo', 'talking-heads-remain-in-light', 'Polyrhythm as philosophy', 'Dev seed review. Layers on layers on layers, and somehow it still swings.', 4.5)
) as v(username, album_slug, title, body, rating)
join public.profiles p on p.username = v.username
join public.albums al on al.slug = v.album_slug
on conflict (user_id, album_id) do nothing;

-- DEV ONLY: give the 'ava' fixture admin rights so the moderation console can be exercised locally.
update public.profiles set role = 'admin' where username = 'ava';
`);

  return out.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
