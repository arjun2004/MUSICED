import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Public pages only (as seen by an anonymous visitor, so private content can
 * never appear). Capped per type to stay well under the 50k-URL limit.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const statics: MetadataRoute.Sitemap = ["", "/explore", "/charts", "/lists", "/members", "/search"].map((path) => ({
    url: `${site}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    const supabase = createPublicClient();
    const [albums, artists, lists, profiles] = await Promise.all([
      supabase.from("albums").select("slug, updated_at").order("updated_at", { ascending: false }).limit(20000),
      supabase.from("artists").select("slug, updated_at").order("updated_at", { ascending: false }).limit(10000),
      supabase
        .from("user_lists")
        .select("id, updated_at")
        .eq("visibility", "public")
        .gt("items_count", 0)
        .order("updated_at", { ascending: false })
        .limit(10000),
      supabase
        .from("profiles")
        .select("username, updated_at")
        .not("username", "is", null)
        .not("onboarded_at", "is", null)
        .limit(10000),
    ]);

    return [
      ...statics,
      ...(albums.data ?? []).map((a) => ({ url: `${site}/album/${a.slug}`, lastModified: a.updated_at, priority: 0.8 })),
      ...(artists.data ?? []).map((a) => ({ url: `${site}/artist/${a.slug}`, lastModified: a.updated_at, priority: 0.6 })),
      ...(lists.data ?? []).map((l) => ({ url: `${site}/list/${l.id}`, lastModified: l.updated_at, priority: 0.5 })),
      ...(profiles.data ?? []).map((p) => ({ url: `${site}/user/${p.username}`, lastModified: p.updated_at, priority: 0.4 })),
    ];
  } catch (err) {
    console.error("[sitemap] catalog unavailable:", (err as Error).message);
    return statics;
  }
}
