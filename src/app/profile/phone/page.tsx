"use client";

import { useRouter } from "next/navigation";
import { PhoneStep } from "@/components/auth/phone-step";
import { ProfilePane } from "@/components/profile/pane";
import { SectionLabel } from "@/components/profile/ui";
import { useI18n } from "@/lib/i18n/locale";

/**
 * Adding or replacing the mobile number, from the profile.
 *
 * This exists because the number is required to buy but not to browse: taking
 * it out of the activation flow's enforced steps stopped it blocking the app,
 * but the activation flow was also the only place a student could enter one —
 * so a student trying to pay had nowhere to go. The profile's own field is
 * read-only, so the menu row and the checkout both point here.
 */
export default function PhonePage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <ProfilePane title={t("addPhoneTitle")}>
      <div className="flex flex-col gap-[25px] pb-4">
        <SectionLabel>{t("addPhoneSubtitle")}</SectionLabel>
        <PhoneStep onDone={() => router.replace("/profile/personal")} />
      </div>
    </ProfilePane>
  );
}
