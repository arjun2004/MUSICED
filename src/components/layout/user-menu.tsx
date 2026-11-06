"use client";

import Link from "next/link";
import { Bell, LogOut, NotebookPen, Settings, ShieldCheck, Sparkles, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/profile/user-avatar";
import { signOut } from "@/features/authentication/actions";

export type MenuProfile = {
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  onboarded: boolean;
  isStaff?: boolean;
};

export function UserMenu({ profile }: { profile: MenuProfile }) {
  const name = profile.display_name || profile.username || "Your account";
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Account menu"
      >
        <UserAvatar user={profile} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          {profile.username ? (
            <span className="truncate font-mono text-xs font-normal text-muted-foreground">
              @{profile.username}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {!profile.onboarded ? (
            <DropdownMenuItem asChild>
              <Link href="/onboarding" className="text-signal">
                <Sparkles /> Finish setting up
              </Link>
            </DropdownMenuItem>
          ) : null}
          {profile.username ? (
            <DropdownMenuItem asChild>
              <Link href={`/user/${profile.username}`}>
                <User /> Profile
              </Link>
            </DropdownMenuItem>
          ) : null}
          {profile.username ? (
            <DropdownMenuItem asChild>
              <Link href={`/user/${profile.username}/diary`}>
                <NotebookPen /> Diary
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href="/notifications">
              <Bell /> Notifications
            </Link>
          </DropdownMenuItem>
          {profile.isStaff ? (
            <DropdownMenuItem asChild>
              <Link href="/admin/moderation">
                <ShieldCheck /> Moderation
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings /> Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
