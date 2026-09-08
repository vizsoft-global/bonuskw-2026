"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { CourseCard, RatingStars } from "@/components/shared/ui";
import { listCourses } from "@/lib/catalog/queries";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { isEbookCourse } from "@/lib/format";
import { useI18n } from "@/lib/i18n/locale";
import type { UserDoc } from "@/lib/types/firestore";

export default function InstructorPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [tab, setTab] = useState<"courses" | "ebooks">("courses");
  const user = useQuery({
    queryKey: ["instructor", id],
    queryFn: async () => {
      const snap = await getDoc(doc(getDb(), collections.users, id));
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as UserDoc) }) : null;
    },
  });
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const mine = (courses.data ?? []).filter((c) => c.authorRef?.id === id && c.status !== "Draft");

  return (
    <AppShell>
      <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-black to-accent/30 p-6">
        <div className="flex items-center gap-4">
          <span className="size-16 overflow-hidden rounded-full bg-white/10">
            {user.data?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.data.photo_url} alt="" className="h-full w-full object-cover" />
            ) : null}
          </span>
          <div>
            <h1 className="text-xl font-semibold">{user.data?.display_name || t("instructor")}</h1>
            <RatingStars value={4.8} />
            <p className="text-sm text-muted">
              {mine.filter((c) => !isEbookCourse(c)).length} {t("lessons")} · {mine.filter((c) => isEbookCourse(c)).length} ebooks
            </p>
          </div>
        </div>
      </div>
      <div className="mb-4 flex gap-3 text-sm">
        <button type="button" onClick={() => setTab("courses")}>{t("explore")}</button>
        <button type="button" onClick={() => setTab("ebooks")}>{t("store")}</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {mine
          .filter((c) => (tab === "ebooks" ? isEbookCourse(c) : !isEbookCourse(c)))
          .map((course) => (
            <CourseCard
              key={course.id}
              href={isEbookCourse(course) ? `/store/${course.id}` : `/course/${course.id}`}
              title={course.name || ""}
              image={course.image}
            />
          ))}
      </div>
    </AppShell>
  );
}
