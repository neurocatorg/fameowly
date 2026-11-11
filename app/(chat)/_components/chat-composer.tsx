"use client";

import type { ChatStatus, PendingAttachment, ReasoningLevel } from "@/lib/types";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { PluginSlot } from "@/lib/plugin-ui";
import { PromptIsland } from "@/components/prompt-island/prompt-island";
import { AttachmentStrip } from "@/components/prompt-island/attachment-strip";
import { ModePanel } from "./mode-panel";

export interface ChatComposerProps {
  modelId: string;
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
  chatId: string | null;
  status: ChatStatus;
  /** Text length of the loaded history, for the estimate of a chat with no measured context */
  historyChars: number;
  isPanelVisible: boolean;
  onFocusChange: (focused: boolean) => void;
}

/** Chat answer options, pending files and the prompt island */
export function ChatComposer({
  modelId, input, onInputChange, onSubmit, onStop, isLoading, modelUnavailable,
  pendingAttachments, onAddFiles, onRemoveAttachment, onRetryAttachment,
  chatId, status, historyChars, isPanelVisible, onFocusChange, ...options
}: Props) {
  const { isCompact } = useVisualViewport();
  const estimate = {
    mode: "chat",
    modelId,
    chatId,
    status,
    text: input,
    attachments: pendingAttachments
      .filter((a) => !a.error)
      .map((a) => ({ mimeType: a.file.type, size: a.file.size })),
    reasoningLevel: options.reasoningLevel,
    webSearch: options.supportsWebSearch && options.webSearchEnabled,
    historyChars,
  };
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
        estimate={!modelUnavailable && <PluginSlot id="prompt-estimate" props={estimate} />}
        top={
          <AttachmentStrip
            attachments={pendingAttachments}
            onRemove={onRemoveAttachment}
            onRetry={onRetryAttachment}
          />
        }
        bottom={!isCompact && <PluginSlot id="prompt-footer" props={{ mode: "chat", chatId, status }} />}
        testId="chat-input-island"
      />
    </div>
  );
}
