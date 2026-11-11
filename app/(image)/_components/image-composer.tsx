"use client";

import type { ImageSize, PendingAttachment } from "@/lib/types";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import type { ImageOptions } from "@/hooks/use-image-options";
import { PluginSlot } from "@/lib/plugin-ui";
import { PromptIsland } from "@/components/prompt-island/prompt-island";
import { AttachmentStrip } from "@/components/prompt-island/attachment-strip";
import { ImageOptionsPanel } from "./image-options-panel";

interface ImageComposerProps {
  modelId: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string;
  refAttachments: PendingAttachment[];
  onAddRefFiles: (files: File[]) => void;
  onRemoveRefAttachment: (idx: number) => void;
  options: ImageOptions;
}

/** Image option chips, reference files and the prompt island */
export function ImageComposer({
  modelId, prompt, onPromptChange, onSubmit, isLoading, error,
  refAttachments, onAddRefFiles, onRemoveRefAttachment, options,
}: ImageComposerProps) {
  const { isCompact } = useVisualViewport();
  const status = isLoading ? "submitted" : "ready";
  const estimate = {
    mode: "image",
    modelId,
    status,
    imageSize: options.resolution as ImageSize,
    webSearch: options.webSearchEnabled,
  };
  return (
    <div className="relative shrink-0">
      <ImageOptionsPanel compact={isCompact} options={options} />
      <PromptIsland
        value={prompt}
        onChange={onPromptChange}
        onSubmit={onSubmit}
        canSubmit={prompt.trim().length > 0}
        isLoading={isLoading}
        placeholder="Опишите изображение..."
        onAddFiles={onAddRefFiles}
        submitTitle="Создать"
        estimate={<PluginSlot id="prompt-estimate" props={estimate} />}
        top={
          <AttachmentStrip
            attachments={refAttachments}
            onRemove={onRemoveRefAttachment}
            caption={`Файлы для контекста (${refAttachments.length}/10)`}
          />
        }
        bottom={
          <>
            {error && (
              <div className="mx-auto mt-2 w-full max-w-4xl rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}
            {!isCompact && <PluginSlot id="prompt-footer" props={{ mode: "image", chatId: null, status }} />}
          </>
        }
        testId="image-input-island"
      />
    </div>
  );
}
