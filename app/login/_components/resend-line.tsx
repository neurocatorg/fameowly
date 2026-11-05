"use client";

import { linkCls, noteCls } from "./styles";

interface ResendLineProps {
  secondsLeft: number;
  busy: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
}

export function ResendLine({ secondsLeft, busy, onResend, onChangeEmail }: ResendLineProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className={noteCls}>
        Не нашли письмо? Загляните в «Спам».
        {secondsLeft > 0 && <> Отправить снова можно через {secondsLeft} с.</>}
      </p>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
        {secondsLeft <= 0 && (
          <button type="button" onClick={onResend} disabled={busy} className={linkCls}>
            Отправить снова
          </button>
        )}
        <button type="button" onClick={onChangeEmail} className={linkCls}>
          Другой email
        </button>
      </div>
    </div>
  );
}
