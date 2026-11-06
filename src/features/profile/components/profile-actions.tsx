"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Ellipsis, Flag, Link2 } from "lucide-react";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setBlocked } from "@/features/social/actions";

/** Overflow menu on someone else's profile: copy link, block/unblock. */
export function ProfileOverflowMenu({
  userId,
  username,
  hasBlocked,
  isSignedIn,
}: {
  userId: string;
  username: string;
  hasBlocked: boolean;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function copyLink() {
    const url = `${window.location.origin}/user/${username}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Profile link copied."),
      () => toast.error("Couldn't copy the link."),
    );
  }

  function applyBlock(block: boolean) {
    startTransition(async () => {
      const result = await setBlocked(userId, block);
      if (result.ok) {
        toast.success(block ? `You blocked @${username}.` : `You unblocked @${username}.`);
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon-sm" aria-label="More actions">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={copyLink}>
            <Link2 /> Copy profile link
          </DropdownMenuItem>
          {isSignedIn ? (
            <>
              <DropdownMenuSeparator />
              <ReportDialog
                targetType="profile"
                targetId={userId}
                trigger={
                  <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                    <Flag /> Report @{username}
                  </DropdownMenuItem>
                }
              />
              {hasBlocked ? (
                <DropdownMenuItem onSelect={() => applyBlock(false)} disabled={pending}>
                  <Ban /> Unblock @{username}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                  <Ban /> Block @{username}
                </DropdownMenuItem>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block @{username}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll stop following each other, and neither of you will see the other&apos;s
              reviews, diary or activity. They won&apos;t be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                applyBlock(true);
              }}
            >
              {pending ? "Blocking…" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
