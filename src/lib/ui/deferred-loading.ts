"use client";

import { useEffect, useRef, useState } from "react";

/** Delay only applies when loading starts after first paint (refetch). Initial pending shows immediately. */
export function useDeferredLoading(pending: boolean, delay = 200, minVisible = 300) {
  const [show, setShow] = useState(pending);
  const shownAt = useRef(pending ? Date.now() : 0);

  useEffect(() => {
    let timeout: number;
    if (pending) {
      if (show) return;
      timeout = window.setTimeout(() => {
        shownAt.current = Date.now();
        setShow(true);
      }, delay);
    } else if (show) {
      const remain = Math.max(0, minVisible - (Date.now() - shownAt.current));
      timeout = window.setTimeout(() => setShow(false), remain);
    }
    return () => window.clearTimeout(timeout);
  }, [pending, delay, minVisible, show]);

  return show;
}
