import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";
import { avatarUrl } from "@/lib/utils/storage";

const SIZES = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl sm:size-28",
} as const;

export function UserAvatar({
  user,
  size = "sm",
  className,
}: {
  user: { username: string | null; display_name: string | null; avatar_path: string | null };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = avatarUrl(user.avatar_path);
  const name = user.display_name || user.username || "Listener";
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="bg-surface-raised font-medium text-foreground/80">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
