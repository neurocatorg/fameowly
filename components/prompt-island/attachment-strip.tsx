"use client";

import { AlertCircle, Loader2, RefreshCw, X } from "lucide-react";
import type { PendingAttachment } from "@/lib/types";

interface AttachmentStripProps {
  attachments: PendingAttachment[];
  onRemove: (idx: number) => void;
  onRetry?: (idx: number) => void;
  caption?: string;
}

/** Previews of files waiting to be sent, above the prompt island */
export function AttachmentStrip({ attachments, onRemove, onRetry, caption }: AttachmentStripProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mx-auto mb-2 w-full max-w-4xl px-2" data-testid="attachment-strip">
      <div className="flex flex-wrap gap-2">
        {attachments.map((pa, idx) => (
          <div key={pa.id} className="relative rounded-lg bg-th-subtle p-1">
            {pa.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pa.preview} alt={pa.file.name} className="h-14 w-14 rounded object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded bg-th-muted text-xs text-th-fg-m">
                {pa.file.name.slice(0, 8)}
              </div>
            )}
            {pa.uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              </div>
            )}
            {pa.error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded bg-red-900/70">
                <AlertCircle className="h-4 w-4 text-red-300" />
                {onRetry && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRetry(idx); }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                    title="Повторить загрузку"
                  >
                    <RefreshCw className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-th-muted text-th-fg transition hover:bg-th-red hover:text-white"
              title="Убрать файл"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {caption && <span className="mt-1 block text-[10px] text-th-fg-f">{caption}</span>}
    </div>
  );
}
