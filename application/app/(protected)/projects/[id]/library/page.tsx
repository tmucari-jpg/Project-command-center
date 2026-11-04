import { redirect } from "next/navigation";

export default async function ProjectDocumentLibraryRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/factory-library?project_id=${encodeURIComponent(id)}`);
}
