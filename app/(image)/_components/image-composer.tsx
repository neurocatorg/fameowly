"use client";

import type { PendingAttachment } from "@/lib/types";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { PromptIsland } from "@/components/prompt-island/prompt-island";
import { AttachmentStrip } from "@/components/prompt-island/attachment-strip";
import { ImageOptionsPanel } from "./image-options-panel";

interface ImageComposerProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string;
  refAttachments: PendingAttachment[];
  onAddRefFiles: (files: File[]) => void;
  onRemoveRefAttachment: (idx: number) => void;
  aspectRatio: string;
  onAspectRatioChange: (id: string) => void;
  resolution: string;
  onResolutionChange: (id: string) => void;
}

/** Image format and quality chips, reference files and the prompt island */
export function ImageComposer({
  prompt, onPromptChange, onSubmit, isLoading, error,
  refAttachments, onAddRefFiles, onRemoveRefAttachment,
  aspectRatio, onAspectRatioChange, resolution, onResolutionChange,
}: ImageComposerProps) {
  const { isCompact } = useVisualViewport();
  return (
    <div className="relative shrink-0">
      <ImageOptionsPanel
        compact={isCompact}
        aspectRatio={aspectRatio}
        onAspectRatioChange={onAspectRatioChange}
        resolution={resolution}
        onResolutionChange={onResolutionChange}
      />
      <PromptIsland
        value={prompt}
        onChange={onPromptChange}
        onSubmit={onSubmit}
        canSubmit={prompt.trim().length > 0}
        isLoading={isLoading}
        placeholder="Опишите изображение..."
        onAddFiles={onAddRefFiles}
        submitTitle="Создать"
        top={
          <AttachmentStrip
            attachments={refAttachments}
            onRemove={onRemoveRefAttachment}
            caption={`Файлы для контекста (${refAttachments.length}/10)`}
          />
        }
        bottom={error && (
          <div className="mx-auto mt-2 w-full max-w-4xl rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
        testId="image-input-island"
      />
    </div>
  );
}
