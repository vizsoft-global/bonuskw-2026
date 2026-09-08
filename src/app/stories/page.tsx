"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { SettingsDoc, SettingsStory } from "@/lib/types/firestore";

function Viewer() {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<SettingsStory[]>([]);
  const [index, setIndex] = useState(Number(params.get("i") || 0));

  useEffect(() => {
    void getDocs(collection(getDb(), collections.settings)).then((snap) => {
      const main = snap.docs.find((d) => d.get("type") === "Main")?.data() as SettingsDoc | undefined;
      setItems((main?.settings_status ?? []).filter((item) => item?.image || item?.type));
    });
  }, []);

  const story = items[index];
  if (!story) return <main className="grid min-h-dvh place-items-center">…</main>;

  return (
    <main className="grid min-h-dvh place-items-center bg-black">
      <div className="relative aspect-[9/16] w-full max-w-md overflow-hidden bg-black">
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {items.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
        <button type="button" className="absolute end-3 top-8 z-10" onClick={() => router.push("/")}>
          ×
        </button>
        {story.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.image} alt="" className="h-full w-full object-cover" />
        ) : null}
        <button type="button" className="absolute inset-y-0 start-0 w-1/2" onClick={() => setIndex((n) => Math.max(0, n - 1))} />
        <button
          type="button"
          className="absolute inset-y-0 end-0 w-1/2"
          onClick={() => setIndex((n) => (n + 1 < items.length ? n + 1 : (router.push("/"), n)))}
        />
      </div>
    </main>
  );
}

export default function StoriesPage() {
  return (
    <Suspense>
      <Viewer />
    </Suspense>
  );
}
