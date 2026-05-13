export const mockManagerAlerts = [
  {
    id: "mock-alert-1",
    type: "above_average",
    message:
      "Arroz Branco — na Padaria Centro este lançamento ficou em R$ 5,80 (média da rede: R$ 5,20, ou seja, 11,5% acima da média).",
    products: { name: "Arroz Branco" }
  },
  {
    id: "mock-alert-2",
    type: "cheaper_supplier_exists",
    message:
      "Óleo de Soja — o menor preço registrado na rede está na Padaria Sul (R$ 5,90). Neste lançamento você pagou R$ 6,80.",
    products: { name: "Óleo de Soja" }
  }
];

export const mockStores = [
  { id: "s1", name: "Lamego Centro", location: "Centro", store_number: 1 },
  { id: "s2", name: "Lamego Barra", location: "Barra", store_number: 2 },
  { id: "s3", name: "Lamego Norte", location: "Zona Norte", store_number: 3 }
];

export const mockProducts = [
  { id: "p1", name: "Farinha de trigo", category: "Mercearia", standard_unit: "kg", type: "insumo" },
  { id: "p2", name: "Acucar refinado", category: "Mercearia", standard_unit: "kg", type: "insumo" },
  { id: "p3", name: "Manteiga", category: "Laticinios", standard_unit: "kg", type: "venda" }
];

export const mockSuppliers = [
  { id: "f1", name: "Distribuidora Sul" },
  { id: "f2", name: "Fornecedor Central" },
  { id: "f3", name: "Atacado Prime" }
];
