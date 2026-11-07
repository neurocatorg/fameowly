"use client";

import { PluginSlot } from "@/lib/plugin-ui";
import { Toast } from "./toast";

interface PaymentRequiredProps {
  /** Server refusal of a 402; null when there is nothing to show */
  reason: string | null;
  onClose: () => void;
}

/** A plugin may explain a 402 and offer a top-up; otherwise the refusal is a toast */
export function PaymentRequired({ reason, onClose }: PaymentRequiredProps) {
  if (!reason) return null;
  return (
    <PluginSlot
      id="payment-required"
      props={{ reason, onClose }}
      fallback={<Toast message={reason} duration={5000} onDone={onClose} />}
    />
  );
}
