"use client";

import Image from "next/image";
import { Download, EllipsisVertical, ExternalLink, Link as LinkIcon, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toaster";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";

/**
 * Download icon for the phone header. Only rendered on Android / iOS browsers
 * while the app is not installed; tapping opens the install sheet. Desktop
 * never sees it — a shortcut there is not something we want to push.
 */
export function InstallButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const install = useInstallPrompt();
  if (!install.eligible) return null;
  return (
    <button
      type="button"
      aria-label={t("installRowTitle")}
      title={t("installRowTitle")}
      onClick={install.show}
      className={cn("grid size-10 place-items-center text-[#fafafa]", className)}
    >
      <Download className="size-5" strokeWidth={1.75} />
    </button>
  );
}

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
 * Never auto-opens: it is reached from the header download icon or the profile row.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const install = useInstallPrompt();

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
      open={install.open && !install.installed && install.mobile}
      onOpenChange={(open) => (open ? install.show() : install.close())}
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
            <Button variant="ghost" size="sm" onClick={install.close}>
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
