"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AlbumSummary } from "@/types/domain";
import { removeListCover, uploadListCover } from "@/features/lists/actions";
import { ListCollage } from "./list-collage";

export function ListCoverUploader({
  listId,
  coverPath,
  preview,
}: {
  listId: string;
  coverPath: string | null;
  preview: AlbumSummary[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(coverPath);
  const [pending, startTransition] = useTransition();

  function upload(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Use a JPEG, PNG or WebP image.");
    if (file.size > 4 * 1024 * 1024) return toast.error("Covers must be 4 MB or smaller.");
    const data = new FormData();
    data.set("cover", file);
    startTransition(async () => {
      const result = await uploadListCover(listId, data);
      if (result.ok) {
        setPath(result.data.path);
        toast.success(result.message ?? "Cover updated.");
        router.refresh();
      } else toast.error(result.error);
      if (input.current) input.current.value = "";
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeListCover(listId);
      if (result.ok) {
        setPath(null);
        toast.success(result.message ?? "Removed.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-center">
      <ListCollage albums={preview} coverPath={path} />
      <div className="grid gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => upload(e.target.files?.[0])}
          aria-label="Upload list cover"
        />
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => input.current?.click()}>
          <ImageUp data-icon="inline-start" /> {path ? "Replace cover" : "Upload a cover"}
        </Button>
        {path ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}>
            <Trash2 data-icon="inline-start" /> Use album collage
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">Optional. Wide images work best · JPEG, PNG or WebP · up to 4 MB.</p>
      </div>
    </div>
  );
}
