import { useCallback, useRef, useState } from "react";

/** Dispara animação única de borda amarela nos campos do formulário de edição. */
export function useCatalogEditFlash() {
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

  const flashFormClass = flash ? "catalog-edit-flash" : "";

  return { flashFormClass, triggerEditFlash };
}
