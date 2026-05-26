import DateRangeFilter from "./DateRangeFilter";
import MultiSelectSearch from "../ui/MultiSelectSearch";
import TableToolbar from "../ui/TableToolbar";

export default function AnalyticsFilterBar({ filters, onChange, onClear, products, suppliers, children }) {
  return (
    <section className="card span-12 analytics-filter-card">
      <DateRangeFilter filters={filters} onChange={onChange} />
      <TableToolbar>
        <div className="span-5">
          <MultiSelectSearch
            label="Produtos"
            placeholder="Filtrar produtos..."
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            value={filters.productIds || []}
            onChange={(productIds) => onChange({ productIds })}
            maxChips={2}
          />
        </div>
        <div className="span-5">
          <MultiSelectSearch
            label="Fornecedores"
            placeholder="Filtrar fornecedores..."
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            value={filters.supplierIds || []}
            onChange={(supplierIds) => onChange({ supplierIds })}
            maxChips={2}
          />
        </div>
        <div className="field span-2">
          <label>&nbsp;</label>
          <button type="button" className="btn btn-ghost" onClick={onClear}>
            Limpar
          </button>
        </div>
      </TableToolbar>
      {children}
    </section>
  );
}
