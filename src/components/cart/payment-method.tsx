"use client";

import { useEffect, useState } from "react";

type TestCard = {
  brand: string;
  number: string;
  expiry: string;
  cvv: string;
  name: string;
  result: string;
  note?: string;
};

type PublicConfig = {
  gateway?: "myfatoorah" | "tap";
  mode?: "test" | "live";
  showTestCards?: boolean;
  testCards?: TestCard[];
};

/**
 * Payment happens on the hosted gateway page. This block shows what to expect
 * and, in test mode only, the official sandbox cards.
 */
const LOGOS = [
  { id: "knet", logo: "/cart/knet.png", alt: "KNET" },
  { id: "myfatoorah", logo: "/cart/myfatoorah.png", alt: "MyFatoorah", fill: true },
] as const;

export function PaymentMethods({
  title,
  hint,
  testTitle,
  copyLabel,
}: {
  title: string;
  hint: string;
  testTitle: string;
  copyLabel: string;
}) {
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    void fetch("/api/checkout/public-config")
      .then((res) => res.json() as Promise<PublicConfig>)
      .then(setConfig)
      .catch(() => setConfig({ mode: "live", testCards: [] }));
  }, []);

  const testCards =
    config?.mode === "test" && config?.showTestCards !== false ? (config.testCards ?? []) : [];

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
      {testCards.length ? (
        <div className="rounded-[10px] border border-[#f5d08a] bg-[#3a2f12] p-3">
          <p className="mb-2 text-[12px] font-medium text-[#f5d08a]">{testTitle}</p>
          <div className="flex flex-col gap-2">
            {testCards.map((card) => (
              <button
                key={card.number}
                type="button"
                onClick={() => void navigator.clipboard.writeText(card.number).catch(() => undefined)}
                className="rounded-[8px] bg-black/25 px-2.5 py-2 text-left"
              >
                <p className="text-[12px] font-medium text-[#fafafa]">
                  {card.brand} · {card.result}
                </p>
                <p className="font-mono text-[11px] text-[#f5d08a]">
                  {card.number} · {card.expiry} · {card.cvv}
                </p>
                {card.note ? <p className="mt-1 text-[10px] text-[#c8b48a]">{card.note}</p> : null}
                <p className="mt-1 text-[10px] text-[#999]">{copyLabel}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
