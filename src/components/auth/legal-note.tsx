import Link from "next/link";
import { useI18n } from "@/lib/i18n/locale";

export function LegalNote() {
  const { t } = useI18n();
  return (
    <p className="text-[12px] leading-normal text-[#808080]">
      {t("agreePrefix")}{" "}
      <Link href="/profile/terms" className="font-medium text-[#808080] underline">
        {t("termsOfService")}
      </Link>{" "}
      {t("and")}{" "}
      <Link href="/profile/terms" className="font-medium text-[#808080] underline">
        {t("privacy")}
      </Link>
      .
    </p>
  );
}
