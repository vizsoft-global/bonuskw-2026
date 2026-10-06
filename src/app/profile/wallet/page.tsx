"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { ProfilePane } from "@/components/profile/pane";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

/**
 * Every reason the wallet ledger can carry (see `WalletLedgerDoc` in the admin
 * app). Anything missing here used to fall back to "Refund", which told a
 * student that goodwill credit from the academy was money they had been
 * refunded — so the fallback is deliberately vague instead, and staff-granted
 * credit has a label of its own.
 */
const REASON = {
  refund: "walletRefund",
  checkout: "walletCheckout",
  checkout_reversal: "walletReturned",
  hold_expiry: "walletExpired",
  admin_credit: "walletAdminCredit",
} as const;

const FALLBACK_REASON = "walletCreditGeneric";

export default function WalletPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();

  const wallet = useQuery({
    queryKey: ["my-wallet", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const db = getDb();
      const me = doc(db, collections.users, user!.uid);
      const [balance, entries] = await Promise.all([
        getDoc(doc(db, "studentWallets", user!.uid)),
        getDocs(query(collection(db, "walletLedger"), where("userRef", "==", me))),
      ]);
      const rows = entries.docs
        .map((d) => ({
          id: d.id,
          direction: String(d.get("direction") || "in"),
          amountFils: Number(d.get("amountFils") || 0),
          reason: String(d.get("reason") || "refund"),
          /** Staff note on a granted credit, so the entry explains itself. */
          note: String(d.get("note") || ""),
          createdAt: d.get("createdAt")?.toDate?.() as Date | undefined,
        }))
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      return { balanceFils: Number(balance.get("creditBalanceFils") || 0), rows };
    },
  });

  const balance = (wallet.data?.balanceFils ?? 0) / 1000;

  return (
    <ProfilePane title={t("wallet")}>
      <div className="mb-4 rounded-2xl bg-surface p-4">
        <p className="text-xs text-muted">{t("walletBalanceLabel").replace("{amount}", "")}</p>
        <p className="text-2xl font-semibold">{formatKwdLocale(balance, locale as Locale)}</p>
      </div>
      {(wallet.data?.rows ?? []).length ? (
        <ul className="flex flex-col divide-y divide-line">
          {(wallet.data?.rows ?? []).map((row) => {
            const label = REASON[row.reason as keyof typeof REASON] ?? FALLBACK_REASON;
            const sign = row.direction === "out" ? "−" : "+";
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{t(label)}</span>
                  {row.note ? (
                    <span className="block text-[11px] text-muted">{row.note}</span>
                  ) : null}
                  {row.createdAt ? (
                    <span className="block text-[11px] text-muted">{row.createdAt.toLocaleDateString(locale === "ar" ? "ar-KW" : "en-KW")}</span>
                  ) : null}
                </span>
                <span className={row.direction === "out" ? "text-danger" : "text-[#1f9d4d]"}>
                  {sign} {formatKwdLocale(row.amountFils / 1000, locale as Locale)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted">{t("walletEmpty")}</p>
      )}
    </ProfilePane>
  );
}
