export type FactorySuggestion = {
  title?: string;
  problem?: string;
  expected_value?: string;
  target_user?: string;
  description?: string;
  constraints?: string;
};

export function parseFactorySuggestion(text: string): FactorySuggestion | null {
  try {
    const clean = text.replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/i, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as FactorySuggestion;
  } catch {
    return null;
  }
}
