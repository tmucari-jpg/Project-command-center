import Link from "next/link";
import {
  Bot,
  BrainCircuit,
  BookOpenCheck,
  FlaskConical,
  HardDrive,
  CircleHelp,
  Workflow,
  LockKeyhole,
  Radar,
  Repeat2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

const groups = [
  {
    title: "IA & Automação",
    description: "Configura as capacidades que os projectos utilizam automaticamente no próprio fluxo.",
    tools: [
      { href: "/ai-providers", label: "IA / Providers", description: "Providers, modelos e disponibilidade.", icon: HardDrive },
      { href: "/bot-ia", label: "BotIA", description: "Coordenação assistida dentro dos projectos.", icon: Bot },
      { href: "/agents", label: "Agentes", description: "Execuções especializadas e controladas.", icon: BrainCircuit },
      { href: "/automation", label: "Automações", description: "Execuções automáticas e aprovações.", icon: Workflow },
      { href: "/orchestrator", label: "Orquestração", description: "Regras de encaminhamento e execução.", icon: BrainCircuit },
    ],
  },
  {
    title: "Conhecimento & Qualidade",
    description: "Mantém conhecimento reutilizável, testes e melhoria contínua.",
    tools: [
      { href: "/factory-library", label: "Biblioteca", description: "Conhecimento e activos reutilizáveis.", icon: BookOpenCheck },
      { href: "/help", label: "Manual", description: "Referência operacional do PCC.", icon: CircleHelp },
      { href: "/execution-arena", label: "Testes", description: "Validação controlada antes de decisões.", icon: FlaskConical },
      { href: "/intelligence", label: "Inteligência", description: "Sinais, oportunidades e apoio à decisão.", icon: Radar },
      { href: "/optimization", label: "Optimização", description: "Saúde operacional e melhoria contínua.", icon: Repeat2 },
    ],
  },
  {
    title: "Sistema & Segurança",
    description: "Governa acessos, controlos e configuração técnica da plataforma.",
    tools: [
      { href: "/security", label: "Segurança", description: "Acessos, controlos e eventos de segurança.", icon: LockKeyhole },
    ],
  },
];

export default async function AdminPage() {
  const { supabase, user } = await requireAdmin();

  const { data: providers } = await supabase
    .from("ai_provider_profiles")
    .select("enabled,last_health_status")
    .eq("user_id", user.id);

  const healthyProviders = (providers ?? []).filter(
    (provider) => provider.enabled && provider.last_health_status === "healthy",
  ).length;
  const aiState = healthyProviders > 0 ? "Saudável" : (providers?.length ?? 0) > 0 ? "Atenção" : "Não configurado";

  return (
    <>
      <PageHeader eyebrow="Administração" title="Administração" />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-[var(--cc-foreground)]">Capacidades do PCC</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cc-secondary)]">
              Administração configura e governa as capacidades da plataforma. O trabalho normal continua dentro dos projectos; o utilizador não deve vir aqui para executar o projecto.
            </p>
          </div>
          <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">IA</p>
            <p className="mt-1 text-sm font-semibold text-[var(--cc-foreground)]">{aiState}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.title}>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">{group.title}</h2>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">{group.description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.tools.map(({ href, label, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4 transition hover:bg-[var(--cc-surface-muted)]"
                >
                  <Icon size={18} aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-[var(--cc-foreground)]">{label}</h3>
                  <p className="mt-1 text-sm leading-5 text-[var(--cc-secondary)]">{description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
