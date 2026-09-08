"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { CtaButton } from "@/components/auth/cta-button";
import { HomeIcon } from "@/components/home/icon";
import { ProfilePane } from "@/components/profile/pane";
import { SectionLabel } from "@/components/profile/ui";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { getStoredSessionId } from "@/lib/auth/session-client";
import { useAuth } from "@/lib/auth/auth-provider";
import { asDate } from "@/lib/format";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

function deviceIcon(device: string, os: string) {
  const s = `${device} ${os}`.toLowerCase();
  if (/ipad|tablet/.test(s)) return "/profile/tablet.svg";
  if (/iphone|android(?!.*chrome)|phone/.test(s) && !/mac|windows|chrome|safari|firefox|edge/.test(s)) {
    return "/profile/phone-02.svg";
  }
  if (/macbook|laptop/.test(s)) return "/profile/laptop.svg";
  if (/iphone|ipad|android/.test(s) && !/chrome|safari|firefox|edge/.test(s)) return "/profile/phone-02.svg";
  return "/profile/globe.svg";
}

function lastActiveWhen(value: unknown) {
  const d = asDate(value);
  if (!d) return "";
  if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "h:mm a")}`;
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function DevicesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [mine, setMine] = useState("");
  useEffect(() => {
    setMine(getStoredSessionId() || "");
  }, []);
  const sessions = useQuery({
    queryKey: ["sessions", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.sessions), where("userref", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs;
    },
  });

  async function kick(sessionId: string) {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch("/api/session/kick", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  }

  const rows = sessions.data ?? [];
  const current = rows.find((row) => row.id === mine) || rows.find((row) => row.get("isActive"));
  const others = rows.filter((row) => row.id !== current?.id);

  async function kickOthers() {
    await Promise.all(others.map((row) => kick(row.id)));
    await queryClient.invalidateQueries({ queryKey: ["sessions", user?.uid] });
  }

  return (
    <ProfilePane loading={sessions.isPending} title={t("deviceLogs")} skeleton={<ListPageSkeleton />}>
      {current ? (
        <div>
          <SectionLabel>{t("currentDevice")}</SectionLabel>
          <DeviceCard
            device={String(current.get("device") || current.get("model") || "Web")}
            os={String(current.get("os") || "")}
            location={String(current.get("location") || "")}
            active
            activeLabel={t("activeNow")}
          />
        </div>
      ) : null}

      <div className="mt-5">
        <SectionLabel>{t("otherDevices")}</SectionLabel>
        {others.length ? (
          others.map((row) => (
            <DeviceCard
              key={row.id}
              device={String(row.get("device") || row.get("model") || "Web")}
              os={String(row.get("os") || "")}
              location={String(row.get("location") || "")}
              when={t("lastActive").replace("{when}", lastActiveWhen(row.get("lastActive") || row.get("updatedAt") || row.get("createdAt")))}
            />
          ))
        ) : (
          <EmptyState
            compact
            icon="/profile/laptop.svg"
            title={t("emptyDevicesTitle")}
            body={t("emptyDevicesBody")}
          />
        )}
      </div>

      <div className="mt-8 pb-4">
        <CtaButton onClick={() => void kickOthers()}>{t("logoutAllDevices")}</CtaButton>
      </div>
    </ProfilePane>
  );
}

function DeviceCard({
  device,
  os,
  location,
  active,
  activeLabel,
  when,
}: {
  device: string;
  os: string;
  location: string;
  active?: boolean;
  activeLabel?: string;
  when?: string;
}) {
  return (
    <div className="mt-2.5 flex items-center gap-2.5 rounded-[12px] bg-[#141414] p-[5px]">
      <span className="size-6 shrink-0">
        <HomeIcon src={deviceIcon(device, os)} />
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-[#fafafa]">{device}</p>
          {location ? <p className="text-[10px] text-[#999]">{location}</p> : null}
        </div>
        {active ? (
          <span className="flex items-center gap-[5px] text-[10px] font-medium text-[#999]">
            <span className="size-3.5">
              <HomeIcon src="/profile/check.svg" />
            </span>
            {activeLabel}
          </span>
        ) : (
          <p className="max-w-[50%] text-end text-[10px] font-medium text-[#999]">{when}</p>
        )}
      </div>
    </div>
  );
}
