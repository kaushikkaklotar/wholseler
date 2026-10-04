type StatusBadgeProps = {
  label: string;
};

export function StatusBadge({ label }: StatusBadgeProps) {
  const tone =
    label === "Active" || label === "Paid" || label === "Public"
      ? "success"
      : label === "Invited" || label === "Issued" || label === "Partial" || label === "Approved sellers"
        ? "warning"
        : "danger";

  return <span className={`badge badge--${tone}`}>{label}</span>;
}
