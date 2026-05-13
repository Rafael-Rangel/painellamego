import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";

export default function CompactTable({
  columns,
  rows,
  keyField,
  maxHeight = 420,
  loading = false,
  emptyMessage = "Nenhum registro.",
  footerText
}) {
  if (loading) return <LoadingSkeleton rows={6} />;
  if (!rows?.length) return <EmptyState message={emptyMessage} compact />;

  return (
    <>
      <div className="table-wrap" style={{ maxHeight }}>
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={keyField ? row[keyField] : idx}>
                {columns.map((col) => (
                  <td key={col.id}>{col.render ? col.render(row, idx) : row[col.id]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footerText ? <p className="subtitle table-footer">{footerText}</p> : null}
    </>
  );
}
