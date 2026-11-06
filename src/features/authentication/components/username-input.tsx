"use client";

import { useEffect, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { usernameSchema } from "@/lib/validation/auth";
import { checkUsernameAvailability } from "@/features/profile/actions";

function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Username field with a debounced live availability check. The server
 * remains authoritative (unique index); this is purely a convenience.
 */
export function UsernameInput({
  registration,
  error,
  watchValue,
  currentUsername,
  autoFocus,
}: {
  registration: UseFormRegisterReturn;
  error?: string;
  watchValue: string;
  currentUsername?: string | null;
  autoFocus?: boolean;
}) {
  const candidate = useDebounced((watchValue ?? "").trim().toLowerCase());
  const valid = usernameSchema.safeParse(candidate).success;
  const unchanged = Boolean(currentUsername) && candidate === currentUsername;

  const { data, isFetching } = useQuery({
    queryKey: ["username-available", candidate],
    queryFn: () => checkUsernameAvailability(candidate),
    enabled: valid && !unchanged,
    staleTime: 30_000,
  });

  const available = data?.ok ? data.data.available : undefined;
  let status: React.ReactNode = null;
  if (valid && !unchanged && !error) {
    if (isFetching) {
      status = <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Checking" />;
    } else if (available === true) {
      status = <Check className="size-4 text-signal" aria-label="Available" />;
    } else if (available === false) {
      status = <X className="size-4 text-destructive" aria-label="Taken" />;
    }
  }

  const takenMessage = available === false && !unchanged ? "That username is taken" : undefined;

  return (
    <FormField
      label="Username"
      error={error ?? takenMessage}
      hint="Lowercase letters, numbers and underscores. This is your profile address."
    >
      {(field) => (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            @
          </span>
          <Input
            {...field}
            {...registration}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            autoFocus={autoFocus}
            className="h-10 pr-9 pl-7 font-mono"
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2" aria-live="polite">
            {status}
          </span>
        </div>
      )}
    </FormField>
  );
}
