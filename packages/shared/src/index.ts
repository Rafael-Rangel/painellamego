import { z } from "zod";

export const roles = ["manager", "admin"] as const;
export const productTypes = ["insumo", "venda"] as const;

export const lineTypes = ["insumo", "venda"] as const;

export const purchaseItemSchema = z
  .object({
    productId: z.string().uuid(),
    supplierId: z.string().uuid(),
    unitPrice: z.number().nonnegative(),
    unitUsed: z.string().min(1),
    quantity: z.number().nonnegative(),
    purchaseDate: z.string().min(1),
    weekOfMonth: z.number().int().min(1).max(5),
    lineType: z.enum(["insumo", "venda"]),
    isBonificationOnly: z.boolean().optional().default(false),
    bonusQuantity: z.number().nonnegative().optional().default(0),
    bonusUnitValue: z.number().nonnegative().optional().default(0),
    notes: z.string().max(500).optional().nullable()
  })
  .superRefine((row, ctx) => {
    if (row.isBonificationOnly) {
      if (row.bonusQuantity <= 0 && row.quantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe a quantidade do produto de bonificação." });
      }
      return;
    }
    const charge = row.quantity * row.unitPrice;
    const bonus = row.bonusQuantity * row.bonusUnitValue;
    if (charge <= 0 && bonus <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe compra (qtd × preço) ou produto de bonificação."
      });
    }
    if (row.quantity > 0 && row.unitPrice <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Preço unitário obrigatório para linha de compra." });
    }
  });

export const purchaseInstallmentSchema = z.object({
  dueDate: z.string().min(1),
  amount: z.number().positive(),
  notes: z.string().max(500).optional()
});

export const purchaseAdjustmentLineSchema = z.object({
  name: z.string().min(1).max(120),
  amount: z.number().nonnegative()
});

export {
  parseBrNumber,
  isBonificationOnlyLine,
  lineChargeAmount,
  lineBonusValue,
  purchaseTotalsFromItems,
  sumAdjustmentLines,
  purchaseInvoiceSummary,
  validateInstallmentsAgainstPayable,
  draftItemToPreviewRow,
  purchaseTotalsWithDraft,
  hasChargeablePurchaseContent,
  normalizePurchaseItemRow,
  lineDisplayAmount
} from "./purchaseTotals";

export type { PurchaseAdjustmentLine } from "./purchaseTotals";

export const createPurchaseSchema = z.object({
  storeId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  items: z.array(purchaseItemSchema).min(1)
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export {
  analyticsFiltersSchema,
  analyticsGranularitySchema,
  analyticsPresetSchema,
  managerOverviewSchema,
  managerProductSummarySchema
} from "./analytics";
export type { ManagerOverview, ManagerProductSummary } from "./analytics";
