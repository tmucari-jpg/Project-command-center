import Link from "next/link";
import {
  BarChart3,
  Blocks,
  CheckSquare2,
  FolderKanban,
  Gauge,
  Lightbulb,
  ListTodo,
  PackageCheck,
  Search,
  ShieldCheck,
  Target,
  TimerReset,
} from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/objectives", label: "Objectivos", icon: Target },
  { href: "/projects", label: "Projectos", icon: FolderKanban },
  { href: "/deliverables", label: "Entregáveis", icon: PackageCheck },
  { href: "/actions", label: "Acções", icon: CheckSquare2 },
  { href: "/focus", label: "Modo foco", icon: TimerReset },
  { href: "/blockers", label: "Bloqueios", icon: Blocks },
  { href: "/evidence", label: "Evidências", icon: ShieldCheck },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
  { href: "/ideas", label: "Ideias", icon: Lightbulb },
  { href: "/search", label: "Pesquisa externa", icon: Search },
  { href: "/activity", label: "Actividade", icon: ListTodo },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto p-5">
        <Link href="/dashboard" className="block px-2 py-3">
          <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Project
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-950">
            Command Center
          </span>
        </Link>
        <nav className="mt-5 space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <div className="overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
      <nav className="flex min-w-max gap-1">
        {navigation.slice(0, 10).map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
