import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

type CallbackBody = {
  jobId?: string;
  callbackToken?: string;
  status?: "succeeded" | "failed";
  externalRunId?: string;
  result?: Record<string, unknown>;
  error?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: CallbackBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.jobId || !body.callbackToken || !body.status) {
    return json({ error: "jobId, callbackToken and status are required" }, 400);
  }

  if (!["succeeded", "failed"].includes(body.status)) {
    return json({ error: "Invalid status" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: job, error: readError } = await supabase
    .from("automation_jobs")
    .select("id,status,callback_token_hash")
    .eq("id", body.jobId)
    .maybeSingle();

  if (readError || !job) return json({ error: "Job not found" }, 404);
  if (!job.callback_token_hash) return json({ error: "Callback already consumed or unavailable" }, 409);

  const suppliedHash = await sha256(body.callbackToken);
  if (suppliedHash !== job.callback_token_hash) return json({ error: "Unauthorized" }, 401);

  if (!["dispatching", "running"].includes(job.status)) {
    return json({ error: "Job is not awaiting completion" }, 409);
  }

  const { error: updateError } = await supabase
    .from("automation_jobs")
    .update({
      status: body.status,
      external_run_id: body.externalRunId ?? null,
      result: body.result ?? {},
      last_error: body.status === "failed" ? body.error ?? "n8n execution failed" : null,
      completed_at: new Date().toISOString(),
      callback_token_hash: null,
    })
    .eq("id", body.jobId);

  if (updateError) return json({ error: "Could not update job" }, 500);

  return json({ ok: true, jobId: body.jobId, status: body.status });
});
