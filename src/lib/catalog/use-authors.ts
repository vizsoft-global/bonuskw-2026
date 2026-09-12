"use client";

import { useQuery } from "@tanstack/react-query";
import { avatarSrc } from "@/lib/avatar";
import { collections } from "@/lib/firebase/collections";
import { getDocsByIds } from "./queries";

export type AuthorInfo = { name: string; photo: string };
export type AuthorMap = Record<string, AuthorInfo>;

const STALE_MS = 5 * 60 * 1000;

/**
 * Names and avatars for the instructors behind a list of courses. One batched
 * read per 10 ids, cached across pages that show the same instructors.
 */
export function useAuthors(ids: (string | undefined | null)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])].sort();
  return useQuery({
    queryKey: ["authors-info", unique.join(",")],
    enabled: unique.length > 0,
    staleTime: STALE_MS,
    queryFn: async (): Promise<AuthorMap> => {
      const rows = await getDocsByIds(collections.users, unique);
      return Object.fromEntries(
        Object.entries(rows).map(([id, row]) => [
          id,
          {
            name: String(row.display_name || "").trim(),
            photo: avatarSrc(
              { display_name: row.display_name, email: row.email, photo_url: row.photo_url, phoneE164: row.phoneE164 },
              id,
            ),
          },
        ]),
      );
    },
  });
}
