import { budgetClient } from "@/core/api";
import {
  Plan,
  PlanCategory,
  PlanCategoryCreate,
  PlanCategoryUpdate,
  PlanCreate,
  PlanSummaryResponse,
  PlanUpdate,
} from "@/features/budget/types";

export const plansApi = {
  async listPlans(includeInactive = false): Promise<Plan[]> {
    return budgetClient.get(`plans?include_inactive=${includeInactive}`).json<Plan[]>();
  },

  async getPlan(id: string): Promise<Plan> {
    return budgetClient.get(`plans/${id}`).json<Plan>();
  },

  async createPlan(data: PlanCreate): Promise<Plan> {
    return budgetClient.post("plans", { json: data }).json<Plan>();
  },

  async updatePlan(id: string, data: PlanUpdate): Promise<Plan> {
    return budgetClient.patch(`plans/${id}`, { json: data }).json<Plan>();
  },

  async deletePlan(id: string): Promise<void> {
    await budgetClient.delete(`plans/${id}`);
  },

  async getPlanSummary(planId: string): Promise<PlanSummaryResponse> {
    return budgetClient.get(`plans/${planId}/summary`).json<PlanSummaryResponse>();
  },

  async createCategory(planId: string, data: PlanCategoryCreate): Promise<PlanCategory> {
    return budgetClient.post(`plans/${planId}/categories`, { json: data }).json<PlanCategory>();
  },

  async updateCategory(categoryId: string, data: PlanCategoryUpdate): Promise<PlanCategory> {
    return budgetClient.patch(`plans/categories/${categoryId}`, { json: data }).json<PlanCategory>();
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await budgetClient.delete(`plans/categories/${categoryId}`);
  },
};
