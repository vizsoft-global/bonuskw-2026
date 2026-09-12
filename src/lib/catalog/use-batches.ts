"use client";

import { useQuery } from "@tanstack/react-query";
import { getDocsByIds } from "@/lib/catalog/queries";
import { collections } from "@/lib/firebase/collections";
import { batchInfo, type BatchInfo } from "@/lib/course/batch-status";
import type { BatchDoc } from "@/lib/types/firestore";

const STALE_MS = 5 * 60 * 1000;

/**
 * Name + open/closed tone for a list of batch ids, one batched read.
 * Used by every course list so the chip colour matches what checkout enforces.
 */
export function useBatches(ids: string[]) {
  const key = [...new Set(ids.filter(Boolean))].sort().join(",");
  return useQuery({
    queryKey: ["batches-info", key],
    enabled: key.length > 0,
    staleTime: STALE_MS,
    queryFn: async () => {
      const rows = await getDocsByIds(collections.batches, key.split(","));
      return Object.fromEntries(
        Object.entries(rows).map(([id, row]) => [id, batchInfo(row as BatchDoc)]),
      ) as Record<string, BatchInfo>;
    },
  });
}
