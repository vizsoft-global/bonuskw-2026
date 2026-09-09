"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Download, EllipsisVertical, ExternalLink, Link as LinkIcon, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";

/** Routes where an install nudge would get in the way. */
const QUIET_PREFIXES = ["/login", "/onboarding", "/verify", "/cart", "/checkout", "/learn", "/pay", "/offline"];
/** First visit: wait this long before nudging; later visits nudge sooner. */
const FIRST_OPEN_DELAY_MS = 30_000;
const LATER_OPEN_DELAY_MS = 4_000;

function Step({ n, icon, title, hint }: { n: number; icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
        {n}
      </span>
      <div className="min-w-0 pt-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="grid size-6 place-items-center rounded-md bg-surface-2 text-muted">{icon}</span>
          {title}
        </div>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
    </li>
  );
}

/**
 * Bottom sheet that walks the user through adding the app to their home
 * screen. Content depends on the platform:
 *  - Chromium (Android/desktop): a real one-tap Install button.
 *  - Android without the event: menu -> Install app.
 *  - iOS browsers: Share -> Add to Home Screen.
 *  - iOS in-app webviews: open in Safari first.
 * Auto-shows once eligibility rules pass; can also be opened from the profile.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const install = useInstallPrompt();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoShown = useRef(false);

  const quiet = QUIET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Auto nudge: signed in, eligible platform, not on a quiet route, once per page load.
  useEffect(() => {
    if (autoShown.current || !install.ready || !install.eligible || !user || quiet) return;
    const delay = install.opens <= 1 ? FIRST_OPEN_DELAY_MS : LATER_OPEN_DELAY_MS;
    timer.current = setTimeout(() => {
      autoShown.current = true;
      install.show();
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [install, install.ready, install.eligible, install.opens, user, quiet]);

  async function copyLink() {
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("installLinkCopied"));
    } catch {
      window.prompt(t("installCopyLink"), url);
    }
  }

  const platform = install.platform;
  const inApp = platform === "ios-inapp";
  const ios = platform === "ios-safari";
  const native = install.canPromptNatively;

  return (
    <Sheet
      open={install.open && !install.installed}
      onOpenChange={(open) => (open ? install.show() : install.snooze())}
      title={inApp ? t("installInAppTitle") : t("installTitle")}
      description={inApp ? t("installInAppBody") : t("installBody")}
      footer={
        <div className="flex flex-col gap-2">
          {native ? (
            <Button
              variant="accent"
              size="lg"
              block
              onClick={() => {
                void install.promptInstall().then((outcome) => {
                  if (outcome === "accepted") toast.success(t("installInstalled"));
                });
              }}
            >
              <Download className="size-4" /> {t("installButton")}
            </Button>
          ) : inApp ? (
            <Button variant="accent" size="lg" block onClick={() => void copyLink()}>
              <LinkIcon className="size-4" /> {t("installCopyLink")}
            </Button>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={install.snooze}>
              {t("installNotNow")}
            </Button>
            <Button variant="link" size="sm" className="text-muted" onClick={install.hideForever}>
              {t("installNever")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <Image src="/icons/icon-192.png" alt="" width={56} height={56} className="size-14 rounded-xl" />
        <div className="min-w-0">
          <div className="font-semibold">{t("appName")}</div>
          <div className="truncate text-xs text-muted">{typeof window !== "undefined" ? window.location.host : ""}</div>
        </div>
      </div>

      {!native && !inApp ? (
        <div className="mt-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("installStepsTitle")}</h4>
          <ol className="space-y-3">
            {ios ? (
              <>
                <Step n={1} icon={<Share className="size-3.5" />} title={t("installIosStep1")} hint={t("installIosStep1Hint")} />
                <Step n={2} icon={<SquarePlus className="size-3.5" />} title={t("installIosStep2")} />
                <Step n={3} icon={<Download className="size-3.5" />} title={t("installIosStep3")} />
              </>
            ) : (
              <>
                <Step n={1} icon={<EllipsisVertical className="size-3.5" />} title={t("installAndroidStep1")} />
                <Step n={2} icon={<Download className="size-3.5" />} title={t("installAndroidStep2")} />
              </>
            )}
          </ol>
        </div>
      ) : null}

      {inApp ? (
        <div className="mt-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("installStepsTitle")}</h4>
          <ol className="space-y-3">
            <Step n={1} icon={<ExternalLink className="size-3.5" />} title={t("installOpenInBrowser")} hint={t("installCopyLink")} />
            <Step n={2} icon={<Share className="size-3.5" />} title={t("installIosStep1")} />
            <Step n={3} icon={<SquarePlus className="size-3.5" />} title={t("installIosStep2")} />
          </ol>
        </div>
      ) : null}
    </Sheet>
  );
}
