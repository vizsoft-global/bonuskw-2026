"use client";

import { useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { CourseDoc } from "@/lib/types/firestore";

type CourseRow = CourseDoc & { id: string };

/**
 * Keeps the course catalog live. One Firestore listener on `course` pushes
 * every add / edit / delete into the `["courses"]` cache (and any open
 * `["course", id]` detail) so a course published in the admin shows up here
 * without a reload. `listCourses()` still runs on first paint; from then on
 * the listener owns the data.
 */
export function LiveCatalog() {
  const qc = useQueryClient();

  useEffect(() => {
    let first = true;
    const unsubscribe = onSnapshot(
      collection(getDb(), collections.course),
      (snap) => {
        const rows: CourseRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CourseDoc) }));
        qc.setQueryData<CourseRow[]>(["courses"], rows);

        if (first) {
          // Initial delivery mirrors what listCourses() would have returned.
          first = false;
          return;
        }
        for (const change of snap.docChanges()) {
          const key: readonly unknown[] = ["course", change.doc.id];
          if (!qc.getQueryState(key)) continue;
          const next: CourseRow | null =
            change.type === "removed"
              ? null
              : { id: change.doc.id, ...(change.doc.data() as CourseDoc) };
          qc.setQueryData<CourseRow | null>(key, () => next);
        }
      },
      () => {
        // Listener failed (offline, rules). Queries keep their normal refetching.
      },
    );
    return unsubscribe;
  }, [qc]);

  return null;
}
