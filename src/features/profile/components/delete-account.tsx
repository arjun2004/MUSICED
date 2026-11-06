"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAccount } from "@/features/profile/actions";

export function DeleteAccount({ username }: { username: string }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await deleteAccount({ username: typed, password });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes your profile, diary, ratings, reviews, lists, comments and uploads. It can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-username" className="text-[0.8125rem]">
              Type <span className="font-mono">{username}</span> to confirm
            </Label>
            <Input id="confirm-username" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="h-10 font-mono" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-password" className="text-[0.8125rem]">Password</Label>
            <Input id="confirm-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-10" />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending || typed.trim().toLowerCase() !== username || !password} onClick={submit}>
            {pending ? "Deleting…" : "Delete forever"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
