"use client";

import type { QueryClient } from "@tanstack/react-query";

/**
 * Drops every cached enrolment view after a purchase or free enrol so My
 * Zone, course pages and the learn page re-read subscriptions immediately
 * instead of serving the pre-purchase snapshot.
 */
export function invalidateEnrolment(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["my-subs"] }),
    qc.invalidateQueries({ queryKey: ["my-books"] }),
    qc.invalidateQueries({ queryKey: ["my-ebook-docs"] }),
    qc.invalidateQueries({ queryKey: ["continue"] }),
    qc.invalidateQueries({ queryKey: ["courses"] }),
    qc.invalidateQueries({ queryKey: ["course"] }),
    qc.invalidateQueries({ queryKey: ["subscription"] }),
    qc.invalidateQueries({ queryKey: ["stats"] }),
  ]);
}
