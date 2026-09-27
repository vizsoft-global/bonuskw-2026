"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadOwnedEbookIds } from "@/lib/cart/add-course";
import { loadCart } from "@/lib/cart/store";
import { loadLiveEnrollments } from "@/lib/course/enrollments";
import { useI18n } from "@/lib/i18n/locale";

export type OwnState = "enrolled" | "inCart" | null;

/**
 * Whether each course or eBook is already bought or already in the cart, so
 * every "Enroll" / "Add to cart" button can say so instead of selling it twice.
 * Shares the ["cart"] and ["subs"] queries with the header and Home.
 */
export function useOwnership() {
  const { t } = useI18n();
  const { user } = useAuth();
  const uid = user?.uid;
  const cart = useQuery({ queryKey: ["cart", uid], enabled: Boolean(uid), queryFn: () => loadCart(uid!) });
  const subs = useQuery({ queryKey: ["subs", uid], enabled: Boolean(uid), queryFn: () => loadLiveEnrollments(uid!) });
  const ebooks = useQuery({
    queryKey: ["ebooks-owned", uid],
    enabled: Boolean(uid),
    staleTime: 60_000,
    queryFn: () => loadOwnedEbookIds(uid!),
  });

  const inCart = new Set(
    (cart.data?.lines ?? []).filter((line) => line.kind === "course" || line.kind === "ebook").map((line) => line.courseId),
  );
  const chaptersInCart = new Set(
    (cart.data?.lines ?? []).filter((line) => line.kind === "chapter").map((line) => `${line.courseId}:${line.chapterId}`),
  );
  const owned = new Set([...(subs.data ?? []).map((s) => s.courseId), ...(ebooks.data ?? [])]);

  function stateOf(courseId: string): OwnState {
    if (owned.has(courseId)) return "enrolled";
    if (inCart.has(courseId)) return "inCart";
    return null;
  }

  return {
    stateOf,
    chapterInCart: (courseId: string, chapterId: string) => chaptersInCart.has(`${courseId}:${chapterId}`),
    /** Short button label for cards; undefined when the item can still be bought. */
    labelOf: (courseId: string) => {
      const state = stateOf(courseId);
      return state === "enrolled" ? t("ownEnrolled") : state === "inCart" ? t("ownInCart") : undefined;
    },
    /** Longer label for the course / eBook page button. */
    longLabelOf: (courseId: string) => {
      const state = stateOf(courseId);
      return state === "enrolled" ? t("ownEnrolledLong") : state === "inCart" ? t("ownInCartLong") : undefined;
    },
  };
}
