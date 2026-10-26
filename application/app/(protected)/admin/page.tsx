import Link from "next/link";
import {
  Bot,
  CircleDollarSign,
  BrainCircuit,
  BookOpenCheck,
  CircleHelp,
  FlaskConical,
  HardDrive,
  LockKeyhole,
  Radar,
  Repeat2,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

const groups = [
  {
    title: "Comercial",
    description: "Capacidade transversal para todos os projectos que exigem avaliação ou execução comercial.",
    tools: [
      { href: "/monetization", label: "Comercial", description: "Backlog, pipeline, leads, oferta/preço, custos/receitas e entregáveis comerciais ligados aos projectos.", icon: CircleDollarSign },
    ],
  },
  {
    title: "IA & Automação",
    description: "Capacidades usadas pelos projectos sem obrigar o utilizador a sair do fluxo operacional.",
    tools: [
      { href: "/ai-providers", label: "IA / Providers", description: "Configuração e saúde dos providers.", icon: HardDrive },
      { href: "/bot-ia", label: "BotIA", description: "Assistência operacional dentro dos projectos.", icon: Bot },
      { href: "/agents", label: "Agentes", description: "Execuções especializadas e controladas.", icon: BrainCircuit },
      { href: "/automation", label: "Automações", description: "Execuções automáticas e aprovações.", icon: Workflow },
      { href: "/orchestrator", label: "Orquestração", description: "Regras de encaminhamento entre capacidades.", icon: BrainCircuit },
    ],
  },
  {
    title: "Conhecimento & Qualidade",
    description: "Conhecimento, testes e melhoria contínua das capacidades do PCC.",
    tools: [
      { href: "/factory-library", label: "Biblioteca de Activos", description: "Conhecimento e activos reutilizáveis do PCC; não é a biblioteca de entregáveis de um projecto.", icon: BookOpenCheck },
      { href: "/help", label: "Manual", description: "Referência operacional do PCC.", icon: CircleHelp },
      { href: "/execution-arena", label: "Testes", description: "Testes controlados antes de decisões relevantes.", icon: FlaskConical },
      { href: "/intelligence", label: "Inteligência", description: "Sinais e informação de apoio.", icon: Radar },
      { href: "/optimization", label: "Optimização", description: "Saúde operacional e melhoria contínua.", icon: Repeat2 },
    ],
  },
  {
    title: "Sistema & Segurança",
    description: "Governação, acessos e controlos técnicos da plataforma.",
    tools: [
      { href: "/security", label: "Segurança", description: "Acessos, controlos e eventos de segurança.", icon: LockKeyhole },
      { href: "/official-documents", label: "Repositório Oficial PCC", description: "Downloads oficiais da plataforma: documentos, pacote técnico e builds.", icon: BookOpenCheck },
    ],
  },
];

export default async function AdminPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader eyebrow="Administração" title="Administração" />

      <Card className="mb-6 p-5">
        <p className="font-semibold text-[var(--cc-foreground)]">Capacidades do PCC</p>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Administração configura e governa as capacidades. O trabalho normal do projecto acontece no próprio fluxo do projecto.
        </p>
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
                  <div className="flex items-center justify-between gap-3">
                    <Icon size={19} aria-hidden="true" />
                    <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">
                      {group.title === "Comercial" ? "Interno" : "Configurar"}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold text-[var(--cc-foreground)]">{label}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--cc-secondary)]">{description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
