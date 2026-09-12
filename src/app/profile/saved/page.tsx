"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { arrayRemove, doc, updateDoc } from "firebase/firestore";
import { ExploreGridCard, exploreGridClass, type ExploreItem } from "@/components/home/explore-card";
import { ProfilePane } from "@/components/profile/pane";
import { ProfileTabs } from "@/components/profile/ui";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { purchaseKindFor, usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { getBatch, getCourse, getDocsByIds } from "@/lib/catalog/queries";
import { avatarSrc } from "@/lib/avatar";
import { isEbookCourse } from "@/lib/format";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc } from "@/lib/types/firestore";
import { cn } from "@/lib/utils";
import { courseThumb } from "@/lib/course/thumb";

export default function SavedPage() {
  const { user, profile, refreshProfile } = useAuth();
  const gate = usePurchaseGate();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<"course" | "ebook">("course");
  const refs = profile?.fvrtCourseList ?? [];

  const saved = useQuery({
    queryKey: ["saved-courses", refs.map((r) => r.id).join(",")],
    enabled: refs.length > 0,
    queryFn: async () => {
      const rows = (await Promise.all(refs.map((ref) => getCourse(ref.id)))).filter(
        (row): row is CourseDoc & { id: string } => Boolean(row),
      );
      const authorIds = [...new Set(rows.map((c) => c.authorRef?.id).filter(Boolean) as string[])];
      const batchIds = [...new Set(rows.map((c) => c.batchesRef?.id).filter(Boolean) as string[])];
      const authorRows = await getDocsByIds(collections.users, authorIds);
      const authors = Object.fromEntries(
        Object.entries(authorRows).map(([id, row]) => [
          id,
          {
            name: String(row.display_name || ""),
            photo: avatarSrc(
              { display_name: row.display_name, email: row.email, photo_url: row.photo_url, phoneE164: row.phoneE164 },
              id,
            ),
          },
        ]),
      );
      const batches = Object.fromEntries(
        await Promise.all(
          batchIds.map(async (id) => {
            const row = await getBatch(id);
            return [id, row?.name || ""] as const;
          }),
        ),
      );
      return { rows, authors, batches };
    },
  });

  const items: ExploreItem[] = useMemo(() => {
    const data = saved.data;
    if (!data) return [];
    return data.rows.map((course) => ({
      id: course.id,
      name: localizedField(course.name, course.nameManualTranslate, course.nameAutoTranslate, locale),
      image: courseThumb(course),
      rating: Number(course.totalRatting || 0),
      author: course.authorRef?.id ? data.authors[course.authorRef.id]?.name : undefined,
      authorPhoto: course.authorRef?.id ? data.authors[course.authorRef.id]?.photo : undefined,
      lessons: Number(course.numberLessons || 0),
      hours: Number(course.totalHours || course.totalCourseHour || 0),
      batch: course.batchesRef?.id ? data.batches[course.batchesRef.id] : undefined,
      saved: true,
      href: isEbookCourse(course) ? `/store/${course.id}` : `/course/${course.id}`,
    }));
  }, [saved.data, locale]);

  const courses = items.filter((item) => !item.href?.startsWith("/store/"));
  const books = items.filter((item) => item.href?.startsWith("/store/"));
  const visible = tab === "course" ? courses : books;
  const labels = {
    enroll: t("enroll"),
    lessons: t("lessons"),
    hrs: t("hrs"),
    save: t("bookmark"),
    saved: t("saved"),
  };

  async function enrol(id: string) {
    if (!user) return;
    const course = saved.data?.rows.find((row) => row.id === id);
    if (gate.blockFor(purchaseKindFor(course))) return;
    const cart = await loadCart(user.uid);
    await saveCart(
      user.uid,
      upsertLine(cart, {
        kind: course && isEbookCourse(course) ? "ebook" : "course",
        courseId: id,
        paymentType: "Full payment",
        title: course?.name,
        image: course ? courseThumb(course) : undefined,
        price: Number(course?.price) || 0,
        addedAt: Date.now(),
      }),
    );
    router.push("/cart");
  }

  async function unsave(courseId: string) {
    if (!user) return;
    await updateDoc(doc(getDb(), collections.users, user.uid), {
      fvrtCourseList: arrayRemove(doc(getDb(), collections.course, courseId)),
    });
    await refreshProfile();
  }

  return (
    <ProfilePane
      title={t("savedCourses")}
      loading={refs.length > 0 && saved.isPending}
      skeleton={<ListPageSkeleton />}
    >
      <ProfileTabs
        tabs={[
          { id: "course", label: t("coursesUnit"), count: courses.length },
          { id: "ebook", label: t("ebooks"), count: books.length },
        ]}
        value={tab}
        onChange={(id) => setTab(id as "course" | "ebook")}
      />
      {visible.length ? (
        <div className={cn("mt-5", exploreGridClass, "lg:grid-cols-4")}>
          {visible.map((item) => (
            <ExploreGridCard
              key={item.id}
              item={item}
              labels={labels}
              onEnroll={() => void enrol(item.id)}
              onSave={() => void unsave(item.id)}
              enrollBlocked={gate.blockFor(tab === "ebook" ? "ebook" : "course")}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="/home/bookmark.svg"
          title={t("emptySavedTitle")}
          body={t("emptySavedBody")}
          cta={{ href: "/", label: t("explore") }}
        />
      )}
    </ProfilePane>
  );
}
