const tone: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 ring-blue-600/20",
  on_track: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-slate-50 text-slate-700 ring-slate-600/20",
  draft: "bg-slate-50 text-slate-700 ring-slate-600/20",
  idea: "bg-violet-50 text-violet-700 ring-violet-600/20",
  captured: "bg-violet-50 text-violet-700 ring-violet-600/20",
  at_risk: "bg-amber-50 text-amber-800 ring-amber-600/20",
  delayed: "bg-red-50 text-red-700 ring-red-600/20",
  blocked: "bg-red-50 text-red-700 ring-red-600/20",
  open: "bg-red-50 text-red-700 ring-red-600/20",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        tone[status] ?? "bg-slate-50 text-slate-700 ring-slate-600/20"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
