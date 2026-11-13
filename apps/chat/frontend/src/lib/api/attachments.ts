import type { Attachment } from "@/features/conversations/types";
import { chatApi } from "./client";

/** Uploads one file as multipart form data; rejects with `ApiError` on failure. */
export function uploadAttachment(file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);
  return chatApi.post("/attachments", formData).json<Attachment>();
}
