"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, Loader2, X } from "lucide-react";
import { domToJpeg } from "modern-screenshot";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useI18n } from "@/lib/i18n/locale";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

type Category = "bug" | "payment" | "video" | "account" | "other";

type RecentError = { message: string; at: number };

const errorBuffer: RecentError[] = [];
let errorHookInstalled = false;

const TAB_BAR_PATHS = new Set(["/", "/store", "/my-space"]);

function installErrorHook() {
  if (typeof window === "undefined" || errorHookInstalled) return;
  errorHookInstalled = true;
  const push = (message: string) => {
    errorBuffer.push({ message: message.slice(0, 500), at: Date.now() });
    if (errorBuffer.length > 10) errorBuffer.shift();
  };
  window.addEventListener("error", (ev) => {
    push(ev.message || String(ev.error ?? "error"));
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    push(
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "unhandledrejection",
    );
  });
}

function parseUa(ua: string) {
  let browser = "Unknown";
  let browserVersion = "";
  let os = "Unknown";
  if (/Edg\//.test(ua)) {
    browser = "Edge";
    browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] ?? "";
  } else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
    browser = "Chrome";
    browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? "";
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    browser = "Safari";
    browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] ?? "";
  } else if (/Firefox\//.test(ua)) {
    browser = "Firefox";
    browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? "";
  }
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  const deviceType = /Mobi|Android|iPhone|iPad/.test(ua)
    ? /iPad|Tablet/.test(ua)
      ? "tablet"
      : "mobile"
    : "desktop";
  return { browser, browserVersion, os, deviceType };
}

function collectDevice() {
  const ua = navigator.userAgent;
  const parsed = parseUa(ua);
  const connection =
    (
      navigator as Navigator & {
        connection?: { effectiveType?: string };
      }
    ).connection?.effectiveType ?? undefined;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return {
    userAgent: ua,
    ...parsed,
    screen: `${window.screen.width}×${window.screen.height}`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
    connection,
    standalone,
    locale: document.documentElement.lang || undefined,
    appVersion: APP_VERSION,
  };
}

export function HelpButton() {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const { user, profile } = useAuth();
  const [hiddenFullscreen, setHiddenFullscreen] = useState(false);
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [includeShot, setIncludeShot] = useState(true);
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  const hideOnPath = pathname.startsWith("/checkout/return");
  const raisedForTabs = TAB_BAR_PATHS.has(pathname);

  useEffect(() => {
    installErrorHook();
  }, []);

  useEffect(() => {
    const sync = () => {
      const native = Boolean(
        document.fullscreenElement ||
          (document as Document & { webkitFullscreenElement?: Element })
            .webkitFullscreenElement,
      );
      const fill = document.documentElement.dataset.videoFill === "1";
      setHiddenFullscreen(native || fill);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-video-fill"],
    });
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      obs.disconnect();
    };
  }, []);

  async function start() {
    if (capturing || open) return;
    setCapturing(true);
    let shot: string | null = null;
    try {
      if (buttonRef.current) buttonRef.current.style.visibility = "hidden";
      shot = await domToJpeg(document.body, {
        quality: 0.7,
        scale: Math.min(1, 1600 / Math.max(document.body.scrollWidth, 1)),
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return !node.dataset.helpWidget;
        },
      });
    } catch (err) {
      console.warn("[help] screenshot failed", err);
    } finally {
      if (buttonRef.current) buttonRef.current.style.visibility = "";
      setCapturing(false);
    }
    setScreenshot(shot);
    setIncludeShot(Boolean(shot));
    setCategory("bug");
    setMessage("");
    setWebsite("");
    if (!user) {
      setName("");
      setEmail("");
      setPhone("");
    } else {
      setName(
        profile?.display_name ||
          [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
          "",
      );
      setEmail(profile?.email || user.email || "");
      setPhone(profile?.phone_number || profile?.phoneE164 || "");
    }
    setOpen(true);
  }

  async function submit() {
    const text = message.trim();
    if (!text) {
      toast.error(t("helpMessageRequired"));
      return;
    }
    if (!user && !name.trim()) {
      toast.error(t("helpNameRequired"));
      return;
    }
    if (!user && !email.trim() && !phone.trim()) {
      toast.error(t("helpContactRequired"));
      return;
    }
    setBusy(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const current = getFirebaseAuth().currentUser;
      if (current) headers.Authorization = `Bearer ${await current.getIdToken()}`;

      const res = await fetch("/api/support", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: text,
          category,
          source: "student_app",
          website,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          page: {
            url: window.location.href,
            path: pathname || window.location.pathname,
            title: document.title,
            referrer: document.referrer || undefined,
          },
          device: {
            ...collectDevice(),
            locale: locale || document.documentElement.lang || undefined,
          },
          recentErrors: [...errorBuffer],
          screenshotDataUrl: includeShot ? screenshot : null,
        }),
      });
      const json = (await res.json()) as { number?: number; error?: string };
      if (!res.ok) throw new Error(json.error || t("ticketFailed"));
      toast.success(t("ticketReceived", { number: String(json.number ?? 0) }));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ticketFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (hideOnPath || hiddenFullscreen) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-help-widget="1"
        onClick={() => void start()}
        disabled={capturing}
        aria-label={t("help")}
        className={cn(
          "fixed end-4 z-50 flex size-12 items-center justify-center rounded-full bg-text text-bg shadow-lg transition hover:opacity-90",
          // Sit above ScrollToTop (bottom-28/6) and the mobile tab bar.
          raisedForTabs ? "bottom-40 lg:bottom-20" : "bottom-20 lg:bottom-8",
        )}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        title={t("help")}
      >
        {capturing ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <LifeBuoy className="size-5" />
        )}
      </button>

      {open ? (
        <div
          data-help-widget="1"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-text">{t("reportProblem")}</h2>
                <p className="mt-0.5 text-xs leading-4 text-muted">{t("reportProblemHint")}</p>
              </div>
              <button
                type="button"
                aria-label={t("cancel")}
                className="rounded-md p-1 text-muted hover:bg-surface-2"
                onClick={() => !busy && setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t("helpCategory")}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="h-11 w-full rounded-full border border-line bg-surface-2 px-4 text-sm text-text"
                >
                  <option value="bug">{t("helpBug")}</option>
                  <option value="payment">{t("helpPayment")}</option>
                  <option value="video">{t("helpVideo")}</option>
                  <option value="account">{t("helpAccount")}</option>
                  <option value="other">{t("helpOther")}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t("helpMessage")}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-text"
                  placeholder={t("reportProblemHint")}
                />
              </div>

              {!user ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">
                      {t("helpYourName")}
                    </label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">
                        {t("helpEmail")}
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">
                        {t("helpPhone")}
                      </label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : null}

              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                aria-hidden
              />

              {screenshot ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-2">
                  <input
                    type="checkbox"
                    checked={includeShot}
                    onChange={(e) => setIncludeShot(e.target.checked)}
                    className="mt-1 size-4"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text">
                      {t("includeScreenshot")}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshot}
                      alt=""
                      className="mt-2 max-h-36 w-full rounded-lg bg-surface-2 object-contain object-top"
                    />
                  </span>
                </label>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button loading={busy} onClick={() => void submit()}>
                  {busy ? t("sendingTicket") : t("submitTicket")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
