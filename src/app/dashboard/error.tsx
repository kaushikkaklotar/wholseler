"use client";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card">
      <div className="card__body">
        <div className="eyebrow">Error</div>
        <h1>Dashboard could not load</h1>
        <p className="muted">{error.message || "Please retry once. If it repeats, check server logs."}</p>
        <button className="button button--primary" onClick={reset} type="button">
          Retry
        </button>
      </div>
    </div>
  );
}
