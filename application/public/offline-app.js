(() => {
  const DB_NAME="pcc-offline", DB_VERSION=1, META="meta", SNAPSHOT="snapshot", QUEUE="queue";
  const LANG_KEY="pcc-language";
  const sectionsPt=[
    ["dashboard","Painel"],["projects","Projectos"],["actions","Executar"],["objectives","Objectivos"],
    ["deliverables","Entregáveis"],["metrics","Métricas"],["evidence","Evidências"],["commercial","Comercial"],["factory","Factory"],["governance","Governança"]
  ];
  const sectionLabelsEn={dashboard:"Dashboard",projects:"Projects",actions:"Execute",objectives:"Objectives",deliverables:"Deliverables",metrics:"Metrics",evidence:"Evidence",commercial:"Commercial",factory:"Factory",governance:"Governance"};
  const t=(pt,en)=>localStorage.getItem(LANG_KEY)==="en"?en:pt;
  const sections=()=>sectionsPt.map(([key,label])=>[key,localStorage.getItem(LANG_KEY)==="en"?sectionLabelsEn[key]:label]);
  let current="dashboard", query="";
  let snapshot={generatedAt:"",projects:[],objectives:[],deliverables:[],actions:[],blockers:[],metrics:[],evidence:[],ideas:[],factoryCases:[],dependencies:[],risks:[],decisions:[],strategyPlans:[],commercialProfiles:[],financialEntries:[],commercialLeads:[]};
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const fmt=value=>{if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?esc(value):d.toLocaleString("pt-MZ",{dateStyle:"medium",timeStyle:value.includes?.("T")?"short":undefined})};
  const titleOf=row=>row?.title||row?.name||row?.missing_key||row?.decision||"Registo";
  const projectName=id=>snapshot.projects.find(p=>p.id===id)?.title||"Sem projecto";
  const isClosed=status=>["completed","cancelled","resolved","ignored","closed"].includes(String(status||"").toLowerCase());
  const statusClass=status=>{const s=String(status||"").toLowerCase();if(["blocked","open"].includes(s))return"blocked";if(["delayed","overdue"].includes(s))return"overdue";if(["in_progress","investigating"].includes(s))return"progress";if(["completed","resolved","on_track","active"].includes(s))return"success";if(["at_risk","waiting"].includes(s))return"due";return""};
  function openDb(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(META))d.createObjectStore(META);if(!d.objectStoreNames.contains(SNAPSHOT))d.createObjectStore(SNAPSHOT);if(!d.objectStoreNames.contains(QUEUE))d.createObjectStore(QUEUE,{keyPath:"id"})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
  function req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
  async function get(store,key){const d=await openDb(),tx=d.transaction(store,"readonly"),v=await req(tx.objectStore(store).get(key));d.close();return v}
  async function put(store,value,key){const d=await openDb(),tx=d.transaction(store,"readwrite");if(key===undefined){tx.objectStore(store).put(value)}else{tx.objectStore(store).put(value,key)}await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});d.close()}
  async function all(store){const d=await openDb(),tx=d.transaction(store,"readonly"),v=await req(tx.objectStore(store).getAll());d.close();return v}
  async function del(store,key){const d=await openDb(),tx=d.transaction(store,"readwrite");tx.objectStore(store).delete(key);await new Promise(res=>{tx.oncomplete=res});d.close()}
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==="x"?r:(r&3|8);return v.toString(16)});
  function matches(row){if(!query)return true;return JSON.stringify(row).toLowerCase().includes(query.toLowerCase())}
  function tag(status){return `<span class="tag ${statusClass(status)}">${esc(status||"Sem estado")}</span>`}
  function nav(){const box=$("nav");box.innerHTML="";sections().forEach(([key,label])=>{const b=document.createElement("button");b.textContent=label;b.className=key===current?"active":"";b.onclick=()=>{current=key;nav();render()};box.appendChild(b)})}
  function applyLanguage(){
    const en=localStorage.getItem(LANG_KEY)==="en";
    document.documentElement.lang=en?"en":"pt-MZ";
    $("langPt").classList.toggle("active",!en);
    $("langEn").classList.toggle("active",en);
    $("search").placeholder=t("Pesquisar no PCC offline...","Search PCC offline...");
    $("captureButton").textContent=t("Registar trabalho","Record work");
    $("syncButton").textContent=t("Sincronizar","Sync");
    nav();
    render();
  }
  function option(value,label){const o=document.createElement("option");o.value=value;o.textContent=label;return o}
  function options(el,rows,empty){el.innerHTML="";el.append(option("",empty));rows.forEach(r=>el.append(option(r.id,titleOf(r))))}
  function card(label,value,cls=""){return `<div class="card"><p class="small muted">${esc(label)}</p><div class="metric ${cls}">${esc(value)}</div></div>`}
  function item(row,meta=[]){return `<article class="item"><div class="itemtop"><h3>${esc(titleOf(row))}</h3>${tag(row.status||row.governance_gate_status||row.stage)}</div><div class="meta">${meta.filter(Boolean).map(esc).join(" · ")}</div></article>`}
  function renderDashboard(){
    const activeProjects=snapshot.projects.filter(p=>!isClosed(p.status));
    const openActions=snapshot.actions.filter(a=>!isClosed(a.status));
    const now=Date.now();
    const overdue=openActions.filter(a=>a.due_at&&new Date(a.due_at).getTime()<now);
    const blockers=snapshot.blockers.filter(b=>!isClosed(b.status));
    const atRisk=activeProjects.filter(p=>String(p.status)==="at_risk").length;
    const onTrack=Math.max(0,activeProjects.length-atRisk);
    const total=Math.max(1,activeProjects.length);
    const p1=(onTrack/total)*100,p2=((onTrack+atRisk)/total)*100;
    let html=`<div class="grid cards">${card("Projectos activos",activeProjects.length)}${card("Acções em atraso",overdue.length,"")}${card("Bloqueios activos",blockers.length,"")}${card("Por sincronizar","…")}</div>`;
    html+=`<div class="grid two section"><div class="card"><h2>Saúde dos projectos</h2><p class="small muted">Leitura do último snapshot sincronizado.</p><div class="row" style="margin-top:16px"><div class="donut" style="background:conic-gradient(var(--success) 0 ${p1}%,var(--due) ${p1}% ${p2}%,var(--overdue) ${p2}% 100%)"><div class="donutvalue">${activeProjects.length}</div></div><div><p><b>${onTrack}</b> sem alerta explícito</p><p><b>${atRisk}</b> em risco</p><p class="small muted">Atrasos e bloqueios são destacados nas áreas Executar e Projectos.</p></div></div></div>`;
    html+=`<div class="card"><h2>Pressão por projecto</h2><p class="small muted">Acções abertas por projecto, com leitura visual proporcional.</p><div class="list" style="margin-top:14px">`;
    activeProjects.filter(matches).slice(0,12).forEach(p=>{const count=openActions.filter(a=>a.project_id===p.id).length;const max=Math.max(1,...activeProjects.map(x=>openActions.filter(a=>a.project_id===x.id).length));html+=`<div><div class="itemtop"><span>${esc(p.title)}</span><b>${count}</b></div><div class="bar"><span style="width:${Math.max(count?5:0,count/max*100)}%"></span></div></div>`});
    html+=`</div></div></div><p class="small muted section">Snapshot: ${fmt(snapshot.generatedAt)}</p>`;return html
  }
  function renderProjects(){const rows=snapshot.projects.filter(matches);return `<div class="card"><h2>Projectos</h2><p class="small muted">Todos os projectos guardados no último snapshot.</p><div class="list section">${rows.map(p=>item(p,[`Progresso ${p.progress??0}%`,p.due_date?`Prazo ${fmt(p.due_date)}`:"Sem prazo",p.next_action?`Próxima: ${p.next_action}`:""])).join("")||'<div class="empty">Sem projectos.</div>'}</div></div>`}
  function actionButtons(a){if(isClosed(a.status))return"";return `<div class="row" style="margin-top:9px"><button class="button secondary small" data-action="${a.id}" data-status="in_progress">Em curso</button><button class="button secondary small" data-action="${a.id}" data-status="blocked">Bloquear</button><button class="button secondary small" data-action="${a.id}" data-status="completed">Concluir</button></div>`}
  function renderActions(){const now=Date.now();const rows=snapshot.actions.filter(matches);return `<div class="card"><h2>Executar</h2><p class="small muted">Acções, prazos e bloqueios disponíveis offline.</p><div class="list section">${rows.map(a=>{const overdue=a.due_at&&!isClosed(a.status)&&new Date(a.due_at).getTime()<now;const cls=overdue?"overdue":statusClass(a.status);return `<article class="item"><div class="itemtop"><h3>${esc(a.title)}</h3><span class="tag ${cls}">${overdue?"Em atraso":esc(a.status||"Pendente")}</span></div><div class="meta">${esc(projectName(a.project_id))} · ${a.due_at?fmt(a.due_at):"Sem prazo"}</div>${actionButtons(a)}</article>`}).join("")||'<div class="empty">Sem acções.</div>'}</div><h3 class="section">Bloqueios</h3><div class="list">${snapshot.blockers.filter(matches).map(b=>item(b,[projectName(b.project_id),b.impact||"",b.resolution_due_at?fmt(b.resolution_due_at):""])).join("")||'<div class="empty">Sem bloqueios.</div>'}</div></div>`}
  function renderGeneric(title,rows,metaFn){const filtered=rows.filter(matches);return `<div class="card"><h2>${esc(title)}</h2><div class="list section">${filtered.map(r=>item(r,metaFn(r))).join("")||'<div class="empty">Sem registos.</div>'}</div></div>`}

  function renderCommercial(){
    const project=snapshot.projects.find(p=>p.title==="Marketing, Vendas e Lançamento do PCC");
    if(!project)return '<div class="card"><h2>Master Comercial PCC</h2><div class="empty">Projecto comercial ainda não sincronizado.</div></div>';
    const plan=(snapshot.strategyPlans||[]).find(p=>p.project_id===project.id)||{};
    const monetization=plan.monetization||{},marketing=plan.marketing||{},sales=plan.sales||{},execution=plan.execution||{},measurement=plan.measurement||{};
    const packages=Array.isArray(monetization.packages)?monetization.packages:[];
    const costs=(snapshot.financialEntries||[]).filter(x=>x.project_id===project.id&&x.entry_type==="cost");
    const deliverables=(snapshot.deliverables||[]).filter(x=>x.project_id===project.id);
    const actions=(snapshot.actions||[]).filter(x=>x.project_id===project.id&&!isClosed(x.status));
    const leads=(snapshot.commercialLeads||[]).filter(x=>x.project_id===project.id);
    const list=value=>Array.isArray(value)?value:[];
    let html='<div class="card"><h2>Master Comercial PCC</h2><p class="small muted">PCC = consultoria de projectos. Tecnologia e IA apoiam nos bastidores; o cliente recebe consultoria e entregáveis concretos.</p>';
    html+='<div class="grid cards section">'+card("Pacotes",packages.length)+card("Entregáveis",deliverables.length)+card("Acções abertas",actions.length)+card("Leads",leads.length)+'</div></div>';
    html+='<div class="grid two section"><div class="card"><h2>Pacotes e preços</h2><div class="list section">'+packages.map(p=>'<article class="item"><div class="itemtop"><h3>'+esc(p.name||"Pacote")+'</h3><b>'+esc((p.price_mzn_from?"desde ":"")+(p.price_mzn_from||p.price_mzn||"—")+" MZN / "+(p.period||""))+'</b></div><div class="meta">'+esc(p.scope||"")+(p.max_simultaneous_projects?" · até "+esc(p.max_simultaneous_projects)+" projectos em simultâneo":"")+'</div></article>').join("")+'</div></div>';
    html+='<div class="card"><h2>Custos internos</h2><div class="list section">'+costs.slice(0,8).map(x=>'<article class="item"><div class="itemtop"><h3>'+esc(x.description||"Custo")+'</h3><b>'+esc(x.amount||"—")+" "+esc(x.currency||"")+'</b></div><div class="meta">'+esc(x.status||"")+(x.evidence_reference?" · "+esc(x.evidence_reference):"")+'</div></article>').join("")+'</div></div></div>';
    html+='<div class="grid two section"><div class="card"><h2>Marketing e vendas</h2><p class="small muted"><b>Canais:</b> '+esc(list(marketing.channels).join(" · ")||"Em falta")+'</p><p class="small muted"><b>Funil:</b> '+esc(list(sales.funnel).join(" → ")||"Em falta")+'</p><p class="small muted"><b>Prioridades:</b> '+esc(list(marketing.priority_ids).join(" → ")||"Em falta")+'</p></div>';
    html+='<div class="card"><h2>Validação</h2><p class="small muted"><b>Lançamento:</b> '+esc(list(execution.launch_sequence).join(" → ")||"Em falta")+'</p><p class="small muted"><b>KPIs:</b> '+esc(list(measurement.master_kpis).join(" · ")||"Em falta")+'</p><p class="small muted">Validação funcional, operacional e de mercado permanecem separadas.</p></div></div>';
    return html;
  }
  function render(){
    let html="";
    if(current==="dashboard")html=renderDashboard();
    if(current==="projects")html=renderProjects();
    if(current==="actions")html=renderActions();
    if(current==="objectives")html=renderGeneric("Objectivos",snapshot.objectives,r=>[`Progresso ${r.progress??0}%`,r.expected_result||""]);
    if(current==="deliverables")html=renderGeneric("Entregáveis",snapshot.deliverables,r=>[projectName(r.project_id),`Progresso ${r.progress??0}%`,r.due_date?fmt(r.due_date):""]);
    if(current==="metrics")html=renderGeneric("Métricas",snapshot.metrics,r=>[projectName(r.project_id),`Actual: ${r.current_value??"—"} ${r.unit??""}`,`Meta: ${r.target_value??"—"} ${r.unit??""}`]);
    if(current==="evidence")html=renderGeneric("Evidências",snapshot.evidence,r=>[projectName(r.project_id),r.evidence_type||"",r.created_at?fmt(r.created_at):""]);
    if(current==="commercial")html=renderCommercial();
    if(current==="factory")html=renderGeneric("Factory / Avaliações",snapshot.factoryCases,r=>[r.stage||"",r.governance_gate||"",r.project_type||""]);
    if(current==="governance"){
      html=`<div class="grid two">${renderGeneric("Dependências",snapshot.dependencies,r=>[projectName(r.project_id),r.responsible||"",r.missing_key||""])}${renderGeneric("Riscos",snapshot.risks,r=>[projectName(r.project_id),r.severity||r.impact||""])}</div><div class="section">${renderGeneric("Decisões",snapshot.decisions,r=>[projectName(r.project_id),r.decision||"",r.created_at?fmt(r.created_at):""])}</div>`;
    }
    $("content").innerHTML=html;
    document.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",()=>queue("update_action_status",{action_id:btn.dataset.action,status:btn.dataset.status})));
    renderQueue();
  }
  async function queue(type,payload){const item={id:uuid(),type,payload,createdAt:new Date().toISOString(),status:"pending"};await put(QUEUE,item);$("message").textContent="Guardado no dispositivo. Será sincronizado quando a ligação voltar.";$("message").className="small ok";await renderQueue();if(navigator.onLine)sync()}
  async function renderQueue(){const q=await all(QUEUE);$("queueCount").textContent=`${q.length} por sincronizar`;const metric=[...document.querySelectorAll(".metric")].find(el=>el.previousElementSibling?.textContent==="Por sincronizar");if(metric)metric.textContent=q.length}
  async function refreshSnapshot(){const r=await fetch("/api/offline/bootstrap",{credentials:"include",cache:"no-store"});if(!r.ok)return false;snapshot=await r.json();await put(SNAPSHOT,snapshot,"workspace");await put(META,true,"offlineEnabled");return true}
  async function sync(){if(!navigator.onLine)return;const q=await all(QUEUE);if(q.length){const r=await fetch("/api/offline/sync",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({items:q})});if(r.status===401){$("message").textContent="A sessão precisa de ser renovada. Os dados continuam guardados.";return}if(!r.ok){$("message").textContent="Não foi possível sincronizar ainda.";return}const body=await r.json();for(const result of body.results){if(result.ok)await del(QUEUE,result.id);else{const item=q.find(x=>x.id===result.id);if(item)await put(QUEUE,{...item,status:"failed",error:result.error})}}}await refreshSnapshot().catch(()=>false);$("message").textContent="Sincronização concluída.";$("message").className="small ok";render()}
  function fillCapture(){options($("captureProject"),snapshot.projects,"Sem projecto");options($("captureDeliverable"),snapshot.deliverables,"Sem entregável");options($("captureAction"),snapshot.actions.filter(a=>!isClosed(a.status)),"Seleccione uma acção")}
  function captureMode(){const t=$("captureType").value,needsAction=["create_evidence","create_blocker"].includes(t),factory=t==="create_factory_intake";$("actionField").classList.toggle("hidden",!needsAction);$("projectField").classList.toggle("hidden",needsAction||factory);$("deliverableField").classList.toggle("hidden",t!=="create_action");$("problemField").classList.toggle("hidden",!factory);$("expectedField").classList.toggle("hidden",!factory)}
  async function saveCapture(){const type=$("captureType").value,title=$("captureTitle").value.trim(),description=$("captureDescription").value.trim();if(title.length<2){$("message").textContent="Indique um título.";return}let payload={title,description,priority:"medium"};if(type==="create_action"){payload.project_id=$("captureProject").value;payload.deliverable_id=$("captureDeliverable").value}if(type==="create_idea")payload.project_id=$("captureProject").value;if(type==="create_evidence"||type==="create_blocker"){payload.action_id=$("captureAction").value;if(!payload.action_id){$("message").textContent="Seleccione uma acção.";return}}if(type==="create_evidence")payload.evidence_type="comment";if(type==="create_factory_intake"){const problem=$("captureProblem").value.trim();if(problem.length<3){$("message").textContent="Indique o problema ou oportunidade.";return}payload={title,description,problem,expected_value:$("captureExpected").value.trim(),target_user:"",project_type:"commercial",constraints:"",source:"offline_intake"}}await queue(type,payload);$("captureDialog").close();$("captureTitle").value="";$("captureDescription").value="";$("captureProblem").value="";$("captureExpected").value=""}
  async function init(){const enabled=await get(META,"offlineEnabled");$("network").textContent=navigator.onLine?"Online":"Offline";$("network").className="pill "+(navigator.onLine?"online":"offline");if(!enabled){$("locked").classList.remove("hidden");return}$("workspace").classList.remove("hidden");snapshot=(await get(SNAPSHOT,"workspace"))||snapshot;nav();fillCapture();captureMode();render();if(navigator.onLine)sync()}
  $("search").addEventListener("input",e=>{query=e.target.value;render()});$("syncButton").onclick=sync;$("captureButton").onclick=()=>$("captureDialog").showModal();$("closeDialog").onclick=()=>$("captureDialog").close();$("captureType").onchange=captureMode;$("saveCapture").onclick=saveCapture;
  $("langPt").onclick=()=>{localStorage.setItem(LANG_KEY,"pt");applyLanguage()};$("langEn").onclick=()=>{localStorage.setItem(LANG_KEY,"en");applyLanguage()};
  window.addEventListener("online",()=>{$("network").textContent="Online";$("network").className="pill online";sync()});window.addEventListener("offline",()=>{$("network").textContent="Offline";$("network").className="pill offline"});
  init();
})();