"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/shared/loader";

export default function LanguagePage() {
  const router = useRouter();
  useEffect(() => {
    window.sessionStorage.setItem("ba_open_lang", "1");
    router.replace("/profile");
  }, [router]);
  return <PageLoader />;
}
