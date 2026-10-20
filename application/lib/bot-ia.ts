import { z } from "zod";

export const BOT_IA_OPERATION_KINDS = [
  "create_action",
  "set_project_next_action",
  "append_project_note",
  "create_blocker",
  "update_blocker",
  "resolve_blocker",
] as const;

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);

export const botIAOperationSchema = z.object({
  kind: z.enum(BOT_IA_OPERATION_KINDS),
  target_id: optionalUuid,
  title: optionalText(180),
  description: optionalText(4000),
  priority: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["low", "medium", "high", "critical"]).optional(),
  ),
  completion_criteria: optionalText(4000),
  impact: optionalText(1000),
  solution: optionalText(4000),
  value: optionalText(6000),
  status: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["investigating", "waiting", "resolved"]).optional(),
  ),
});

export const botIAPlanSchema = z.object({
  summary: z.string().trim().min(2).max(4000),
  diagnosis: z.string().trim().min(2).max(6000),
  operations: z.array(botIAOperationSchema).max(12),
});

export type BotIAOperation = z.infer<typeof botIAOperationSchema>;
export type BotIAPlan = z.infer<typeof botIAPlanSchema>;

function extractJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function parseBotIAPlan(text: string): BotIAPlan | null {
  try {
    const parsed = botIAPlanSchema.safeParse(JSON.parse(extractJson(text)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function validateBotIAOperation(operation: BotIAOperation) {
  switch (operation.kind) {
    case "create_action":
      return Boolean(operation.title);
    case "set_project_next_action":
      return Boolean(operation.value);
    case "append_project_note":
      return Boolean(operation.value);
    case "create_blocker":
      return Boolean(operation.title);
    case "update_blocker":
      return Boolean(operation.target_id && (operation.solution || operation.status));
    case "resolve_blocker":
      return Boolean(operation.target_id && operation.solution);
    default:
      return false;
  }
}

export function botIAOperationLabel(operation: BotIAOperation) {
  switch (operation.kind) {
    case "create_action":
      return `Criar acção: ${operation.title ?? "sem título"}`;
    case "set_project_next_action":
      return "Actualizar próxima acção do projecto";
    case "append_project_note":
      return "Acrescentar nota operacional ao projecto";
    case "create_blocker":
      return `Registar bloqueio: ${operation.title ?? "sem título"}`;
    case "update_blocker":
      return "Actualizar tratamento do bloqueio";
    case "resolve_blocker":
      return "Resolver bloqueio";
    default:
      return operation.kind;
  }
}
