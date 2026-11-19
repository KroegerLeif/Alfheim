import { budgetClient } from "@/core/api";
import {
  CascadeAllocationRequest,
  CascadeAllocationResponse,
  Pot,
  PotCreate,
  PotUpdate,
  SinkingFundCalculationResponse,
} from "@/features/budget/types";

export const potsApi = {
  async listPots(includeInactive = false): Promise<Pot[]> {
    return budgetClient.get(`pots?include_inactive=${includeInactive}`).json<Pot[]>();
  },

  async getPot(id: string): Promise<Pot> {
    return budgetClient.get(`pots/${id}`).json<Pot>();
  },

  async createPot(data: PotCreate): Promise<Pot> {
    return budgetClient.post("pots", data).json<Pot>();
  },

  async updatePot(id: string, data: PotUpdate): Promise<Pot> {
    return budgetClient.patch(`pots/${id}`, data).json<Pot>();
  },

  async deletePot(id: string): Promise<void> {
    await budgetClient.delete(`pots/${id}`);
  },

  async allocateCascade(data: CascadeAllocationRequest): Promise<CascadeAllocationResponse> {
    return budgetClient.post("pots/cascade", data).json<CascadeAllocationResponse>();
  },

  async calculateSinkingFundGap(id: string): Promise<SinkingFundCalculationResponse> {
    return budgetClient.get(`pots/${id}/sinking-fund-calculator`).json<SinkingFundCalculationResponse>();
  },
};
