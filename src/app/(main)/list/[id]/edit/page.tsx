import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/shared/states";
import { requireViewer } from "@/lib/auth/session";
import { getList } from "@/features/lists/queries";
import { ListDetailsForm } from "@/features/lists/components/list-details-form";
import { ListEditor } from "@/features/lists/components/list-editor";
import { ListCoverUploader } from "@/features/lists/components/list-cover-uploader";

export const metadata: Metadata = { title: "Edit list", robots: { index: false } };

export default function EditListPage({ params }: PageProps<"/list/[id]/edit">) {
  return (
    <div className="container-page py-10">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}

async function Body({ params }: Pick<PageProps<"/list/[id]/edit">, "params">) {
  const { id } = await params;
  await requireViewer(`/list/${id}/edit`);
  const list = await getList(id);
  if (!list) notFound();
  if (!list.isOwner) redirect(`/list/${id}`);

  return (
    <>
      <Link href={`/list/${list.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> View list
      </Link>
      <h1 className="heading mt-4 text-3xl">Edit “{list.title}”</h1>
      <p className="mt-2 mb-10 text-sm text-muted-foreground">
        Albums save as soon as you add or move them. Use <span className="text-foreground">Save details</span> only when
        you change the title, description, ranking or visibility.
      </p>

      <section className="mb-14 max-w-2xl">
        <SectionHeader title="Details" />
        <ListDetailsForm
          listId={list.id}
          initial={{
            title: list.title,
            description: list.description ?? "",
            isRanked: list.is_ranked,
            visibility: list.visibility,
          }}
        />
      </section>

      <section className="mb-14 max-w-2xl">
        <SectionHeader title="Cover" />
        <ListCoverUploader listId={list.id} coverPath={list.cover_path} preview={list.items.slice(0, 5).map((i) => i.album)} />
      </section>

      <ListEditor
        listId={list.id}
        listTitle={list.title}
        isRanked={list.is_ranked}
        initialItems={list.items.map((i) => ({ id: i.id, note: i.note, album: i.album }))}
      />
    </>
  );
}
