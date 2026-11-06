"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/user-avatar";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/lib/validation/profile";
import { removeAvatar, uploadAvatar } from "@/features/profile/actions";

export function AvatarUploader({
  user,
  onUploaded,
}: {
  user: { username: string | null; display_name: string | null; avatar_path: string | null };
  onUploaded?: (path: string | null) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(user.avatar_path);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Images must be 2 MB or smaller.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);

    const data = new FormData();
    data.set("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatar(data);
      if (result.ok) {
        setPath(result.data.path);
        onUploaded?.(result.data.path);
        toast.success("Looking good.");
        router.refresh();
      } else {
        setPreview(null);
        toast.error(result.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeAvatar();
      if (result.ok) {
        setPath(null);
        setPreview(null);
        onUploaded?.(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="" className="size-24 rounded-full object-cover sm:size-28" />
        ) : (
          <UserAvatar user={{ ...user, avatar_path: path }} size="xl" />
        )}
        {pending ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60 text-xs">
            Saving…
          </span>
        ) : null}
      </div>
      <div className="grid gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_MIME_TYPES.join(",")}
          className="sr-only"
          id="avatar-file"
          onChange={(event) => onFile(event.target.files?.[0])}
          disabled={pending}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <Camera data-icon="inline-start" />
          {path ? "Change photo" : "Upload photo"}
        </Button>
        {path ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRemove}>
            <Trash2 data-icon="inline-start" />
            Remove
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · up to 2 MB</p>
      </div>
    </div>
  );
}
