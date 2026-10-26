"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  actionSchema,
  automationJobSchema,
  automationWorkflowSchema,
  blockerSchema,
  deliverableSchema,
  evidenceSchema,
  executionArenaTrialSchema,
  factoryIntakeSchema,
  factoryLibraryItemSchema,
  factoryValidationSchema,
  factoryReportSchema,
  factoryDecisionSchema,
  investmentDiscoveryDecisionSchema,
  ideaSchema,
  metricSchema,
  objectiveSchema,
  orchestratorRouteSchema,
  projectSchema,
  projectMemorySchema,
  decisionSchema,
  commercialProfileSchema,
  commercialLeadSchema,
  competitiveIntelligenceSchema,
  financialEntrySchema,
  commitmentBaselineSchema,
  changeRequestSchema,
  subscriptionFunnelMetricSchema,
  agentRunSchema,
  intelligenceSignalSchema,
  zodMessage,
} from "@/lib/validation";
import { ENTITY_PATHS, STATUS_OPTIONS, type MutableEntity } from "@/lib/constants";
import { requireAdmin, requireUser } from "@/lib/auth";
import { selectExecutionRoute } from "@/lib/orchestrator";
import { createN8nCallback, dispatchToN8n } from "@/lib/n8n";
import { automationCodeFromName } from "@/lib/automation";
import { executionArenaDefaults } from "@/lib/execution-arena";
import { buildStrategyExecutionPlan } from "@/lib/project-plan";
import { validateAIProviderHealth } from "@/lib/ai-provider-health";
import { classifyAIProviderHealth } from "@/lib/ai-provider-state";
import { hasBlockingGovernanceRisk } from "@/li¶»§q«^