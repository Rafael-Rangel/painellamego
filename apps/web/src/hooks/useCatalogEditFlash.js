import { useCallback, useRef, useState } from "react";

/**
 * Destaque de edição: pisca ao abrir e mantém borda amarela até salvar/cancelar.
 * @param {boolean} isEditing — true enquanto um item está em modo edição
 */
export function useCatalogEditFlash(isEditing) {
  const [flash, setFlash] = useState(false);
  const timerRef = useRef(null);

  const triggerEditFlash = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFlash(false);
    requestAnimationFrame(() => {
      setFlash(true);
      timerRef.current = setTimeout(() => {
        setFlash(false);
        timerRef.current = null;
      }, 900);
    });
  }, []);

  const formClass = [isEditing ? "catalog-edit-active" : "", flash ? "catalog-edit-flash" : ""]
    .filter(Boolean)
    .join(" ");

  return { formClass, triggerEditFlash };
}
