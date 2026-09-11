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

/** The uploaded photo when there is one, otherwise the generated avatar. */
export function avatarSrc(person?: AvatarPerson | null, id?: string | null) {
  const photo = person?.photo_url?.trim();
  return photo || generatedAvatar(avatarSeed(person, id));
}

export function isGeneratedAvatar(url?: string | null) {
  return Boolean(url && url.startsWith(DICEBEAR));
}
