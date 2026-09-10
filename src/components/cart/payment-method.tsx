"use client";

/**
 * Payment happens on MyFatoorah's hosted page, which offers every method the
 * account has enabled (KNET, Visa/Mastercard, Apple Pay…). This block just
 * shows what to expect — there is nothing to select here any more.
 */
const LOGOS = [
  { id: "knet", logo: "/cart/knet.png", alt: "KNET" },
  { id: "card", logo: "/cart/visa.svg", alt: "Visa / Mastercard" },
  { id: "myfatoorah", logo: "/cart/myfatoorah.png", alt: "MyFatoorah", fill: true },
] as const;

export function PaymentMethods({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <p className="text-[14px] font-medium text-[#999]">{title}</p>
      <div className="flex items-center gap-2">
        {LOGOS.map((item) => (
          <span
            key={item.id}
            title={item.alt}
            className={
              "relative h-[35px] w-[56px] shrink-0 overflow-hidden rounded-[8px] " +
              ("fill" in item && item.fill ? "bg-[#0018ff]" : "bg-[#141414] p-1.5")
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.logo}
              alt={item.alt}
              className={
                "h-full w-full object-center " +
                ("fill" in item && item.fill ? "object-cover" : "object-contain")
              }
            />
          </span>
        ))}
      </div>
      <p className="text-[12px] text-[#999]">{hint}</p>
    </div>
  );
}
