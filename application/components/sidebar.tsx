import Link from "next/link";
import { BarChart3, Blocks, Bot, CalendarCheck2, CheckSquare2, CircleDollarSign, ClipboardList, FolderKanban, Gauge, HardDrive, Lightbulb, ListTodo, PackageCheck, Radar, Scale, ShieldCheck, Target, TimerReset } from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/agenda", label: "Agenda diária", icon: CalendarCheck2 },
  { href: "/weekly-review", label: "Revisão semanal", icon: ClipboardList },
  { href: "/objectives", label: "Objectivos", icon: Target },
  { href: "/projects", label: "Projectos", icon: FolderKanban },
  { href: "/monetization", label: "Monetização", icon: CircleDollarSign },
  { href: "/agents", label: "Agentic Core", icon: Bot },
  { href: "/intelligence", label: "Intelligence", icon: Radar },
  { href: "/ai-providers", label: "Offline + IA", icon: HardDrive },
  { href: "/deliverables", label: "Entregáveis", icon: PackageCheck },
  { href: "/actions", label: "Acções", icon: CheckSquare2 },
  { href: "/focus", label: "Modo foco", icon: TimerReset },
  { href: "/blockers", label: "Bloqueios", icon: Blocks },
  { href: "/evidence", label: "Evidências", icon: ShieldCheck },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
  { href: "/ideas", label: "Ideias", icon: Lightbulb },
  { href: "/decisions", label: "Decisões", icon: Scale },
  { href: "/activity", label: "Actividade", icon: ListTodo },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--cc-border)] bg-white lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto px-4 py-5">
        <Link href="/dashboard" className="block rounded-[12px] px-3 py-3">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cc-accent)]">Project</span>
          <span className="text-lg font-semibold tracking-tight text-[var(--cc-foreground)]">Command Center</span>
        </Link>
        <nav className="mt-5 space-y-1" aria-label="Navegação principal">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-medium text-[var(--cc-secondary)] transition hover:bg-[var(--cc-surface-muted)] hover:text-[var(--cc-foreground)]">
              <Icon size={18} strokeWidth={1.8} />{label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <div className="overflow-x-auto border-b border-[var(--cc-border)] bg-white px-3 py-2 lg:hidden">
      <nav className="flex min-w-max gap-1" aria-label="Navegação principal">
        {navigation.map(({ href, label }) => (
          <Link key={href} href={href} className="flex min-h-11 items-center rounded-[10px] px-3 text-sm font-medium text-[var(--cc-secondary)] hover:bg-[var(--cc-surface-muted)] hover:text-[var(--cc-foreground)]">{label}</Link>
        ))}
      </nav>
    </div>
  );
}
