import { libraryClient } from "@/core/api";
import {
  LendingRecord,
  LendingRecordListResponse,
  LendItemPayload,
  ReturnItemPayload,
} from "../types";

export const lendingApi = {
  async lendItem(itemId: string, payload: LendItemPayload): Promise<LendingRecord> {
    return await libraryClient
      .post(`items/${itemId}/lend`, { json: payload })
      .json<LendingRecord>();
  },

  async returnItem(itemId: string, payload?: ReturnItemPayload): Promise<LendingRecord> {
    return await libraryClient
      .post(`items/${itemId}/return`, { json: payload || {} })
      .json<LendingRecord>();
  },

  async getLendingHistory(params?: {
    skip?: number;
    limit?: number;
    item_id?: string;
    contact_name?: string;
    status?: string;
  }): Promise<LendingRecordListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.set("skip", params.skip.toString());
    if (params?.limit !== undefined) searchParams.set("limit", params.limit.toString());
    if (params?.item_id) searchParams.set("item_id", params.item_id);
    if (params?.contact_name) searchParams.set("contact_name", params.contact_name);
    if (params?.status) searchParams.set("status", params.status);

    return await libraryClient
      .get("lending/history", { searchParams })
      .json<LendingRecordListResponse>();
  },
};
