import Link from "next/link";
import {
  Bot,
  BrainCircuit,
  BookOpenCheck,
  FlaskConical,
  HardDrive,
  LockKeyhole,
  Radar,
  Repeat2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";

const tools = [
  { href: "/agents", label: "Agentes", description: "Runs especializados e aprovações humanas.", icon: Bot },
  { href: "/orchestrator", label: "Orchestrator", description: "Rotas e decisões internas de execução.", icon: BrainCircuit },
  { href: "/execution-arena", label: "Execution Arena", description: "Testes e execução controlada.", icon: FlaskConical },
  { href: "/factory-library", label: "Factory Library", description: "Activos, prompts, estratégias e lições reutilizáveis.", icon: BookOpenCheck },
  { href: "/intelligence", label: "Intelligence", description: "Inteligência e pesquisa de apoio.", icon: Radar },
  { href: "/ai-providers", label: "Configuração de IA", description: "Providers, estado de IA local e sincronização.", icon: HardDrive },
  { href: "/security", label: "Segurança", description: "Controlo e revisão de segurança.", icon: LockKeyhole },
  { href: "/optimization", label: "Optimização", description: "Melhorias técnicas e operacionais.", icon: Repeat2 },
];

export default function AdminPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Admin"
        description="Configuração técnica, segurança e ferramentas internas do PCC."
      />

      <Card className="mb-6 p-5">
        <p className="font-semibold text-[var(--cc-foreground)]">Configuração do sistema</p>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Use esta área apenas para configuração técnica, segurança e manutenção interna. As Automações fazem parte do fluxo principal do PCC.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5 transition hover:bg-[var(--cc-surface-muted)]"
          >
            <Icon size={20} aria-hidden="true" />
            <h2 className="mt-4 font-semibold text-[var(--cc-foreground)]">{label}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">{description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
