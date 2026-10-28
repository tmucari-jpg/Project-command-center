"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Boxes,
  Factory,
  FolderKanban,
  Gauge,
  Settings,
} from "lucide-react";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  pathname,
  href,
  label,
  Icon,
  badge,
}: {
  pathname: string;
  href: string;
  label: string;
  Icon: typeof Gauge;
  badge?: number;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-[12px] px-3.5 text-sm font-medium transition ${active ? "bg-[color-mix(in_srgb,var(--cc-gold)_14%,white)] text-[var(--cc-accent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--cc-gold)_48%,var(--cc-border))]" : "text-[var(--cc-accent)]/78 hover:bg-[color-mix(in_srgb,var(--cc-gold)_8%,white)] hover:text-[var(--cc-accent)]"}`}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span className="ml-auto min-w-5 rounded-full bg-[#c99439] px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ isAdmin, notificationCount }: { isAdmin: boolean; notificationCount: number }) {
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

        <nav className="relative z-10 mt-6 space-y-1" aria-label="Navegação principal">
          <NavLink pathname={pathname} href="/dashboard" label="Início" Icon={Gauge} />
          <NavLink pathname={pathname} href="/project-factory" label="Novo projecto" Icon={Factory} />
          <NavLink pathname={pathname} href="/projects" label="Projectos" Icon={FolderKanban} />
          <NavLink pathname={pathname} href="/products" label="Produtos e Pacotes" Icon={Boxes} />
          <NavLink pathname={pathname} href="/notifications" label="Alertas" Icon={Bell} badge={notificationCount} />
        </nav>

        <nav className="relative z-10 mt-5 space-y-1 border-t border-[var(--cc-border)] pt-4" aria-label="Administração">
          {isAdmin && <NavLink pathname={pathname} href="/admin" label="Administração" Icon={Settings} />}
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav({ notificationCount }: { notificationCount: number }) {
  const pathname = usePathname();
  const mobileItems = [
    { href: "/dashboard", label: "Início", icon: Gauge },
    { href: "/project-factory", label: "Novo", icon: Factory },
    { href: "/projects", label: "Projectos", icon: FolderKanban },
    { href: "/products", label: "Produtos", icon: Boxes },
    { href: "/notifications", label: notificationCount > 0 ? `Alertas ${notificationCount > 99 ? "99+" : notificationCount}` : "Alertas", icon: Bell },
  ];

  return (
    <div className="cc-safe-bottom border-t border-[var(--cc-border)] bg-[var(--cc-glass)] px-2 py-2 backdrop-blur-2xl lg:hidden">
      <nav className="grid grid-cols-5 gap-1" aria-label="Navegação principal">
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[14px] px-2 text-[11px] font-medium transition ${active ? "bg-[var(--cc-surface-strong)] text-[var(--cc-accent)] shadow-sm" : "text-[var(--cc-secondary)]"}`}
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
