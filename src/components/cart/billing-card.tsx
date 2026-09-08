"use client";

import { useEffect, useState } from "react";

export function BillingCard({
  location,
  onSave,
  labels,
}: {
  location?: string;
  onSave: (value: string) => Promise<void>;
  labels: { title: string; edit: string; add: string; save: string };
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(location || "");
  const [busy, setBusy] = useState(false);
  const hasAddress = Boolean(location?.trim());

  useEffect(() => {
    if (!editing) setValue(location || "");
  }, [location, editing]);

  async function save() {
    setBusy(true);
    try {
      await onSave(value.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setValue(location || "");
    setEditing(true);
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      <p className="text-[14px] font-medium text-[#999]">{labels.title}</p>
      {editing ? (
        <div className="flex min-h-[50px] items-start gap-3 rounded-[12px] border-[1.5px] border-white/40 bg-white/15 p-3">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={2}
            placeholder={labels.add}
            className="min-w-0 flex-1 resize-none bg-transparent text-[12px] leading-normal text-[#fafafa] outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="shrink-0 text-[12px] font-medium text-[#f24822] disabled:opacity-60"
          >
            {labels.save}
          </button>
        </div>
      ) : hasAddress ? (
        <div className="flex min-h-[50px] items-center justify-between gap-3 rounded-[12px] border-[1.5px] border-white/40 bg-white/15 px-3 py-2.5">
          <p className="min-w-0 flex-1 whitespace-pre-line text-[12px] leading-normal text-[#fafafa]">{location}</p>
          <button type="button" onClick={startEdit} className="shrink-0 text-[12px] font-medium text-[#f24822]">
            {labels.edit}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="flex min-h-[50px] w-full items-center rounded-[12px] border-[1.5px] border-dashed border-white/40 bg-white/15 px-3 text-start text-[12px] font-medium text-[#fafafa]"
        >
          {labels.add}
        </button>
      )}
    </div>
  );
}
