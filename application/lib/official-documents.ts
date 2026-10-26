export const OFFICIAL_DOCUMENT_LABELS: Record<string, string> = {
  master_mind: "Master Mind",
  commercial_guide: "Guia Comercial",
  technical_package: "Pacote Técnico PCC",
  release_diagnostic: "Diagnóstico de Release",
  android_apk: "Android APK",
  android_aab: "Android AAB",
  other: "Outro documento oficial",
};

export function officialDocumentLabel(value: string) {
  return OFFICIAL_DOCUMENT_LABELS[value] ?? value;
}

export function sanitizeOfficialFileName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "");
  return (cleaned || "documento").slice(-180);
}
