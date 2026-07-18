import { z } from "zod";

/**
 * Zod validation schema representing a frequently purchased item search record.
 */
export const ShoppingHistorySchema = z.object({
  id: z.string().uuid(),
  home_id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  unit: z.string().default("piece"),
  purchase_count: z.number().int().nonnegative(),
  icon_tag: z.string().nullable().optional(),
  last_purchased_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
