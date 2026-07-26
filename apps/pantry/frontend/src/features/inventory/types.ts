export interface ProductRead {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  image_url: string | null;
  base_unit: string;
  minimum_stock: number;
  category_id: string | null;
  is_global: boolean;
  home_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationRead {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  owner_id: string | null;
  home_id: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface CategoryRead {
  id: string;
  name: string;
  description: string | null;
  is_global: boolean;
  owner_id: string | null;
  home_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductNutritionCreate {
  calories?: number | null;
  fat?: number | null;
  saturated_fat?: number | null;
  carbohydrates?: number | null;
  sugars?: number | null;
  protein?: number | null;
  salt?: number | null;
}

export interface ProductCreate {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  base_unit: string;
  minimum_stock: number;
  category_id?: string | null;
  nutrition?: ProductNutritionCreate | null;
}

export interface LocationCreate {
  name: string;
  description?: string | null;
}

export interface CategoryCreate {
  name: string;
  description?: string | null;
}



