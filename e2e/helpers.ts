import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import WebSocket from "ws";

/** Minimal .env.local reader (Playwright doesn't load Next env files). */
function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  const file = readFileSync(".env.local", "utf8");
  const line = file.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^"|"$/g, "") : "";
}

export const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
export const admin = createClient(SUPABASE_URL, env("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
  realtime: { transport: WebSocket as never },
});

export const DEV_PASSWORD = "musiced-dev-1";

export async function login(page: Page, username: string) {
  // The real sign-in rate limit (10 per 5 min per IP) applies to tests too;
  // reset the local buckets so repeated suite runs don't lock themselves out.
  await admin.from("rate_limits").delete().like("bucket_key", "signIn:%");
  await page.goto("/login");
  await page.getByLabel("Email").fill(`${username}@dev.musiced.local`);
  await page.getByLabel("Password").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
}

export async function userId(username: string) {
  const { data } = await admin.from("profiles").select("id").eq("username", username).single();
  return data!.id as string;
}

/** Latest confirmation link sent to an address (local Mailpit). */
export async function confirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)).json()) as { HTML: string };
      const link = msg.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No confirmation email for ${email}`);
}
