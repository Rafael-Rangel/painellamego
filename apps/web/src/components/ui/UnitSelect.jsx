import { useMemo } from "react";
import { buildUnitOptions } from "../../lib/catalogUnits";

export default function UnitSelect({ value, onChange, units = [], products = [], className = "" }) {
  const options = useMemo(() => buildUnitOptions(units, products, value), [units, products, value]);

  return (
    <select className={className} value={value || options[0] || "un"} onChange={onChange}>
      {options.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  );
}
