import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsNav, SettingsNavView } from "@/features/profile/components/settings-nav";

export const metadata: Metadata = {
  title: { default: "Settings", template: "%s · Settings · MUSICED" },
  robots: { index: false },
};

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="container-page py-10">
      <h1 className="heading mb-8 text-3xl">Settings</h1>
      <div className="grid gap-10 md:grid-cols-[200px_minmax(0,1fr)]">
        <Suspense fallback={<SettingsNavView />}>
          <SettingsNav />
        </Suspense>
        <div className="max-w-2xl min-w-0">{children}</div>
      </div>
    </div>
  );
}
