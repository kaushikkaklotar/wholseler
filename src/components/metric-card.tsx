type MetricCardProps = {
  label: string;
  value: string;
  trend: string;
};

export function MetricCard({ label, value, trend }: MetricCardProps) {
  return (
    <article className="card metric-card">
      <div className="muted">{label}</div>
      <div className="metric-card__value">{value}</div>
      <div className="metric-card__trend">{trend}</div>
    </article>
  );
}
