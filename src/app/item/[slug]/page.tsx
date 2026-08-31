import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Editor } from "@/components/Editor";
import { exigirSessao } from "@/lib/guarda";
import { porSlug } from "@/lib/itens";

export async function generateMetadata(
  props: PageProps<"/item/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const item = await porSlug(slug).catch(() => null);

  return { title: item?.titulo ?? "Item" };
}

export default async function Pagina(props: PageProps<"/item/[slug]">) {
  await exigirSessao();

  const { slug } = await props.params;
  const item = await porSlug(slug);

  if (!item) notFound();

  return <Editor item={item} />;
}
