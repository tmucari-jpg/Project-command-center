import type { Metadata } from "next";
import { gie360ClientLogin } from "./actions";

export const metadata:Metadata={
  title:"Entrar no GIE360°",
  description:"Acesso reservado ao acompanhamento dos seus projectos GIE360°.",
};

export default async function GieLogin({searchParams}:{searchParams:Promise<{next?:string,error?:string}>}) {
  const query=await searchParams;
  const next=query.next ?? "/gie-client";
  const safeNext=/^\/gie-client\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(next)
    ? next : "/gie-client";

  return <main className="flex min-h-screen items-center justify-center bg-[#f8f6f0] px-5 py-10 text-[#17322d]">
    <div className="w-full max-w-md rounded-2xl border border-[#d0ded6] bg-white p-7 shadow-sm">
      <p className="text-sm font-semibold tracking-wider text-[#956e2b]">GIE360°</p>
      <h1 className="mt-2 text-2xl font-bold">Acompanhar o meu projecto</h1>
      <p className="mt-2 text-sm text-[#63716c]">Entre com a conta autorizada para consultar apenas as informações do seu projecto.</p>
      {query.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
        {query.error==="access" ? "Esta conta não tem acesso a projectos GIE360°. Contacte o gestor do projecto." :
          "Não foi possível iniciar sessão. Verifique os dados de acesso."}
      </p>}
      <form action={gie360ClientLogin} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={safeNext}/>
        <label className="block text-sm font-semibold">Email
          <input name="email" type="email" required autoComplete="email" maxLength={254}
            className="mt-1 block w-full rounded-lg border border-[#d0ded6] p-3 font-normal"/>
        </label>
        <label className="block text-sm font-semibold">Palavra-passe
          <input name="password" type="password" required minLength={8} autoComplete="current-password"
            className="mt-1 block w-full rounded-lg border border-[#d0ded6] p-3 font-normal"/>
        </label>
        <button type="submit" className="w-full rounded-lg bg-[#073f36] p-3 font-semibold text-white">
          Entrar no acompanhamento
        </button>
      </form>
    </div>
  </main>;
}
