export function FlashMessage({
  error,
  created,
  message = "Registo criado com sucesso.",
}: {
  error?: string;
  created?: string;
  message?: string;
}) {
  if (!error && !created) return null;

  return error ? (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  ) : (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {message}
    </div>
  );
}
