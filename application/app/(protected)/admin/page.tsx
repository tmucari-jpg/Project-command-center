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

const tools = [
  { href: "/automation", label: "Automações", description: "Configuração, aprovação e acompanhamento das execuções automáticas.", icon: Workflow },
  { href: "/help", label: "Manual", description: "Referência operacional e ajuda do PCC.", icon: CircleHelp },
  { href: "/agents", label: "Agentes", description: "Execuções especializadas e aprovações.", icon: Bot },
  { href: "/orchestrator", label: "Orquestração", description: "Regras de encaminhamento e execução.", icon: BrainCircuit },
  { href: "/execution-arena", label: "Testes", description: "Testes controlados antes da decisão final.", icon: FlaskConical },
  { href: "/factory-library", label: "Biblioteca", description: "Conhecimento e activos reutilizáveis.", icon: BookOpenCheck },
  { href: "/intelligence", label: "Inteligência", description: "Sinais, oportunidades e informação de apoio.", icon: Radar },
  { href: "/security", label: "Segurança", description: "Acessos, controlos e eventos de segurança.", icon: LockKeyhole },
  { href: "/optimization", label: "Optimização", description: "Saúde operacional e melhoria contínua.", icon: Repeat2 },
  { href: "/ai-providers", label: "IA", description: "Motor técnico para diagnóstico, melhoria e tratamento assistido de falhas, limitado às capacidades realmente configuradas.", icon: HardDrive },
];

export default async function AdminPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Administração"
      />

      <Card className="mb-6 p-5">
        <p className="font-semibold text-[var(--cc-foreground)]">Configuração do sistema</p>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Área reservada à configuração, segurança e manutenção do PCC.
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
