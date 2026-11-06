import { Disc3 } from "lucide-react";
import { EmptyState } from "@/components/shared/states";

export default function AlbumNotFound() {
  return (
    <div className="container-page py-20">
      <EmptyState
        icon={Disc3}
        title="We couldn't find that album"
        description="It may have moved. Try searching for it instead."
        action={{ label: "Search albums", href: "/search" }}
      />
    </div>
  );
}
