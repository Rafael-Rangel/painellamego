import { useCallback, useState } from "react";

/**
 * Controla quando mostrar erros no wizard: após tentar avançar ou após tocar/sair do campo.
 */
export function useWizardStepValidation() {
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const [touched, setTouched] = useState({});

  const markStepAttempted = useCallback((step) => {
    setAttemptedSteps((prev) => (prev[step] ? prev : { ...prev, [step]: true }));
  }, []);

  const touchField = useCallback((field) => {
    if (!field) return;
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  const shouldShow = useCallback(
    (step, field) => {
      if (attemptedSteps[step]) return true;
      if (field && touched[field]) return true;
      return false;
    },
    [attemptedSteps, touched]
  );

  const wasStepAttempted = useCallback((step) => Boolean(attemptedSteps[step]), [attemptedSteps]);

  return { markStepAttempted, touchField, shouldShow, wasStepAttempted, attemptedSteps };
}
