"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { Avatar } from "@/components/layout/avatar";
import { HomeIcon } from "@/components/home/icon";
import { DevModeBanner } from "@/components/commerce/dev-mode-banner";
import { DevModeSheet } from "@/components/profile/dev-mode-sheet";
import { LanguageSheet } from "@/components/profile/language-sheet";
import { LangRadio, MenuRow, PushToggle, SectionLabel } from "@/components/profile/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb, getFirebaseApp } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { avatarSrc } from "@/lib/avatar";
import { useI18n } from "@/lib/i18n/locale";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { SHORT_VERSION } from "@/lib/version";

const PUSH_KEY = "ba_push_enabled";
const LANG_SHEET_KEY = "ba_open_lang";

export function ProfileHub() {
  const { profile, logout, user } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const path = usePathname();
  const [langOpen, setLangOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const taps = useRef<number[]>([]);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const install = useInstallPrompt();
  // Only phones/tablets that are not yet running from the home screen.
  const showInstall =
    install.ready && !install.installed && install.platform !== "desktop" && install.platform !== "unknown";

  useEffect(() => {
    setPushOn(window.localStorage.getItem(PUSH_KEY) === "1");
    if (window.sessionStorage.getItem(LANG_SHEET_KEY) === "1") {
      window.sessionStorage.removeItem(LANG_SHEET_KEY);
      setLangOpen(true);
    }
  }, []);

  const university = useQuery({
    queryKey: ["university", profile?.universityRef?.id],
    enabled: Boolean(profile?.universityRef),
    queryFn: async () => {
      const snap = await getDoc(profile!.universityRef!);
      return String(snap.get("name") || "");
    },
  });
  const branch = useQuery({
    queryKey: ["branch", profile?.branchRef?.id],
    enabled: Boolean(profile?.branchRef),
    queryFn: async () => {
      const snap = await getDoc(profile!.branchRef!);
      return String(snap.get("name") || "");
    },
  });
  const stats = useQuery({
    queryKey: ["stats", user?.uid],
    enabled: Boolean(user),
    queryFn: async () =>
      ((await getDoc(doc(getDb(), collections.userStats, user!.uid))).data() as
        | { streakDays?: number; studySeconds?: number }
        | undefined) ?? null,
  });
  // Same key and shape as My Zone (`snap.docs` of Ongoing subscriptions) so the
  // two screens share one cache entry instead of clobbering each other.
  const courses = useQuery({
    queryKey: ["my-subs", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(getDb(), collections.subscription),
          where("userRef", "==", doc(getDb(), collections.users, user!.uid)),
        ),
      );
      return snap.docs.filter((d) => d.get("status") === "Ongoing");
    },
  });

  const name = profile?.display_name || t("profile");
  const subtitle = [branch.data, university.data].filter(Boolean).join(" • ");
  const hours = Math.round((Number(stats.data?.studySeconds) || 0) / 3600);
  const enrolledCount = Array.isArray(courses.data) ? courses.data.length : 0;

  async function togglePush() {
    if (pushBusy) return;
    if (pushOn) {
      setPushOn(false);
      window.localStorage.setItem(PUSH_KEY, "0");
      return;
    }
    if (!user || !(await isSupported())) return;
    setPushBusy(true);
    try {
      const messaging = getMessaging(getFirebaseApp());
      const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
      if (!token) return;
      await fetch("https://bonus-academy.cloudfunctions.net/addFcmToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { userDocPath: `users/${user.uid}`, fcmToken: token, deviceType: "web" } }),
      });
      setPushOn(true);
      window.localStorage.setItem(PUSH_KEY, "1");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-[365px] flex-col items-center">
      <DevModeBanner className="mb-3 w-full" />
      <Avatar src={avatarSrc(profile, user?.uid)} name={name} className="size-[75px] text-2xl lg:size-[100px]" />
      <p className="mt-2.5 text-[14px] font-bold text-[#fafafa]">{name}</p>
      {subtitle ? <p className="text-[12px] text-[#999]">{subtitle}</p> : null}

      <div className="mt-4 flex w-full items-center justify-between rounded-[12px] bg-[#141414] px-[19px] py-3.5">
        <div className="flex flex-1 flex-col items-center gap-[5px]">
          <p className="text-[10px] text-[#999]">{t("enrolledCourses")}</p>
          <div className="flex items-center gap-[3px]">
            <span className="size-4">
              <HomeIcon src="/profile/book.svg" />
            </span>
            <p className="text-[12px] font-medium text-[#fafafa]">
              {enrolledCount} {t("coursesUnit")}
            </p>
          </div>
        </div>
        <span className="h-[22px] w-px bg-white/15" />
        <div className="flex flex-1 flex-col items-center gap-[5px]">
          <p className="text-[10px] text-[#999]">{t("learningHours")}</p>
          <div className="flex items-center gap-[3px]">
            <span className="size-4">
              <HomeIcon src="/profile/clock.svg" />
            </span>
            <p className="text-[12px] font-medium text-[#fafafa]">
              {hours} {t("hoursUnit")}
            </p>
          </div>
        </div>
      </div>

      <div
        className="mt-4 flex w-full flex-col gap-5 rounded-[12px] px-[15px] py-5"
        style={{ backgroundImage: "linear-gradient(162deg, #1c1c1c 3%, #141414 90%)" }}
      >
        <div className="flex flex-col gap-[15px]">
          <SectionLabel>{t("account")}</SectionLabel>
          <MenuRow href="/profile/personal" icon="/profile/info.svg" label={t("personal")} active={path === "/profile/personal"} />
          <MenuRow href="/profile/saved" icon="/profile/heart.svg" label={t("savedCourses")} active={path === "/profile/saved"} />
          <MenuRow href="/profile/devices" icon="/profile/phone.svg" label={t("deviceLogs")} active={path === "/profile/devices"} />
          <MenuRow href="/profile/password" icon="/profile/passcode.svg" label={t("changePassword")} active={path === "/profile/password"} />
          <MenuRow href="/profile/transactions" icon="/profile/receipt.svg" label={t("transactions")} active={path === "/profile/transactions"} />
          <MenuRow href="/my-space" icon="/profile/book.svg" label={t("mySpace")} last active={path === "/my-space"} />
        </div>
        <div className="flex flex-col gap-[15px]">
          <SectionLabel>{t("preferences")}</SectionLabel>
          <MenuRow
            icon="/profile/notification.svg"
            label={t("notifications")}
            onClick={() => void togglePush()}
            trailing={<PushToggle on={pushOn} disabled={pushBusy} />}
          />
          <div className="flex min-h-11 w-full items-center gap-2.5 border-b-[0.8px] border-[#fafafa]/10 py-2.5">
            <button
              type="button"
              onClick={() => setLangOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2.5 lg:pointer-events-none"
            >
              <span className="size-4 shrink-0">
                <HomeIcon src="/profile/translate.svg" />
              </span>
              <span className="text-[14px] font-medium text-[#fafafa]">{t("language")}</span>
            </button>
            <span className="hidden items-center gap-3 lg:flex">
              <button
                type="button"
                onClick={() => setLocale("en")}
                className="flex items-center gap-1.5 text-[12px] text-[#fafafa]"
              >
                <LangRadio selected={locale === "en"} />
                {t("english")}
              </button>
              <button
                type="button"
                onClick={() => setLocale("ar")}
                className="flex items-center gap-1.5 text-[12px] text-[#fafafa]"
              >
                <LangRadio selected={locale === "ar"} />
                {t("arabic")}
              </button>
            </span>
          </div>
          {showInstall ? (
            <MenuRow icon="/profile/phone-02.svg" label={t("installRowTitle")} onClick={install.show} />
          ) : null}
          <MenuRow href="/profile/terms" icon="/profile/file.svg" label={t("terms")} last active={path === "/profile/terms"} />
        </div>
        <MenuRow icon="/profile/logout.svg" label={t("logout")} onClick={() => void logout()} last />
      </div>

      <button
        type="button"
        onClick={() => {
          const now = Date.now();
          taps.current = [...taps.current.filter((at) => now - at < 1600), now];
          if (taps.current.length >= 3) {
            taps.current = [];
            setDevOpen(true);
          }
        }}
        className="mt-4 text-[11px] text-[#666]"
      >
        {t("version")} {SHORT_VERSION}
      </button>

      <DevModeSheet open={devOpen} onClose={() => setDevOpen(false)} />
      <LanguageSheet
        open={langOpen}
        locale={locale}
        onLocale={(next) => {
          setLocale(next);
          setLangOpen(false);
        }}
        onClose={() => setLangOpen(false)}
        title={t("changeLanguage")}
      />
    </div>
  );
}
