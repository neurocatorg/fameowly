"use client";

import { useState } from "react";
import { useCountdown } from "@/hooks/use-countdown";
import { useSignIn, type CodePurpose } from "@/hooks/use-sign-in";
import { PluginSlot } from "@/lib/plugin-ui";
import { CodeStep } from "./code-step";
import { EmailStep } from "./email-step";
import { PasswordStep } from "./password-step";
import { RequestAccessStep } from "./request-access-step";
import { ResetStep } from "./reset-step";
import { linkCls, noteCls } from "./styles";

type Step = "email" | "code" | "password" | "reset-email" | "reset-code" | "request-access";

const RESEND_SECONDS = 45;

/** Without mail delivery only the password form is offered */
export function LoginFlow({ emailLogin }: { emailLogin: boolean }) {
  const [step, setStep] = useState<Step>(emailLogin ? "email" : "password");
  const [email, setEmail] = useState("");
  const [noAccountHint, setNoAccountHint] = useState(false);
  const countdown = useCountdown();
  const api = useSignIn();

  function go(next: Step) {
    api.setError("");
    setStep(next);
  }

  async function sendCode(purpose: CodePurpose, codeStep: Step) {
    const res = await api.requestCode(email, purpose);
    if (!res.ok) {
      if (!res.retryAfter) return;
      // A code for this address went out moments ago: let the user type it
      countdown.start(res.retryAfter);
      if (step !== codeStep) go(codeStep);
      return;
    }
    if (res.data.next === "request-access") return go("request-access");
    setNoAccountHint(Boolean(res.data.noAccountHint));
    countdown.start(res.data.resendIn ?? RESEND_SECONDS);
    go(codeStep);
  }

  function enter(res: { ok: boolean }) {
    // Full load, so client caches built for a guest are dropped
    if (res.ok) window.location.assign("/");
  }

  const common = { busy: api.busy, error: api.error, secondsLeft: countdown.left, email };

  switch (step) {
    case "email":
      return (
        <EmailStep
          title="Заходим?"
          email={email}
          onEmailChange={setEmail}
          onSubmit={() => sendCode("login", "code")}
          busy={api.busy}
          error={api.error}
        >
          <p className={noteCls}>
            Пароль не нужен. <PluginSlot id="login-legal" />
          </p>
          <button type="button" onClick={() => go("password")} className={`${linkCls} self-center`}>
            Войти по паролю
          </button>
        </EmailStep>
      );

    case "code":
      return (
        <CodeStep
          {...common}
          noAccountHint={noAccountHint}
          onSubmit={(code) => api.verifyCode(email, code).then(enter)}
          onResend={() => sendCode("login", "code")}
          onChangeEmail={() => go("email")}
        />
      );

    case "password":
      return (
        <PasswordStep
          busy={api.busy}
          error={api.error}
          onSubmit={(login, password) => api.passwordLogin(login, password).then(enter)}
        >
          {emailLogin && (
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
              <button type="button" onClick={() => go("email")} className={linkCls}>
                Войти по коду
              </button>
              <button type="button" onClick={() => go("reset-email")} className={linkCls}>
                Забыли пароль?
              </button>
            </div>
          )}
        </PasswordStep>
      );

    case "reset-email":
      return (
        <EmailStep
          title="Восстановление пароля"
          email={email}
          onEmailChange={setEmail}
          onSubmit={() => sendCode("reset_password", "reset-code")}
          busy={api.busy}
          error={api.error}
        >
          <p className={noteCls}>Пришлём код, по нему можно задать новый пароль.</p>
          <button type="button" onClick={() => go("password")} className={`${linkCls} self-center`}>
            Назад ко входу
          </button>
        </EmailStep>
      );

    case "reset-code":
      return (
        <ResetStep
          {...common}
          onSubmit={(code, password) => api.resetPassword(email, code, password).then(enter)}
          onResend={() => sendCode("reset_password", "reset-code")}
          onChangeEmail={() => go("reset-email")}
        />
      );

    case "request-access":
      return <RequestAccessStep email={email} onBack={() => go("email")} />;
  }
}
