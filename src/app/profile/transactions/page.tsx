"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { ProfilePane } from "@/components/profile/pane";
import { ProfileTabs } from "@/components/profile/ui";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCourse } from "@/lib/catalog/queries";
import { asDate, formatDate, isEbookCourse } from "@/lib/format";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc, OrderItem, OrderLine } from "@/lib/types/firestore";

type TxKind = "course" | "ebook";
type TxRow = {
  key: string;
  orderId: string;
  kind: TxKind;
  title: string;
  image?: string;
  author?: string;
  amount: number;
  date?: Date | null;
  batch?: string;
};

export default function TransactionsPage() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<"all" | TxKind>("all");
  const orders = useQuery({
    queryKey: ["orders", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.orders), where("userRef", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs;
    },
  });

  const rows = useQuery({
    queryKey: ["order-rows", user?.uid, (orders.data ?? []).map((d) => d.id).join(",")],
    enabled: Boolean(orders.data),
    queryFn: async () => {
      const docs = orders.data ?? [];
      const courseIds = new Set<string>();
      for (const order of docs) {
        const lines = (order.get("lines") as OrderLine[] | undefined) ?? [];
        const items = (order.get("order_items") as OrderItem[] | undefined) ?? [];
        for (const line of lines) if (line.courseRef?.id) courseIds.add(line.courseRef.id);
        for (const item of items) if (item.courseRef?.id) courseIds.add(item.courseRef.id);
      }
      const courses = new Map<string, CourseDoc & { id: string }>();
      await Promise.all(
        [...courseIds].map(async (id) => {
          const course = await getCourse(id);
          if (course) courses.set(id, course);
        }),
      );
      const out: TxRow[] = [];
      for (const order of docs) {
        const created = asDate(order.get("createdAt"));
        const lines = (order.get("lines") as OrderLine[] | undefined) ?? [];
        const items = (order.get("order_items") as OrderItem[] | undefined) ?? [];
        const source = lines.length ? lines : items;
        if (!source.length) {
          out.push({
            key: order.id,
            orderId: order.id,
            kind: "course",
            title: String(order.get("orderID") || order.id),
            amount: Number(order.get("dueNow") || order.get("cartTotal") || 0),
            date: created,
          });
          continue;
        }
        source.forEach((line, i) => {
          const rec = line as OrderLine & OrderItem;
          const courseId = rec.courseRef?.id;
          const course = courseId ? courses.get(courseId) : undefined;
          const kind: TxKind =
            rec.kind === "ebook" || rec.itemKind === "ebook" || isEbookCourse(course) ? "ebook" : "course";
          const title = rec.courseName || rec.chapterName || course?.name || String(order.get("orderID") || order.id);
          const amount =
            Number(rec.amountNow || rec.amountTotal || rec.subTotal || 0) ||
            Number(order.get("dueNow") || order.get("cartTotal") || 0);
          out.push({
            key: `${order.id}-${i}`,
            orderId: order.id,
            kind,
            title: String(title),
            image: rec.courseImage || course?.image,
            amount,
            date: created,
          });
        });
      }
      return out;
    },
  });

  const all = rows.data ?? [];
  const visible = tab === "all" ? all : all.filter((row) => row.kind === tab);
  const courses = all.filter((row) => row.kind === "course").length;
  const books = all.filter((row) => row.kind === "ebook").length;

  async function invoice(orderId: string) {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/invoices/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json()) as { url?: string };
    if (json.url) window.open(json.url, "_blank");
  }

  const tabs = useMemo(
    () => [
      { id: "all", label: t("all"), count: all.length },
      { id: "course", label: t("coursesUnit"), count: courses },
      { id: "ebook", label: t("ebooks"), count: books },
    ],
    [all.length, books, courses, t],
  );

  return (
    <ProfilePane
      loading={orders.isPending || (Boolean(orders.data) && rows.isPending)}
      title={t("transactions")}
      skeleton={<ListPageSkeleton />}
    >
      <ProfileTabs tabs={tabs} value={tab} onChange={(id) => setTab(id as typeof tab)} />
      {visible.length ? (
        <div className="mt-4 flex flex-col gap-2.5">
          {visible.map((row) =>
            row.kind === "ebook" ? (
              <button
                key={row.key}
                type="button"
                onClick={() => void invoice(row.orderId)}
                className="flex w-full items-center gap-3 rounded-[12px] bg-[#141414] p-1 text-start"
              >
                <span className="h-[79px] w-[59px] shrink-0 overflow-hidden rounded-[8px] bg-[#1a1a1a]">
                  {row.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.image} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-between py-1">
                  <span>
                    <span className="line-clamp-1 text-[14px] font-medium text-[#fafafa]">{row.title}</span>
                    {row.author ? <span className="block text-[12px] text-[#999]">{row.author}</span> : null}
                  </span>
                  <span className="mt-2 flex items-end justify-between">
                    <span className="text-[16px] font-semibold text-[#fafafa]">{formatKwdLocale(row.amount, locale)}</span>
                    <span className="text-[12px] text-[#999]">{row.date ? formatDate(row.date) : ""}</span>
                  </span>
                </span>
              </button>
            ) : (
              <button
                key={row.key}
                type="button"
                onClick={() => void invoice(row.orderId)}
                className="flex w-full gap-3 rounded-[12px] bg-[#141414] p-1 text-start"
              >
                <span className="h-[86px] w-[154px] shrink-0 overflow-hidden rounded-[8px] bg-[#1a1a1a]">
                  {row.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.image} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-between py-1">
                  <span>
                    <span className="line-clamp-2 text-[14px] font-medium text-[#fafafa]">{row.title}</span>
                    <span className="mt-1 block text-[12px] text-[#999]">{row.date ? formatDate(row.date) : ""}</span>
                  </span>
                  <span className="flex items-end justify-between gap-2">
                    {row.batch ? (
                      <span className="rounded-[6px] bg-[#545454] px-1.5 py-0.5 text-[10px] text-white">{row.batch}</span>
                    ) : (
                      <span />
                    )}
                    <span className="text-[16px] font-semibold text-[#fafafa]">{formatKwdLocale(row.amount, locale)}</span>
                  </span>
                </span>
              </button>
            ),
          )}
        </div>
      ) : (
        <EmptyState
          icon="/profile/receipt.svg"
          title={t("emptyTransactionsTitle")}
          body={t("emptyTransactionsBody")}
          cta={{ href: "/", label: t("explore") }}
        />
      )}
    </ProfilePane>
  );
}
