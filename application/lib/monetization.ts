export type CommercialProfile = {
  offer?: string | null;
  ideal_customer?: string | null;
  price?: number | null;
  currency?: string | null;
  channel?: string | null;
  validation_status: string;
  is_priority?: boolean | null;
};

export function monetizationReadiness(profile?: CommercialProfile | null) {
  if (!profile) return { score: 0, missing: ["offer", "ideal_customer", "price", "channel"] };

  const fields = [
    ["offer", profile.offer],
    ["ideal_customer", profile.ideal_customer],
    ["price", profile.price],
    ["channel", profile.channel],
  ] as const;

  const missing = fields
    .filter(([, value]) => value === null || value === undefined || value === "")
    .map(([name]) => name);

  return {
    score: Math.round(((fields.length - missing.length) / fields.length) * 100),
    missing,
  };
}

export function financialSummary(entries: Array<{ entry_type: "revenue" | "cost"; amount: number; status: string }>) {
  const actual = entries.filter((entry) => entry.status === "actual");
  const revenue = actual
    .filter((entry) => entry.entry_type === "revenue")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const costs = actual
    .filter((entry) => entry.entry_type === "cost")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return { revenue, costs, net: revenue - costs };
}
