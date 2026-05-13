export default function EmptyState({ message = "Nenhum dado encontrado.", cta, compact = false }) {
  return (
    <div className={compact ? "empty-state compact" : "empty-state"}>
      <h4>Nenhum resultado</h4>
      <p className="subtitle">{message}</p>
      {cta ? <div>{cta}</div> : null}
    </div>
  );
}
