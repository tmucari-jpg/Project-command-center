"use client";
import Image from "next/image";
import { useState, type FormEvent, type ReactNode } from "react";
import { submitClientDiagnostic } from "@/app/client-diagnostic/[token]/actions";

const areas = [
  { name: "Vendas e clientes", key: "sales", question: "Como acompanha propostas e oportunidades?", options: ["CRM", "Excel", "Registo manual", "Sem controlo definido"] },
  { name: "Cobranças e tesouraria", key: "cash", question: "Existem atrasos de cobrança?", options: ["Frequentemente", "Às vezes", "Não", "Não sei"] },
  { name: "Custos e operações", key: "cost", question: "A empresa conhece os custos por actividade?", options: ["Sim", "Parcialmente", "Não"] },
  { name: "Gestão e indicadores", key: "metrics", question: "Os indicadores são revistos regularmente?", options: ["Mensalmente", "Ocasionalmente", "Não"] },
];
const styles = {
  panel: "rounded-[18px] border border-[#e0e7e1] bg-white px-5 py-6 sm:px-8",
  title: "mb-2 text-lg font-semibold text-[#073f36]",
  label: "mb-2 block text-sm font-semibold text-[#17322d]",
  field: "mt-2 w-full rounded-lg border border-[#bfcfc5] bg-white px-3 py-2.5 text-[#17322d]",
  choice: "flex cursor-pointer items-center gap-2 rounded-lg border border-[#d1ded7] bg-white px-3 py-2.5 text-sm has-[:checked]:border-[#073f36] has-[:checked]:bg-[#e9f2ed]",
};
const fieldNames: Record<string,string> = { respondent_name:"Nome",respondent_email:"Email",respondent_type:"Tipo de cliente",organization:"Empresa",respondent_role:"Função",request_nature:"Percurso",context:"Situação e necessidades",focus:"Diagnóstico específico",desired_result:"Objectivo prioritário",conditions:"Dados disponíveis",deadline_urgency:"Horizonte",success_criteria:"Critério de sucesso" };
const Choice=({name,values,multiple=false}:{name:string;values:string[];multiple?:boolean})=><div className="flex flex-wrap gap-2">{values.map(value=><label key={value} className={styles.choice}><input type={multiple?"checkbox":"radio"} name={name} value={value} className="accent-[#073f36]"/>{value}</label>)}</div>;
const Panel=({step,title,children}:{step:number;title:string;children:ReactNode})=><section className={styles.panel}><p className="mb-2 text-xs font-bold uppercase tracking-[.13em] text-[#146453]">Etapa {step} / 4</p><h2 className={styles.title}>{title}</h2>{children}</section>;
export function ClientDiagnosticQuestionnaire({token,clientName,clientOrganization,publicContext,questionnaireVersion,expiresAt}:{token:string;clientName?:string|null;clientOrganization?:string|null;publicContext?:string|null;questionnaireVersion?:string|null;expiresAt:string}) {
  const gie = questionnaireVersion === "executive-gie360-v1";
  const [selected,setSelected] = useState<string[]>([]);
  const [preview,setPreview] = useState<Array<[string,string]>|null>(null);
  const [approved,setApproved] = useState(false);
  const [purpose,setPurpose] = useState("problem");
  const [stage,setStage] = useState(1);
  function invalidate(){setPreview(null);setApproved(false);}
  function toggle(name:string){setSelected(old=>old.includes(name)?old.filter(v=>v!==name):[...old,name]);invalidate();}
  function submit(e:FormEvent<HTMLFormElement>){if(approved&&preview)return;e.preventDefault();const fd=new FormData(e.currentTarget);const entries:Array<[string,string]>=[];for(const key of ["respondent_name","respondent_email","respondent_type","organization","respondent_role","request_nature","context","focus","desired_result","conditions","deadline_urgency","success_criteria"]){const vals=fd.getAll(key).map(String).map(v=>v.trim()).filter(Boolean);if(vals.length)entries.push([fieldNames[key]??key,vals.join("; ")]);}setPreview(entries);setApproved(false);setStage(4);}
  return <main className="min-h-screen bg-[#f8f6f0] px-4 py-8 text-[#17322d]"><div className="mx-auto max-w-[850px]">
    <header className="overflow-hidden rounded-t-[18px] bg-[#073f36] px-6 py-7 text-white sm:px-8">
      <div className="flex flex-wrap items-center gap-4">
        <Image src="/brand/pcc-logo-transparent.svg" alt="Project Command Center" width={190} height={68} className="max-h-20 w-auto max-w-44" priority/>
        {gie && <><span className="text-xl font-bold text-[#c99439]">×</span><Image src="/brand/gie360/logo.png" alt="GIE360°" width={125} height={70} className="max-h-20 w-auto max-w-32"/></>}
      </div>
      <p className="mt-3 text-sm text-white/80">{gie?"Da estratégia à execução · Gestão Inteligente Empresarial":"PCC · Da estratégia à execução"}</p>
    </header>
    <div className="rounded-b-[18px] border border-[#e0e7e1] bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.13em] text-[#146453]">Questionário personalizado</p>
      <h1 className="mt-2 text-2xl font-bold text-[#073f36]">{gie?"Compreender a empresa antes de recomendar soluções":"Compreender a necessidade antes de propor soluções"}</h1>
      <p className="mt-3 text-sm leading-6">{gie?"Identificamos necessidades e prioridades para orientar o diagnóstico GIE360° e seleccionar apenas os módulos relevantes.":"Identificamos o contexto, a prioridade e os resultados pretendidos para preparar o projecto PCC."}</p>
      <p className="mt-3 border-l-4 border-[#c99439] bg-[#f8f5ec] px-4 py-3 text-sm">As respostas serão associadas ao caso PCC, analisadas internamente e não serão partilhadas sem aprovação.</p>
      <p className="mt-3 text-xs text-[#63716c]">Destinatário: {clientOrganization||clientName||"Por identificar"} · Link válido até {new Date(expiresAt).toLocaleDateString("pt-PT")}</p>
      {publicContext&&<p className="mt-3 whitespace-pre-wrap text-sm">{publicContext}</p>}
    </div>
    <nav aria-label="Etapas do questionário" className="my-5 flex flex-wrap gap-2">{["Empresa","Necessidades","Dados e objectivos","Revisão e envio"].map((n,i)=><span key={n} className={`rounded-full border px-3 py-2 text-xs font-semibold ${stage===i+1?"bg-[#073f36] text-white":"border-[#d0ded6] bg-white"}`}>{i+1} · {n}</span>)}</nav>
    <form action={submitClientDiagnostic} onSubmit={submit} onChange={event => { if ((event.target as HTMLInputElement).type !== "checkbox" || (event.target as HTMLInputElement).name !== "") invalidate(); }} className="space-y-5">
      <input type="hidden" name="token" value={token}/><input type="hidden" name="reviewed" value={approved?"yes":"no"}/>
      <input type="hidden" name="respondent_type" value={gie?"organization":"individual"}/><input type="hidden" name="request_nature" value={gie?"organization_solution":purpose}/>
      <Panel step={1} title={gie?"Quem responde e em nome de que empresa?":"Quem responde ao questionário?"}>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={styles.label}>Nome do respondente *<input name="respondent_name" required className={styles.field} placeholder="Nome completo"/></label>
          <label className={styles.label}>Email de contacto *<input name="respondent_email" type="email" required className={styles.field} placeholder="nome@empresa.com"/></label>
          {gie&&<label className={styles.label}>Empresa *<input name="organization" required defaultValue={clientOrganization??""} className={styles.field} placeholder="Nome da empresa"/></label>}
          {gie&&<label className={styles.label}>Função <input name="respondent_role" className={styles.field} placeholder="Cargo ou responsabilidade"/></label>}
        </div>
        {gie&&<div className="mt-3"><p className={styles.label}>Sector principal</p><Choice name="conditions" values={["Comércio","Serviços","Indústria","Outro"]}/></div>}
      </Panel>
      <Panel step={2} title={gie?"Em que áreas a empresa precisa de apoio?":"Qual é a necessidade principal?"}>
        {gie?<><p className="mb-3 text-sm text-[#63716c]">Seleccione uma ou mais áreas.</p><div className="flex flex-wrap gap-2">{areas.map(a=><label key={a.key} className={styles.choice}><input type="checkbox" checked={selected.includes(a.name)} onChange={()=>toggle(a.name)} className="accent-[#073f36]"/>{a.name}</label>)}</div>
          {areas.filter(a=>selected.includes(a.name)).map(a=><div key={a.key} className="mt-5"><p className={styles.label}>{a.question}</p><Choice name={"focus_"+a.key} values={a.options}/></div>)}
          <input type="hidden" name="context" value={selected.length?selected.join("; "):"Diagnóstico inicial empresarial"}/>
        </>:<><p className="mb-3 text-sm text-[#63716c]">Escolha o objectivo que melhor corresponde ao seu pedido.</p><div onChange={e=>setPurpose((e.target as HTMLInputElement).value)}><div className="flex flex-wrap gap-2">{[["problem","Resolver um problema"],["improve_existing","Melhorar o que existe"],["idea","Avaliar uma ideia"],["active_project","Desenvolver um projecto"],["commercial_growth","Aumentar vendas"],["investment_discovery","Explorar investimentos"]].map(([v,t])=><label key={v} className={styles.choice}><input type="radio" name="purpose_selection" value={v} defaultChecked={v==="problem"}/>{t}</label>)}</div></div><label className={styles.label+" mt-4"}>Descreva brevemente a situação *<textarea className={styles.field} name="context" minLength={3} required placeholder="O que está a acontecer e que apoio procura?"/></label></>}
      </Panel>
      <Panel step={3} title="Que informação existe e que resultado se pretende alcançar?">
        <p className={styles.label}>Que dados estão disponíveis?</p><Choice name="conditions" multiple values={gie?["Vendas","Clientes","Custos","Tesouraria","Não disponíveis"]:["Informação existente","Orçamento definido","Equipa disponível","Por definir"]}/>
        <label className={styles.label+" mt-5"}>Qual é o resultado prioritário? *<textarea name="desired_result" className={styles.field} required minLength={3} placeholder="Resultado a alcançar"/></label>
        <label className={styles.label+" mt-5"}>Horizonte desejado<select name="deadline_urgency" className={styles.field}>{["Por definir","Até 30 dias","1 a 3 meses","3 a 6 meses","Mais de 6 meses"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className={styles.label+" mt-5"}>Como saberemos que houve sucesso?<textarea name="success_criteria" className={styles.field} placeholder="Indicadores ou resultados, se conhecidos"/></label>
      </Panel>
      <Panel step={4} title="Rever as respostas antes de enviar">
        {preview?<><p className="mb-3 text-sm">Confira o conteúdo que será recebido pelo PCC.</p><dl className="space-y-3 rounded-xl bg-[#eef5f1] p-4">{preview.map(([k,v],i)=><div key={i} className="border-b border-[#cfdfd5] pb-2"><dt className="text-xs font-semibold text-[#073f36]">{k}</dt><dd className="whitespace-pre-wrap text-sm">{v}</dd></div>)}</dl><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} className="mt-1 accent-[#073f36]"/>Confirmo que revi as respostas e autorizo a submissão para análise no PCC.</label></>:<p className="text-sm text-[#63716c]">Pré-visualize e confirme as respostas antes da submissão.</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button type="submit" className="rounded-lg bg-[#073f36] px-5 py-3 font-semibold text-white">{preview?(approved?"Confirmar e enviar ao PCC":"Pré-visualizar respostas"):"Pré-visualizar respostas"}</button>{preview&&<button type="button" className="rounded-lg border border-[#073f36] px-5 py-3 text-[#073f36]" onClick={()=>{setPreview(null);setApproved(false)}}>Editar respostas</button>}</div>
      </Panel>
    </form>
    <footer className="mt-6 text-center text-xs text-[#63716c]">{gie?"PCC × GIE360°":"PCC"} · Outubro de 2026 · Tratamento sujeito a validação interna</footer>
  </div></main>;
}
