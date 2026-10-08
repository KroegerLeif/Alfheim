'use client';

import React, { useRef, useState } from 'react';
import { Paperclip, SendHorizontal, X } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { AttachmentSummary, StagedAttachment } from './types';

export interface ChatWidgetInputProps {
  onSend: (content: string, attachments: AttachmentSummary[]) => void;
  onUploadFile: (file: File) => Promise<AttachmentSummary>;
  disabled?: boolean;
}

export function ChatWidgetInput({
  onSend,
  onUploadFile,
  disabled = false,
}: ChatWidgetInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isUploading = staged.some((s) => s.isUploading);
  const canSend = !disabled && !isUploading && (text.trim().length > 0 || staged.length > 0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    const newItems: StagedAttachment[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      isUploading: true,
    }));

    setStaged((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const uploaded = await onUploadFile(item.file);
        setStaged((prev) =>
          prev.map((s) =>
            s.id === item.id ? { ...s, isUploading: false, uploadedId: uploaded.id } : s
          )
        );
      } catch (err) {
        setStaged((prev) =>
          prev.map((s) =>
            s.id === item.id
              ? { ...s, isUploading: false, error: err instanceof Error ? err.message : t('Chat.uploadError') }
              : s
          )
        );
      }
    }
  };

  const handleRemove = (id: string) => {
    setStaged((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  };

  const handleSend = () => {
    if (!canSend) return;
    const content = text.trim();
    const attachments: AttachmentSummary[] = staged
      .filter((s) => Boolean(s.uploadedId))
      .map((s) => ({
        id: s.uploadedId!,
        url: s.previewUrl,
      }));

    staged.forEach((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    });

    setText('');
    setStaged([]);
    onSend(content, attachments);
  };

  return (
    <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-card)]">
      {staged.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1 border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
          {staged.map((item) => (
            <div
              key={item.id}
              className="relative flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-main)] max-w-[180px]"
            >
              <span className="truncate font-medium">{item.file.name}</span>
              {item.isUploading && (
                <span className="w-3 h-3 border-2 border-[var(--primary-main)] border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              {item.error && (
                <span className="text-red-400 text-[10px]" title={item.error} role="img" aria-label={t('Chat.uploadError')}>
                  !
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                disabled={item.isUploading}
                aria-label={t('Chat.removeAttachment')}
                className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs cursor-pointer"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-label={t('Chat.attachImage')}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          aria-label={t('Chat.attachImage')}
          title={t('Chat.attachImage')}
          className="p-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors disabled:opacity-40 cursor-pointer"
        >
          <Paperclip aria-hidden="true" className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t('Chat.inputPlaceholder')}
          disabled={disabled}
          className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-xs px-3 py-2 disabled:opacity-40 focus:outline-none focus:border-[var(--primary-main)]"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label={t('Chat.send')}
          title={t('Chat.send')}
          className="p-2 rounded-lg bg-[var(--primary-main)] text-black font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center shrink-0"
        >
          <SendHorizontal aria-hidden="true" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
