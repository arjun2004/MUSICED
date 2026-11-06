import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-hairline pb-24 md:pb-0">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-[1fr_auto]">
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <LogoMark className="size-5" />
            <span className="text-sm font-semibold tracking-tight">musiced</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Discover. Listen. Rate. Repeat.</p>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground/80">
            Music metadata from{" "}
            <a
              href="https://musicbrainz.org"
              className="underline decoration-border underline-offset-2 hover:text-foreground"
              rel="noopener noreferrer"
              target="_blank"
            >
              MusicBrainz
            </a>{" "}
            (CC0). Album artwork via the{" "}
            <a
              href="https://coverartarchive.org"
              className="underline decoration-border underline-offset-2 hover:text-foreground"
              rel="noopener noreferrer"
              target="_blank"
            >
              Cover Art Archive
            </a>
            ; artwork remains the property of its respective owners.
          </p>
        </div>
        <nav aria-label="Footer" className="flex gap-6 text-sm text-muted-foreground sm:flex-col sm:gap-2 sm:text-right">
          <Link href="/search" className="hover:text-foreground">Albums</Link>
          <Link href="/lists" className="hover:text-foreground">Lists</Link>
          <Link href="/members" className="hover:text-foreground">Listeners</Link>
          <Link href="/signup" className="hover:text-foreground">Join</Link>
        </nav>
      </div>
    </footer>
  );
}
