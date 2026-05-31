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
  mobileCompact = true,
  /** Tabela mais larga com scroll horizontal (ideal para histórico no celular). */
  scrollHorizontal = false,
  onRowClick,
  rowAriaLabel
}) {
  if (loading) return <LoadingSkeleton rows={6} />;
  if (!rows?.length) return <EmptyState message={emptyMessage} compact />;

  const wrapClass = [
    "table-wrap",
    scrollHorizontal ? "table-wrap--scroll-x" : mobileCompact ? "table-wrap--mobile" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={wrapClass} style={{ maxHeight }}>
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} className={col.headerClassName} data-col={col.id}>
                  <span className="table-th-label">{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={keyField ? row[keyField] : idx}
                className={onRowClick ? "table-row-clickable" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row, idx);
                        }
                      }
                    : undefined
                }
                aria-label={onRowClick ? rowAriaLabel?.(row, idx) : undefined}
              >
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
                        {content ?? "n/d"}
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
