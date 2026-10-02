import { budgetClient } from "@/core/api";
import {
  QuickAddTransactionCreate,
  Transaction,
  TransactionCreate,
  TransactionUpdate,
} from "@/features/budget/types";

export interface PresignedUploadResponse {
  upload_url: string;
  object_key: string;
}

export interface TransactionFilterOptions {
  accountId?: string;
  potId?: string;
  planId?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export const transactionsApi = {
  async listTransactions(filters?: TransactionFilterOptions): Promise<Transaction[]> {
    const searchParams = new URLSearchParams();
    if (filters?.accountId) searchParams.append("account_id", filters.accountId);
    if (filters?.potId) searchParams.append("pot_id", filters.potId);
    if (filters?.planId) searchParams.append("plan_id", filters.planId);
    if (filters?.categoryId) searchParams.append("category_id", filters.categoryId);
    if (filters?.limit) searchParams.append("limit", filters.limit.toString());
    if (filters?.offset) searchParams.append("offset", filters.offset.toString());

    const query = searchParams.toString();
    const endpoint = query ? `transactions?${query}` : "transactions";
    return budgetClient.get(endpoint).json<Transaction[]>();
  },

  async getTransaction(id: string): Promise<Transaction> {
    return budgetClient.get(`transactions/${id}`).json<Transaction>();
  },

  async createTransaction(data: TransactionCreate): Promise<Transaction> {
    return budgetClient.post("transactions", { json: data }).json<Transaction>();
  },

  async quickAddTransaction(data: QuickAddTransactionCreate): Promise<Transaction> {
    return budgetClient.post("transactions/quick-add", { json: data }).json<Transaction>();
  },

  async updateTransaction(id: string, data: TransactionUpdate): Promise<Transaction> {
    return budgetClient.patch(`transactions/${id}`, { json: data }).json<Transaction>();
  },

  async deleteTransaction(id: string): Promise<void> {
    await budgetClient.delete(`transactions/${id}`);
  },

  /**
   * Get a presigned RustFS/S3 upload URL for a receipt image. The caller is responsible for
   * PUT-ing the file bytes to `upload_url`; `object_key` is what should be stored as the
   * transaction's `receipt_url` afterwards. See issue #529 -- OCR extraction is intentionally
   * NOT wired up from the frontend yet, because the backend OCR endpoint only returns real data
   * when the caller supplies pre-extracted `raw_text` (there is no client-side OCR step), and a
   * "receipt scan" UI that always failed would be worse than not offering it at all.
   */
  async getReceiptUploadUrl(filename: string, contentType?: string): Promise<PresignedUploadResponse> {
    return budgetClient
      .post("transactions/receipt/upload-url", { json: { filename, content_type: contentType } })
      .json<PresignedUploadResponse>();
  },

  /** Upload the receipt file bytes directly to the presigned URL returned by getReceiptUploadUrl. */
  async uploadReceiptFile(uploadUrl: string, file: File): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: file.type ? { "Content-Type": file.type } : undefined,
    });
    if (!res.ok) {
      throw new Error(`Receipt upload failed with status ${res.status}`);
    }
  },
};
