const SEEN_KEY = "ba_stories_seen";
const listeners = new Set<() => void>();

export function subscribeSeen(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSeenSnapshot() {
  try {
    return window.localStorage.getItem(SEEN_KEY) || "[]";
  } catch {
    return "[]";
  }
}

export function getSeenServerSnapshot() {
  return "[]";
}

export function parseSeen(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function markSeen(key: string) {
  if (typeof window === "undefined") return;
  const next = [...new Set([...parseSeen(getSeenSnapshot()), key])];
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  listeners.forEach((cb) => cb());
}
