export default function DashboardLoading() {
  return (
    <div className="card">
      <div className="card__body">
        <div className="eyebrow">Loading</div>
        <h1>Preparing dashboard...</h1>
        <p className="muted">Fetching the latest stock, billing and inquiry data.</p>
      </div>
    </div>
  );
}
