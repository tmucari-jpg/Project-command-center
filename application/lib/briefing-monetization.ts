export type FunnelMetric = {
  acquired: number;
  payment_started: number;
  paid: number;
  activated: number;
  retained: number;
  churned: number;
};

function rate(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function subscriptionFunnelRates(metric: FunnelMetric) {
  return {
    acquisition_to_payment: rate(metric.payment_started, metric.acquired),
    payment_conversion: rate(metric.paid, metric.payment_started),
    activation_rate: rate(metric.activated, metric.paid),
    retention_rate: rate(metric.retained, metric.activated),
    churn_rate: rate(metric.churned, metric.activated),
  };
}
