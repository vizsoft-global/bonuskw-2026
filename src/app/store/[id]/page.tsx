"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { CourseHeaderActions } from "@/components/course/header-actions";
import { CourseCover, CourseInfo } from "@/components/course/hero";
import { EnrollCta } from "@/components/course/enroll-cta";
import { InstructorCard } from "@/components/course/instructor-card";
import { ResourceRow } from "@/components/course/resource-row";
import { ExploreGridCard, exploreRailClass, type ExploreItem } from "@/components/home/explore-card";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseDetailsSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { getCourse, listCourses, storeEbooks } from "@/lib/catalog/queries";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { ebookPageCount, formatBytes } from "@/lib/format";
import { formatKwdLocale, localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc, UserDoc } from "@/lib/types/firestore";
import { cn } from "@/lib/utils";

export default function EbookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user, profile, refreshProfile, ready } = useAuth();
  const [busy, setBusy] = useState(false);
  const [cartError, setCartError] = useState("");

  const book = useQuery({ queryKey: ["course", id], queryFn: () => getCourse(id) });
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
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
  const instructor = useQuery({
    queryKey: ["instructor", book.data?.authorRef?.id],
    enabled: Boolean(book.data?.authorRef?.id),
    queryFn: async () => {
      const snap = await getDoc(book.data!.authorRef!);
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as UserDoc) }) : null;
    },
  });

  const title = book.data
    ? localizedField(book.data.name, book.data.nameManualTranslate, book.data.nameAutoTranslate, locale)
    : t("store");
  const saved = Boolean(profile?.fvrtCourseList?.some((ref) => ref.id === id));

  const related = useMemo(() => {
    const authorId = book.data?.authorRef?.id;
    if (!authorId) return [] as Array<CourseDoc & { id: string }>;
    return storeEbooks(courses.data ?? [])
      .filter((row) => row.id !== id && row.authorRef?.id === authorId)
      .slice(0, 6);
  }, [book.data?.authorRef?.id, courses.data, id]);

  const relatedAuthorIds = [...new Set(related.map((row) => row.authorRef?.id).filter(Boolean))] as string[];
  const relatedAuthors = useQuery({
    queryKey: ["authors", relatedAuthorIds.join(",")],
    enabled: relatedAuthorIds.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        relatedAuthorIds.map(async (authorId) => {
          const snap = await getDoc(doc(getDb(), collections.users, authorId));
          return [authorId, String(snap.get("display_name") || "")] as const;
        }),
      );
      return Object.fromEntries(pairs) as Record<string, string>;
    },
  });

  const savedKey = (profile?.fvrtCourseList ?? []).map((ref) => ref.id).join(",");
  const savedIds = useMemo(() => new Set(savedKey ? savedKey.split(",") : []), [savedKey]);

  const relatedItems: ExploreItem[] = useMemo(
    () =>
      related.map((row) => {
        const pages = ebookPageCount(row);
        return {
          id: row.id,
          name: localizedField(row.name, row.nameManualTranslate, row.nameAutoTranslate, locale),
          image: row.image,
          rating: Number(row.totalRatting || 0),
          author: row.authorRef?.id ? relatedAuthors.data?.[row.authorRef.id] : instructor.data?.display_name,
          pages: pages > 0 ? pages : undefined,
          saved: savedIds.has(row.id),
          href: `/store/${row.id}`,
          aspect: "3/4" as const,
        };
      }),
    [related, relatedAuthors.data, instructor.data?.display_name, locale, savedIds],
  );

  async function toggleSave(courseId = id) {
    if (!user) {
      router.push("/login");
      return;
    }
    const isSaved = savedIds.has(courseId);
    await updateDoc(doc(getDb(), collections.users, user.uid), {
      fvrtCourseList: isSaved
        ? arrayRemove(doc(getDb(), collections.course, courseId))
        : arrayUnion(doc(getDb(), collections.course, courseId)),
    });
    await refreshProfile();
  }

  async function addEbook(target: CourseDoc & { id: string }) {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setCartError("");
    try {
      await addEbookToCart(user.uid, target);
      router.push("/cart");
    } catch (err) {
      setCartError(err instanceof Error ? err.message : "Could not add to cart");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* user cancelled share */
    }
  }

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

  const actions = (
    <CourseHeaderActions
      saved={saved}
      onShare={() => void share()}
      onSave={() => void toggleSave()}
      shareLabel={t("share")}
      saveLabel={saved ? t("saved") : t("bookmark")}
    />
  );

  if (book.isPending) {
    return (
      <AppShell loading compactHeader title={title} actions={actions} skeleton={<CourseDetailsSkeleton coverAspect="3/4" />} />
    );
  }
  if (!book.data) {
    return (
      <AppShell compactHeader title={t("store")} actions={actions}>
        <EmptyState
          icon="/course/book.svg"
          title={t("emptyEbookTitle")}
          body={t("emptyEbookBody")}
          cta={{ href: "/store", label: t("store") }}
        />
      </AppShell>
    );
  }

  const data = book.data;
  const pages = ebookPageCount(data);
  const language = courseLanguage(data);
  const cardLabels = {
    enroll: t("addToCart"),
    lessons: t("lessons"),
    hrs: t("hrs"),
    save: t("bookmark"),
    saved: t("saved"),
    pages: t("pages"),
  };
  const ctaStats = [
    { icon: "/course/star.svg", text: Number(data.totalRatting || 0).toFixed(1) },
    { icon: "/course/lessons.svg", text: t("studentsEnrolled").replace("{n}", String(data.bookedCount || 0)) },
    ...(pages > 0 ? [{ icon: "/course/book.svg", text: `${pages} ${t("pages")}` }] : []),
  ];

  return (
    <AppShell compactHeader title={title} actions={actions}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start lg:gap-8 lg:pt-2">
        <CourseCover image={data.image} aspect="3/4" />
        <div>
          <CourseInfo
            sku={data.sku || id.slice(0, 8)}
            language={language}
            title={title}
            rating={Number(data.totalRatting || 0)}
            ratingLabel={t("rating")}
            enrolled={Number(data.bookedCount || 0)}
            enrolledLabel={t("studentsEnrolled")}
            description={data.description}
            seeMore={t("seeMore")}
            seeLess={t("seeLess")}
          />
          <EnrollCta
            stats={ctaStats}
            price={formatKwdLocale(data.price, locale)}
            enrollLabel={t("addToCart")}
            secure={t("secure")}
            block={owned.data ? t("purchased") : undefined}
            busy={busy}
            showEmi={false}
            onEnroll={() => void addEbook(data)}
          />
          {cartError ? <p className="mt-2 text-center text-[12px] text-[#f24822]">{cartError}</p> : null}
        </div>
      </div>

      {instructor.data ? (
        <InstructorCard
          href={`/instructor/${instructor.data.id}`}
          name={instructor.data.display_name || t("instructor")}
          bio={instructor.data.bio}
          rating={Number(data.totalRatting || 0)}
          ratingLabel={t("rating")}
          verified={instructor.data.instuctorStatus === "Approved"}
        />
      ) : null}

      {relatedItems.length ? (
        <section className="mt-8 flex flex-col gap-4">
          <h2 className="text-[14px] font-semibold text-[#fafafa]">{t("relatedEbooks")}</h2>
          <div className={cn(exploreRailClass, "lg:grid lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] lg:overflow-visible")}>
            {relatedItems.map((item) => {
              const row = related.find((b) => b.id === item.id);
              return (
                <div key={item.id} className="w-[180px] shrink-0 lg:w-auto">
                  <ExploreGridCard
                    item={item}
                    labels={cardLabels}
                    onEnroll={() => row && void addEbook(row)}
                    onSave={() => void toggleSave(item.id)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {(data.ebookFiles ?? []).length ? (
        <section className="mt-8">
          <h2 className="mb-1 text-[14px] font-semibold text-[#fafafa]">{t("download")}</h2>
          <div className="divide-y divide-white/10">
            {(data.ebookFiles ?? []).map((file) => (
              <ResourceRow
                key={file.id}
                name={file.name}
                type={(file.kind || "FILE").toUpperCase()}
                size={file.bytes ? formatBytes(file.bytes) : undefined}
                locked={!owned.data}
                downloadLabel={t("download")}
                onDownload={owned.data ? () => void download(file.id) : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function courseLanguage(course: object) {
  const value = (course as { language?: unknown }).language;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function addEbookToCart(uid: string, book: CourseDoc & { id: string }) {
  const cart = await loadCart(uid);
  await saveCart(
    uid,
    upsertLine(cart, {
      kind: "ebook",
      courseId: book.id,
      paymentType: "Full payment",
      title: book.name,
      image: book.image,
      price: Number(book.price) || 0,
      addedAt: Date.now(),
    }),
  );
}
