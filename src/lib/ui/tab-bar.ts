/** Mobile bottom bar: every framed page except the lesson player. */
export function hasTabBar(path: string) {
  return !path.includes("/learn");
}
