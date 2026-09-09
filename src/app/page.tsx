"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { BrandLogo } from "@/components/layout/brand";
import { AppShell } from "@/components/layout/app-shell";
import { CourseCard, PrimaryButton, StatChip } from "@/components/shared/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { exploreCourses, listCourses } from "@/lib/catalog/queries";
import { upsertLine, loadCart, saveCart } from "@/lib/cart/store";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { formatKwdLocale, localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc, SettingsDoc } from "@/lib/types/firestore";

export default function HomePage() {
  const { user, profile, ready, needsOnboarding, kicked } = useAuth();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setSplash(false), 900);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!ready || splash) return;
    if (kicked) router.replace("/session-ended");
    else if (user && needsOnboarding) router.replace("/onboarding");
  }, [ready, splash, kicked, user, needsOnboarding, router]);

  if (!ready || splash || !user || needsOnboarding) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div>
          <BrandLogo size="lg" className="mx-auto" />
          <p className="mt-2 text-muted">{t("splash")}</p>
          {!splash && ready && !user ? (
            <div className="mt-8 flex flex-col gap-3">
              <Link href="/login?mode=signup" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
                {t("signUpMobile")}
              </Link>
              <Link href="/login?mode=login" className="text-sm text-muted">
                {t("haveAccount")}
              </Link>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <AppShell>
      <HomeBody uid={user.uid} branchId={profile?.branchRef?.id} />
    </AppShell>
  );
}

function HomeBody({ uid, branchId }: { uid: string; branchId?: string }) {
  const { t, locale } = useI18n();
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const stories = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const snap = await getDocs(collection(getDb(), collections.settings));
      const main = snap.docs.find((d) => d.get("type") === "Main")?.data() as SettingsDoc | undefined;
      return (main?.settings_status ?? []).filter((item) => item?.image || item?.type);
    },
  });
  const stats = useQuery({
    queryKey: ["stats", uid],
    queryFn: async () => {
      const snap = await getDoc(doc(getDb(), collections.userStats, uid));
      return snap.data() as { streakDays?: number; studySeconds?: number } | undefined;
    },
  });
  const subs = useQuery({
    queryKey: ["subs", uid],
    queryFn: async () => {
      const { query, where, collection: col, getDocs } = await import("firebase/firestore");
      const snap = await getDocs(
        query(col(getDb(), collections.subscription), where("userRef", "==", doc(getDb(), collections.users, uid))),
      );
      return snap.docs.filter((d) => d.get("status") === "Ongoing");
    },
  });

  const explore = exploreCourses(courses.data ?? [], branchId ? ({ branchRef: { id: branchId } } as never) : null).slice(0, 12);
  const hours = Math.round((stats.data?.studySeconds || 0) / 3600);

  async function enrol(course: CourseDoc & { id: string }) {
    const cart = await loadCart(uid);
    await saveCart(
      uid,
      upsertLine(cart, {
        kind: "course",
        courseId: course.id,
        paymentType: "Full payment",
        title: course.name,
        image: course.image,
        price: course.price,
        addedAt: Date.now(),
      }),
    );
    window.location.href = "/cart";
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-3 overflow-x-auto hide-scrollbar">
        {(stories.data ?? []).map((story, i) => (
          <Link key={i} href={`/stories?i=${i}`} className="w-16 shrink-0 text-center">
            <span className="story-ring grid size-16 place-items-center rounded-full p-[2px]">
              <span className="size-full overflow-hidden rounded-full bg-surface">
                {story.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={story.image} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
            </span>
            <span className="mt-1 block truncate text-[11px] text-muted">{story.title || "Story"}</span>
          </Link>
        ))}
      </div>
      <div className="flex gap-2">
        <StatChip label={t("streak")} value={`${stats.data?.streakDays || 0}`} />
        <StatChip label={t("activeCourses")} value={`${subs.data?.length || 0}`} />
        <StatChip label={t("studyTime")} value={`${hours}h`} />
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("continueLearning")}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(subs.data ?? []).slice(0, 3).map((sub) => (
            <CourseCard
              key={sub.id}
              href={`/course/${sub.get("courseRef")?.id}/learn`}
              title={t("resume")}
              action={<PrimaryButton>{t("resume")}</PrimaryButton>}
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("explore")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {explore.map((course) => (
            <CourseCard
              key={course.id}
              href={`/course/${course.id}`}
              title={localizedField(course.name, course.nameManualTranslate, course.nameAutoTranslate, locale)}
              image={course.image}
              badge={course.batchesRef ? "Batch" : undefined}
              price={formatKwdLocale(course.price, locale)}
              action={<PrimaryButton onClick={() => void enrol(course)}>{t("enroll")}</PrimaryButton>}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
