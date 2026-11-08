import type { MetadataRoute } from "next";

/** Installable PWA metadata (home-screen icon, theme, name). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MUSICED",
    short_name: "MUSICED",
    description: "The social diary for people who live in albums. Discover. Listen. Rate. Repeat.",
    start_url: "/",
    display: "standalone",
    background_color: "#151719",
    theme_color: "#151719",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
