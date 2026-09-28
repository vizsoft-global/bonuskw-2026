"use client";

import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { dismissAddedToCart, showAddedToCart } from "@/components/cart/added-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { addCourseLine, enrolmentClosedMessage } from "@/lib/cart/add-course";
import { useOwnership } from "@/lib/cart/ownership";
import { emptyCart, upsertLine, type CartPaymentType, type CartState } from "@/lib/cart/store";
import { courseEmiAmounts, courseEmiCount, splitEmi } from "@/lib/course/emi";
import { courseThumb } from "@/lib/course/thumb";
import { isEbookCourse } from "@/lib/format";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc } from "@/lib/types/firestore";

function emiAmounts(course: CourseDoc) {
  const count = courseEmiCount(course);
  const stored = courseEmiAmounts(course).slice(0, count);
  if (stored.length === count && stored.every((amount) => amount > 0)) return stored;
  return splitEmi(Number(course.price) || 0, "even", count);
}

/**
 * Adds a course or eBook and shows the result immediately. The cart count and
 * popup update before the server checks finish; a refusal removes the line
 * and explains why.
 */
export function useAddToCart() {
  const { user } = useAuth();
  const { t } = useI18n();
  const own = useOwnership();
  const client = useQueryClient();
  const busy = useRef(new Set<string>());

  async function add(
    course: CourseDoc & { id: string },
    paymentType: CartPaymentType = "Full payment",
    { announce = true }: { announce?: boolean } = {},
  ) {
    if (!user) return "login" as const;
    if (busy.current.has(course.id)) return "busy" as const;
    const state = own.stateOf(course.id);
    if (state) {
      toast.error(t(state === "enrolled" ? "ownEnrolledLong" : "ownInCartLong"));
      return "owned" as const;
    }

    busy.current.add(course.id);
    const ebook = isEbookCourse(course);
    const emi = !ebook && Boolean(course.emiPaymentStatus);
    const key = ["cart", user.uid] as const;
    const previous = client.getQueryData<CartState>(key);
    client.setQueryData<CartState>(key, (old) =>
      upsertLine(old ?? emptyCart, {
        kind: ebook ? "ebook" : "course",
        courseId: course.id,
        paymentType: emi ? paymentType : "Full payment",
        title: course.name,
        image: ebook ? course.image : courseThumb(course),
        price: Number(course.price) || 0,
        addedAt: Date.now(),
        ...(ebook ? {} : { emiAvailable: emi }),
        ...(emi ? { emiCount: courseEmiCount(course), emiAmounts: emiAmounts(course) } : {}),
        ...(course.batchesRef?.id ? { batchId: course.batchesRef.id } : {}),
      }),
    );
    if (announce) showAddedToCart({ title: course.name, image: ebook ? course.image : courseThumb(course) });

    try {
      await addCourseLine(user.uid, course, paymentType, { announce: false });
      void client.invalidateQueries({ queryKey: ["cart-quote", user.uid] });
      return "ok" as const;
    } catch (err) {
      client.setQueryData(key, previous ?? emptyCart);
      if (announce) dismissAddedToCart();
      toast.error(enrolmentClosedMessage(err, t));
      return "error" as const;
    } finally {
      busy.current.delete(course.id);
    }
  }

  return add;
}
