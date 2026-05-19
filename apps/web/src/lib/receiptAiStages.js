export const RECEIPT_AI_STAGES = [
  { id: "optimize", label: "Otimizando imagem" },
  { id: "upload", label: "Enviando imagem" },
  { id: "analyze", label: "IA analisando nota" },
  { id: "extract", label: "Extraindo produtos" },
  { id: "finish", label: "Finalizando cadastro" }
];

export function stageIndex(stageId) {
  const i = RECEIPT_AI_STAGES.findIndex((s) => s.id === stageId);
  return i >= 0 ? i : 0;
}
