"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  botIAOperationLabel,
  botIAPlanSchema,
  validateBotIAOperation,
  type BotIAOperation,
} from "@/lib/bot-ia";
import { generateBotIAPlanWithFallback, type BotIAProviderProfile } from "@/lib/bot-ia-provider";
import { validateAIProviderHealth } from "@/lib/ai-provider-health";
import { classifyAIProviderHealth } from "@/lib/ai-provider-state";

const prepareSchema = z.object({
  projectId: z.string().uuid(),
  blockerId: z.string().uuid().optional(),
  objective: z.string().trim().min(3).max(4000),
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha desconhecida.";
}

function sanitizeOperations(
  operations: BotIAOperation[],
  validBlockerIds: Set<string>,
  selectedBlockerId?: string,
) {
  return operations.filter((operation) => {
    if (!validateBotIAOperation(operation)) return false;

    if (operation.kind === "update_blocker" || operation.kind === "resolve_blocker") {
      if (!operation.target_id || !validBlockerIds.has(operation.target_id)) return false;
      if (selectedBlockerId && operation.target_id !== selectedBlockerId) return false;
    }

    if (operation.kind === "update_blocker" && operation.status === "resolved") return false;

    return true;
  });
}

async function resolveBotIAProviders(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  userI¶»§q«^