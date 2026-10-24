"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const mobile = window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    setIsIOS(ios);
    setIsMobile(mobile);
    setIsStandalone(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (isStandalone) return null;
  if (!isMobile && !installPrompt) return null;

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    setShowHelp(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--cc-accent-strong)]"
      >
        <Download size={16} />
        <span className="hidden sm:inline">Instalar PCC</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      {showHelp && (
        <div className="fixed inset-x-4 bottom-24 z-[80] mx-auto max-w-md rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4 shadow-[var(--cc-shadow-md)] sm:bottom-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--cc-foreground)]">Instalar Project Command Center</p>
              <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                {isIOS
                  ? "No Safari, toque em Partilhar e escolha “Adicionar ao Ecrã Principal”. Depois toque em “Adicionar”."
                  : "No navegador, abra o menu e escolha “Instalar app” ou “Adicionar ao ecrã principal”. Se o Chrome mostrar a instalação, confirme para criar o ícone do PCC."}
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar instruções"
              onClick={() => setShowHelp(false)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--cc-border)] text-[var(--cc-secondary)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
