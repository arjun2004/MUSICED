import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/settings",
          "/onboarding",
          "/notifications",
          "/diary",
          "/lists/new",
          "/list/*/edit",
          "/album/import/",
          "/artist/import/",
          "/auth/",
          "/api/",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
