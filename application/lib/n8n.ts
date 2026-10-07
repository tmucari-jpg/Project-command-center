export type N8nDispatchPayload = {
  jobId: string;
  workflowCode?: string;
  objective: string;
  payload: Record<string, unknown>;
};

export function n8nConfigured() {
  return Boolean(process.env.N8N_WEBHOOK_URL);
}

export async function dispatchToN8n(input: N8nDispatchPayload) {
  const endpoint = process.env.N8N_WEBHOOK_URL;
  if (!endpoint) {
    throw new Error("N8N_WEBHOOK_URL não configurado.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (process.env.N8N_WEBHOOK_TOKEN) {
    headers.authorization = `Bearer ${process.env.N8N_WEBHOOK_TOKEN}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`n8n respondeu HTTP ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ""}`);
  }

  const data = await response.json().catch(() => ({}));
  return {
    externalRunId:
      typeof data?.executionId === "string"
        ? data.executionId
        : typeof data?.id === "string"
          ? data.id
          : undefined,
    response: data as Record<string, unknown>,
  };
}
