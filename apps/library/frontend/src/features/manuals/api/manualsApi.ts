import { libraryClient } from "@/core/api";
import { ManualUploadResponse, ManualUrlResponse } from "../types";

export const manualsApi = {
  async uploadManual(itemId: string, file: File): Promise<ManualUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return await libraryClient
      .post(`items/${itemId}/manual`, {
        body: formData,
      })
      .json<ManualUploadResponse>();
  },

  async getManualUrl(itemId: string): Promise<ManualUrlResponse> {
    return await libraryClient
      .get(`items/${itemId}/manual/url`)
      .json<ManualUrlResponse>();
  },

  async deleteManual(itemId: string): Promise<void> {
    await libraryClient.delete(`items/${itemId}/manual`);
  },
};
