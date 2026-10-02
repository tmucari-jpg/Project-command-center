import { KeyRound, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function SecurityPage() {
  const { supabase, user } = await requireUser();

  const [
    { data: roles, error: rolesError },
    { data: vaultItems, error: vaultError },
    { data: controls, error: controlsError },
    { data: events, error: eventsError },
  ] = await Promise.all([
    supabase.from("user_roles").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("vault_items").select("id,category,service,username_hint,secret_reference,url,storage_mode,status,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30),
    supabase.from("security_controls").select("*").eq("user_id", user.id).order("control_key"),
    supabase.from("security_events").select("id,event_type,severity,description,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const error = rolesError?.message ?? vaultError?.message ?? controlsError?.message ?? eventsError?.message;

  return (
    <>
      <PageHeader
        eyebrow="Fase 6"
        title="Segurança e escala"
        description="RBAC, Vault metadata, security controls e eventos de segurança sem expor secrets."
      />

      {error && <Card className="mb-6 p-5 text-sm text-red-700">{error}</Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Roles</p><p className="mt-1 text-2xl font-semibold">{roles?.length ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Vault items</p><p className="mt-1 text-2xl font-semibold">{vaultItems?.length ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Security controls</p><p className="mt-1 text-2xl font-semibold">{controls?.length ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Security events</p><p className="mt-1 text-2xl font-semibold">{events?.length ?? 0}</p></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><Users size={18} /> RBAC</h2>
          </div>
          <div className="p-5">
            {!roles?.length ? <EmptyState>Sem roles explícitos registados.</EmptyState> : (
              <div className="space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-950">{role.role}</p>
                    <p className="mt-1 text-xs text-slate-500">{role.scope_type}{role.project_id ? " · projecto específico" : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><KeyRound size={18} /> Vault metadata</h2>
          </div>
          <div className="p-5">
            {!vaultItems?.length ? <EmptyState>Sem referências de Vault registadas.</EmptyState> : (
              <div className="space-y-3">
                {vaultItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-950">{item.service}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.category} · {item.storage_mode}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{item.status}</span>
                    </div>
                    {item.username_hint && <p className="mt-2 text-xs text-slate-500">Utilizador: {item.username_hint}</p>}
                    {item.secret_reference && <p className="mt-1 text-xs text-slate-500">Secret ref: {item.secret_reference}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><ShieldCheck size={18} /> Security controls</h2>
          </div>
          <div className="p-5">
            {!controls?.length ? <EmptyState>Sem controlos registados.</EmptyState> : (
              <div className="space-y-3">
                {controls.map((control) => (
                  <div key={control.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-950">{control.control_key}</p>
                      <p className="mt-1 text-xs text-slate-500">{control.last_checked_at ? formatDateTime(control.last_checked_at) : "Ainda não verificado"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${control.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                      {control.enabled ? "activo" : "inactivo"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><LockKeyhole size={18} /> Eventos recentes</h2>
          </div>
          <div className="p-5">
            {!events?.length ? <EmptyState>Sem eventos de segurança recentes.</EmptyState> : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-950">{event.event_type}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{event.severity}</span>
                    </div>
                    {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <p className="text-sm leading-6 text-slate-600">
          O Vault aqui guarda apenas metadata e referências. Passwords, API keys, tokens e private keys não devem ser guardados em plaintext no Command Center.
        </p>
      </Card>
    </>
  );
}
