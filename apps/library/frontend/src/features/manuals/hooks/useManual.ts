import { useState } from "react";
import { manualsApi } from "../api/manualsApi";

export function useManual(itemId: string, onManualUpdated?: () => void) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadManual = async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      await manualsApi.uploadManual(itemId, file);
      if (onManualUpdated) {
        onManualUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload manual";
      setError(msg);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch manual URL";
      setError(msg);
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
      const msg = err instanceof Error ? err.message : "Failed to delete manual";
      setError(msg);
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
