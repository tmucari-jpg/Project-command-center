export type NextReviewResult = {
  date: string | null;
  source: "existing" | "calculated" | "missing";
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveNextReviewDate(input: {
  existingDate?: string | null;
  cadenceDays?: number | null;
  from?: Date;
}): NextReviewResult {
  if (input.existingDate) {
    return { date: input.existingDate, source: "existing" };
  }

  if (!input.cadenceDays || input.cadenceDays < 1) {
    return { date: null, source: "missing" };
  }

  const from = input.from ? new Date(input.from) : new Date();
  from.setUTCDate(from.getUTCDate() + input.cadenceDays);
  return { date: isoDate(from), source: "calculated" };
}
