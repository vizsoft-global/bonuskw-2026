"use client";

import { useEffect, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { Camera, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { Avatar } from "@/components/layout/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  avatarSeed,
  avatarSrc,
  generatedAvatar,
  randomAvatarSeed,
  seedFromText,
  seedOfGeneratedAvatar,
} from "@/lib/avatar";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";
import { squareThumbnail } from "@/lib/profile/resize-image";
import { cn } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

type Draft =
  | { kind: "generated"; seed: string; url: string }
  | { kind: "upload"; file: Blob; url: string };

/**
 * The avatar itself, tappable: opens the editor where the student can shuffle
 * a new random character, name one, or upload their own photo.
 */
export function EditableAvatar({ className }: { className?: string }) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const name = profile?.display_name || user?.displayName || "";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("changePhoto")}
        className="group relative inline-flex rounded-full outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <Avatar src={avatarSrc(profile, user?.uid)} name={name} className={className} />
        <span className="absolute -bottom-0.5 -end-0.5 grid size-7 place-items-center rounded-full border-2 border-[#050505] bg-[#fafafa] text-[#050505] shadow group-hover:brightness-95">
          <Pencil className="size-3.5" />
        </span>
      </button>
      {open ? <AvatarEditor open onOpenChange={setOpen} /> : null}
    </>
  );
}

/** Mounted fresh each time it opens, so state starts from the current avatar. */
export function AvatarEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft | null>(null);
  // Prefill the name box if the current avatar is a named character.
  const [text, setText] = useState(() => {
    const current = seedOfGeneratedAvatar(profile?.photo_url);
    return current && !/^\+?\d+$/.test(current) ? current.replace(/-/g, " ") : "";
  });
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const name = profile?.display_name || user?.displayName || "";

  useEffect(() => {
    return () => {
      if (draft?.kind === "upload") URL.revokeObjectURL(draft.url);
    };
  }, [draft]);

  const shown = draft?.url ?? avatarSrc(profile, user?.uid);

  function shuffle() {
    const seed = randomAvatarSeed();
    setText(seed.replace(/-/g, " "));
    setDraft({ kind: "generated", seed, url: generatedAvatar(seed) });
  }

  function fromText(value: string) {
    setText(value);
    const seed = seedFromText(value);
    if (!seed) {
      setDraft(null);
      return;
    }
    setDraft({ kind: "generated", seed, url: generatedAvatar(seed) });
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("avatarNotImage"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t("avatarTooLarge"));
      return;
    }
    try {
      const blob = await squareThumbnail(file);
      setDraft({ kind: "upload", file: blob, url: URL.createObjectURL(blob) });
    } catch {
      toast.error(t("avatarNotImage"));
    }
  }

  async function save() {
    if (!user || !draft) return;
    setBusy(true);
    try {
      if (draft.kind === "generated") {
        await updateDoc(doc(getDb(), collections.users, user.uid), { photo_url: draft.url });
      } else {
        const form = new FormData();
        form.set("file", draft.file, "avatar.jpg");
        const res = await fetch("/api/profile/photo", {
          method: "POST",
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          body: form,
        });
        if (!res.ok) throw new Error("upload");
      }
      await refreshProfile();
      toast.success(t("avatarSaved"));
      onOpenChange(false);
    } catch {
      toast.error(t("avatarUploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!user) return;
    setBusy(true);
    try {
      const seed = avatarSeed({ ...profile, photo_url: null }, user.uid);
      await updateDoc(doc(getDb(), collections.users, user.uid), { photo_url: generatedAvatar(seed) });
      await refreshProfile();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("avatarTitle")}
      description={t("avatarHint")}
      footer={
        <div className="flex flex-col gap-2">
          <Button block size="lg" disabled={!draft || busy} onClick={() => void save()}>
            {busy ? t("saving") : t("useThisAvatar")}
          </Button>
          <Button block variant="ghost" size="sm" disabled={busy} onClick={() => void reset()}>
            {t("resetAvatar")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-5">
        <Avatar
          key={shown}
          src={shown}
          name={name}
          className={cn("size-[132px] text-4xl transition-opacity", busy && "opacity-60")}
        />

        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="secondary" onClick={shuffle} disabled={busy}>
            <RefreshCw className="size-4" /> {t("shuffleAvatar")}
          </Button>
          <Button variant="secondary" onClick={() => picker.current?.click()} disabled={busy}>
            <Camera className="size-4" /> {t("uploadPhoto")}
          </Button>
        </div>

        <Input
          label={t("avatarSeedLabel")}
          hint={t("avatarSeedHint")}
          suffix={<Sparkles className="size-4" />}
          value={text}
          onChange={(e) => fromText(e.target.value)}
          placeholder={t("avatarSeedPlaceholder")}
          className="w-full"
          maxLength={40}
        />

        <input
          ref={picker}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </Sheet>
  );
}
