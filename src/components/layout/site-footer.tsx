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
          <p className="mt-3 text-xs text-muted-foreground/80">
            Built by{" "}
            <a
              href="https://github.com/arjun2004"
              className="inline-flex items-center gap-1 underline decoration-border underline-offset-2 hover:text-foreground"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 fill-current">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              arjun2004
            </a>
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
