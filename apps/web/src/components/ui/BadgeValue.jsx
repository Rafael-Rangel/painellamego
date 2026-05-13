export default function BadgeValue({ value }) {
  const numeric = Number(value || 0);
  const className = numeric >= 15 ? "badge badge-danger" : numeric >= 5 ? "badge badge-warning" : "badge badge-success";
  return <span className={className}>{numeric.toFixed(2)}%</span>;
}
