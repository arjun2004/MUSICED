import { describe, expect, it } from "vitest";
import { passwordSchema, signUpSchema, usernameSchema } from "@/lib/validation/auth";
import { profileSchema } from "@/lib/validation/profile";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import { sniffImage } from "@/lib/utils/image-validation";
import { formatDuration, formatPartialDate, formatRating } from "@/lib/utils/format";
import { starFills } from "@/components/shared/star-rating";

describe("usernameSchema", () => {
  it("normalises case and whitespace", () => {
    expect(usernameSchema.parse("  Vinyl_Head ")).toBe("vinyl_head");
  });

  it.each(["ab", "a".repeat(25), "has space", "dash-name", "émile", "admin", "settings"])(
    "rejects %s",
    (value) => {
      expect(usernameSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("passwordSchema", () => {
  it("requires length, a letter and a digit", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("records4ever").success).toBe(true);
  });
});

describe("signUpSchema", () => {
  it("lowercases email and username", () => {
    const parsed = signUpSchema.parse({ email: "Ava@Example.COM", username: "Ava", password: "records4ever" });
    expect(parsed).toEqual({ email: "ava@example.com", username: "ava", password: "records4ever" });
  });
});

describe("profileSchema", () => {
  it("turns empty optional fields into null", () => {
    const parsed = profileSchema.parse({ username: "ava", displayName: "  ", bio: "", website: "" });
    expect(parsed.displayName).toBeNull();
    expect(parsed.bio).toBeNull();
    expect(parsed.website).toBeNull();
  });

  it("rejects non-http websites (no javascript: URLs)", () => {
    expect(profileSchema.safeParse({ username: "ava", website: "javascript:alert(1)" }).success).toBe(false);
    expect(profileSchema.safeParse({ username: "ava", website: "https://ava.fm" }).success).toBe(true);
  });
});

describe("safeRedirectPath", () => {
  it.each([
    ["/settings", "/settings"],
    ["/user/ava?tab=lists#top", "/user/ava?tab=lists#top"],
    ["https://evil.example", "/"],
    ["//evil.example/path", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [undefined, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});

describe("sniffImage", () => {
  const pad = (bytes: number[]) => new Uint8Array([...bytes, ...new Array(16).fill(0)]);

  it("detects real image signatures", () => {
    expect(sniffImage(pad([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImage(webp)?.mime).toBe("image/webp");
  });

  it("rejects disguised files", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a........"))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("rating display helpers", () => {
  it("splits values into star fills", () => {
    expect(starFills(3.5)).toEqual([1, 1, 1, 0.5, 0]);
    expect(starFills(5)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(0.5)).toEqual([0.5, 0, 0, 0, 0]);
  });

  it("formats ratings and durations", () => {
    expect(formatRating(4)).toBe("4.0");
    expect(formatRating("3.5")).toBe("3.5");
    expect(formatRating(null)).toBe("—");
    expect(formatDuration(245_000)).toBe("4:05");
    expect(formatDuration(4_000_000)).toBe("1:06:40");
  });

  it("formats MusicBrainz partial dates as precisely as available", () => {
    expect(formatPartialDate("2007")).toBe("2007");
    expect(formatPartialDate("2007-10")).toBe("October 2007");
    expect(formatPartialDate("2007-10-10")).toBe("10 October 2007");
  });
});
