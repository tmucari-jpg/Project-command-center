"use client";

import { deleteRecord } from "@/app/(protected)/mutations";

export function DeleteForm({ table, id }: { table: string; id: string }) {
  return (
    <form
      action={deleteRecord}
      onSubmit={(event) => {
        if (!window.confirm("Eliminar este registo? Esta operação não pode ser desfeita.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        Eliminar
      </button>
    </form>
  );
}
