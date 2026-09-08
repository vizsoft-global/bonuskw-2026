const CLEARED_KEY = "ba_notes_cleared";
const READ_KEY = "ba_notes_read";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

export function subscribeNotesState(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getNotesStateSnapshot() {
  try {
    return JSON.stringify({
      cleared: window.localStorage.getItem(CLEARED_KEY) || "[]",
      read: window.localStorage.getItem(READ_KEY) || "[]",
    });
  } catch {
    return '{"cleared":"[]","read":"[]"}';
  }
}

export function getNotesStateServerSnapshot() {
  return '{"cleared":"[]","read":"[]"}';
}

function parseIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseNotesState(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { cleared?: string; read?: string };
    return { cleared: parseIds(parsed.cleared || "[]"), read: parseIds(parsed.read || "[]") };
  } catch {
    return { cleared: [] as string[], read: [] as string[] };
  }
}

function write(key: string, ids: string[]) {
  window.localStorage.setItem(key, JSON.stringify([...new Set(ids)]));
  emit();
}

export function markNoteRead(id: string) {
  if (typeof window === "undefined") return;
  write(READ_KEY, [...parseIds(window.localStorage.getItem(READ_KEY) || "[]"), id]);
}

export function clearAllNotes(ids: string[]) {
  if (typeof window === "undefined") return;
  write(CLEARED_KEY, [...parseIds(window.localStorage.getItem(CLEARED_KEY) || "[]"), ...ids]);
}
