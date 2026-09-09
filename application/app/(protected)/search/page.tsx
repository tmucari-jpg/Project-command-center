import { BraveSearch } from "@/components/brave-search";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";

export default function SearchPage() {
  return (
    <>
      <PageHeader
        eyebrow="Integração"
        title="Pesquisa externa"
        description="Pesquisa web através do Brave Search API. A chave permanece exclusivamente no servidor."
      />
      <Card className="p-5 sm:p-6">
        <BraveSearch />
      </Card>
    </>
  );
}
