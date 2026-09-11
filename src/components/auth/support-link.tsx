"use client";

import { useI18n } from "@/lib/i18n/locale";

/** Academy support WhatsApp number (E.164 digits only, as wa.me expects). */
export const SUPPORT_WHATSAPP = "96599914714";

export function supportWhatsAppUrl(message: string) {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

/**
 * "Contact support" → opens WhatsApp to the academy with a prefilled message.
 * Shown wherever a student can get stuck signing in (no SMS, blocked number).
 */
export function SupportLink({
  phone,
  className = "",
}: {
  /** Number the student was trying, included in the prefilled message. */
  phone?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const message = phone
    ? t("supportMessageWithPhone").replace("{phone}", phone)
    : t("supportMessage");
  return (
    <a
      href={supportWhatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full border border-white/20 px-3.5 py-2 text-[13px] font-medium text-white hover:border-white/40 ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
        <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
      </svg>
      {t("contactSupport")}
    </a>
  );
}
