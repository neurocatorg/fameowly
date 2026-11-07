"use client";

import { useState } from "react";
import { cardCls, inputCls, labelCls, btnPrimary } from "@/lib/ui-classes";
import { FormError } from "@/app/login/_components/form-error";
import { useJsonPost } from "@/hooks/use-json-post";

interface NameSectionProps {
  name: string;
  onSaved: () => void;
}

export function NameSection({ name, onSaved }: NameSectionProps) {
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(false);
  const { busy, error, post } = useJsonPost();
  const changed = value.trim() !== name && value.trim() !== "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await post("/api/profile", { name: value }, "PATCH");
    if (!res.ok) return;
    setSaved(true);
    onSaved();
  }

  return (
    <form onSubmit={save} className={`${cardCls} space-y-3`} data-testid="profile-name">
      <h2 className="font-semibold">Имя</h2>
      <div>
        <label htmlFor="profile-name" className={labelCls}>
          Как к вам обращаться
        </label>
        <input
          id="profile-name"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          maxLength={64}
          className={inputCls}
          style={{ fontSize: "16px" }}
        />
      </div>
      <FormError message={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !changed} className={`${btnPrimary} disabled:opacity-50`}>
          Сохранить
        </button>
        {saved && !changed && <span className="text-sm text-th-fg-m">Сохранено</span>}
      </div>
    </form>
  );
}
