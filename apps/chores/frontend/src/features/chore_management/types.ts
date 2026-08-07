import { Language } from "@loeger-os/shared";

export interface ChoreTemplateRead {
  id: string;
  home_id: string;
  name: string;
  description: string | null;
  points: number;
  is_non_cumulative: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChoreTemplateCreate {
  name: string;
  description?: string;
  points: number;
  is_non_cumulative: boolean;
}

export interface ChoreTemplateUpdate {
  name?: string;
  description?: string;
  points?: number;
  is_non_cumulative?: boolean;
}

export interface ChoreInstanceRead {
  id: string;
  template_id: string;
  home_id: string;
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  due_date: string;
  status: "pending" | "completed" | "missed";
  points_awarded: number;
  created_at: string;
  updated_at: string;
}

export interface HouseholdStreakRead {
  id: string;
  home_id: string;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChoreIntegrationSummary {
  home_id: string;
  current_streak: number;
  longest_streak: number;
  today_completed_count: number;
  today_pending_count: number;
  today_total_count: number;
  completion_rate: number;
  today_chores: ChoreInstanceRead[];
}

export interface ChoreTimelineRead {
  id: string;
  template_id: string;
  instance_id: string;
  home_id: string;
  completed_by: string;
  completed_by_name: string | null;
  completed_at: string;
  points_awarded: number;
}

