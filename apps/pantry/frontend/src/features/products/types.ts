export interface ProductNutritionCreate {
  calories?: number | null;
  fat?: number | null;
  saturated_fat?: number | null;
  carbohydrates?: number | null;
  sugars?: number | null;
  protein?: number | null;
  salt?: number | null;
}

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
