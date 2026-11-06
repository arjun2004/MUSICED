import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { creditText, mapAlbumType, mapTracks, pickRepresentativeRelease } = await import(
  "@/lib/music-providers/musicbrainz"
);
const { slugify, partialDate } = await import("@/lib/music-providers/slug");

describe("slugify", () => {
  it.each([
    ["Radiohead In Rainbows", "radiohead-in-rainbows"],
    ["Beyoncé RENAISSANCE", "beyonce-renaissance"],
    ["Simon & Garfunkel", "simon-and-garfunkel"],
    ["Jay‐Z & Kanye West Watch the Throne", "jay-z-and-kanye-west-watch-the-throne"],
    ["  --Weird!!  Spacing--  ", "weird-spacing"],
    ["뉴진스", ""],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("never ends with a dash after truncation and matches the DB constraint", () => {
    const slug = slugify("a".repeat(119) + " b c d e");
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("partialDate", () => {
  it("accepts MusicBrainz partial dates only", () => {
    expect(partialDate("2007")).toBe("2007");
    expect(partialDate("2007-10-10")).toBe("2007-10-10");
    expect(partialDate("10/10/2007")).toBeNull();
    expect(partialDate(undefined)).toBeNull();
  });
});

describe("MusicBrainz mapping", () => {
  it("maps release-group types with secondary types taking precedence", () => {
    expect(mapAlbumType("Album")).toBe("album");
    expect(mapAlbumType("EP")).toBe("ep");
    expect(mapAlbumType("Album", ["Compilation"])).toBe("compilation");
    expect(mapAlbumType("Album", ["Live"])).toBe("live");
    expect(mapAlbumType("Album", ["Mixtape/Street"])).toBe("mixtape");
    expect(mapAlbumType(null)).toBe("other");
  });

  it("preserves multi-artist credits with join phrases", () => {
    expect(
      creditText([
        { name: "Ella Fitzgerald", joinphrase: " & ", artist: { id: "1", name: "Ella Fitzgerald" } },
        { name: "Louis Armstrong", artist: { id: "2", name: "Louis Armstrong" } },
      ]),
    ).toBe("Ella Fitzgerald & Louis Armstrong");
    expect(creditText([])).toBe("Unknown artist");
  });

  it("picks the earliest official release as representative", () => {
    const picked = pickRepresentativeRelease([
      { id: "bootleg", status: "Bootleg", date: "1990" },
      { id: "reissue", status: "Official", date: "2010-01-01" },
      { id: "original", status: "Official", date: "1991-09-24" },
      { id: "undated", status: "Official" },
    ]);
    expect(picked?.id).toBe("original");
    expect(pickRepresentativeRelease([])).toBeNull();
  });

  it("maps multi-disc tracklists and drops malformed tracks", () => {
    const tracks = mapTracks({
      id: "r",
      media: [
        { position: 1, tracks: [{ position: 1, number: "A1", title: "Intro", length: 61000 }] },
        {
          position: 2,
          tracks: [
            { position: 1, title: "Second disc", length: null },
            { position: 0, title: "Bad position" },
            { position: 2, title: "" },
          ],
        },
      ],
    });
    expect(tracks).toEqual([
      { discNumber: 1, position: 1, number: "A1", title: "Intro", durationMs: 61000, recordingId: null },
      { discNumber: 2, position: 1, number: null, title: "Second disc", durationMs: null, recordingId: null },
    ]);
  });
});
