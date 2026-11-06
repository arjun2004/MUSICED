import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { getViewerProfile } from "@/lib/auth/session";
import { HeaderAccount, HeaderAccountSkeleton } from "./header-account";
import { MobileTabBar } from "./mobile-tab-bar";
import { NavLinks, NavLinksView } from "./nav-links";

export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur-md">
        <div className="container-page flex h-14 items-center gap-6">
          <Logo />
          <Suspense fallback={<NavLinksView />}>
            <NavLinks />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <Suspense fallback={<HeaderAccountSkeleton />}>
              <HeaderAccount />
            </Suspense>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <MobileTabs />
      </Suspense>
    </>
  );
}

async function MobileTabs() {
  const profile = await getViewerProfile();
  return <MobileTabBar username={profile?.username ?? null} />;
}
