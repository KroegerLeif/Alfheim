import type { Attachment } from "@/features/conversations/types";
import { chatApi } from "./client";

/**
 * Uploads one file as multipart form data; rejects with `ApiError` on failure. The client's
 * default request timeout is disabled because a large file on a slow link can take longer.
 */
export function uploadAttachment(file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);
  return chatApi.post("/attachments", formData, { timeoutMs: false }).json<Attachment>();
}
