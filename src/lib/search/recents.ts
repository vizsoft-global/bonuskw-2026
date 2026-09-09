const KEY = "bonus:recent-searches";
const MAX = 8;

export function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(items: string[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  return items.slice(0, MAX);
}

export function saveRecentSearch(q: string): string[] {
  const text = q.trim();
  if (text.length < 2) return loadRecentSearches();
  const next = [text, ...loadRecentSearches().filter((item) => item.toLowerCase() !== text.toLowerCase())];
  return write(next);
}

export function removeRecentSearch(q: string): string[] {
  return write(loadRecentSearches().filter((item) => item.toLowerCase() !== q.toLowerCase()));
}

export function clearRecentSearches(): string[] {
  return write([]);
}
