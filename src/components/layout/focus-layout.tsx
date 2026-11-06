import { Logo } from "@/components/brand/logo";

/**
 * Minimal frame for auth and onboarding: logo, a single column, and a quiet
 * editorial aside on wide screens.
 */
export function FocusLayout({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <p className="text-xs text-muted-foreground">Discover. Listen. Rate. Repeat.</p>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-hairline bg-surface lg:block">
        {aside}
      </aside>
    </div>
  );
}
