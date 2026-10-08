import { useState } from "react";
import { manualsApi } from "../api/manualsApi";

/** Which manual action failed last; the UI maps it to a localized message. */
export type ManualErrorKind = "upload" | "url" | "delete";

export function useManual(itemId: string, onManualUpdated?: () => void) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<ManualErrorKind | null>(null);

  const uploadManual = async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      await manualsApi.uploadManual(itemId, file);
      if (onManualUpdated) {
        onManualUpdated();
      }
    } catch (err: unknown) {
      setError("upload");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const fetchManualUrl = async (): Promise<string | null> => {
    setIsFetchingUrl(true);
    setError(null);
    try {
      const res = await manualsApi.getManualUrl(itemId);
      setDownloadUrl(res.download_url);
      return res.download_url;
    } catch {
      setError("url");
      return null;
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const deleteManual = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await manualsApi.deleteManual(itemId);
      setDownloadUrl(null);
      if (onManualUpdated) {
        onManualUpdated();
      }
    } catch (err: unknown) {
      setError("delete");
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isUploading,
    isDeleting,
    isFetchingUrl,
    downloadUrl,
    error,
    uploadManual,
    fetchManualUrl,
    deleteManual,
  };
}
