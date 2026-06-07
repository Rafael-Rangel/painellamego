import { useMemo } from "react";
import { buildUnitOptions, normalizeUnitUsed } from "../../lib/catalogUnits";

export default function UnitSelect({ id, value, onChange, units = [], products = [], className = "" }) {
  const options = useMemo(() => buildUnitOptions(units, products, value), [units, products, value]);
  const selectValue = normalizeUnitUsed(value, options);

  return (
    <select id={id} className={className} value={selectValue} onChange={onChange}>
      {options.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  );
}
