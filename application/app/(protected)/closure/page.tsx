import { finalizeProjectClosure } from "@/app/(protected)/mutations";
import { Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function ClosurePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; closed?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,title,status")
    .eq("user_id", user.id)
    .not("status", "in", '("completed","cancelled")')
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader eyebrow="Projectos" title="Fecho do Projecto" />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.closed}
        message={params.closed ? "Projecto fechado e decisão registada." : undefined}
      />

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">Processo independente do entregável</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Um projecto pode ser encerrado mesmo sem entregável concluído, por exemplo quando o cliente decide não continuar. O PCC regista o motivo e encerra o processo sem transformar essa decisão numa falsa conclusão de entrega.
        </p>
      </Card>

      <div className="space-y-4">
        {(projects ?? []).map((project) => (
          <Card key={project.id} className="p-5">
            <h2 className="font-semibold text-[var(--cc-foreground)]">{project.title}</h2>
            <p className="mt-1 text-sm text-[var(--cc-secondary)]">Estado actual: {project.status}</p>

            <form action={finalizeProjectClosure} className="mt-4 grid gap-4 lg:grid-cols-2">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="decision" value="close" />
              <Select label="Motivo do fecho" name="closure_reason" defaultValue="client_declined">
                <option value="completed">Objectivo concluído</option>
                <option value="client_declined">Cliente não pretende continuar</option>
                <option value="cancelled">Projecto cancelado por decisão interna</option>
                <option value="other">Outro motivo</option>
              </Select>
              <TextArea
                label="Justificação / registo"
                name="rationale"
                placeholder="Registe a razão real do fecho. Não é necessário existir entregável concluído."
              />
              <div className="lg:col-span-2">
                <button className={primaryButtonClass} type="submit">Fechar projecto</button>
              </div>
            </form>
          </Card>
        ))}
        {!projects?.length && <EmptyState>Não existem projectos abertos para fechar.</EmptyState>}
      </div>
    </>
  );
}
