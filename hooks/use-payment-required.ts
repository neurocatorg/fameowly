"use client";

import { useCallback, useRef, useState } from "react";
import type { PendingAttachment } from "@/lib/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

/** A request refused for lack of money (HTTP 402): the reason to show and the draft to give back */
export function usePaymentRequired(setInput: SetState<string>, setPendingAttachments: SetState<PendingAttachment[]>) {
  const [reason, setReason] = useState<string | null>(null);
  const draftRef = useRef<{ text: string; pending: PendingAttachment[] } | null>(null);

  /** Called on submit: attachments cannot be rebuilt from the sent message */
  const rememberDraft = useCallback((text: string, pending: PendingAttachment[]) => {
    draftRef.current = { text, pending };
  }, []);

  const onChatRefused = useCallback((why: string, text: string) => {
    setReason(why);
    // Whatever the user typed meanwhile wins
    setInput((current) => current || text);
    const draft = draftRef.current;
    if (draft?.text === text) setPendingAttachments((current) => (current.length ? current : draft.pending));
  }, [setInput, setPendingAttachments]);

  const dismiss = useCallback(() => setReason(null), []);

  return { reason, dismiss, rememberDraft, onChatRefused, onImageRefused: setReason };
}
