"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitGie360Diagnostic } from "@/app/client-diagnostic/[token]/actions";
import styles from "./client-diagnostic-gie360.module.css";

const areas = [
  ["Vendas e clientes", "sales"],
  ["Cobranças e tesouraria", "cash"],
  ["Custos e operações", "cost"],
  ["Gestão e indicadores", "metrics"],
] as const;

function Choices({ name, choices, type = "radio", required = false }: {
  name: string;
  choices: readonly string[];
  type?: "radio" | "checkbox";
  required?: boolean;
}) {
  return <div className={styles.choices}>{choices.map((label) =>
    <label key={label}><input name={name} type={type} value={label} required={required} /> {label}</label>
  )}</div>;
}

function SendButton() {
  const { pending } = useFormStatus();
  return <button className={styles.button} type="submit" disabled={pending}>
    {pending ? "A enviar respostas…" : "Enviar respostas ao PCC"}
  </button>;
}

export function ClientDiagnosticGie360Questionnaire({ token, clientName, clientOrganization, publicContext, expiresAt, error }: {
  token: string;
  clientName?: string | null;
  clientOrganization?: string | null;
  publicContext?: string | null;
  expiresAt: string;
  error?: string | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState("");
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);
  const areasSelected = useMemo(() => Object.fromEntries(areas.map(([label, id]) => [id, selected.includes(label)])), [selected]);
  function previewAnswers() {
    if (!formElement) return;
    const form = new FormData(formElement);
    const obj: Record<string, string | string[]> = {};
    form.forEach((v, k) => {
      if (k === "token" || k === "consent") return;
      const val = String(v);
      if (k in obj) obj[k] = ([] as string[]).concat(obj[k] as string | string[], val);
      else obj[k] = val;
    });
    obj.necessidades = selected;
    setPreview(JSON.stringify(obj, null, 2));
  }
  return <main className={styles.page}>
    <div className={styles.main}>
      <header className={styles.header}>
        <div className={styles.brand}>PCC <b>× GIE360°</b></div>
        <div className={styles.subtitle}>Da estratégia à execução · Gestão Inteligente Empresarial</div>
        <span className={styles.flag}>QUESTIONÁRIO EMPRESARIAL PERSONALIZADO</span>
      </header>
      <section className={styles.hero}>
        <p className={styles.step}>Questionário empresarial personalizado · versão aprovada</p>
        <h1>Compreender a empresa antes de recomendar soluções</h1>
        <p>Este questionário permite identificar necessidades, obstáculos e prioridades da empresa, para orientar um diagnóstico GIE360° e definir apenas os módulos relevantes. Não é uma auditoria nem uma aprovação automática.</p>
        <div className={styles.note}><strong>O que acontece às respostas?</strong> Serão associadas ao diagnóstico inicial do caso PCC, revistas pelo gestor e utilizadas para preparar o âmbito de trabalho. Nenhuma informação será divulgada sem aprovação.</div>
        <p className={styles.muted}>Destinatário: {clientOrganization || clientName || "Empresa convidada"} · Validade até {new Date(expiresAt).toLocaleDateString("pt-PT")}</p>
        {publicContext && <p>{publicContext}</p>}
      </section>
      <nav className={styles.flow} aria-label="Etapas do questionário">
        <span className={styles.active}>1 · Empresa</span><span>2 · Necessidades</span>
        <span>3 · Dados e objectivos</span><span>4 · Revisão e envio</span>
      </nav>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <form action={submitGie360Diagnostic} ref={setFormElement}>
        <input type="hidden" name="token" value={token} />
        <section className={styles.panel}>
          <p className={styles.step}>Etapa 1 / 4 · Identificação</p>
          <h2>Quem responde e em nome de que empresa?</h2>
          <div className={styles.question}>
            <label className={styles.title} htmlFor="gie-org">Empresa <span className={styles.required}>*</span></label>
            <input id="gie-org" className={styles.field} name="empresa" type="text" defaultValue={clientOrganization ?? ""} placeholder="Nome da empresa" required maxLength={300} />
          </div>
          <div className={styles.question}>
            <label className={styles.title} htmlFor="gie-person">Nome do respondente <span className={styles.required}>*</span></label>
            <input id="gie-person" className={styles.field} name="respondent_name" type="text" defaultValue={clientName ?? ""} placeholder="Nome de quem responde" required maxLength={200} />
          </div>
          <div className={styles.question}>
            <label className={styles.title} htmlFor="gie-email">Email de contacto <span className={styles.required}>*</span></label>
            <input id="gie-email" className={styles.field} name="email" type="email" placeholder="nome@empresa.com" required maxLength={320} />
          </div>
          <div className={styles.question}>
            <span className={styles.title}>Sector principal <span className={styles.required}>*</span></span>
            <p className={styles.why}>Objectivo: contextualizar as perguntas seguintes.</p>
            <Choices name="sector" choices={["Comércio","Serviços","Indústria","Outro"]} required />
          </div>
        </section>
        <section className={styles.panel}>
          <p className={styles.step}>Etapa 2 / 4 · Diagnóstico adaptativo</p>
          <h2>Em que áreas a empresa precisa de apoio?</h2>
          <p className={styles.muted}>Pode seleccionar várias opções. As perguntas seguintes são apresentadas em função do que escolher.</p>
          <div className={styles.question}>
            <div className={styles.choices}>{areas.map(([label]) =>
              <label key={label}><input type="checkbox" name="necessidades" value={label} checked={selected.includes(label)}
                onChange={(e) => setSelected(prev => e.target.checked ? [...prev,label] : prev.filter(x=>x!==label))} /> {label}</label>
            )}</div>
          </div>
          {areasSelected.sales && <div className={styles.question}>
            <span className={styles.title}>Como acompanha propostas e oportunidades?</span>
            <p className={styles.why}>Objectivo: identificar necessidades de CRM e pipeline comercial.</p>
            <Choices name="crm" choices={["CRM","Excel","Manual","Sem controlo"]} />
          </div>}
          {areasSelected.cash && <div className={styles.question}>
            <span className={styles.title}>Existem atrasos de cobrança?</span>
            <p className={styles.why}>Objectivo: determinar se é necessário avaliar o ciclo de recebimentos.</p>
            <Choices name="cobrancas" choices={["Frequentemente","Às vezes","Não","Não sei"]} />
          </div>}
          {areasSelected.cost && <div className={styles.question}>
            <span className={styles.title}>A empresa conhece os custos por actividade?</span>
            <p className={styles.why}>Objectivo: avaliar a necessidade de controlo de custos.</p>
            <Choices name="custos" choices={["Sim","Parcialmente","Não"]} />
          </div>}
          {areasSelected.metrics && <div className={styles.question}>
            <span className={styles.title}>Os indicadores são revistos regularmente?</span>
            <p className={styles.why}>Objectivo: identificar necessidades de acompanhamento e reporting.</p>
            <Choices name="indicadores" choices={["Mensalmente","Ocasionalmente","Não"]} />
          </div>}
        </section>
        <section className={styles.panel}>
          <p className={styles.step}>Etapa 3 / 4 · Dados e objectivos</p>
          <h2>Que informação existe e que resultado se pretende alcançar?</h2>
          <div className={styles.question}>
            <span className={styles.title}>Que dados a empresa consegue disponibilizar?</span>
            <p className={styles.why}>Escolha múltipla · não é necessário enviar ficheiros nesta etapa.</p>
            <Choices name="dados" type="checkbox" choices={["Vendas","Clientes","Custos","Tesouraria","Não disponíveis"]} />
          </div>
          <div className={styles.question}>
            <label className={styles.title} htmlFor="gie-goal">Qual é o resultado prioritário?</label>
            <p className={styles.why}>Resposta aberta · objectivo: estabelecer o critério de sucesso real.</p>
            <textarea id="gie-goal" className={styles.field} name="objectivo" maxLength={6000} placeholder="Descreva o resultado pretendido, sem inventar valores ou metas..." />
          </div>
          <div className={styles.question}>
            <label className={styles.title} htmlFor="gie-urgency">Horizonte desejado</label>
            <select id="gie-urgency" name="prazo" className={styles.field}>
              {["Por definir","Até 30 dias","1 a 3 meses","3 a 6 meses","Mais de 6 meses"].map(x=><option key={x}>{x}</option>)}
            </select>
          </div>
        </section>
        <section className={styles.panel}>
          <p className={styles.step}>Etapa 4 / 4 · Verificar antes de enviar</p>
          <h2>Rever as respostas</h2>
          <div className={styles.review}>
            <p><strong>Critérios de qualidade</strong></p>
            <p>Identificação do respondente · necessidades seleccionadas · questões condicionais adequadas · dados por confirmar · finalidade claramente explicada.</p>
            <label><input name="consent" type="checkbox" value="confirmed" required /> Confirmo que estas respostas podem ser enviadas para análise no PCC/GIE360°.</label>
          </div>
          <div className={styles.buttons}>
            <button type="button" onClick={previewAnswers} className={styles.button + " " + styles.secondary}>Pré-visualizar respostas</button>
            <SendButton />
          </div>
          {preview && <pre className={styles.out} aria-label="Pré-visualização das respostas">{preview}</pre>}
        </section>
      </form>
      <footer className={styles.footer}>PCC × GIE360° · Questionário empresarial · Outubro de 2026</footer>
    </div>
  </main>;
}
