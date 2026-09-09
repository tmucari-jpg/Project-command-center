"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  forgotPasswordAction,
  loginAction,
  signUpAction,
  updatePasswordAction,
  type AuthState,
} from "@/app/auth/actions";

type Mode = "login" | "sign-up" | "forgot-password" | "update-password";

const initialState: AuthState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      type="submit"
      disabled={pending}
    >
      {pending ? "A processar..." : label}
    </button>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const action =
    mode === "login"
      ? loginAction
      : mode === "sign-up"
        ? signUpAction
        : mode === "forgot-password"
          ? forgotPasswordAction
          : updatePasswordAction;

  const [state, formAction] = useActionState(action, initialState);

  const title =
    mode === "login"
      ? "Entrar"
      : mode === "sign-up"
        ? "Criar conta"
        : mode === "forgot-password"
          ? "Recuperar acesso"
          : "Definir nova palavra-passe";

  const button =
    mode === "login"
      ? "Entrar"
      : mode === "sign-up"
        ? "Criar conta"
        : mode === "forgot-password"
          ? "Enviar instruções"
          : "Actualizar palavra-passe";

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-7">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Project Command Center
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      </div>

      <form action={formAction} className="space-y-4">
        {mode === "sign-up" && (
          <label className="block text-sm font-medium text-slate-700">
            Nome completo
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none ring-blue-500 transition focus:ring-2"
              name="fullName"
              type="text"
              autoComplete="name"
              maxLength={120}
              required
            />
          </label>
        )}

        {mode !== "update-password" && (
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none ring-blue-500 transition focus:ring-2"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
        )}

        {(mode === "login" || mode === "sign-up" || mode === "update-password") && (
          <label className="block text-sm font-medium text-slate-700">
            Palavra-passe
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none ring-blue-500 transition focus:ring-2"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        )}

        {state.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {state.success}
          </div>
        )}

        <SubmitButton label={button} />
      </form>

      <div className="mt-6 space-y-2 text-sm text-slate-600">
        {mode === "login" && (
          <>
            <p>
              Ainda não tem conta?{" "}
              <Link className="font-medium text-blue-700 hover:underline" href="/auth/sign-up">
                Criar conta
              </Link>
            </p>
            <p>
              <Link
                className="font-medium text-blue-700 hover:underline"
                href="/auth/forgot-password"
              >
                Esqueci a palavra-passe
              </Link>
            </p>
          </>
        )}
        {mode !== "login" && mode !== "update-password" && (
          <p>
            <Link className="font-medium text-blue-700 hover:underline" href="/auth/login">
              Voltar ao login
            </Link>
          </p>
        )}
        {mode === "update-password" && state.success && (
          <p>
            <Link className="font-medium text-blue-700 hover:underline" href="/dashboard">
              Ir para o dashboard
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
