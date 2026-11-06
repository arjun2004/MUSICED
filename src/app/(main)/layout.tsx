import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SuspendedBanner } from "@/components/layout/suspended-banner";
import { Suspense } from "react";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <SuspendedBanner />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
