"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Smartphone } from "lucide-react";
import { getOfflineMeta, getOfflineSnapshot, setOfflineMeta } from "@/lib/offline-client";
import { secondaryButtonClass } from "@/components/ui";

type CheckState = "passed" | "failed" | "info";
type CheckResult = { key: string; label: string; state: CheckState; detail: string };

function iconFor(state: CheckState) {
  if (state === "passed") return <CheckCircle2 size={16} className="text-[var(--cc-success)]" aria-hidden="true" />;
  if (state === "failed") return <CircleAlert size={16} className="text-[var(--cc-danger)]" aria-hidden="true" />;
  return <Smartphone size={16} className="text-[var(--cc-secondary)]" aria-hidden="true" />;
}

async function fetchOk(path: string) {
  const response = await fetch(path, { cache: "no-store" });
  return response.ok;
}

export function OperationalReadinessCheck() {
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [recorded, setRecorded] = useState(false);

  async function run() {
    setRunning(true);
    setRecorded(false);
    const results: CheckResult[] = [];

    results.push({
      key: "secure_context",
      label: "Contexto HTTPS seguro",
      state: window.isSecureContext ? "passed" : "failed",
      detail: window.isSecureContext ? "Activo neste dispositivo." : "O PCC não está num contexto seguro.",
    });

    let serviceWorkerReady = false;
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        serviceWorkerReady = Boolean(registration.active);
      } catch {
        serviceWorkerReady = false;
      }
    }
    results.push({
      key: "service_worker",
      label: "Service Worker",
      state: serviceWorkerReady ? "passed" : "failed",
      detail: serviceWorkerReady ? "Registado e activo." : "Não foi possível confirmar um Service Worker activo.",
    });

    const [manifestOk, offlineShellOk] = await Promise.all([
      fetchOk("/manifest.webmanifest").catch(() => false),
      fetchOk("/offline.html").catch(() => false),
    ]);
    results.push({
      key: "manifest",
      label: "Manifesto PWA",
      state: manifestOk ? "passed" : "failed",
      detail: manifestOk ? "Manifesto acessível." : "Manifesto não respondeu correctamente.",
    });
    results.push({
      key: "offline_shell",
      label: "Shell offline",
      state: offlineShellOk ? "passed" : "failed",
      detail: offlineShellOk ? "Página offline acessível." : "Página offline indisponível.",
    });

    let indexedDbOk = false;
    try {
      const probe = `pcc-${Date.now()}-${crypto.randomUUID()}`;
      await setOfflineMeta("operationalReadinessProbe", probe);
      indexedDbOk = (await getOfflineMeta<string>("operationalReadinessProbe")) === probe;
    } catch {
      indexedDbOk = false;
    }
    results.push({
      key: "indexeddb",
      label: "Persistência local",
      state: indexedDbOk ? "passed" : "failed",
      detail: indexedDbOk ? "Escrita e leitura em IndexedDB confirmadas." : "Falha no armazenamento local.",
    });

    let snapshotReady = false;
    try {
      snapshotReady = Boolean(await getOfflineSnapshot());
    } catch {
      snapshotReady = false;
    }
    results.push({
      key: "snapshot",
      label: "Snapshot de trabalho",
      state: snapshotReady ? "passed" : "info",
      detail: snapshotReady
        ? "Existe um snapshot local pronto para utilização offline."
        : "Ainda não existe snapshot local neste dispositivo; abrir o PCC online permite prepará-lo.",
    });

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    results.push({
      key: "install_mode",
      label: "Modo de instalação",
      state: standalone ? "passed" : "info",
      detail: standalone ? "PCC aberto como aplicação instalada." : "PCC aberto no navegador.",
    });
    results.push({
      key: "network",
      label: "Ligação actual",
      state: "info",
      detail: navigator.onLine ? "Dispositivo online." : "Dispositivo offline.",
    });

    setChecks(results);
    const critical = results.filter((item) =>
      ["secure_context", "service_worker", "manifest", "offline_shell", "indexeddb"].includes(item.key),
    );
    const localReady = critical.every((item) => item.state === "passed");

    try {
      const response = await fetch("/api/operational-readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: localReady ? "partial" : "failed",
          details: {
            test: "device_offline_readiness",
            end_to_end_offline_sync_validated: false,
            snapshot_ready: snapshotReady,
            standalone,
            online: navigator.onLine,
            checks: results,
          },
        }),
      });
      setRecorded(response.ok);
    } catch {
      setRecorded(false);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h3 className="font-semibold text-[var(--cc-foreground)]">Teste de prontidão neste dispositivo</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Verifica HTTPS, Service Worker, manifesto, shell offline e persistência local. Este teste comprova prontidão técnica do dispositivo, mas não substitui o ciclo físico completo: trabalhar sem rede, fechar/reabrir e sincronizar depois.
          </p>
        </div>
        <button className={secondaryButtonClass} type="button" onClick={run} disabled={running}>
          {running ? <LoaderCircle size={16} className="mr-2 animate-spin" /> : null}
          Testar este dispositivo
        </button>
      </div>
      {checks.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {checks.map((item) => (
            <div key={item.key} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
              <div className="flex items-center gap-2">
                {iconFor(item.state)}
                <p className="text-sm font-semibold text-[var(--cc-foreground)]">{item.label}</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--cc-secondary)]">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
      {checks.length > 0 && (
        <p className="mt-3 text-xs text-[var(--cc-secondary)]">
          {recorded ? "Resultado registado no ledger de validação operacional." : "O resultado local foi mostrado, mas não foi possível confirmar o registo no ledger."}
        </p>
      )}
    </div>
  );
}
