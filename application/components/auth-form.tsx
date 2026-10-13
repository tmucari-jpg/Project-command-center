"use client";

import Image from "next/image";
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
      className="w-full rounded-[14px] bg-[var(--cc-accent)] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[var(--cc-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="w-full max-w-md rounded-[28px] border border-[color-mix(in_srgb,var(--cc-border)_82%,white)] bg-white/88 p-7 shadow-[0_24px_70px_rgba(7,63,54,0.10)] backdrop-blur-xl sm:p-9">
      <div className="mb-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--cc-gold)_26%,var(--cc-border))] bg-white p-1.5 shadow-sm">
            <Image src="/icons/app-icon.svg" alt="PCC" width={42} height={42} className="rounded-[11px]" priority />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.015em] text-[var(--cc-foreground)]">Project Command Center</p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-gold)]">Da estratégia à execução</p>
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--cc-foreground)]">{title}</h1>
      </div>

      <form action={formAction} className="space-y-4">
        {mode === "sign-up" && (
          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            Nome completo
            <input
              className="mt-1.5 w-full rounded-xl border border-[var(--cc-border)] px-3.5 py-3 outline-none ring-[var(--cc-gold)] transition focus:ring-2"
              name="fullName"
              type="text"
              autoComplete="name"
              maxLength={120}
              required
            />
          </label>
        )}

        {mode !== "update-password" && (
          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            Email
            <input
              className="mt-1.5 w-full rounded-xl border border-[var(--cc-border)] px-3.5 py-3 outline-none ring-[var(--cc-gold)] transition focus:ring-2"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
        )}

        {(mode === "login" || mode === "sign-up" || mode === "update-password") && (
          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            Palavra-passe
            <input
              className="mt-1.5 w-full rounded-xl border border-[var(--cc-border)] px-3.5 py-3 outline-none ring-[var(--cc-gold)] transition focus:ring-2"
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

      <div className="mt-6 space-y-2 text-sm text-[var(--cc-secondary)]">
        {mode === "login" && (
          <>
            <p>
              Ainda não tem conta?{" "}
              <Link className="font-medium text-[var(--cc-accent)] hover:underline" href="/auth/sign-up">
                Criar conta
              </Link>
            </p>
            <p>
              <Link
                className="font-medium text-[var(--cc-accent)] hover:underline"
                href="/auth/forgot-password"
              >
                Esqueci a palavra-passe
              </Link>
            </p>
          </>
        )}
        {mode !== "login" && mode !== "update-password" && (
          <p>
            <Link className="font-medium text-[var(--cc-accent)] hover:underline" href="/auth/login">
              Voltar ao login
            </Link>
          </p>
        )}
        {mode === "update-password" && state.success && (
          <p>
            <Link className="font-medium text-[var(--cc-accent)] hover:underline" href="/dashboard">
              Ir para o dashboard
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
