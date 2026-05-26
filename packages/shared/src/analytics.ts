import { z } from "zod";

export const analyticsGranularitySchema = z.enum(["day", "week", "month"]);
export const analyticsPresetSchema = z.enum(["today", "7d", "30d", "thisMonth", "custom", ""]);

export const analyticsFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  preset: z.string().optional(),
  granularity: analyticsGranularitySchema.optional(),
  months: z.coerce.number().int().min(1).max(24).optional(),
  productIds: z.string().optional(),
  supplierIds: z.string().optional(),
  lineType: z.enum(["insumo", "venda"]).optional()
});

export const priceDeltaSchema = z.object({
  deltaAmount: z.number(),
  deltaPercent: z.number(),
  direction: z.enum(["up", "down", "flat"])
});

export const bucketSpendSchema = z.object({
  label: z.string(),
  amount: z.number()
});

export const bucketQtySchema = z.object({
  label: z.string(),
  quantity: z.number()
});

export const managerOverviewSchema = z.object({
  filters: z.object({
    dateFrom: z.string(),
    dateTo: z.string(),
    granularity: analyticsGranularitySchema,
    preset: z.string()
  }),
  totalSpent: z.number(),
  totalQty: z.number(),
  purchasesCount: z.number(),
  itemsCount: z.number(),
  suppliersCount: z.number(),
  avgTicket: z.number(),
  avgPriceChangePercent: z.number(),
  priceChangeDirection: z.enum(["up", "down", "flat"]),
  spendByBucket: z.array(bucketSpendSchema),
  qtyByBucket: z.array(bucketQtySchema),
  spendByCategory: z.array(z.object({ category: z.string(), amount: z.number() })),
  spendByWeek: z.array(z.object({ week: z.number(), amount: z.number() })),
  topProductsBySpend: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      amount: z.number(),
      quantity: z.number()
    })
  ),
  topProductsByQty: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number(),
      amount: z.number()
    })
  ),
  efficiencyScore: z.number().nullable(),
  storeName: z.string().nullable()
});

export const managerProductSummarySchema = z.object({
  productId: z.string(),
  name: z.string(),
  standardUnit: z.string(),
  category: z.string(),
  totalQty: z.number(),
  totalSpent: z.number(),
  minPrice: z.number(),
  maxPrice: z.number(),
  avgPrice: z.number(),
  lastPrice: z.number(),
  previousPrice: z.number().nullable(),
  deltaAmount: z.number(),
  deltaPercent: z.number(),
  priceDirection: z.enum(["up", "down", "flat"]),
  periodDeltaPercent: z.number(),
  periodPriceDirection: z.enum(["up", "down", "flat"])
});

export type ManagerOverview = z.infer<typeof managerOverviewSchema>;
export type ManagerProductSummary = z.infer<typeof managerProductSummarySchema>;
