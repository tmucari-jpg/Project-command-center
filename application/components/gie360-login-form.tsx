"use client";
import { useActionState } from "react";
import { gie360Login } from "@/app/gie360/actions";
export function GIE360LoginForm() {
  const [state, action, pending] = useActionState(gie360Login, {});
  return <form action={action} className="space-y-5">
    <label className="block">Email<input className="mt-2 w-full rounded-lg border p-3" name="email" type="email" autoComplete="username" required /></label>
    <label className="block">Palavra-passe<input className="mt-2 w-full rounded-lg border p-3" name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
    {state.error && <p role="alert" className="text-red-800">{state.error}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-[#073F36] px-4 py-3 text-white disabled:opacity-60">{pending ? "A verificar acesso…" : "Entrar no GIE360°"}</button>
  </form>;
}
