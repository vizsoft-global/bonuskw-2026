"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { exploreGridClass } from "@/components/home/explore-card";
import { AppShell } from "@/components/layout/app-shell";
import { OfferGridCard, type OfferCourseCard } from "@/components/promotions/offer-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StoreSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { addCourseLine, enrolmentClosedMessage } from "@/lib/cart/add-course";
import { getCourse } from "@/lib/catalog/queries";
import { usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import {
  localizedText,
  usePromotions,
  type PromoCourse,
  type Promotion,
} from "@/lib/promotions/use-promotions";
import { cn } from "@/lib/utils";

export default function OffersPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const gate = usePurchaseGate();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const promos = usePromotions();

  const offers = promos.data ?? [];
  const loaded = promos.isSuccess || promos.isError;
  const purchaseBlocked = gate.blockFor("course");

  function endsLabel(endsAt: string) {
    const date = new Date(endsAt);
    if (Number.isNaN(date.getTime())) return null;
    const text = new Intl.DateTimeFormat(locale === "ar" ? "ar-KW" : "en-KW", {
      day: "numeric",
      month: "short",
    }).format(date);
    return t("offerEnds").replace("{date}", text);
  }

  function ruleLabel(promo: Promotion) {
    if (promo.type === "quantity_tiers") {
      const tiers = (promo.tiers ?? [])
        .filter((tier) => (tier.minItems ?? 0) > 0)
        .sort((a, b) => (a.minItems ?? 0) - (b.minItems ?? 0));
      if (!tiers.length) return null;
      return tiers
        .map((tier) => {
          const value =
            tier.fixed != null ? formatKwdLocale(tier.fixed, locale) : `${tier.percent ?? 0}%`;
          return t("offerTierLine")
            .replace("{count}", String(tier.minItems ?? 0))
            .replace("{value}", value);
        })
        .join("  ·  ");
    }
    if (promo.reward) {
      if (promo.reward.kind === "percent") {
        return t("offerPercentOff").replace("{value}", String(promo.reward.value));
      }
      return t("offerFixedOff").replace("{value}", formatKwdLocale(promo.reward.value, locale));
    }
    return null;
  }

  function toCard(course: PromoCourse): OfferCourseCard {
    const price = Number(course.price) || 0;
    const discounted = course.discountedPrice == null ? price : Number(course.discountedPrice);
    const hasDiscount = discounted > 0 && discounted < price;
    return {
      id: course.id,
      name: course.name || course.id,
      image: course.image ?? undefined,
      price: formatKwdLocale(hasDiscount ? discounted : price, locale),
      compareAt: hasDiscount ? formatKwdLocale(price, locale) : undefined,
      href: `/course/${course.id}`,
    };
  }

  async function addOne(courseId: string) {
    if (!user) {
      router.push("/login");
      return;
    }
    if (gate.blockFor("course")) return;
    setBusy(courseId);
    setError(null);
    try {
      const course = await getCourse(courseId);
      if (!course) {
        setError(t("offerUnavailable"));
        return;
      }
      await addCourseLine(user.uid, course);
      router.push("/cart");
    } catch (err) {
      setError(enrolmentClosedMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  async function addAll(promo: Promotion) {
    if (!user) {
      router.push("/login");
      return;
    }
    if (gate.blockFor("course")) return;
    const ids = (promo.courses ?? []).map((course) => course.id);
    if (!ids.length) return;
    setBusy(`all:${promo.id}`);
    setError(null);
    try {
      const docs = await Promise.all(ids.map((id) => getCourse(id)));
      let count = 0;
      for (const doc of docs) {
        if (!doc) continue;
        await addCourseLine(user.uid, doc);
        count += 1;
      }
      if (!count) {
        setError(t("offerUnavailable"));
        return;
      }
      router.push("/cart");
    } catch (err) {
      setError(enrolmentClosedMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title={t("offers")} loading={promos.isPending} skeleton={<StoreSkeleton />}>
      <div className="flex flex-col">
        <p className="hidden text-[20px] font-semibold text-text lg:block lg:pt-[30px]">
          {t("offers")}
        </p>
        <p className="pt-4 text-[12px] leading-relaxed text-muted lg:pt-2">{t("offersSubtitle")}</p>

        {error ? <p className="pt-3 text-[12px] text-[#f24822]">{error}</p> : null}

        <div className="flex flex-col gap-[30px] py-5">
          {offers.map((promo) => {
            const courses = promo.courses ?? [];
            const title = localizedText(promo.name, locale);
            const body = localizedText(promo.description, locale);
            const rule = ruleLabel(promo);
            const ends = promo.endsAt ? endsLabel(promo.endsAt) : null;
            const adding = busy === `all:${promo.id}`;
            return (
              <section key={promo.id} className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
                  {promo.bannerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={promo.bannerImage}
                      alt=""
                      className="h-[150px] w-full object-cover lg:h-[220px]"
                    />
                  ) : null}
                  <div className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {promo.badge ? (
                        <span className="rounded-full bg-[#0c5eff] px-2.5 py-1 text-[10px] font-semibold leading-none text-white">
                          {promo.badge}
                        </span>
                      ) : null}
                      {promo.featured ? (
                        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-semibold leading-none text-muted">
                          {t("offerFeatured")}
                        </span>
                      ) : null}
                      {ends ? (
                        <span className="text-[10px] font-medium leading-none text-muted">
                          {ends}
                        </span>
                      ) : null}
                    </div>
                    {title ? (
                      <h2 className="text-[16px] font-semibold leading-snug text-text">{title}</h2>
                    ) : null}
                    {body ? <p className="text-[12px] leading-relaxed text-muted">{body}</p> : null}
                    {rule ? (
                      <p className="text-[12px] font-medium leading-relaxed text-[#0c5eff]">{rule}</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={Boolean(purchaseBlocked) || adding}
                      title={purchaseBlocked}
                      onClick={() => void addAll(promo)}
                      className={cn(
                        "mt-1 h-9 w-full rounded-[10px] text-[12px] font-medium lg:w-auto lg:px-6",
                        purchaseBlocked || adding
                          ? "cursor-not-allowed bg-surface-2 text-muted"
                          : "bg-[#0c5eff] text-white",
                      )}
                    >
                      {purchaseBlocked || t("offerAddAll")}
                    </button>
                  </div>
                </div>

                <div className={exploreGridClass}>
                  {courses.map((course) => (
                    <OfferGridCard
                      key={course.id}
                      course={toCard(course)}
                      addLabel={t("offerAddToCart")}
                      blocked={purchaseBlocked}
                      busy={busy === course.id}
                      onAdd={() => void addOne(course.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {loaded && !offers.length ? (
          <EmptyState
            icon="/home/saucer.svg"
            title={t("offersEmptyTitle")}
            body={t("offersEmptyBody")}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
