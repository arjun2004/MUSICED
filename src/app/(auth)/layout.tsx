import { FocusLayout } from "@/components/layout/focus-layout";
import { CoverMosaic } from "@/components/albums/cover-mosaic";
import { getHeroCovers } from "@/features/discovery/queries";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <FocusLayout aside={<AuthAside />}>{children}</FocusLayout>;
}

async function AuthAside() {
  const covers = await getHeroCovers(20);
  return (
    <div className="relative h-full">
      <CoverMosaic albums={covers} columns={4} className="absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 p-12">
        <p className="eyebrow mb-4 !text-signal">Your listening life</p>
        <p className="max-w-md text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance">
          Every record you love, every first listen, every opinion worth sharing.
        </p>
      </div>
    </div>
  );
}
