export interface ManualUploadResponse {
  item_id: string;
  manual_s3_key: string;
  filename: string;
  message: string;
}

export interface ManualUrlResponse {
  item_id: string;
  download_url: string;
  expires_in: number;
}

export interface ManualSectionProps {
  itemId: string;
  itemTitle: string;
  manualS3Key?: string | null;
  onManualUpdated?: () => void;
}
