import { ProductRead } from "@/features/products/types";
import { LocationRead } from "@/features/locations/types";

export interface InventoryStateReadWithRelations {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  batch_code: string | null;
  expiration_date: string | null; // ISO Date YYYY-MM-DD
  created_at: string;
  updated_at: string;
  product?: ProductRead;
  location?: LocationRead;
}

export interface LowStockItem {
  product: ProductRead;
  current_stock: number;
}

export interface ExpirationSummary {
  expired: InventoryStateReadWithRelations[];
  valid: InventoryStateReadWithRelations[];
  untracked: InventoryStateReadWithRelations[];
}

export type InventoryTransactionType = "in" | "out" | "waste" | "reconciliation";

export interface InventoryTransactionCreate {
  product_id: string;
  location_id: string;
  transaction_type: InventoryTransactionType;
  quantity_input: number;
  unit_input: string;
  batch_code?: string | null;
  expiration_date?: string | null; // ISO Date YYYY-MM-DD
  notes?: string | null;
}

export interface InventoryLedgerRead {
  id: string;
  product_id: string;
  location_id: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  quantity_input: number;
  unit_input: string;
  batch_code: string | null;
  expiration_date: string | null;
  notes: string | null;
  created_at: string;
}
