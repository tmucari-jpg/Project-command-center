export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="h-10 w-72 rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
