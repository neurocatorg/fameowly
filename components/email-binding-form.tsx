"use client";

import { useId, useState } from "react";
import { inputCls, labelCls, btnPrimary, btnGhost } from "@/lib/ui-classes";
import { CodeField, CODE_DIGITS } from "@/app/login/_components/code-field";
import { FormError } from "@/app/login/_components/form-error";
import { ResendLine } from "@/app/login/_components/resend-line";
import { useCountdown } from "@/hooks/use-countdown";
import { useJsonPost } from "@/hooks/use-json-post";

interface EmailBindingFormProps {
  initialEmail?: string;
  onBound: () => void;
  onCancel?: () => void;
}

/** Address → code sent there → bound to the signed-in account */
export function EmailBindingForm({ initialEmail = "", onBound, onCancel }: EmailBindingFormProps) {
  const inputId = useId();
  const [step, setStep] = useState<"address" | "code">("address");
  const [address, setAddress] = useState(initialEmail);
  const [code, setCode] = useState("");
  const { busy, error, setError, post } = useJsonPost();
  const countdown = useCountdown();

  async function sendCode() {
    const res = await post<{ resendIn: number }>("/api/profile/email/start", { email: address });
    if (res.ok) {
      countdown.start(res.data.resendIn);
      setCode("");
      setStep("code");
    } else if (res.retryAfter) {
      countdown.start(res.retryAfter);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    const res = await post("/api/profile/email/verify", { email: address, code });
    if (res.ok) {
      onBound();
    } else if (res.status === 409) {
      // Taken by another account: keep the message, ask for another address
      setAddress("");
      countdown.start(0);
      setStep("address");
    }
  }

  function changeAddress() {
    setError("");
    countdown.start(0);
    setStep("address");
  }

  if (step === "code") {
    return (
      <form onSubmit={confirm} className="space-y-3">
        <p className="text-sm text-th-fg-s">
          Код отправили на <span className="break-all font-medium text-th-fg">{address}</span>.
        </p>
        <CodeField value={code} onChange={setCode} autoFocus />
        <FormError message={error} />
        <button type="submit" disabled={busy || code.length !== CODE_DIGITS} className={`${btnPrimary} w-full disabled:opacity-50`}>
          Подтвердить
        </button>
        <ResendLine secondsLeft={countdown.left} busy={busy} onResend={() => void sendCode()} onChangeEmail={changeAddress} />
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void sendCode();
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor={inputId} className={labelCls}>
          Ваш email
        </label>
        <input
          id={inputId}
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputCls}
          style={{ fontSize: "16px" }}
          autoFocus
          required
        />
      </div>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || countdown.left > 0} className={`${btnPrimary} disabled:opacity-50`}>
          {countdown.left > 0 ? `Получить код через ${countdown.left} с` : "Получить код"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnGhost}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}
