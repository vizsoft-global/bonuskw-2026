"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { StoryViewer } from "@/components/home/story-viewer";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { isStoryActive } from "@/lib/stories/media";
import type { SettingsDoc, SettingsStory } from "@/lib/types/firestore";

function Viewer() {
  const params = useSearchParams();
  const [items, setItems] = useState<SettingsStory[] | null>(null);
  const startIndex = Number(params.get("i") || 0);

  useEffect(() => {
    void getDocs(collection(getDb(), collections.settings)).then((snap) => {
      const main = snap.docs.find((d) => d.get("type") === "Main")?.data() as SettingsDoc | undefined;
      setItems((main?.settings_status ?? []).filter(isStoryActive));
    });
  }, []);

  if (!items) return <main className="min-h-dvh bg-[#050505]" />;
  if (!items.length) return <EmptyHome />;
  return <StoryViewer stories={items} startIndex={startIndex} />;
}

function EmptyHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return <main className="min-h-dvh bg-[#050505]" />;
}

export default function StoriesPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#050505]" />}>
      <Viewer />
    </Suspense>
  );
}
