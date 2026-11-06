import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10">
      <Logo />
      <main id="main" className="flex flex-1 flex-col items-center justify-center text-center">
        <LogoMark className="mb-8 size-16 animate-[spin_6s_linear_infinite] motion-reduce:animate-none" />
        <p className="eyebrow mb-3">404 · Side C</p>
        <h1 className="heading text-3xl">This track doesn&apos;t exist</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for was moved, deleted, or never pressed in the first place.
        </p>
        <div className="mt-8 flex gap-2">
          <Button asChild className="font-semibold">
            <Link href="/">Back to Discover</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/members">Find listeners</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
