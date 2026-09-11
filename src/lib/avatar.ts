/**
 * Generated avatars for people without a photo of their own. DiceBear's "clay"
 * style is deterministic per seed, so the same person always gets the same face
 * and two people only match if they share a mobile number or email.
 *
 * Seed priority: mobile number → email → name+id → id.
 * Keep this file identical in the student and admin apps.
 */
export type AvatarPerson = {
  photo_url?: string | null;
  phoneE164?: string | null;
  phone_number?: string | null;
  email?: string | null;
  display_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

const DICEBEAR = "https://api.dicebear.com/10.x/clay/svg";

export function avatarSeed(person?: AvatarPerson | null, id?: string | null) {
  const phone = (person?.phoneE164 || person?.phone_number || "").replace(/\D/g, "");
  if (phone) return phone;
  const email = person?.email?.trim().toLowerCase();
  if (email) return email;
  const name = (person?.display_name || `${person?.firstName ?? ""} ${person?.lastName ?? ""}`).trim();
  if (name && id) return `${name}-${id}`;
  return name || id || "bonus";
}

export function generatedAvatar(seed: string) {
  return `${DICEBEAR}?seed=${encodeURIComponent(seed)}`;
}

/**
 * A fresh seed for the "shuffle" button. Short and readable so it can double
 * as the character's name if the person wants to type it back in later.
 */
export function randomAvatarSeed() {
  const words = [
    "atlas", "birch", "comet", "delta", "ember", "fjord", "gale", "harbor", "indigo", "juniper",
    "kite", "lumen", "maple", "nova", "orbit", "pebble", "quill", "river", "saffron", "tundra",
    "umber", "velvet", "willow", "xenon", "yarrow", "zephyr",
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 900 + 100)}`;
}

/** Turns free text ("Captain Falafel") into a stable seed. */
export function seedFromText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64);
}

/** Reads the seed back out of a generated-avatar URL, if it is one. */
export function seedOfGeneratedAvatar(url?: string | null) {
  if (!isGeneratedAvatar(url)) return null;
  try {
    return new URL(url!).searchParams.get("seed");
  } catch {
    return null;
  }
}

/** The uploaded photo when there is one, otherwise the generated avatar. */
export function avatarSrc(person?: AvatarPerson | null, id?: string | null) {
  const photo = person?.photo_url?.trim();
  return photo || generatedAvatar(avatarSeed(person, id));
}

export function isGeneratedAvatar(url?: string | null) {
  return Boolean(url && url.startsWith(DICEBEAR));
}
