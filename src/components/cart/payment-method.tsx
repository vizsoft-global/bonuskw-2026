"use client";

import { cn } from "@/lib/utils";

export const PAYMENT_SOURCES = [
  { id: "src_kw.knet", logo: "/cart/knet.png" },
  { id: "src_card", logo: "/cart/visa.svg" },
  { id: "myfatoorah", logo: "/cart/myfatoorah.png" },
] as const;

export type PaymentSource = (typeof PAYMENT_SOURCES)[number]["id"];

export function PaymentMethod({
  source,
  onSource,
  labels,
}: {
  source: PaymentSource;
  onSource: (id: PaymentSource) => void;
  labels: { title: string; knet: string; card: string; myFatoorah: string };
}) {
  const items: Array<{ id: PaymentSource; logo: string; label: string; fill?: boolean }> = [
    { id: "src_kw.knet", logo: "/cart/knet.png", label: labels.knet },
    { id: "src_card", logo: "/cart/visa.svg", label: labels.card },
    { id: "myfatoorah", logo: "/cart/myfatoorah.png", label: labels.myFatoorah, fill: true },
  ];

  return (
    <div className="flex w-full flex-col gap-2.5">
      <p className="text-[14px] font-medium text-[#999]">{labels.title}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => {
          const selected = source === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSource(item.id)}
              className="flex w-full items-center justify-between rounded-[12px] py-1.5 pe-2.5"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "relative h-[35px] w-[56px] shrink-0 overflow-hidden rounded-[8px]",
                    item.fill ? "bg-[#0018ff]" : "bg-[#141414] p-1.5",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.logo}
                    alt=""
                    className={cn(
                      "h-full w-full object-center",
                      item.fill ? "object-cover" : "object-contain",
                    )}
                  />
                </span>
                <span className="text-[14px] font-medium text-[#fafafa]">{item.label}</span>
              </span>
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border",
                  selected ? "border-[#f24822]" : "border-[#3c3c3c]",
                )}
              >
                {selected ? <span className="size-2 rounded-full bg-[#f24822]" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
