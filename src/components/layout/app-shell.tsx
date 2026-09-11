"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDoc } from "firebase/firestore";
import { BrandLogo } from "@/components/auth/brand-logo";
import { CustomPopupHost } from "@/components/home/custom-popup";
import { InstallButton, InstallPrompt } from "@/components/system/install-prompt";
import { HomeIcon } from "@/components/home/icon";
import { Avatar } from "@/components/layout/avatar";
import { BackButton } from "@/components/layout/back-button";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { NotificationsBellButton, NotificationsMenu } from "@/components/notifications/menu";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart } from "@/lib/cart/store";
import { useI18n } from "@/lib/i18n/locale";
import { haptic } from "@/lib/ui/haptics";
import { useDeferredLoading } from "@/lib/ui/deferred-loading";
import { avatarSrc } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", key: "home" as const, icon: "/home/home-outline.svg", iconActive: "/home/home.svg" },
  { href: "/store", key: "store" as const, icon: "/home/notebook.svg", iconActive: "/home/notebook-filled.svg" },
  { href: "/my-space", key: "myZone" as const, icon: "/home/saucer.svg", iconActive: "/home/saucer-filled.svg" },
  { href: "/profile", key: "profile" as const },
];

const chromePaths = new Set(["/", "/store", "/my-space"]);
const tabPaths = new Set(["/", "/store", "/my-space", "/profile"]);
const tabBarPaths = new Set(["/", "/store", "/my-space"]);
const tabHrefs = tabs.map((tab) => tab.href);
const GLOW = "linear-gradient(180deg, #ED4A27 26%, #32B2B9 72%, #048EE4 100%)";

function isBarePath(path: string) {
  return (
    path.startsWith("/login") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/verify") ||
    path.startsWith("/session-ended") ||
    path.startsWith("/offline") ||
    path.startsWith("/stories")
  );
}

type ShellTargets = {
  framed: boolean;
  extra: HTMLElement | null;
  search: HTMLElement | null;
  actions: HTMLElement | null;
  actionsLg: HTMLElement | null;
  title: string | undefined;
  setTitle: (title?: string) => void;
};

const ShellContext = createContext<ShellTargets>({
  framed: false,
  extra: null,
  search: null,
  actions: null,
  actionsLg: null,
  title: undefined,
  setTitle: () => {},
});

function Slot({ target, children }: { target: HTMLElement | null; children?: ReactNode }) {
  if (!target || children == null || children === false) return null;
  return createPortal(children, target);
}

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute end-1.5 top-1.5 grid min-w-3 place-items-center rounded-[7px] bg-[#f24822] px-0.5 text-[8px] font-medium leading-3 text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function GlassIcon({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-label={label}
      className="relative flex items-center rounded-[47px] border-[0.5px] border-white/15 bg-white/5 p-[5px] backdrop-blur-[15px] transition-transform duration-150 active:scale-95"
    >
      <span className="relative size-10 overflow-visible rounded-[28px]">
        <span className="absolute start-2.5 top-[10px] size-5">
          <HomeIcon src={icon} />
        </span>
        {badge ? <CountBadge count={badge} /> : null}
      </span>
    </Link>
  );
}

function HeaderGlow() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[220px] overflow-hidden lg:hidden"
      style={{ maskImage: "linear-gradient(to bottom, #000 35%, transparent 100%)" }}
      aria-hidden
    >
      <div
        className="absolute start-[84px] -top-10 h-[231px] w-[409px] rounded-full opacity-[0.14] blur-[50px]"
        style={{ background: GLOW }}
      />
    </div>
  );
}

function DesktopGlow() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 hidden h-[162px] overflow-hidden lg:block"
      style={{ maskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)" }}
      aria-hidden
    >
      <div className="absolute end-[-32px] top-[3px] h-[162px] w-[483px]">
        <div
          className="absolute left-1/2 top-1/2 h-[474px] w-[103px] rounded-full opacity-30"
          style={{
            background: GLOW,
            filter: "blur(100px)",
            transform: "translate(-50%, -50%) rotate(82.68deg)",
          }}
        />
      </div>
    </div>
  );
}

function PageToolbar({
  heading = true,
  className,
  title,
  actionsRef,
}: {
  heading?: boolean;
  className?: string;
  title?: string;
  actionsRef: (node: HTMLElement | null) => void;
}) {
  const path = usePathname();
  const TitleTag = heading ? "h1" : "p";
  return (
    <div className={cn("flex w-full flex-nowrap items-center gap-2.5", className)}>
      <BackButton fallback={path.startsWith("/profile/") ? "/profile" : "/"} />
      {title ? (
        <TitleTag className="m-0 min-w-0 flex-1 truncate text-[16px] font-semibold leading-6 text-[#fafafa]">
          {title}
        </TitleTag>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      <div ref={actionsRef} className="flex shrink-0 items-center gap-3 empty:hidden" />
    </div>
  );
}

function TabItem({
  href,
  label,
  active,
  icon,
  iconActive,
  profile,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: string;
  iconActive?: string;
  profile?: { src?: string; name: string };
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onPointerDown={() => {
        if (!active) haptic("light");
      }}
      className="flex min-h-[44px] w-10 shrink-0 touch-manipulation flex-col items-center gap-[5px] transition-transform duration-150 ease-out active:scale-95"
    >
      {profile ? (
        <Avatar
          src={profile.src}
          name={profile.name}
          className={cn(
            "size-[30px] text-[10px] transition-[box-shadow,opacity] duration-200",
            active ? "shadow-[0_0_0_1.5px_#fff]" : "opacity-80",
          )}
        />
      ) : (
        <span className="relative grid size-[30px] place-items-center">
          <span
            className={cn(
              "absolute size-[25px] transition-opacity duration-200",
              active ? "opacity-100" : "opacity-0",
            )}
          >
            <HomeIcon src={iconActive || ""} />
          </span>
          <span
            className={cn(
              "absolute size-[25px] transition-opacity duration-200",
              active ? "opacity-0" : "opacity-100",
            )}
          >
            <HomeIcon src={icon || ""} />
          </span>
        </span>
      )}
      <span
        className={cn(
          "max-w-[50px] whitespace-nowrap text-center text-[12px] font-medium leading-[14px] transition-colors duration-200",
          active ? "text-white" : "text-[#999]",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function CatalogWarmup() {
  const router = useRouter();

  useEffect(() => {
    const prefetch = () => {
      for (const href of tabHrefs) router.prefetch(href);
    };
    const idle = window.requestIdleCallback?.(prefetch);
    const timer = window.setTimeout(prefetch, 2500);
    return () => {
      if (idle) window.cancelIdleCallback?.(idle);
      window.clearTimeout(timer);
    };
  }, [router]);

  return null;
}

function AppChrome({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [nodes, setNodes] = useState({
    extra: null as HTMLElement | null,
    search: null as HTMLElement | null,
    actions: null as HTMLElement | null,
    actionsLg: null as HTMLElement | null,
  });
  const [pageTitle, setPageTitle] = useState<string | undefined>();
  const setTitle = useCallback((next?: string) => {
    setPageTitle((prev) => (prev === next ? prev : next));
  }, []);

  const bindExtra = useCallback((node: HTMLElement | null) => {
    setNodes((prev) => (prev.extra === node ? prev : { ...prev, extra: node }));
  }, []);
  const bindSearch = useCallback((node: HTMLElement | null) => {
    setNodes((prev) => (prev.search === node ? prev : { ...prev, search: node }));
  }, []);
  const bindActions = useCallback((node: HTMLElement | null) => {
    setNodes((prev) => (prev.actions === node ? prev : { ...prev, actions: node }));
  }, []);
  const bindActionsLg = useCallback((node: HTMLElement | null) => {
    setNodes((prev) => (prev.actionsLg === node ? prev : { ...prev, actionsLg: node }));
  }, []);

  const ctx = useMemo<ShellTargets>(
    () => ({ framed: true, title: pageTitle, setTitle, ...nodes }),
    [nodes, pageTitle, setTitle],
  );

  const university = useQuery({
    queryKey: ["university", profile?.universityRef?.id],
    enabled: Boolean(profile?.universityRef),
    queryFn: async () => {
      const snap = await getDoc(profile!.universityRef!);
      return String(snap.get("name") || "");
    },
  });
  const cart = useQuery({
    queryKey: ["cart", user?.uid],
    enabled: Boolean(user),
    queryFn: () => loadCart(user!.uid),
  });
  const cartCount = cart.data?.lines.length ?? 0;
  const uniName = university.data || "";
  const displayName = profile?.display_name || t("profile");
  const isChrome = chromePaths.has(path);
  const showTabBar = tabBarPaths.has(path);
  const isSearch = path === "/search";
  const nested = !tabPaths.has(path);
  const hideSearch = isSearch;

  return (
    <ShellContext.Provider value={ctx}>
      <div className="relative min-h-dvh overflow-x-hidden bg-app-top text-[#fafafa]">
        <CatalogWarmup />
        <CustomPopupHost />
        <InstallPrompt />
        <HeaderGlow />

        <header className="relative z-40 overflow-visible lg:sticky lg:top-0 lg:bg-app-top">
          <DesktopGlow />
          <div
            className={cn(
              "relative hidden items-center justify-between px-[30px] lg:flex",
              path.includes("/learn") ? "py-1.5" : "py-[15px]",
            )}
          >
            <div className="flex items-center gap-8">
              <Link href="/" prefetch>
                <BrandLogo size="nav" />
              </Link>
              <nav className="flex items-center gap-2">
                {tabs.map((tab) => {
                  const active =
                    tab.href === "/" ? path === "/" : path === tab.href || path.startsWith(`${tab.href}/`);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      prefetch
                      onPointerDown={() => {
                        if (!active) haptic("light");
                      }}
                      className={cn(
                        "rounded-full px-5 py-2 text-[14px] font-medium transition-[background-color,color] duration-200",
                        active ? "bg-[#2a2a2a] text-[#fafafa]" : "text-[#999] hover:text-[#fafafa]",
                      )}
                    >
                      {t(tab.key)}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-[15px]">
              {hideSearch ? null : (
                <button
                  type="button"
                  onClick={() => router.push("/search")}
                  className={cn(
                    "flex w-[304px] items-center gap-2.5 rounded-[47px] border-[0.5px] border-white/15 bg-black/25 px-[15px] backdrop-blur-[15px] transition-transform duration-150 active:scale-[0.99]",
                    path.includes("/learn") ? "h-9" : "h-[51px]",
                  )}
                >
                  <span className="size-5 shrink-0">
                    <HomeIcon src="/home/search.svg" />
                  </span>
                  <span className="truncate text-[12px] text-[#999]">{t("search")}</span>
                </button>
              )}
              <NotificationsMenu />
              <GlassIcon href="/cart" label={t("cart")} icon="/home/cart.svg" badge={cartCount} />
              <ProfileMenu
                className={cn(
                  "flex items-center gap-2.5 rounded-[47px] border-[0.5px] border-white/15 bg-white/5 ps-[5px] pe-2.5 backdrop-blur-[15px]",
                  path.includes("/learn") ? "py-0.5" : "py-[5px]",
                )}
                trigger={(open) => (
                  <>
                    <Avatar src={avatarSrc(profile, user?.uid)} name={displayName} />
                    <span className="min-w-0 text-start">
                      <span className="block truncate text-[14px] font-bold text-[#fafafa]">{displayName}</span>
                      <span className="block truncate text-[12px] text-[#999]">{uniName}</span>
                    </span>
                    <span className={cn("size-[18px] shrink-0 rotate-90 transition-transform", open && "rotate-[270deg]")}>
                      <HomeIcon src="/home/chevron.svg" />
                    </span>
                  </>
                )}
              />
            </div>
          </div>

          {isSearch ? (
            <div className="relative px-[15px] pb-2.5 pt-safe-header lg:hidden">
              <div className="flex min-h-12 items-center gap-2.5">
                <BackButton />
                <span className="h-5 w-px shrink-0 bg-white/20" />
                <div ref={bindSearch} className="min-w-0 flex-1" />
                <button
                  type="button"
                  aria-label={t("searchTitle")}
                  className="grid size-10 shrink-0 place-items-center"
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector("input");
                    input?.focus();
                  }}
                >
                  <span className="size-5">
                    <HomeIcon src="/home/search.svg" />
                  </span>
                </button>
              </div>
            </div>
          ) : isChrome ? (
            <div className="relative overflow-hidden rounded-b-[18px] bg-app-top px-[15px] pb-5 pt-safe-header lg:hidden">
              <div
                className="pointer-events-none absolute start-[84px] -top-10 h-[231px] w-[409px] rounded-full opacity-[0.14] blur-[50px]"
                style={{ background: GLOW }}
                aria-hidden
              />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <ProfileMenu
                  align="start"
                  className="flex min-w-0 items-center gap-2.5"
                  trigger={() => (
                    <>
                      <Avatar src={avatarSrc(profile, user?.uid)} name={displayName} />
                      <span className="min-w-0 text-start">
                        <span className="block truncate text-[14px] font-bold text-[#fafafa]">{displayName}</span>
                        <span className="block truncate text-[12px] text-[#999]">{uniName}</span>
                      </span>
                    </>
                  )}
                />
                <div className="flex shrink-0 items-center gap-[5px]">
                  <InstallButton />
                  <Link href="/search" prefetch aria-label={t("search")} className="grid size-10 place-items-center">
                    <span className="size-5">
                      <HomeIcon src="/home/search.svg" />
                    </span>
                  </Link>
                  <NotificationsBellButton />
                  <Link href="/cart" prefetch aria-label={t("cart")} className="relative grid size-10 place-items-center">
                    <span className="size-5">
                      <HomeIcon src="/home/cart.svg" />
                    </span>
                    <CountBadge count={cartCount} />
                  </Link>
                </div>
              </div>
              <div ref={bindExtra} className="relative empty:hidden empty:pt-0 pt-[15px]" />
            </div>
          ) : (
            <div
              className={cn(
                "relative px-[15px] lg:hidden",
                path.includes("/learn")
                  ? "pb-1.5 pt-[max(8px,env(safe-area-inset-top,0px))]"
                  : "pb-3 pt-safe-header",
              )}
            >
              <PageToolbar title={pageTitle} actionsRef={bindActions} />
            </div>
          )}
        </header>

        <main
          className={cn(
            "relative z-10 mx-auto w-full max-w-[1040px] px-[15px] lg:px-0 lg:pb-10",
            showTabBar ? "pb-32" : path.includes("/learn") ? "pb-4" : "pb-10",
            path.startsWith("/profile") && "lg:max-w-[1280px] lg:px-[30px]",
            path.includes("/learn") && "lg:max-w-[1600px] lg:px-6 lg:pb-3",
          )}
        >
          {nested && !path.startsWith("/profile/") ? (
            <PageToolbar
              heading={false}
              className={cn("hidden lg:flex", path.includes("/learn") ? "mb-1.5" : "mb-4 pt-[30px]")}
              title={pageTitle}
              actionsRef={bindActionsLg}
            />
          ) : null}
          {children}
          <ScrollToTop raised={showTabBar} />
        </main>

        <nav
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-white/10 bg-[rgba(22,22,22,0.7)] px-10 pb-safe-nav pt-2.5 backdrop-blur-[20px] transition-[transform,opacity] duration-200 ease-out lg:hidden",
            showTabBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
          )}
          aria-hidden={!showTabBar}
        >
          {tabs.map((tab) => {
            const active = tab.href === "/" ? path === "/" : path === tab.href;
            return (
              <TabItem
                key={tab.href}
                href={tab.href}
                label={t(tab.key)}
                active={active}
                icon={tab.icon}
                iconActive={tab.iconActive}
                profile={
                  tab.key === "profile" ? { src: avatarSrc(profile, user?.uid), name: displayName } : undefined
                }
              />
            );
          })}
        </nav>
      </div>
    </ShellContext.Provider>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (isBarePath(path)) return children;
  return <AppChrome>{children}</AppChrome>;
}

function AppShellBody({
  children,
  headerExtra,
  searchField,
  loading,
  skeleton,
  title,
  actions,
}: {
  children?: ReactNode;
  headerExtra?: ReactNode;
  searchField?: ReactNode;
  loading?: boolean;
  skeleton?: ReactNode;
  title?: string;
  actions?: ReactNode;
}) {
  const shell = useContext(ShellContext);
  const showSkeleton = useDeferredLoading(Boolean(loading));

  useLayoutEffect(() => {
    if (!shell.framed) return;
    shell.setTitle(title);
    return () => shell.setTitle(undefined);
  }, [shell.framed, shell.setTitle, title]);

  const body = showSkeleton ? (
    (skeleton ?? <ListPageSkeleton />)
  ) : loading ? (
    <div className="min-h-[40vh]" aria-hidden />
  ) : (
    children
  );

  const actionCopy = actions && isValidElement(actions) ? cloneElement(actions) : actions;

  return (
    <>
      <Slot target={shell.extra}>{headerExtra}</Slot>
      <Slot target={shell.search}>{searchField}</Slot>
      <Slot target={shell.actions}>{actions}</Slot>
      <Slot target={shell.actionsLg}>{actionCopy}</Slot>
      {body}
    </>
  );
}

export function AppShell({
  children,
  headerExtra,
  searchField,
  loading,
  skeleton,
  title,
  actions,
}: {
  children?: ReactNode;
  headerExtra?: ReactNode;
  searchField?: ReactNode;
  loading?: boolean;
  skeleton?: ReactNode;
  title?: string;
  actions?: ReactNode;
  compactHeader?: boolean;
}) {
  const shell = useContext(ShellContext);
  const body = (
    <AppShellBody
      headerExtra={headerExtra}
      searchField={searchField}
      loading={loading}
      skeleton={skeleton}
      title={title}
      actions={actions}
    >
      {children}
    </AppShellBody>
  );
  if (shell.framed) return body;
  return <AppChrome>{body}</AppChrome>;
}
