import { z } from "zod";

export const roles = ["manager", "admin"] as const;
export const productTypes = ["insumo", "venda"] as const;

export const lineTypes = ["insumo", "venda"] as const;

export const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  supplierId: z.string().uuid(),
  unitPrice: z.number().positive(),
  unitUsed: z.string().min(1),
  quantity: z.number().positive(),
  purchaseDate: z.string().min(1),
  weekOfMonth: z.number().int().min(1).max(5),
  /** Classificação na nota: insumo ou venda (por linha). */
  lineType: z.enum(["insumo", "venda"])
});

export const createPurchaseSchema = z.object({
  storeId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  items: z.array(purchaseItemSchema).min(1)
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
