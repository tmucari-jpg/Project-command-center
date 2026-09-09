import { AuthForm } from "@/components/auth-form";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <AuthForm mode="update-password" />
    </main>
  );
}
