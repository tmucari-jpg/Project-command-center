"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { applyBotIARun, prepareBotIARun } from "@/app/(protected)/bot-ia/actions";
import { botIAOperationLabel, type BotIAOperation } from "@/lib/bot-ia";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";

type ProjectOption = {
  id: string;
  title: string;
};

type BlockerOption = {
  id: string;
  project_id: string | null;
  title: string;
  status: string;
};

type PreparedRun = {
  runId: string;
  provider: string;
  summary: string;
  diagnosis: string;
  operations: BotIAOperation[];
};

export function BotIAOperator({
  projects,
  blockers,
}: {
  projects: ProjectOption[];
  blockers: BlockerOption[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [blockerId, setBlockerId] = useState("");
  const [objective, setObjective] = useState("");
  const [prepared, setPrepared] = useState<PreparedRun | null>(null);
  const [applied, setApplied] = useState<Array<{ operation: string; entity?: string; id?: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectBlockers = useMemo(
    () =>
      blockers.filter(
        (blocker) =>
          blocker.project_id === projectId &&
          !["resolved", "ignored"].includes(blocker.status),
      ),
    [blockers, projectId],
  );

  async function prepare() {
    if (!projectId || objective.trim().length < 3) return;

    setBusy(true);
    setError(null);
    setPrepared(null);
    setApplied([]);

    try {
      const result = await prepareBotIARun({
        projectId,
        blockerId: blockerId || undefined,
        objective,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPrepared({
        runId: result.runId,
        provider: result.provider,
        summary: result.summary,
        diagnosis: result.diagnosis,
        operations: result.operations,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Falha ao preparar o BotIA.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!prepared) return;

    setApplying(true);
    setError(null);

    try {
      const result = await applyBotIARun(prepared.runId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setApplied(result.applied);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Falha ao aplicar alterações BotIA.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-[var(--cc-radius-md)] bg-[color-mix(in_srgb,var(--cc-accent)_10%,white)] p-2 text-[var(--cc-accent)]">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--cc-foreground)]">Operador interno do projecto</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--cc-secondary)]">
              O BotIA trabalha sobre os dados reais do PCC. Prepara alterações operacionais e só as grava depois da sua confirmação.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-[var(--cc-foreground)]">
            <span>Projecto</span>
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setBlockerId("");
                setPrepared(null);
                setApplied([]);
              }}
              className="min-h-11 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 text-sm outline-none"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-[var(--cc-foreground)]">
            <span>Bloqueio específico, se aplicável</span>
            <select
              value={blockerId}
              onChange={(event) => setBlockerId(event.target.value)}
              className="min-h-11 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 text-sm outline-none"
            >
              <option value="">Analisar o projecto em geral</option>
              {projectBlockers.map((blocker) => (
                <option key={blocker.id} value={blocker.id}>{blocker.title}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block space-y-2 text-sm font-medium text-[var(--cc-foreground)]">
          <span>O que deve ser melhorado ou resolvido?</span>
          <textarea
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            placeholder="Ex.: analisar o bloqueio actual, definir a solução possível e criar as acções necessárias para o fechar."
            className="min-h-28 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-3 text-sm leading-6 text-[var(--cc-foreground)] outline-none"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={prepare}
            disabled={busy || !projectId || objective.trim().length < 3}
            className={primaryButtonClass}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={16} /> A analisar...</span>
            ) : (
              "Analisar e preparar alterações"
            )}
          </button>

          {(prepared || applied.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setPrepared(null);
                setApplied([]);
                setError(null);
              }}
              className={secondaryButtonClass}
            >
              Nova análise
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--cc-radius-md)] border border-[color-mix(in_srgb,var(--cc-danger)_30%,var(--cc-border))] bg-[var(--cc-danger-soft)] p-4 text-sm text-[var(--cc-danger)]">
          {error}
        </div>
      )}

      {prepared && (
        <div className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface)]">
          <div className="border-b border-[var(--cc-border)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Diagnóstico BotIA</p>
                <h3 className="mt-1 font-semibold text-[var(--cc-foreground)]">{prepared.summary}</h3>
              </div>
              <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                {prepared.provider}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-secondary)]">
              {prepared.diagnosis}
            </p>
          </div>

          <div className="p-5">
            <h4 className="font-semibold text-[var(--cc-foreground)]">Alterações preparadas</h4>

            {!prepared.operations.length ? (
              <div className="mt-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--cc-foreground)]">
                  <TriangleAlert size={16} /> Nenhuma alteração segura foi preparada.
                </p>
                <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                  O diagnóstico fica registado, mas o PCC não altera dados sem base factual suficiente.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {prepared.operations.map((operation, index) => (
                  <div
                    key={`${operation.kind}-${operation.target_id ?? index}`}
                    className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--cc-foreground)]">
                      {index + 1}. {botIAOperationLabel(operation)}
                    </p>
                    {operation.description && (
                      <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">{operation.description}</p>
                    )}
                    {operation.solution && (
                      <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                        Solução: {operation.solution}
                      </p>
                    )}
                    {operation.value && (
                      <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">{operation.value}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {prepared.operations.length > 0 && applied.length === 0 && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={apply}
                  disabled={applying}
                  className={primaryButtonClass}
                >
                  {applying ? (
                    <span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={16} /> A aplicar...</span>
                  ) : (
                    "Confirmar e aplicar no PCC"
                  )}
                </button>
                <p className="mt-2 text-xs leading-5 text-[var(--cc-secondary)]">
                  Este botão confirma apenas alterações operacionais permitidas. Preços, Gates, permissões, ownership e eliminações ficam fora do BotIA.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {applied.length > 0 && (
        <div className="rounded-[var(--cc-radius-lg)] border border-[color-mix(in_srgb,var(--cc-success)_32%,var(--cc-border))] bg-[var(--cc-success-soft)] p-5">
          <p className="inline-flex items-center gap-2 font-semibold text-[var(--cc-success)]">
            <CheckCircle2 size={18} /> Alterações gravadas no PCC
          </p>
          <p className="mt-2 text-sm text-[var(--cc-secondary)]">
            {applied.length} operação(ões) foram persistidas e registadas na execução BotIA.
          </p>
        </div>
      )}
    </div>
  );
}
