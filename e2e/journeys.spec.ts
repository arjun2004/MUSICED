import { expect, test } from "@playwright/test";
import { admin, confirmationLink, login, userId } from "./helpers";

/**
 * Critical user journeys, clicked through in a real browser.
 * Uses dev-seed accounts and the seeded catalog. Each test cleans up the rows
 * it creates so the suite can be re-run.
 */

const ALBUM = "portishead-dummy";

test.describe("visitor", () => {
  test("browses discover → explore → album → artist", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /social diary for people who live in albums/i })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Explore" }).click();
    await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "New releases" }).first().click();
    await expect(page).toHaveURL(/sort=new/);

    await page.goto(`/album/${ALBUM}`);
    await expect(page.getByRole("heading", { name: "Dummy", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tracklist" })).toBeVisible();
    await expect(page.getByText("Sign in to rate, log and review this album.")).toBeVisible();

    await page.getByRole("link", { name: "Portishead" }).first().click();
    await expect(page.getByRole("heading", { name: "Portishead", level: 1 })).toBeVisible();
  });

  test("private pages redirect to login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
  });
});

test.describe("signup and onboarding", () => {
  const stamp = Date.now().toString(36);
  const email = `e2e-${stamp}@test.musiced.local`;
  const username = `e2e_${stamp}`.slice(0, 24);

  test.afterAll(async () => {
    const { data } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (data) await admin.auth.admin.deleteUser(data.id);
  });

  test("signs up, confirms by email and completes all six onboarding steps", async ({ page }) => {
    // Same reasoning as login(): the signup limit (5/hour/IP) is real; reset it locally.
    await admin.from("rate_limits").delete().like("bucket_key", "signUp:%");
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill("records4ever");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

    await page.goto((await confirmationLink(email)).replace("http://localhost:3000", ""));
    await expect(page).toHaveURL(/\/onboarding/);

    // 1. Profile (username prefilled from signup)
    await expect(page.getByLabel("Username")).toHaveValue(username);
    await page.getByLabel("Display name").fill("E2E Listener");
    await page.getByRole("button", { name: "Continue" }).click();
    // 2. Photo
    await page.getByRole("button", { name: "Skip for now" }).click();
    // 3. Genres
    for (const genre of ["Rock", "Electronic", "Jazz"]) await page.getByRole("button", { name: genre, exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // 4. Artists
    await expect(page.getByRole("heading", { name: "Artists you love" })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    // 5. Rate albums: give the first suggestion 4 stars via the keyboard slider
    await expect(page.getByRole("heading", { name: "Rate a few albums" })).toBeVisible();
    const firstRating = page.getByRole("slider").first();
    await firstRating.focus();
    await page.keyboard.press("End");
    await expect(page.getByText(/1 rated/)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    // 6. People
    await expect(page.getByRole("heading", { name: "Follow some listeners" })).toBeVisible();
    await page.getByRole("button", { name: "Finish" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Welcome back")).toBeVisible();

    const { data } = await admin.from("profiles").select("onboarded_at, display_name").eq("username", username).single();
    expect(data?.onboarded_at).not.toBeNull();
    expect(data?.display_name).toBe("E2E Listener");
  });
});

test.describe("signed-in listener", () => {
  test.afterEach(async () => {
    const ava = await userId("ava");
    const { data: album } = await admin.from("albums").select("id").eq("slug", ALBUM).single();
    await admin.from("reviews").delete().eq("user_id", ava).eq("album_id", album!.id);
    await admin.from("listening_logs").delete().eq("user_id", ava).eq("album_id", album!.id).like("note", "e2e%");
    await admin.from("user_lists").delete().eq("user_id", ava).like("title", "E2E %");
  });

  test("rates, logs, reviews and lists an album", async ({ page }) => {
    await login(page, "ava");
    await page.goto(`/album/${ALBUM}`);

    // Rate 4.5 via the keyboard slider (End = 5, Left = 4.5)
    const slider = page.getByRole("slider", { name: "Your rating" });
    await slider.focus();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("Rating saved.").first()).toBeVisible();

    // Log a listen
    await page.getByRole("button", { name: "Log", exact: true }).click();
    const logDialog = page.getByRole("dialog", { name: "Log a listen" });
    await logDialog.getByLabel("Note").fill("e2e: late night, headphones");
    await logDialog.getByRole("button", { name: "Loved it" }).click();
    await logDialog.getByRole("button", { name: "Log listen" }).click();
    await expect(page.getByText("Logged to your diary.")).toBeVisible();

    // Write a review
    await page.getByRole("button", { name: /^Review$/ }).click();
    const reviewDialog = page.getByRole("dialog", { name: "Write a review" });
    await reviewDialog.getByLabel("Headline").fill("Trip-hop's blueprint");
    await reviewDialog.getByRole("textbox", { name: "Review" }).fill("Smoky, cinematic and still unmatched. Shout out @sam for the rec.");
    await reviewDialog.getByRole("button", { name: "Publish review" }).click();
    await expect(page.getByText("Review published.")).toBeVisible();
    await page.getByRole("link", { name: "Read your review" }).click();
    await expect(page.getByRole("heading", { name: "Trip-hop's blueprint" })).toBeVisible();
    await expect(page.getByRole("link", { name: "@sam" })).toBeVisible();

    // Add to a new list from the album page
    await page.goto(`/album/${ALBUM}`);
    await page.getByRole("button", { name: "Add to a list" }).click();
    const listDialog = page.getByRole("dialog", { name: "Add to a list" });
    await listDialog.getByLabel("New list title").fill("E2E Trip-hop essentials");
    await listDialog.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Created “E2E Trip-hop essentials”.")).toBeVisible();

    // The diary shows the entry
    await page.goto("/user/ava/diary");
    await expect(page.getByText("“e2e: late night, headphones”")).toBeVisible();
  });

  test("builds and reorders a ranked list", async ({ page }) => {
    await login(page, "ava");
    await page.goto("/lists/new");
    await page.getByLabel("Title").fill("E2E Ranked countdown");
    await page.getByRole("switch", { name: /ranked list/i }).click();
    await page.getByRole("button", { name: "Create and add albums" }).click();
    await expect(page).toHaveURL(/\/list\/.+\/edit/);

    const picker = page.getByRole("searchbox", { name: "Search albums" });
    for (const q of ["dummy", "loveless"]) {
      await picker.fill(q);
      await page.getByRole("button", { name: /^Add /, exact: false }).first().click();
      await expect(page.getByText(/^Added /).first()).toBeVisible();
    }

    const rows = page.locator("ol > li").filter({ has: page.getByRole("button", { name: "Drag to reorder" }) });
    await expect(rows).toHaveCount(2);
    const firstTitle = await rows.first().locator("p").first().textContent();
    await rows.nth(1).getByRole("button", { name: "Move to top" }).click();
    await expect(rows.first().locator("p").first()).not.toHaveText(firstTitle ?? "");

    await page.getByRole("link", { name: "View list" }).click();
    await expect(page.getByText("Ranked list · 2 albums")).toBeVisible();
  });

  test("comments on a review and the author is notified", async ({ page }) => {
    const sam = await userId("sam");
    const { data: review } = await admin.from("reviews").select("id").eq("user_id", sam).limit(1).single();
    await login(page, "ava");
    await page.goto(`/review/${review!.id}`);
    const body = `e2e comment ${Date.now()}`;
    await page.getByLabel("Comment", { exact: true }).fill(body);
    await page.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(page.getByText(body)).toBeVisible();

    // The notification is written by a DB trigger; poll briefly rather than assume timing.
    const ava = await userId("ava");
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("notifications")
          .select("id")
          .eq("recipient_id", sam)
          .eq("actor_id", ava)
          .eq("type", "commented_review")
          .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString());
        return data?.length ?? 0;
      }, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await admin.from("review_comments").delete().eq("body", body);
  });
});

test.describe("moderation", () => {
  test("a moderator hides a reported review, which disappears for visitors", async ({ page, browser }) => {
    const leo = await userId("leo");
    const sam = await userId("sam");
    const { data: review } = await admin.from("reviews").select("id, album:albums!inner(slug)").eq("user_id", leo).limit(1).single();
    await admin.from("reports").delete().eq("target_id", review!.id);
    await admin.from("reports").insert({ reporter_id: sam, target_type: "review", target_id: review!.id, reason: "spam", details: "e2e" });

    try {
      await login(page, "ava");
      await page.goto("/admin/moderation");
      const card = page.locator("li", { hasText: "e2e" }).first();
      await card.getByLabel("Moderation reason").fill("e2e test: spam");
      await card.getByRole("button", { name: "Hide content" }).click();
      await expect(page.getByText("Done. Logged to the audit trail.")).toBeVisible();

      const visitor = await browser.newPage();
      await visitor.goto(`/review/${review!.id}`);
      await expect(visitor.getByRole("heading", { name: /couldn.t find|doesn.t exist/i })).toBeVisible();
      await visitor.close();
    } finally {
      await admin.from("reviews").update({ hidden_at: null }).eq("id", review!.id);
      await admin.from("reports").delete().eq("target_id", review!.id);
    }
  });

  test("non-staff get a 404 for the console", async ({ page }) => {
    await login(page, "sam");
    const res = await page.goto("/admin/moderation");
    await expect(page.getByText("This track doesn't exist")).toBeVisible();
    expect(res?.status()).toBeLessThan(500);
  });
});
