const LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",

  draft: "Rascunho",
  active: "Activo",
  on_track: "No prazo",
  at_risk: "Em risco",
  delayed: "Atrasado",
  completed: "Concluído",
  cancelled: "Cancelado",
  idea: "Ideia",
  planning: "Em planeamento",
  on_hold: "Em espera",

  pending: "Pendente",
  blocked: "Bloqueado",
  in_progress: "Em curso",
  open: "Aberto",
  investigating: "Em análise",
  waiting: "Em espera",
  resolved: "Resolvido",
  ignored: "Ignorado",

  captured: "Capturada",
  evaluating: "Em avaliação",
  approved: "Aprovada",
  rejected: "Rejeitada",
  converted_to_project: "Convertida em projecto",
  archived: "Arquivada",

  file: "Ficheiro",
  link: "Ligação",
  document: "Documento",
  screenshot: "Captura de ecrã",
  comment: "Comentário",
  number: "Número",
  result: "Resultado",
  external_reference: "Referência externa",

  execution_ratio: "Taxa de execução",
  outcome_ratio: "Taxa de resultado",
  on_time_completion: "Conclusão no prazo",
  focus_ratio: "Taxa de foco",
  time_efficiency: "Eficiência de tempo",
  project_health: "Saúde do projecto",
  custom: "Personalizada",
};

export function displayLabel(value?: string | null) {
  if (!value) return "—";
  return LABELS[value] ?? value.replaceAll("_", " ");
}
