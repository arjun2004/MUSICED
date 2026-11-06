"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Flag, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/profile/user-avatar";
import { linkMentions } from "@/components/shared/rich-text";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils/format";
import type { ProfileSummary } from "@/types/domain";
import { addComment, deleteComment, editComment, setCommentLiked } from "@/features/reviews/actions";
import type { CommentNode } from "@/features/reviews/queries";
import { ReportDialog } from "@/features/moderation/components/report-dialog";

type Viewer = ProfileSummary | null;

export function CommentThread({
  reviewId,
  reviewAuthorId,
  initial,
  viewer,
}: {
  reviewId: string;
  reviewAuthorId: string;
  initial: CommentNode[];
  viewer: Viewer;
}) {
  const [comments, setComments] = useState(initial);
  const count = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  function added(node: CommentNode) {
    setComments((current) =>
      node.parent_id
        ? current.map((c) => (c.id === node.parent_id ? { ...c, replies: [...c.replies, node] } : c))
        : [...current, node],
    );
  }

  function removed(id: string) {
    setComments((current) =>
      current.filter((c) => c.id !== id).map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== id) })),
    );
  }

  function edited(id: string, body: string) {
    const patch = (c: CommentNode): CommentNode =>
      c.id === id ? { ...c, body, edited_at: new Date().toISOString() } : { ...c, replies: c.replies.map(patch) };
    setComments((current) => current.map(patch));
  }

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="mb-6 text-lg font-semibold tracking-tight">
        Comments <span className="font-mono text-sm text-muted-foreground">{count}</span>
      </h2>
      {viewer ? (
        <Composer reviewId={reviewId} viewer={viewer} onPosted={added} />
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          <Link href={`/login?next=${encodeURIComponent(`/review/${reviewId}`)}`} className="text-foreground underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      )}
      {comments.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ol className="mt-2 divide-y divide-hairline">
          {comments.map((comment) => (
            <li key={comment.id} className="py-4">
              <Comment
                comment={comment}
                reviewId={reviewId}
                reviewAuthorId={reviewAuthorId}
                viewer={viewer}
                onReply={added}
                onDelete={removed}
                onEdit={edited}
              />
              {comment.replies.length > 0 ? (
                <ol className="mt-3 ml-11 grid gap-4 border-l border-hairline pl-4">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <Comment
                        comment={reply}
                        reviewId={reviewId}
                        reviewAuthorId={reviewAuthorId}
                        viewer={viewer}
                        onDelete={removed}
                        onEdit={edited}
                      />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Composer({
  reviewId,
  viewer,
  parentId,
  onPosted,
  onCancel,
  autoFocus,
}: {
  reviewId: string;
  viewer: ProfileSummary;
  parentId?: string;
  onPosted: (node: CommentNode) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addComment(reviewId, body, parentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onPosted({ ...result.data, likes_count: 0, edited_at: null, author: viewer, viewerLiked: false, replies: [] });
      setBody("");
      onCancel?.();
    });
  }

  return (
    <form onSubmit={submit} className="mb-4 flex gap-3">
      <UserAvatar user={viewer} size="sm" className="mt-1" />
      <div className="flex-1">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={parentId ? 2 : 3}
          autoFocus={autoFocus}
          placeholder={parentId ? "Write a reply…" : "Add a comment. Mention people with @username."}
          aria-label={parentId ? "Reply" : "Comment"}
        />
        <div className="mt-2 flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          ) : null}
          <Button type="submit" size="sm" className="font-semibold" disabled={pending || !body.trim()}>
            {pending ? "Posting…" : parentId ? "Reply" : "Comment"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Comment({
  comment,
  reviewId,
  reviewAuthorId,
  viewer,
  onReply,
  onDelete,
  onEdit,
}: {
  comment: CommentNode;
  reviewId: string;
  reviewAuthorId: string;
  viewer: Viewer;
  onReply?: (node: CommentNode) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, body: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [liked, setLiked] = useState({ on: comment.viewerLiked, count: comment.likes_count });
  const [pending, startTransition] = useTransition();
  const isAuthor = viewer?.id === comment.author.id;
  const canDelete = isAuthor || viewer?.id === reviewAuthorId;

  function like() {
    if (!viewer) return;
    const next = { on: !liked.on, count: liked.count + (liked.on ? -1 : 1) };
    setLiked(next);
    startTransition(async () => {
      const result = await setCommentLiked(comment.id, next.on);
      if (!result.ok) {
        setLiked(liked);
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteComment(comment.id);
      if (result.ok) onDelete(comment.id);
      else toast.error(result.error);
    });
  }

  function saveEdit() {
    startTransition(async () => {
      const result = await editComment(comment.id, draft);
      if (result.ok) {
        onEdit(comment.id, draft.trim());
        setEditing(false);
      } else toast.error(result.error);
    });
  }

  return (
    <article className="flex gap-3">
      <Link href={`/user/${comment.author.username}`} className="shrink-0 self-start">
        <UserAvatar user={comment.author} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Link href={`/user/${comment.author.username}`} className="font-medium hover:text-signal">
            {comment.author.display_name || comment.author.username}
          </Link>
          <span className="ml-2 font-mono text-xs text-muted-foreground" title={comment.created_at}>
            {timeAgo(comment.created_at)}
            {comment.edited_at ? " · edited" : ""}
          </span>
        </p>
        {editing ? (
          <div className="mt-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} rows={3} aria-label="Edit comment" />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={pending || !draft.trim()}>Save</Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-foreground/90">{linkMentions(comment.body)}</p>
        )}
        <div className="mt-2 flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            onClick={like}
            disabled={!viewer || pending}
            aria-pressed={liked.on}
            aria-label={liked.on ? "Unlike comment" : "Like comment"}
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 font-mono text-xs hover:text-foreground disabled:opacity-60"
          >
            <Heart className={cn("size-3.5", liked.on && "fill-signal text-signal")} aria-hidden="true" />
            {liked.count}
          </button>
          {onReply && viewer ? (
            <SmallAction icon={MessageCircle} label="Reply" onClick={() => setReplying((v) => !v)} />
          ) : null}
          {isAuthor && !editing ? <SmallAction icon={Pencil} label="Edit" onClick={() => setEditing(true)} /> : null}
          {canDelete ? <SmallAction icon={Trash2} label="Delete" onClick={remove} /> : null}
          {viewer && !isAuthor ? (
            <ReportDialog
              targetType="comment"
              targetId={comment.id}
              trigger={<SmallAction icon={Flag} label="Report" />}
            />
          ) : null}
        </div>
        {replying && viewer && onReply ? (
          <div className="mt-3">
            <Composer
              reviewId={reviewId}
              viewer={viewer}
              parentId={comment.id}
              autoFocus
              onPosted={onReply}
              onCancel={() => setReplying(false)}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SmallAction({
  icon: Icon,
  label,
  onClick,
  ...rest
}: { icon: typeof Heart; label: string; onClick?: () => void } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs hover:text-foreground"
      {...rest}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
