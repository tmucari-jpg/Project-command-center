import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export default async function HelpPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        eyebrow="Ajuda"
        title="Manual rápido do Project Command Center"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div id="novo-projecto"><Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Criar um novo projecto</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Não precisa de definir o projecto inteiro. Comece com o problema e o resultado pretendido.
          </p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--cc-foreground)]">
            <p><strong>Nome:</strong> curto e claro. Ex.: “Automatizar propostas comerciais”.</p>
            <p><strong>Problema:</strong> descreva o que hoje demora, custa, falha ou impede um resultado.</p>
            <p><strong>Resultado esperado:</strong> escreva a mudança que pretende observar.</p>
            <p><strong>Tipo:</strong> Comercial quando envolve mercado/clientes; Interno quando melhora operações.</p>
          </div>
          <Link href="/project-factory" className={primaryButtonClass + " mt-5"}>Ir para Novo projecto</Link>
        </Card></div>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Fluxo recomendado</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--cc-foreground)]">
            <p>1. Registe a ideia em <strong>Novo projecto</strong>.</p>
            <p>2. Reveja a preparação do projecto.</p>
            <p>3. Quando aprovado, acompanhe em <strong>Projectos</strong>.</p>
            <p>4. Execute através de <strong>Acções</strong> e <strong>Entregáveis</strong>.</p>
            <p>5. Registe obstáculos em <strong>Bloqueios</strong>.</p>
            <p>6. Use <strong>Evidências</strong> e <strong>Métricas</strong> para provar resultados.</p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Estados e prioridades</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--cc-foreground)]">
            <p><strong>Prioridade alta:</strong> atraso afecta receita, cliente, prazo crítico ou outra dependência importante.</p>
            <p><strong>Prioridade média:</strong> importante, mas pode ser ordenada com o restante trabalho.</p>
            <p><strong>Prioridade baixa:</strong> melhoria útil sem impacto imediato.</p>
            <p><strong>Bloqueio:</strong> use apenas quando algo realmente impede o avanço, não para uma simples recomendação.</p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">O que a automação pode fazer</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            O PCC pode preparar e executar tarefas repetitivas através da área Automações. Acções externas críticas continuam sujeitas a aprovação humana.
          </p>
          <Link href="/automation" className={secondaryButtonClass + " mt-5"}>Ver Automações</Link>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Preenchimento automático</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            O PCC pode preparar automaticamente os campos que consegue inferir a partir do contexto já registado.
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--cc-foreground)]">
            Reveja apenas o que for necessário antes de gravar. Informação que o sistema já conhece não deve ser pedida novamente.
          </p>
        </Card>
      </div>
    </>
  );
}
