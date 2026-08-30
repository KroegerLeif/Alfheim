export type OverflowTarget = "CASCADE" | "UNASSIGNED" | "INVESTMENT";

export interface Pot {
  id: string;
  household_id: string;
  name: string;
  priority: number;
  target_amount?: number | null;
  current_amount: number;
  monthly_contribution: number;
  target_date?: string | null;
  overflow_target: OverflowTarget;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PotCreate {
  name: string;
  priority?: number;
  target_amount?: number | null;
  current_amount?: number;
  monthly_contribution?: number;
  target_date?: string | null;
  overflow_target?: OverflowTarget;
  is_active?: boolean;
}

export interface PotUpdate {
  name?: string;
  priority?: number;
  target_amount?: number | null;
  current_amount?: number;
  monthly_contribution?: number;
  target_date?: string | null;
  overflow_target?: OverflowTarget;
  is_active?: boolean;
}

export interface CascadeAllocationRequest {
  amount: number;
}

export interface PotAllocationResult {
  pot_id: string;
  pot_name: string;
  priority: number;
  allocated_amount: number;
  new_current_amount: number;
  target_amount?: number | null;
  is_filled: boolean;
}

export interface CascadeAllocationResponse {
  total_allocated: number;
  remaining_unassigned: number;
  overflow_to_investment: number;
  allocations: PotAllocationResult[];
}

export interface SinkingFundCalculationResponse {
  pot_id: string;
  pot_name: string;
  target_amount?: number | null;
  current_amount: number;
  shortfall: number;
  target_date?: string | null;
  remaining_months: number;
  target_monthly_rate: number;
  actual_monthly_rate: number;
  gap: number;
  has_gap: boolean;
  status: "WARNING" | "ON_TRACK" | "COMPLETED" | "NO_TARGET";
}
