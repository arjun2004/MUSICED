import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

const MENTION = /(^|[^a-z0-9_])@([a-z0-9_]{3,24})/gi;

/**
 * Renders user-written text safely: plain React text nodes (never HTML),
 * paragraphs from blank lines, line breaks preserved, @mentions linked to
 * profiles. URLs are intentionally left as text.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.trim().split(/\n{2,}/);
  return (
    <div className={cn("prose-review", className)}>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="whitespace-pre-line">
          {linkMentions(paragraph)}
        </p>
      ))}
    </div>
  );
}

export function linkMentions(text: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    const [whole, lead, username] = match;
    const start = (match.index ?? 0) + lead.length;
    parts.push(text.slice(last, start));
    parts.push(
      <Link key={start} href={`/user/${username.toLowerCase()}`} className="font-medium text-signal hover:underline">
        @{username}
      </Link>,
    );
    last = (match.index ?? 0) + whole.length;
  }
  parts.push(text.slice(last));
  return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);
}
