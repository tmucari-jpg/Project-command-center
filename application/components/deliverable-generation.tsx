"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
export function DeliverableGeneration({id,type,hasArtifact}:{id:string;type:string;hasArtifact:boolean}) {
  const router=useRouter();
  const [kind,setKind]=useState(type==="spreadsheet"?"spreadsheet":type==="presentation"?"presentation":"document");
  const [content,setContent]=useState("");const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const [gaps,setGaps]=useState<Array<{field:string;cause:string;nextAction:string}>>([]);
  const [download,setDownload]=useState("");
  const [requestId,setRequestId]=useState<string|null>(null);
  async function generate(){
    if(busy)return;setBusy(true);setMessage("");
    const operation=requestId??crypto.randomUUID();setRequestId(operation);
    try{
      const response=await fetch(`/api/deliverables/${id}/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,reviewedContent:content,requestId:operation,confirmNewVersion:confirmed})});
      const data=await response.json();
      if(!response.ok){setMessage(`${data.error??"Geração indisponível"} ${data.message??""}`);return;}
      setGaps(data.informationGaps??[]);setDownload(data.download);setRequestId(null);setMessage(data.message??"Versão já arquivada.");router.refresh();
    }catch{setMessage("Falha de ligação. O pedido mantém a mesma referência para evitar duplicação.");}
    finally{setBusy(false);}
  }
  return <details className="mt-4 rounded-xl border border-[var(--cc-border)] p-3">
    <summary className="cursor-pointer font-semibold text-[var(--cc-accent)]">Gerar e arquivar rascunho</summary>
    <div className="mt-3 space-y-3">
      <p className="text-xs text-[var(--cc-secondary)]">Usa os dados reais do projecto. Informação ausente fica explícita. A geração não aprova QA nem aceitação.</p>
      {!["spreadsheet","presentation"].includes(type)&&<label className="block text-sm">Documento
        <select value={kind} disabled={busy||Boolean(download)} onChange={e=>{setKind(e.target.value);setRequestId(null);}} className="mt-1 w-full rounded border p-2">
          {Object.entries({document:"Documento",master_mind:"Master Mind",master_plan:"Master Plan",commercial_guide:"Guia Comercial",diagnosis:"Diagnóstico",decision:"Dossier de decisão",progress:"Progresso",closure:"Fecho"}).map(([value,label])=><option value={value} key={value}>{label}</option>)}
        </select></label>}
      <label className="block text-sm">Conteúdo revisto a incluir (opcional)
        <textarea className="mt-1 min-h-24 w-full rounded border p-2" maxLength={50000} value={content} disabled={busy||Boolean(download)} onChange={e=>{setContent(e.target.value);setRequestId(null);}} />
      </label>
      {hasArtifact&&<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />Confirmo uma nova versão e a actualização do vínculo; a versão anterior permanece no histórico.</label>}
      {!download&&<button type="button" disabled={busy||(hasArtifact&&!confirmed)} className={primaryButtonClass} onClick={generate}>{busy?"A gerar e arquivar...":"Gerar ficheiros reais"}</button>}
      {message&&requestId&&!download&&<button type="button" disabled={busy} className={secondaryButtonClass} onClick={()=>{setRequestId(null);setMessage("Nova referência preparada. O registo incompleto anterior será preservado.");}}>Preparar nova versão após falha</button>}
      <p role="status" className="text-sm">{message}</p>
      {gaps.length>0&&<div role="alert"><p className="font-semibold">Informação em falta — requer seguimento</p><ul>{gaps.map(g=><li key={g.field}>{g.cause} {g.nextAction}</li>)}</ul></div>}
      {download&&<div className="flex flex-wrap gap-2"><a className={secondaryButtonClass} href={download}>Descarregar</a>{!["spreadsheet","presentation"].includes(type)&&<a className={secondaryButtonClass} href={`${download}?format=docx`}>Descarregar Word</a>}</div>}
    </div>
  </details>;
}
