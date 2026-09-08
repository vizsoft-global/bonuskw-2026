"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { CourseCard, PrimaryButton } from "@/components/shared/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { listCourses, storeEbooks } from "@/lib/catalog/queries";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { formatKwdLocale, localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

export default function StorePage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const books = storeEbooks(courses.data ?? []);

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-semibold">{t("store")}</h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {books.map((book) => (
          <CourseCard
            key={book.id}
            href={`/store/${book.id}`}
            title={localizedField(book.name, book.nameManualTranslate, book.nameAutoTranslate, locale)}
            image={book.image}
            price={formatKwdLocale(book.price, locale)}
            action={
              <PrimaryButton
                onClick={() => {
                  if (!user) return;
                  void loadCart(user.uid).then((cart) =>
                    saveCart(
                      user.uid,
                      upsertLine(cart, {
                        kind: "ebook",
                        courseId: book.id,
                        paymentType: "Full payment",
                        title: book.name,
                        image: book.image,
                        price: book.price,
                        addedAt: Date.now(),
                      }),
                    ).then(() => {
                      window.location.href = "/cart";
                    }),
                  );
                }}
              >
                {t("addToCart")}
              </PrimaryButton>
            }
          />
        ))}
      </div>
    </AppShell>
  );
}
