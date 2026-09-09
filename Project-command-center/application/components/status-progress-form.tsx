import { updateStatusProgress } from "@/app/(protected)/mutations";
import { STATUS_OPTIONS, type MutableEntity } from "@/lib/constants";

export function StatusProgressForm({
  entity,
  id,
  status,
  progress,
}: {
  entity: MutableEntity;
  id: string;
  status: string;
  progress?: number | null;
}) {
  const hasProgress = ["objectives", "projects", "deliverables"].includes(entity);

  return (
    <form action={updateStatusProgress} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
      >
        {STATUS_OPTIONS[entity].map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {hasProgress && (
        <input
          name="progress"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue={progress ?? 0}
          className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          aria-label="Progresso"
        />
      )}
      <button
        type="submit"
        className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
      >
        Guardar
      </button>
    </form>
  );
}
