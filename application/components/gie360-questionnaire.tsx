"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { saveGIE360Assessment } from "@/app/gie360/actions";
import { GIE360_QUESTIONS, gie360InformationGaps, type GIE360Answers } from "@/lib/gie360";

type Props = { id: string; initialAnswers: GIE360Answers; initialRevision: number; initialStatus: string };
export function GIE360Questionnaire({ id, initialAnswers, initialRevision, initialStatus }: Props) {
  const [answers, setAnswers] = useState<GIE360Answers>(initialAnswers);
  const [revision, setRevision] = useState(initialRevision);
  const [status, setStatus] = useState(initialStatus);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const requestKey = useRef<string | null>(null);
  const gaps = gie360InformationGaps(answers);
  async function save(submit: boolean, advance = false) {
    if (busy || (submit && !confirmed)) return;
    setBusy(true); setError(""); setMessage("");
    if (submit && !requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const result = await saveGIE360Assessment({ assessmentId: id, revision, answers, submit, requestKey: submit ? requestKey.current : null });
      if (result.error) { setError(result.error); return; }
      setRevision(result.revision!); setStatus(result.status!);
      setMessage(submit ? "Submissão confirmada pelo servidor. O gestor foi notificado; as respostas aguardam validação." : "Progresso guardado no servidor. Pode sair e retomar nesta conta.");
      if (advance) setStep(Math.min(step + 1, 2));
    } catch { setError("A ligação falhou. As respostas continuam neste ecrã; tente guardar novamente."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-[#073F36]/15 bg-white p-6 shadow-sm" aria-labelledby={`questionnaire-${id}`}>
    <div className="mb-5 flex items-center gap-4 border-b pb-4"><Image src="/gie360/logo.png" alt="GIE360°" width={110} height={58} /><p className="text-sm text-[#073f36]">Diagnóstico empresarial personalizado</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id={`questionnaire-${id}`} className="text-xl font-semibold text-[#073F36]">Diagnóstico empresarial</h2><span className="rounded-full bg-[#F8F6F0] px-3 py-1 text-sm">{status === "submitted" ? "Submetido · validação pendente" : `Rascunho · revisão ${revision}`}</span></div>
    <p className="mt-3 rounded-xl bg-[#f8f6f0] p-4 text-sm text-[#244a42]">Este questionário ajuda a identificar as necessidades da sua empresa e os módulos relevantes para o diagnóstico inicial. Pode guardar as respostas e continuar mais tarde. Ao submeter, a informação regressa automaticamente ao mesmo caso no PCC para revisão. Nenhum dado é considerado validado automaticamente.</p>
    {status === "submitted" ? <div className="mt-6 space-y-4"><p role="status" className="rounded-lg bg-green-50 p-4 text-green-900">Respostas recebidas e ligadas ao mesmo caso de diagnóstico. O envio não comprova os factos declarados.</p>
      {GIE360_QUESTIONS.map((question) => <div key={question.key}><h3 className="font-medium">{question.label}</h3><p className="whitespace-pre-wrap text-sm text-slate-600">{answers[question.key]?.trim() || "Informação em falta"}</p></div>)}
    </div> : <>
      <ol className="my-6 flex flex-wrap gap-2" aria-label="Etapas">{["Empresa", "Situação", "Objectivos"].map((label, index) => <li key={label}><button type="button" onClick={() => setStep(index)} disabled={busy} aria-current={step === index ? "step" : undefined} className={`rounded-lg px-4 py-2 ${step === index ? "bg-[#073F36] text-white" : "bg-[#F8F6F0]"}`}>{index + 1}. {label}</button></li>)}</ol>
      <div className="grid gap-5 md:grid-cols-2">{GIE360_QUESTIONS.filter((question) => question.step === step).map((question) => <label key={question.key} className="block text-sm font-medium">{question.label}<textarea disabled={busy} rows={3} maxLength={2000} value={answers[question.key] ?? ""} onChange={(event) => { setAnswers({ ...answers, [question.key]: event.target.value }); setMessage(""); }} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /><span className="text-xs font-normal text-slate-500">Aceita «Não sei» e «Não disponível».</span></label>)}</div>
      {step === 2 && <label className="mt-6 flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} className="mt-1" />Confirmo o envio destas respostas ao gestor para análise e validação. Compreendo que informação em falta exige seguimento.</label>}
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => save(false)} className="rounded-lg border border-[#073F36] px-4 py-3 disabled:opacity-50">{busy ? "A guardar…" : "Guardar progresso"}</button>
        {step < 2 ? <button type="button" disabled={busy} onClick={() => save(false, true)} className="rounded-lg bg-[#073F36] px-4 py-3 text-white disabled:opacity-50">Guardar e continuar</button> : <button type="button" disabled={busy || !confirmed} onClick={() => save(true)} className="rounded-lg bg-[#073F36] px-4 py-3 text-white disabled:opacity-50">Enviar respostas ao PCC</button>}
      </div>
    </>}
    {message && <p role="status" className="mt-4 text-green-900">{message}</p>}{error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
    {gaps.length > 0 && <aside className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="font-medium">Informação a completar ou confirmar: {gaps.length}</h3><ul className="mt-2 list-inside list-disc text-sm">{gaps.map((gap) => <li key={gap.key}>{gap.label}</li>)}</ul></aside>}
  </section>;
}
