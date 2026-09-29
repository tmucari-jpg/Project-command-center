// The workforce only proposes changes. Each role works from the same bounded,
// user-owned snapshot; the approval action re-reads the target before writing.
export type ProjectSnapshot = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  next_action: string | null;
  updated_at: string;
};

export type ActionSnapshot = {
  id: string;
  project_id: string | null;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  is_next_action: boolean;
  updated_at: string;
};

export type BlockerSnapshot = {
  id: string;
  project_id: string | null;
  action_id: string | null;
  title: string;
  status: string;
};

export type Proposal = {
  kind: "set_next_action" | "create_action";
  target_id: string;
  title: string;
  reason: string;
  agent: "prioridades" | "planeamento";
};

export type Finding = { agent: "planeamento" | "prioridades" | "bloqueios"; text: string };

const liveProject = new Set(["planning", "active", "at_risk"]);
const liveAction = new Set(["pending", "in_progress"]);
const priorityScore: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export function analyseWorkforce(
  projects: ProjectSnapshot[],
  actions: ActionSnapshot[],
  blockers: BlockerSnapshot[],
  today: string,
): { findings: Finding[]; proposals: Proposal[] } {
  const findings: Finding[] = [];
  const proposals: Proposal[] = [];
  const activeProjects = projects.filter((project) => liveProject.has(project.status));
  const blockedActions = new Set(blockers.filter((blocker) => blocker.status !== "resolved" && blocker.status !== "ignored").map((blocker) => blocker.action_id));

  // Planning agent: turn an explicit project next step into a proposed action.
  for (const project of activeProjects) {
    const open = actions.filter((action) => action.project_id === project.id && liveAction.has(action.status));
    if (open.length === 0 && project.next_action?.trim()) {
      const title = project.next_action.trim().slice(0, 180);
      proposals.push({ kind: "create_action", target_id: project.id, title, agent: "planeamento", reason: `O projecto «${project.title}» não tem acções abertas; este é o próximo passo registado no projecto.` });
    } else if (open.length === 0) {
      findings.push({ agent: "planeamento", text: `«${project.title}» não tem acções abertas nem próximo passo definido. Defina um passo concreto no projecto.` });
    }
    if (project.due_date && project.due_date < today) {
      findings.push({ agent: "planeamento", text: `O prazo de «${project.title}» passou em ${project.due_date}. Reveja o plano e a data.` });
    }
  }

  // Coverage agent: inspect every unfinished project, including ideas and paused work.
  for (const project of projects.filter((item) => !["completed", "cancelled"].includes(item.status))) {
    const related = actions.filter((action) => action.project_id === project.id);
    const open = related.filter((action) => liveAction.has(action.status));
    if (!liveProject.has(project.status)) {
      findings.push({ agent: "planeamento", text: `«${project.title}» está em ${project.status}. Registe uma decisão para o retomar ou manter em espera.` });
    }
    if (open.length === 0 && !activeProjects.some((item) => item.id === project.id)) {
      findings.push({ agent: "planeamento", text: `«${project.title}» não tem acções abertas. Defina o próximo passo antes de o deixar parado.` });
    }
    const last = [project.updated_at, ...related.map((action) => action.updated_at)].filter(Boolean).sort().at(-1);
    if (last && Date.parse(`${today}T00:00:00Z`) - Date.parse(last) > 14 * 86400000) {
      findings.push({ agent: "planeamento", text: `«${project.title}» não apresenta movimento há mais de 14 dias. Reveja o estado e o próximo passo.` });
    }
  }

  // Priority agent: score only executable actions and explain the chosen item.
  const candidates = actions.filter((action) => {
    const project = action.project_id ? projects.find((item) => item.id === action.project_id) : null;
    return liveAction.has(action.status) && !blockedActions.has(action.id) &&
      (!project || liveProject.has(project.status));
  });
  const score = (action: ActionSnapshot) => {
    const days = action.due_at ? Math.floor((Date.parse(action.due_at) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
    return (priorityScore[action.priority] ?? 1) * 10 + (days === null ? 0 : days < 0 ? 30 : days === 0 ? 25 : days <= 3 ? 15 : days <= 7 ? 8 : 0);
  };
  candidates.sort((a, b) => score(b) - score(a) || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") || a.id.localeCompare(b.id));
  const best = candidates[0];
  if (best && !best.is_next_action) {
    proposals.push({ kind: "set_next_action", target_id: best.id, title: best.title, agent: "prioridades", reason: `Prioridade ${best.priority}${best.due_at ? `; prazo ${best.due_at.slice(0, 10)}` : "; sem prazo"}. É a acção executável mais urgente pelos dados disponíveis.` });
  } else if (!best) {
    findings.push({ agent: "prioridades", text: "Não há acções executáveis para recomendar neste momento." });
  }

  // Blocker agent: surface obstacles without claiming they were resolved.
  const openBlockers = blockers.filter((blocker) => !["resolved", "ignored"].includes(blocker.status));
  for (const blocker of openBlockers.slice(0, 5)) {
    const project = projects.find((item) => item.id === blocker.project_id);
    findings.push({ agent: "bloqueios", text: `«${blocker.title}» continua ${blocker.status}${project ? ` no projecto «${project.title}»` : ""}. Registe a solução ou um passo de desbloqueio.` });
  }
  if (openBlockers.length > 5) findings.push({ agent: "bloqueios", text: `Existem mais ${openBlockers.length - 5} bloqueios activos na página Bloqueios.` });

  return { findings, proposals };
}
