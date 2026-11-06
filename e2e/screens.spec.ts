import { expect, test } from "@playwright/test";
import { admin, login } from "./helpers";

/**
 * Responsive snapshots of key pages at phone and desktop widths, written to
 * e2e-shots/ for visual review. Also asserts there's no horizontal overflow,
 * the most common responsive bug.
 */
const SHOTS = process.env.SHOTS_DIR ?? "e2e-shots";
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

async function pages() {
  const { data: review } = await admin.from("reviews").select("id").eq("visibility", "public").limit(1).single();
  return [
    { name: "home", path: "/" },
    { name: "album", path: "/album/radiohead-ok-computer" },
    { name: "explore", path: "/explore" },
    { name: "charts", path: "/charts" },
    { name: "artist", path: "/artist/radiohead" },
    { name: "profile", path: "/user/ava" },
    { name: "review", path: `/review/${review!.id}` },
  ];
}

for (const vp of VIEWPORTS) {
  test(`snapshots @ ${vp.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const p of await pages()) {
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${p.name} overflows horizontally by ${overflow}px at ${vp.name}`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SHOTS}/${vp.name}-${p.name}.png`, fullPage: false });
    }
    await login(page, "ava");
    await page.goto("/user/ava/diary");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/${vp.name}-diary-signed-in.png` });
    await page.goto("/album/portishead-dummy");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/${vp.name}-album-signed-in.png`, fullPage: true });
  });
}
