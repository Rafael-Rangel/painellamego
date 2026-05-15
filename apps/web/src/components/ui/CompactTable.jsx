import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";
import { inferCellTitle, shouldClampColumn } from "./tableCellUtils";

export default function CompactTable({
  columns,
  rows,
  keyField,
  maxHeight = 420,
  loading = false,
  emptyMessage = "Nenhum registro.",
  footerText,
  mobileCompact = true
}) {
  if (loading) return <LoadingSkeleton rows={6} />;
  if (!rows?.length) return <EmptyState message={emptyMessage} compact />;

  const wrapClass = ["table-wrap", mobileCompact ? "table-wrap--mobile" : ""].filter(Boolean).join(" ");

  return (
    <>
      <div className={wrapClass} style={{ maxHeight }}>
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} className={col.headerClassName}>
                  <span className="table-th-label">{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={keyField ? row[keyField] : idx}>
                {columns.map((col) => {
                  const content = col.render ? col.render(row, idx) : row[col.id];
                  const clamp = shouldClampColumn(col);
                  const title = clamp ? inferCellTitle(row, col) : undefined;
                  const isActions =
                    col.id === "actions" || col.kind === "actions" || col.kind === "controls";
                  const cellClass = clamp
                    ? "table-cell-clamp"
                    : isActions
                      ? "table-cell-plain table-cell-actions"
                      : "table-cell-plain";

                  return (
                    <td key={col.id} className={col.cellClassName} data-col={col.id}>
                      <div className={cellClass} title={title || undefined}>
                        {content ?? "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footerText ? <p className="subtitle table-footer">{footerText}</p> : null}
    </>
  );
}
