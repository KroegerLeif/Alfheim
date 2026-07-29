import { z } from "zod";

/**
 * Zod validation schema representing a single item in a shopping list.
 */
export const ShoppingItemSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  name: z.string().min(1, "shopping.error.nameRequired"),
  brand: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  quantity: z.number().positive("shopping.error.invalidQty").default(1.0),
  unit: z.string().default("piece"),
  is_completed: z.boolean().default(false),
  is_auto_generated: z.boolean().default(false),
  is_synced: z.boolean().default(false),
  product_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Zod validation schema representing a shopping list with nested items.
 */
export const ShoppingListSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  home_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  is_default: z.boolean().default(false),
  is_personal: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
  items: z.array(ShoppingItemSchema).default([]),
});

/**
 * Zod validation schema representing an unrecognized shopping item requiring cataloging.
 */
export const UnrecognizedShoppingItemSchema = z.object({
  shopping_item_id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  quantity: z.number().positive(),
  unit: z.string(),
  reason: z.string().default("pantry.error.product_not_found"),
});

/**
 * Zod validation schema for the bulk sync checkout response.
 */
export const SyncToPantryResponseSchema = z.object({
  status: z.enum(["success", "partial_success"]),
  synced_count: z.number().int(),
  unrecognized_count: z.number().int(),
  unrecognized_items: z.array(UnrecognizedShoppingItemSchema).default([]),
});

/**
 * Zod validation schema for a pantry product blueprint.
 */
export const ProductReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  base_unit: z.string().default("piece"),
  minimum_stock: z.number().default(0.0),
  category_id: z.string().uuid().nullable().optional(),
  is_global: z.boolean().default(false),
  home_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
