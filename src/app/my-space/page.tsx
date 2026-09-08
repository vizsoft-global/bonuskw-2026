"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { CourseCard, StatChip } from "@/components/shared/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function MySpacePage() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const stats = useQuery({
    queryKey: ["stats", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => (await getDoc(doc(getDb(), collections.userStats, user!.uid))).data(),
  });
  const courses = useQuery({
    queryKey: ["my-subs", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.subscription), where("userRef", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs.filter((d) => d.get("status") === "Ongoing");
    },
  });
  const books = useQuery({
    queryKey: ["my-books", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.ebookAccess), where("userRef", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs.filter((d) => d.get("status") === "Ongoing");
    },
  });

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-semibold">{t("mySpace")}</h1>
      <div className="mb-6 flex gap-2">
        <StatChip label={t("streak")} value={`${stats.data?.streakDays || 0}`} />
        <StatChip label={t("activeCourses")} value={`${courses.data?.length || 0}`} />
        <StatChip label={t("studyTime")} value={`${Math.round((stats.data?.studySeconds || 0) / 3600)}h`} />
      </div>
      <h2 className="mb-2 font-medium">{t("myCourses")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(courses.data ?? []).map((sub) => (
          <CourseCard key={sub.id} href={`/course/${sub.get("courseRef")?.id}/learn`} title={t("resume")} />
        ))}
      </div>
      <h2 className="mb-2 mt-6 font-medium">{t("myEbooks")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(books.data ?? []).map((book) => (
          <CourseCard key={book.id} href={`/store/${book.get("courseRef")?.id}`} title={t("store")} />
        ))}
      </div>
      <h2 className="mb-2 mt-6 font-medium">{t("saved")}</h2>
      <div className="flex flex-wrap gap-2">
        {(profile?.fvrtCourseList ?? []).map((ref) => (
          <Link key={ref.id} href={`/course/${ref.id}`} className="rounded-full border border-line px-3 py-1 text-sm">
            {ref.id}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
