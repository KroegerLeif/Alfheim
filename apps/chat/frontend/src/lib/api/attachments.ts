import type { ApiErrorPayload, Attachment } from "@/features/conversations/types";
import { BASE_URL, authHeaders, ApiError } from "./client";

export async function uploadAttachment(file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/attachments`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    let payload: ApiErrorPayload = { error: "upload_failed", message: `Upload failed with status ${res.status}` };
    try {
      payload = await res.json();
    } catch {
      // Non-JSON error body fallback
    }
    throw new ApiError(res.status, payload);
  }

  return res.json() as Promise<Attachment>;
}
