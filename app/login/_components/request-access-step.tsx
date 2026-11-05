"use client";

import { PluginSlot } from "@/lib/plugin-ui";
import { linkCls, noteCls, titleCls } from "./styles";

interface RequestAccessStepProps {
  email: string;
  onBack: () => void;
}

/** Shown when the registration policy asks for an access request; a plugin supplies the form */
export function RequestAccessStep({ email, onBack }: RequestAccessStepProps) {
  return (
    <PluginSlot
      id="login-request-access"
      props={{ email, onBack }}
      fallback={
        <div className="flex flex-col items-center gap-4">
          <h1 className={titleCls}>Аккаунта пока нет</h1>
          <p className={noteCls}>Чтобы получить доступ, обратитесь к администратору.</p>
          <button type="button" onClick={onBack} className={linkCls}>
            Другой email
          </button>
        </div>
      }
    />
  );
}
