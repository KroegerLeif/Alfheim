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
