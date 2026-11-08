#!/usr/bin/env node
/**
 * Pre-fill a deployed MUSICED catalog with real albums.
 *
 *   node scripts/warm-catalog.mjs https://musiced.vercel.app
 *
 * For each album below it looks up the MusicBrainz release-group id (≤1 req/s,
 * as MusicBrainz requires) and then opens the site's own import route
 * (/album/import/<mbid>), so the deployed server does the import with its own
 * keys. No credentials are needed or read here.
 *
 * The site allows 60 imports per hour per visitor, so keep runs under ~55
 * albums (or wait an hour between runs). Albums already present are skipped
 * by the server instantly.
 */

const SITE = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(SITE)) {
  console.error("Usage: node scripts/warm-catalog.mjs https://your-site.example");
  process.exit(1);
}
const UA = "MUSICED-catalog-warmup/1.0 ( https://github.com/arjun2004/MUSICED )";

const ALBUMS = [
  ["OK Computer", "Radiohead"], ["In Rainbows", "Radiohead"], ["Kid A", "Radiohead"],
  ["To Pimp a Butterfly", "Kendrick Lamar"], ["good kid, m.A.A.d city", "Kendrick Lamar"],
  ["Blonde", "Frank Ocean"], ["Channel Orange", "Frank Ocean"],
  ["My Beautiful Dark Twisted Fantasy", "Kanye West"], ["Graduation", "Kanye West"],
  ["Kind of Blue", "Miles Davis"], ["A Love Supreme", "John Coltrane"],
  ["Rumours", "Fleetwood Mac"], ["Abbey Road", "The Beatles"], ["Revolver", "The Beatles"],
  ["The Dark Side of the Moon", "Pink Floyd"], ["Wish You Were Here", "Pink Floyd"],
  ["Discovery", "Daft Punk"], ["Random Access Memories", "Daft Punk"],
  ["Loveless", "My Bloody Valentine"], ["Homogenic", "Björk"],
  ["The Miseducation of Lauryn Hill", "Lauryn Hill"], ["Illmatic", "Nas"],
  ["The Low End Theory", "A Tribe Called Quest"], ["Madvillainy", "Madvillain"],
  ["Remain in Light", "Talking Heads"], ["Unknown Pleasures", "Joy Division"],
  ["Nevermind", "Nirvana"], ["Back to Black", "Amy Winehouse"],
  ["Lemonade", "Beyoncé"], ["Renaissance", "Beyoncé"],
  ["Thriller", "Michael Jackson"], ["Purple Rain", "Prince"],
  ["Blue", "Joni Mitchell"], ["Pet Sounds", "The Beach Boys"],
  ["Selected Ambient Works 85-92", "Aphex Twin"], ["Dummy", "Portishead"],
  ["Mezzanine", "Massive Attack"], ["Currents", "Tame Impala"],
  ["Whole Lotta Red", "Playboi Carti"], ["Her Loss", "Drake"],
  ["African Giant", "Burna Boy"], ["Un verano sin ti", "Bad Bunny"],
  ["El mal querer", "Rosalía"], ["SOS", "SZA"], ["Ctrl", "SZA"],
  ["Igor", "Tyler, the Creator"], ["Blonde on Blonde", "Bob Dylan"],
  ["Carrie & Lowell", "Sufjan Stevens"], ["Be the Cowboy", "Mitski"],
  ["Punisher", "Phoebe Bridgers"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findReleaseGroup(title, artist) {
  const q = encodeURIComponent(`releasegroup:"${title}" AND artist:"${artist}"`);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://musicbrainz.org/ws/2/release-group/?query=${q}&limit=3&fmt=json`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (res.status === 503 || res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    const data = await res.json();
    return data["release-groups"]?.find((rg) => rg.score >= 90)?.id ?? null;
  }
  return null;
}

let added = 0;
let failed = 0;
for (const [title, artist] of ALBUMS) {
  await sleep(1100); // MusicBrainz: max ~1 request per second
  const mbid = await findReleaseGroup(title, artist);
  if (!mbid) {
    console.log(`?  no confident match: ${title} — ${artist}`);
    failed++;
    continue;
  }
  const res = await fetch(`${SITE}/album/import/${mbid}`, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  if (location.includes("/album/")) {
    console.log(`✓  ${title} — ${artist}  →  ${location.replace(SITE, "")}`);
    added++;
  } else {
    const error = decodeURIComponent((location.split("error=")[1] || `HTTP ${res.status}`).replace(/\+/g, " "));
    console.log(`✗  ${title} — ${artist}: ${error}`);
    failed++;
    if (/temporarily unavailable|configuration|SUPABASE_SECRET_KEY/i.test(error)) {
      console.error("\nThe site can't import albums yet — fix SUPABASE_SECRET_KEY on Vercel and redeploy, then re-run.");
      process.exit(1);
    }
    if (/a lot of new albums/i.test(error)) {
      console.error("\nHit the hourly import limit. Wait an hour and re-run; finished albums are skipped.");
      process.exit(1);
    }
  }
}
console.log(`\nDone: ${added} albums available, ${failed} skipped.`);
