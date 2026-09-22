"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import type { LocalizedText } from "@/lib/types/firestore";

export type PromoReward = { kind: "percent" | "fixed" | "fixed_price"; value: number };

export type PromoTier = {
  minItems: number | null;
  minSubtotal: number | null;
  percent: number | null;
  fixed: number | null;
};

export type PromoCourse = {
  id: string;
  name?: string | null;
  image?: string | null;
  price?: number | null;
  discountedPrice?: number | null;
};

export type Promotion = {
  id: string;
  name?: LocalizedText | null;
  description?: LocalizedText | null;
  badge?: string | null;
  bannerImage?: string | null;
  type: string;
  featured?: boolean;
  endsAt?: string | null;
  reward?: PromoReward | null;
  tiers?: PromoTier[] | null;
  courses?: PromoCourse[] | null;
};

export function localizedText(value: LocalizedText | null | undefined, locale: "en" | "ar") {
  if (!value) return "";
  return (locale === "ar" ? value.ar : undefined) || value.en || "";
}

/** Offers the admin published for the student's university; empty when none. */
export function usePromotions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["promotions", user?.uid],
    enabled: Boolean(user),
    queryFn: async (): Promise<Promotion[]> => {
      const token = await user!.getIdToken();
      const res = await fetch("/api/promotions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { promotions?: Promotion[] };
      return (data.promotions ?? []).filter((promo) => (promo.courses ?? []).length > 0);
    },
  });
}
