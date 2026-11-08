"use client";

import { useState } from "react";
import { cardCls, btnPrimary } from "@/lib/ui-classes";
import { EmailBindingForm } from "@/components/email-binding-form";

interface EmailSectionProps {
  email?: string;
  verified: boolean;
  onSaved: () => void;
}

/** Bind or change the email: a code goes to the new address */
export function EmailSection({ email, verified, onSaved }: EmailSectionProps) {
  const [editing, setEditing] = useState(false);

  return (
    <section className={`${cardCls} space-y-3`} data-testid="profile-email">
      <h2 className="font-semibold">Email</h2>

      {editing ? (
        <EmailBindingForm
          initialEmail={verified ? "" : email}
          onBound={() => {
            setEditing(false);
            onSaved();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
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
          <button type="button" onClick={() => setEditing(true)} className={btnPrimary}>
            {!email ? "Привязать email" : verified ? "Сменить email" : "Подтвердить email"}
          </button>
        </>
      )}
    </section>
  );
}
