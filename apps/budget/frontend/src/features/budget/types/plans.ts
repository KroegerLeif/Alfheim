export type PlanType = "MONTHLY" | "EVENT";

export interface PlanCategory {
  id: string;
  plan_id: string;
  household_id: string;
  name: string;
  parent_id?: string | null;
  allocated_amount: number;
  created_at: string;
  updated_at: string;
  subcategories?: PlanCategory[];
}

export interface PlanCategoryCreate {
  name: string;
  parent_id?: string | null;
  allocated_amount?: number;
}

export interface PlanCategoryUpdate {
  name?: string;
  parent_id?: string | null;
  allocated_amount?: number;
}

export interface Plan {
  id: string;
  household_id: string;
  name: string;
  description?: string | null;
  plan_type: PlanType;
  start_date?: string | null;
  end_date?: string | null;
  total_budget: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanCreate {
  name: string;
  description?: string | null;
  plan_type: PlanType;
  start_date?: string | null;
  end_date?: string | null;
  total_budget?: number;
  is_active?: boolean;
}

export interface PlanUpdate {
  name?: string;
  description?: string | null;
  plan_type?: PlanType;
  start_date?: string | null;
  end_date?: string | null;
  total_budget?: number;
  is_active?: boolean;
}

export interface PlanSummaryResponse {
  plan_id: string;
  name: string;
  plan_type: PlanType;
  total_budget: number;
  total_allocated: number;
  unallocated_balance: number;
  categories_count: number;
  categories: PlanCategory[];
}
