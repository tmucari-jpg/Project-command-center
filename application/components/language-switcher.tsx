"use client";

import { usePccLanguage } from "@/components/language-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = usePccLanguage();

  return (
    <div
      className="inline-flex items-center rounded-full border border-[var(--cc-border)] bg-white/90 p-1 shadow-sm backdrop-blur-xl"
      role="group"
      aria-label="Idioma / Language"
      data-no-translate
    >
      <button
        type="button"
        onClick={() => setLanguage("pt")}
        aria-pressed={language === "pt"}
        className={`rounded-full px-2.5 py-1.5 ${compact ? "text-[10px]" : "text-xs"} font-bold transition ${
          language === "pt"
            ? "bg-[var(--cc-accent)] text-white"
            : "text-[var(--cc-secondary)] hover:bg-[var(--cc-surface-muted)]"
        }`}
      >
        PT
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={`rounded-full px-2.5 py-1.5 ${compact ? "text-[10px]" : "text-xs"} font-bold transition ${
          language === "en"
            ? "bg-[var(--cc-accent)] text-white"
            : "text-[var(--cc-secondary)] hover:bg-[var(--cc-surface-muted)]"
        }`}
      >
        ENG
      </button>
    </div>
  );
}
