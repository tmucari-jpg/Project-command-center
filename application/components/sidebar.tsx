"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  CheckSquare2,
  CircleDollarSign,
  Factory,
  FolderKanban,
  Gauge,
  PackageCheck,
  Settings,
  Target,
} from "lucide-react";

const navigationGroups = [
  {
    label: "Começar",
    items: [
      { href: "/project-factory", label: "Novo projecto", icon: Factory },
      { href: "/objectives", label: "Objectivos", icon: Target },
      { href: "/projects", label: "Projectos", icon: FolderKanban },
    ],
  },
  {
    label: "Executar",
    items: [
      { href: "/actions", label: "Executar", icon: CheckSquare2 },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/commercial-master", label: "Master Comercial", icon: BriefcaseBusiness },
      { href: "/monetization", label: "Monetização", icon: CircleDollarSign },
    ],
  },
  {
    label: "Validar / concluir",
    items: [
      { href: "/metrics", label: "Métricas", icon: BarChart3 },
      { href: "/deliverables", label: "Entregáveis & Fecho", icon: PackageCheck },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ pathname, href, label, Icon }: { pathname: string; href: string; label: string; Icon: typeof Gauge }) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-[12px] px-3.5 text-sm font-medium transition ${active ? "bg-[color-mix(in_srgb,var(--cc-gold)_14%,white)] text-[var(--cc-accent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--cc-gold)_48%,var(--cc-border))]" : "text-[var(--cc-accent)]/78 hover:bg-[color-mix(in_srgb,var(--cc-gold)_8%,white)] hover:text-[var(--cc-accent)]"}`}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="cc-sidebar relative hidden w-[250px] shrink-0 overflow-hidden border-r border-[var(--cc-border)] lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto px-4 py-5">
        <Link href="/dashboard" className="relative z-10 flex items-center gap-3 rounded-[18px] px-3 py-3 text-[var(--cc-accent)]">
          <Image src="/icons/icon-192.png" alt="PCC" width={40} height={40} className="rounded-[11px]" priority />
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-[-0.02em]">Project Command Center</span>
            <span className="mt-1 block text-[9px] uppercase tracking-[0.16em] text-[var(--cc-accent)]/55">Da estratégia à execução</span>
          </span>
        </Link>

        <nav className="relative z-10 mt-5 space-y-5" aria-label="Navegação principal">
          <div>
            <p className="mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]/45">Resumo</p>
            <div className="space-y-1">
              <NavLink pathname={pathname} href="/dashboard" label="Painel" Icon={Gauge} />
            </div>
          </div>

          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]/45">{group.label}</p>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon }) => (
                  <NavLink key={href} pathname={pathname} href={href} label={label} Icon={icon} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <nav className="relative z-10 mt-5 space-y-1 border-t border-[var(--cc-border)] pt-4" aria-label="Administração">
          {isAdmin && <NavLink pathname={pathname} href="/admin" label="Administração" Icon={Settings} />}
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const mobileItems = [
    { href: "/dashboard", label: "Painel", icon: Gauge },
    { href: "/project-factory", label: "Novo", icon: Factory },
    { href: "/projects", label: "Projectos", icon: FolderKanban },
    { href: "/actions", label: "Executar", icon: CheckSquare2 },
    { href: "/commercial-master", label: "Comercial", icon: BriefcaseBusiness },
    { href: "/metrics", label: "Métricas", icon: BarChart3 },
    { href: "/deliverables", label: "Fecho", icon: PackageCheck },
  ];

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
