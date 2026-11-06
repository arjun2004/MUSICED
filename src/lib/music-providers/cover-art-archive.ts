/**
 * Cover Art Archive (https://coverartarchive.org). Artwork is served via
 * redirects to archive.org; we store the stable CAA URL, never a copy.
 */
const CAA = "https://coverartarchive.org";

export type CoverSize = 250 | 500 | 1200;

export function releaseGroupCoverUrl(releaseGroupId: string, size: CoverSize = 500) {
  return `${CAA}/release-group/${releaseGroupId}/front-${size}`;
}

/**
 * Checks whether a release group has front artwork. A redirect means yes,
 * 404 means no. Network failures resolve to "unknown" so callers can retry
 * later instead of recording a false "missing".
 */
export async function checkReleaseGroupCover(
  releaseGroupId: string,
  userAgent: string,
  timeoutMs = 4000,
): Promise<"available" | "missing" | "unknown"> {
  try {
    const res = await fetch(releaseGroupCoverUrl(releaseGroupId), {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) return "available";
    if (res.status === 200) return "available";
    if (res.status === 404) return "missing";
    return "unknown";
  } catch {
    return "unknown";
  }
}
