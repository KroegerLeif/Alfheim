import { z } from "zod";
import {
  ShoppingItemSchema,
  ShoppingListSchema,
  UnrecognizedShoppingItemSchema,
  SyncToPantryResponseSchema,
} from "./schemas";

export type ShoppingItem = z.infer<typeof ShoppingItemSchema>;
export type ShoppingList = z.infer<typeof ShoppingListSchema>;
export type UnrecognizedShoppingItem = z.infer<typeof UnrecognizedShoppingItemSchema>;
export type SyncToPantryResponse = z.infer<typeof SyncToPantryResponseSchema>;

export interface ShoppingListCreatePayload {
  name: string;
}

export interface ShoppingItemCreatePayload {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: string;
}

export interface ShoppingItemUpdatePayload {
  name?: string;
  brand?: string | null;
  barcode?: string | null;
  quantity?: number;
  unit?: string;
  is_completed?: boolean;
}
