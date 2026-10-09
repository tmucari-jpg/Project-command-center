"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Blocks,
  CalendarCheck2,
  CheckSquare2,
  ClipboardList,
  Factory,
  FolderKanban,
  Gauge,
  Lightbulb,
  PackageCheck,
  Scale,
  ShieldCheck,
  Target,
  TimerReset,
  Workflow,
} from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/agenda", label: "Agenda", icon: CalendarCheck2 },
  { href: "/focus", label: "Foco", icon: TimerReset },
  { href: "/objectives", label: "Objectivos", icon: Target },
  { href: "/project-factory", label: "Novo projecto", icon: Factory },
  { href: "/projects", label: "Projectos", icon: FolderKanban },
  { href: "/actions", label: "Acções", icon: CheckSquare2 },
  { href: "/deliverables", label: "Entregáveis", icon: PackageCheck },
  { href: "/blockers", label: "Bloqueios", icon: Blocks },
  { href: "/evidence", label: "Evidências", icon: ShieldCheck },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
  { href: "/weekly-review", label: "Revisão", icon: ClipboardList },
  { href: "/ideas", label: "Ideias", icon: Lightbulb },
  { href: "/decisions", label: "Decisões", icon: Scale },
  { href: "/automation", label: "Automações", icon: Workflow },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[270px] shrink-0 border-r border-[var(--cc-border)] bg-[var(--cc-glass)] backdrop-blur-2xl lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto px-4 py-5">
        <Link href="/dashboard" className="block rounded-[18px] px-3 py-3">
          <span className="block text-xs font-semibold tracking-[0.01em] text-[var(--cc-accent)]">Project</span>
          <span className="text-lg font-semibold tracking-[-0.025em] text-[var(--cc-foreground)]">Command Center</span>
        </Link>

        <nav className="mt-5 space-y-1" aria-label="Navegação principal">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 text-sm font-medium transition ${active ? "bg-[var(--cc-surface-strong)] text-[var(--cc-foreground)] shadow-sm" : "text-[var(--cc-secondary)] hover:bg-[var(--cc-surface-muted)] hover:text-[var(--cc-foreground)]"}`}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-5 border-t border-[var(--cc-border)] pt-4">
          <p className="px-3 text-xs leading-5 text-[var(--cc-secondary)]">
            Ferramentas técnicas e de administração ficam fora do fluxo diário.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const mobileItems = navigation.slice(0, 7);

  return (
    <div className="cc-safe-bottom overflow-x-auto border-t border-[var(--cc-border)] bg-[var(--cc-glass)] px-2 py-2 backdrop-blur-2xl lg:hidden">
      <nav className="flex min-w-max gap-1" aria-label="Navegação principal">
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 min-w-[72px] flex-col items-center justify-center gap-1 rounded-[14px] px-3 text-[11px] font-medium transition ${active ? "bg-[var(--cc-surface-strong)] text-[var(--cc-accent)] shadow-sm" : "text-[var(--cc-secondary)]"}`}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
