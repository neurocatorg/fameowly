"use client";

import type { PendingAttachment, ReasoningLevel } from "@/lib/types";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { PromptIsland } from "@/components/prompt-island/prompt-island";
import { AttachmentStrip } from "@/components/prompt-island/attachment-strip";
import { ModePanel } from "./mode-panel";

export interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  isLoading: boolean;
  modelUnavailable?: boolean;
  pendingAttachments: PendingAttachment[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (idx: number) => void;
  onRetryAttachment?: (idx: number) => void;
  supportsTemperature: boolean;
  reasoningLevels: readonly ReasoningLevel[];
  reasoningLevel: ReasoningLevel | undefined;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  supportsWebSearch: boolean;
  webSearchEnabled: boolean;
  onWebSearchToggle: () => void;
}

interface Props extends ChatComposerProps {
  isPanelVisible: boolean;
  onFocusChange: (focused: boolean) => void;
}

/** Chat answer options, pending files and the prompt island */
export function ChatComposer({
  input, onInputChange, onSubmit, onStop, isLoading, modelUnavailable,
  pendingAttachments, onAddFiles, onRemoveAttachment, onRetryAttachment,
  isPanelVisible, onFocusChange, ...options
}: Props) {
  const { isCompact } = useVisualViewport();
  return (
    <div className="relative shrink-0">
      <ModePanel isVisible={isPanelVisible} compact={isCompact} {...options} />
      <PromptIsland
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        canSubmit={input.trim().length > 0 || pendingAttachments.length > 0}
        isLoading={isLoading}
        onStop={onStop}
        placeholder={modelUnavailable ? "Выберите новую модель для продолжения общения" : "Спросите Fameowly"}
        disabled={modelUnavailable}
        onAddFiles={onAddFiles}
        onFocusChange={onFocusChange}
        submitTitle="Отправить"
        top={
          <AttachmentStrip
            attachments={pendingAttachments}
            onRemove={onRemoveAttachment}
            onRetry={onRetryAttachment}
          />
        }
        testId="chat-input-island"
      />
    </div>
  );
}
