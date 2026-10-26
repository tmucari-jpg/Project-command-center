import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(["partial", "failed"]),
  details: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Resultado de validação inválido." }, { status: 400 });

  const { error } = await supabase.from("operational_validation_runs").insert({
    user_id: user.id,
    scope: "offline_device",
    status: body.data.status,
    release_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    details: body.data.details,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
