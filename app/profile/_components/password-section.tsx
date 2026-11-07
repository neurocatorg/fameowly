"use client";

import { useState } from "react";
import { cardCls, inputCls, labelCls, btnPrimary, btnGhost } from "@/lib/ui-classes";
import { CodeField, CODE_DIGITS } from "@/app/login/_components/code-field";
import { FormError } from "@/app/login/_components/form-error";
import { useJsonPost } from "@/hooks/use-json-post";

interface PasswordSectionProps {
  hasPassword: boolean;
  /** Lets a forgotten current password be replaced by a code */
  email?: string;
  onSaved: () => void;
}

type Proof = "password" | "code";

/** Set a first password, or change it with the current one or a code from the mail */
export function PasswordSection({ hasPassword, email, onSaved }: PasswordSectionProps) {
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<Proof>("password");
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const { busy, error, setError, post } = useJsonPost();

  function reset(show: boolean) {
    setOpen(show);
    setProof("password");
    setCurrent("");
    setCode("");
    setNext("");
    setError("");
  }

  async function sendCode() {
    const res = await post("/api/auth/email/start", { email, purpose: "reset_password" });
    if (res.ok) setProof("code");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await post("/api/auth/password", {
      newPassword: next,
      ...(hasPassword && proof === "password" ? { currentPassword: current } : {}),
      ...(hasPassword && proof === "code" ? { code } : {}),
    });
    if (!res.ok) return;
    reset(false);
    setDone(true);
    onSaved();
  }

  const proofMissing = hasPassword && (proof === "password" ? !current : code.length !== CODE_DIGITS);

  return (
    <section className={`${cardCls} space-y-3`} data-testid="profile-password">
      <h2 className="font-semibold">Пароль</h2>

      {!open ? (
        <>
          <p className="text-sm text-th-fg-s">
            {done
              ? "Пароль сохранён. На других устройствах нужно войти заново."
              : hasPassword
                ? "Пароль задан."
                : "Пароль не задан — вы входите по коду из письма. Пароль можно задать по желанию."}
          </p>
          <button type="button" onClick={() => { reset(true); setDone(false); }} className={btnPrimary}>
            {hasPassword ? "Сменить пароль" : "Задать пароль"}
          </button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-3">
          {hasPassword && proof === "password" && (
            <div>
              <label htmlFor="profile-current-password" className={labelCls}>
                Текущий пароль
              </label>
              <input
                id="profile-current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={inputCls}
                style={{ fontSize: "16px" }}
                autoFocus
              />
              {email && (
                <button type="button" onClick={() => void sendCode()} disabled={busy} className="mt-2 text-sm text-th-accent hover:underline disabled:opacity-50">
                  Не помню — прислать код на {email}
                </button>
              )}
            </div>
          )}
          {hasPassword && proof === "code" && (
            <div className="space-y-1">
              <p className="text-sm text-th-fg-s">
                Код отправили на <span className="break-all font-medium text-th-fg">{email}</span>.
              </p>
              <CodeField value={code} onChange={setCode} autoFocus />
            </div>
          )}
          <div>
            <label htmlFor="profile-new-password" className={labelCls}>
              Новый пароль
            </label>
            <input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputCls}
              style={{ fontSize: "16px" }}
              autoFocus={!hasPassword}
              minLength={6}
              required
            />
          </div>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || proofMissing || !next} className={`${btnPrimary} disabled:opacity-50`}>
              Сохранить пароль
            </button>
            <button type="button" onClick={() => reset(false)} className={btnGhost}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
