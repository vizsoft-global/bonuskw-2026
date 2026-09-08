"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, doc } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { LockBadge, PrimaryButton } from "@/components/shared/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCourse } from "@/lib/catalog/queries";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { formatKwdLocale, localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

export default function EbookPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const book = useQuery({ queryKey: ["course", id], queryFn: () => getCourse(id) });
  const owned = useQuery({
    queryKey: ["ebook-access", id, user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(getDb(), collections.ebookAccess),
          where("userRef", "==", doc(getDb(), collections.users, user!.uid)),
          where("courseRef", "==", doc(getDb(), collections.course, id)),
        ),
      );
      return snap.docs.some((d) => d.get("status") === "Ongoing");
    },
  });

  if (!book.data) return <AppShell><p>{t("empty")}</p></AppShell>;
  const data = book.data;

  async function download(fileId: string) {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/ebooks/download", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: id, fileId }),
    });
    const json = (await res.json()) as { url?: string };
    if (json.url) window.open(json.url, "_blank");
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="aspect-[3/4] overflow-hidden rounded-3xl bg-black/20">
          {data.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.image} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">
            {localizedField(data.name, data.nameManualTranslate, data.nameAutoTranslate, locale)}
          </h1>
          <p className="mt-2 text-muted">{data.description}</p>
          <p className="mt-4 text-xl">{formatKwdLocale(data.price, locale)}</p>
          <PrimaryButton
            className="mt-4"
            onClick={() => {
              if (!user) return;
              void loadCart(user.uid).then((cart) =>
                saveCart(
                  user.uid,
                  upsertLine(cart, {
                    kind: "ebook",
                    courseId: id,
                    paymentType: "Full payment",
                    title: data.name,
                    image: data.image,
                    price: data.price,
                    addedAt: Date.now(),
                  }),
                ),
              );
            }}
          >
            {t("addToCart")}
          </PrimaryButton>
          <ul className="mt-6 space-y-2">
            {(data.ebookFiles ?? []).map((file) => (
              <li key={file.id} className="flex items-center justify-between rounded-2xl border border-line px-3 py-2 text-sm">
                <span>{file.name}</span>
                {owned.data ? (
                  <button type="button" onClick={() => void download(file.id)}>{t("download")}</button>
                ) : (
                  <LockBadge locked />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
