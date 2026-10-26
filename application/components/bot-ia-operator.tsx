"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { applyBotIARun, persistLocalBotIARun, prepareBotIARun } from "@/app/(protected)/bot-ia/actions";
import { botIAOperationLabel, type BotIAOperation } from "@/lib/bot-ia";
import { BROWSER_LOCAL_MODEL_ID, generateBrowserLocalBotIAPlan } from "@/lib/browser-local-ai";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";

type ProjectOption = {
  id: string;
  title: string;
};

type BlockerOption = {
  id: string;
  project_id: string | null;
  title: string;
  status: string;
};

type PreparedRun = {
  runId: string;
  provider: string;
  intent: "question" | "command" | "mixed";
  response: string;
  summary: string;
  diagnosis: string;
  operations: BotIAOperation[];
};

export function BotIAOperator({
  projects,
  blockers,
}: {
  projects: ProjectOption[];
  blockers: BlockerOption[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [blockerId, setBlockerId] = useState("");
  const [objective, setObjective] = useState("");
  const [prepared, setPrepared] = useState<PreparedRun | null>(null);
  const [applied, setApplied] = useState<Array<{ operation: string; entity?: string; id?: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [erro¶»§q«^