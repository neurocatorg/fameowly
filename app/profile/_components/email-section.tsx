"use client";

import { useState } from "react";
import { cardCls, inputCls, labelCls, btnPrimary, btnGhost } from "@/lib/ui-classes";
import { CodeField, CODE_DIGITS } from "@/app/login/_components/code-field";
import { FormError } from "@/app/login/_components/form-error";
import { ResendLine } from "@/app/login/_components/resend-line";
import { useCountdown } from "@/hooks/use-countdown";
import { useJsonPost } from "@/hooks/use-json-post";

interface EmailSectionProps {
  email?: string;
  verified: boolean;
  onSaved: () => void;
}

type Step = "view" | "address" | "code";

/** Bind or change the email: a code goes to the new address */
export function EmailSection({ email, verified, onSaved }: EmailSectionProps) {
  const [step, setStep] = useState<Step>("view");
  const [address, setAddress] = useState("");
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
    if (!res.ok) return;
    setStep("view");
    onSaved();
  }

  function open() {
    setAddress(verified ? "" : email ?? "");
    setError("");
    setStep("address");
  }

  return (
    <section className={`${cardCls} space-y-3`} data-testid="profile-email">
      <h2 className="font-semibold">Email</h2>

      {step === "view" && (
        <>
          <p className="text-sm text-th-fg-s">
            {email ? (
              <>
                <span className="break-all">{email}</span>{" "}
                <span className={verified ? "text-th-fg-m" : "text-amber-400"}>
                  {verified ? "· подтверждён" : "· не подтверждён"}
                </span>
              </>
            ) : (
              "Не привязан. С email можно входить по коду из письма и восстановить пароль."
            )}
          </p>
          <button type="button" onClick={open} className={btnPrimary}>
            {!email ? "Привязать email" : verified ? "Сменить email" : "Подтвердить email"}
          </button>
        </>
      )}

      {step === "address" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="profile-email" className={labelCls}>
              Адрес, на который придёт код
            </label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
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
              {countdown.left > 0 ? `Прислать код через ${countdown.left} с` : "Прислать код"}
            </button>
            <button type="button" onClick={() => setStep("view")} className={btnGhost}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm text-th-fg-s">
            Код отправили на <span className="break-all font-medium text-th-fg">{address}</span>.
          </p>
          <CodeField value={code} onChange={setCode} autoFocus />
          <FormError message={error} />
          <button type="submit" disabled={busy || code.length !== CODE_DIGITS} className={`${btnPrimary} w-full disabled:opacity-50`}>
            Подтвердить
          </button>
          <ResendLine
            secondsLeft={countdown.left}
            busy={busy}
            onResend={() => void sendCode()}
            onChangeEmail={() => setStep("address")}
          />
        </form>
      )}
    </section>
  );
}
