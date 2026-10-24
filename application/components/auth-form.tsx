"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { clearOfflineData } from "@/lib/offline-client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { InstallAppButton } from "@/components/install-app-button";
import {
  forgotPasswordAction,
  loginAction,
  resendConfirmationAction,
  signUpAction,
  updatePasswordAction,
  type AuthState,
} from "@/app/auth/actions";

type Mode = "login" | "sign-up" | "forgot-password" | "resend-confirmation" | "update-password";

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

export function AuthForm({ mode, clearOfflineOnLoad = false }: { mode: Mode; clearOfflineOnLoad?: boolean }) {
  useEffect(() => {
    if (mode === "login" && clearOfflineOnLoad) {
      void clearOfflineData();
    }
  }, [mode, clearOfflineOnLoad]);

  const action =
    mode === "login"
      ? loginAction
      : mode === "sign-up"
        ? signUpAction
        : mode === "forgot-password"
          ? forgotPasswordAction
          : mode === "resend-confirmation"
            ? resendConfirmationAction
            : updatePasswordAction;

  const [state, formAction] = useActionState(action, initialState);

  const title =
    mode === "login"
      ? "Entrar"
      : mode === "sign-up"
        ? "Criar conta"
        : mode === "forgot-password"
          ? "Recuperar acesso"
          : mode === "resend-confirmation"
            ? "Reenviar confirmação"
            : "Definir nova palavra-passe";

  const button =
    mode === "login"
      ? "Entrar"
      : mode === "sign-up"
        ? "Criar conta"
        : mode === "forgot-password"
          ? "Enviar instruções"
          : mode === "resend-confirmation"
            ? "Reenviar confirmação"
            : "Actualizar palavra-passe";

  return (
    <div className="relative w-full max-w-md rounded-[28px] border border-[color-mix(in_srgb,var(--cc-border)_82%,white)] bg-white/88 p-7 shadow-[0_24px_70px_rgba(7,63,54,0.10)] backdrop-blur-xl sm:p-9">
      <div className="absolute right-5 top-5"><LanguageSwitcher compact /></div>
      <div className="mb-8 pt-8">
        <div className="mb-7 flex justify-center">
          <Image
            src="/brand/pcc-logo-transparent.svg"
            alt="Project Command Center"
            width={550}
            height={182}
            className="h-auto w-full max-w-[320px]"
            priority
          />
        </div>
        <div className="mb-5 flex justify-center">
          <InstallAppButton />
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
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{state.error}</p>
            {mode === "login" && (
              <div className="flex flex-wrap gap-3">
                <Link className="font-semibold text-[var(--cc-accent)] hover:underline" href="/auth/resend-confirmation">
                  Reenviar confirmação
                </Link>
                <Link className="font-semibold text-[var(--cc-accent)] hover:underline" href="/auth/forgot-password">
                  Recuperar palavra-passe
                </Link>
              </div>
            )}
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
            <p>
              <Link
                className="font-medium text-[var(--cc-accent)] hover:underline"
                href="/auth/resend-confirmation"
              >
                Reenviar confirmação
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
