"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  linkWithPhoneNumber,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  unlink,
  PhoneAuthProvider,
  RecaptchaVerifier,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import {
  appleProvider,
  getDb,
  getFirebaseAuth,
  googleProvider,
} from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { normalizePhone } from "@/lib/utils";
import {
  heartbeat,
  getStoredSessionId,
  startSession,
  setStoredSessionId,
  type OtherSession,
} from "./session-client";
import { SessionConflictDialog } from "@/components/auth/session-conflict-dialog";
import type { UserDoc } from "@/lib/types/firestore";

/** Where to send the student after a successful sign-in. */
export type SignInResult = { needsOnboarding: boolean };

type AuthState = {
  user: User | null;
  profile: (UserDoc & { id: string }) | null;
  ready: boolean;
  needsOnboarding: boolean;
  /** Signed in (Google / Apple / email) but no verified phone on the profile yet. */
  needsPhone: boolean;
  kicked: boolean;
  sendSms: (phone: string) => Promise<void>;
  confirmSms: (code: string) => Promise<SignInResult>;
  sendFallback: (phone: string, channel: "whatsapp" | "sms") => Promise<void>;
  confirmFallback: (phone: string, code: string) => Promise<SignInResult>;
  signInGoogle: () => Promise<SignInResult>;
  signInApple: () => Promise<SignInResult>;
  signInEmail: (email: string, password: string) => Promise<SignInResult>;
  /** Redeems a single-use sign-in link an admin sent to the student. */
  signInWithLink: (token: string) => Promise<SignInResult>;
  resetPassword: (email: string) => Promise<void>;
  /** Onboarding: send a code to attach a phone to the signed-in account. */
  sendLinkSms: (phone: string) => Promise<void>;
  /**
   * Onboarding: confirm the code and save the phone on the profile. When the
   * number already has its own account, the student just proved they own it,
   * so we sign into that account instead (`switched: true`).
   */
  confirmLinkSms: (code: string) => Promise<SignInResult & { switched: boolean }>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

function needsAcademic(profile: UserDoc | null) {
  // High-school students pick a grade (categoryRef) instead of a field (branchRef).
  return !profile?.countryRef || !profile.universityRef || !(profile.branchRef || profile.categoryRef);
}

function lacksPhone(profile: UserDoc | null) {
  return !profile?.phone_number?.trim();
}

/**
 * Only the academic details are required. A verified phone used to be a hard
 * step for Google/Apple/email sign-ins, but Kuwaiti carriers block enough
 * verification SMS that it kept real students out; legacy accounts are now
 * matched by verified email as well as by phone.
 */
function computeNeedsOnboarding(profile: UserDoc | null) {
  return needsAcademic(profile);
}

async function bearer(user: User) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken(true)}` };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<(UserDoc & { id: string }) | null>(null);
  const [ready, setReady] = useState(false);
  const [kicked, setKicked] = useState(false);
  /** Other devices holding an active session; non-null shows the take-over prompt. */
  const [conflict, setConflict] = useState<OtherSession[] | null>(null);
  const [takingOver, setTakingOver] = useState(false);
  // Bumped after a forced take-over so the session effect runs again.
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const forceNext = useRef(false);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const snap = await getDoc(doc(getDb(), collections.users, uid));
      if (!snap.exists()) {
        setProfile(null);
        return null;
      }
      const next = { id: snap.id, ...(snap.data() as UserDoc) };
      setProfile(next);
      return next;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const failSafe = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 2500);
    let unsub: () => void = () => undefined;
    try {
      unsub = onAuthStateChanged(getFirebaseAuth(), (next) => {
        if (cancelled) return;
        setUser(next);
        setReady(true);
        window.clearTimeout(failSafe);
        if (next) void loadProfile(next.uid);
        else {
          setProfile(null);
          setConflict(null);
        }
      });
    } catch {
      window.clearTimeout(failSafe);
      // Defer so we don't setState synchronously inside the effect body.
      window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 0);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      unsub();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let stopSession: (() => void) | undefined;
    let beat: number | undefined;
    void (async () => {
      const force = forceNext.current;
      forceNext.current = false;
      let outcome: Awaited<ReturnType<typeof startSession>>;
      try {
        const token = await user.getIdToken();
        outcome = await startSession(token, { force });
      } catch {
        // Network hiccup: keep the student signed in; the next load retries.
        return;
      } finally {
        if (!cancelled) setTakingOver(false);
      }
      if (cancelled) return;
      if (outcome.status === "conflict") {
        // Signed in on another device. Never block — ask whether to take over.
        setConflict(outcome.sessions);
        return;
      }
      setConflict(null);
      const sessionId = outcome.sessionId;
      stopSession = onSnapshot(doc(getDb(), collections.sessions, sessionId), (snap) => {
        const data = snap.data() as { isActive?: boolean } | undefined;
        if (data && data.isActive === false && getStoredSessionId() === sessionId) {
          setKicked(true);
          setStoredSessionId(null);
          void signOut(getFirebaseAuth());
        }
      });
      beat = window.setInterval(() => {
        void user.getIdToken().then((t) => heartbeat(t, sessionId));
      }, 5 * 60 * 1000);
    })();
    return () => {
      cancelled = true;
      stopSession?.();
      if (beat) window.clearInterval(beat);
    };
  }, [user, sessionAttempt]);

  const takeOverSession = useCallback(() => {
    forceNext.current = true;
    setTakingOver(true);
    setSessionAttempt((n) => n + 1);
  }, []);

  const ensureVerifier = () => {
    if (verifier) return verifier;
    verifier = new RecaptchaVerifier(getFirebaseAuth(), "ba-recaptcha", {
      size: "invisible",
    });
    return verifier;
  };

  /**
   * Resolves the Firestore profile for a fresh Firebase session. Every sign-in
   * first tries to land on the legacy account (Flutter app users) that owns the
   * verified phone or verified email in the ID token; otherwise the profile is
   * created / completed for this uid.
   */
  const afterSignIn = useCallback(
    async (signed: User, phone?: string, opts?: { skipLegacyLink?: boolean }): Promise<SignInResult> => {
      const token = await signed.getIdToken();
      if (!opts?.skipLegacyLink) {
        const link = await fetch("/api/auth/legacy-link", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(phone ? { phone } : {}),
        }).catch(() => null);
        const json = ((await link?.json().catch(() => ({}))) ?? {}) as { customToken?: string };
        if (json.customToken) {
          const linked = await signInWithCustomToken(getFirebaseAuth(), json.customToken);
          const profile = await loadProfile(linked.user.uid);
          return { needsOnboarding: computeNeedsOnboarding(profile) };
        }
      }
      await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone }),
      });
      const profile = await loadProfile(signed.uid);
      return { needsOnboarding: computeNeedsOnboarding(profile) };
    },
    [loadProfile],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      ready,
      needsOnboarding: Boolean(user && profile && computeNeedsOnboarding(profile)),
      needsPhone: Boolean(user && profile && lacksPhone(profile)),
      kicked,
      sendSms: async (phone) => {
        const normalized = normalizePhone(phone);
        try {
          confirmation = await signInWithPhoneNumber(getFirebaseAuth(), normalized, ensureVerifier());
        } catch (err) {
          // A failed reCAPTCHA leaves the widget unusable; rebuild it next time.
          verifier?.clear();
          verifier = null;
          throw err;
        }
        window.sessionStorage.setItem("ba_phone", normalized);
      },
      confirmSms: async (code) => {
        if (!confirmation) throw new Error("Request a code first");
        const cred = await confirmation.confirm(code);
        return afterSignIn(cred.user, window.sessionStorage.getItem("ba_phone") ?? undefined);
      },
      sendFallback: async (phone, channel) => {
        const normalized = normalizePhone(phone);
        const res = await fetch("/api/auth/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalized, channel }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not send code");
        window.sessionStorage.setItem("ba_phone", normalized);
      },
      confirmFallback: async (phone, code) => {
        const normalized = normalizePhone(phone);
        const res = await fetch("/api/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalized, code }),
        });
        const json = (await res.json()) as { customToken?: string; error?: string };
        if (!res.ok || !json.customToken) throw new Error(json.error || "Invalid code");
        const cred = await signInWithCustomToken(getFirebaseAuth(), json.customToken);
        return afterSignIn(cred.user, normalized);
      },
      signInGoogle: async () => {
        const cred = await signInWithPopup(getFirebaseAuth(), googleProvider);
        return afterSignIn(cred.user);
      },
      signInApple: async () => {
        const cred = await signInWithPopup(getFirebaseAuth(), appleProvider);
        return afterSignIn(cred.user);
      },
      signInEmail: async (email, password) => {
        const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
        return afterSignIn(cred.user);
      },
      signInWithLink: async (linkToken) => {
        const res = await fetch("/api/auth/link/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: linkToken }),
        });
        const json = (await res.json().catch(() => ({}))) as { customToken?: string; error?: string };
        if (!res.ok || !json.customToken) {
          const err = new Error(json.error || "invalid") as Error & { code?: string };
          err.code = `link/${json.error || "invalid"}`;
          throw err;
        }
        const cred = await signInWithCustomToken(getFirebaseAuth(), json.customToken);
        // The admin chose this exact account; never hop to another legacy match.
        return afterSignIn(cred.user, undefined, { skipLegacyLink: true });
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      },
      sendLinkSms: async (phone) => {
        const current = getFirebaseAuth().currentUser;
        if (!current) throw new Error("Sign in first");
        const normalized = normalizePhone(phone);
        try {
          confirmation = await linkWithPhoneNumber(current, normalized, ensureVerifier());
        } catch (err) {
          verifier?.clear();
          verifier = null;
          throw err;
        }
        window.sessionStorage.setItem("ba_phone", normalized);
      },
      confirmLinkSms: async (code) => {
        const current = getFirebaseAuth().currentUser;
        if (!current) throw new Error("Sign in first");
        if (!confirmation) throw new Error("Request a code first");
        const phone = window.sessionStorage.getItem("ba_phone") ?? "";
        try {
          await confirmation.confirm(code);
        } catch (err) {
          const codeOf = (err as { code?: string })?.code;
          const cred =
            codeOf === "auth/account-exists-with-different-credential" || codeOf === "auth/credential-already-in-use"
              ? PhoneAuthProvider.credentialFromError(err as FirebaseError)
              : null;
          if (!cred) throw err;
          // The number is already a Firebase account. The code was correct, so
          // leave the Google / Apple / email account and continue as the owner.
          setStoredSessionId(null);
          const signed = await signInWithCredential(getFirebaseAuth(), cred);
          const result = await afterSignIn(signed.user, phone);
          return { ...result, switched: true };
        }
        // The phone is now on the Auth user; record it on the profile unless
        // another (legacy) student profile already owns that number.
        const res = await fetch("/api/auth/ensure-profile", {
          method: "POST",
          headers: await bearer(current),
          body: JSON.stringify({ phone }),
        });
        const json = (await res.json().catch(() => ({}))) as { phoneConflict?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error || "Could not save phone");
        if (json.phoneConflict) {
          // A legacy profile owns the number: move to it and give the number back.
          const link = await fetch("/api/auth/legacy-link", {
            method: "POST",
            headers: await bearer(current),
            body: JSON.stringify({ phone }),
          });
          const linked = (await link.json().catch(() => ({}))) as { customToken?: string | null };
          if (linked.customToken) {
            await unlink(current, PhoneAuthProvider.PROVIDER_ID).catch(() => undefined);
            setStoredSessionId(null);
            const signed = await signInWithCustomToken(getFirebaseAuth(), linked.customToken);
            const profile = await loadProfile(signed.user.uid);
            return { needsOnboarding: computeNeedsOnboarding(profile), switched: true };
          }
          const conflict = new Error("phone-conflict") as Error & { code: string };
          conflict.code = "profile/phone-conflict";
          throw conflict;
        }
        const profile = await loadProfile(current.uid);
        return { needsOnboarding: computeNeedsOnboarding(profile), switched: false };
      },
      refreshProfile: async () => {
        if (user) await loadProfile(user.uid);
      },
      logout: async () => {
        setStoredSessionId(null);
        await signOut(getFirebaseAuth());
        setKicked(false);
      },
    }),
    [user, profile, ready, kicked, afterSignIn, loadProfile],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {user && conflict ? (
        <SessionConflictDialog
          sessions={conflict}
          busy={takingOver}
          onTakeOver={takeOverSession}
          onSignOut={() => void value.logout()}
        />
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
