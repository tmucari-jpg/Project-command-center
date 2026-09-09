"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(8).max(128);

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export type AuthState = {
  error?: string;
  success?: string;
};

export async function loginAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = z
    .object({
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

  if (!parsed.success) {
    return { error: "Introduza um email válido e uma palavra-passe com pelo menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
  return {};
}

export async function signUpAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2).max(120),
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

  if (!parsed.success) {
    return { error: "Revise o nome, email e palavra-passe." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    success:
      "Conta criada. Verifique o seu email para confirmar o registo antes de iniciar sessão.",
  };
}

export async function forgotPasswordAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Introduza um email válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Se existir uma conta associada a este email, receberá as instruções de recuperação.",
  };
}

export async function updatePasswordAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { error: "A palavra-passe deve ter pelo menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });

  if (error) {
    return { error: error.message };
  }

  return { success: "Palavra-passe actualizada. Pode continuar para o dashboard." };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
