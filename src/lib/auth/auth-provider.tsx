"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  RecaptchaVerifier,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import {
  appleProvider,
  getDb,
  getFirebaseAuth,
  googleProvider,
} from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { normalizePhone } from "@/lib/utils";
import { heartbeat, getStoredSessionId, startSession, setStoredSessionId } from "./session-client";
import type { UserDoc } from "@/lib/types/firestore";

type AuthState = {
  user: User | null;
  profile: (UserDoc & { id: string }) | null;
  ready: boolean;
  needsOnboarding: boolean;
  kicked: boolean;
  sendSms: (phone: string) => Promise<void>;
  confirmSms: (code: string) => Promise<void>;
  sendFallback: (phone: string, channel: "whatsapp" | "sms") => Promise<void>;
  confirmFallback: (phone: string, code: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInApple: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

function needsAcademic(profile: UserDoc | null) {
  return !profile?.countryRef || !profile.universityRef || !profile.branchRef;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<(UserDoc & { id: string }) | null>(null);
  const [ready, setReady] = useState(false);
  const [kicked, setKicked] = useState(false);

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
        else setProfile(null);
      });
    } catch {
      setReady(true);
      window.clearTimeout(failSafe);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      unsub();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    let stopSession: (() => void) | undefined;
    let beat: number | undefined;
    void (async () => {
      const token = await user.getIdToken();
      const sessionId = await startSession(token);
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
      stopSession?.();
      if (beat) window.clearInterval(beat);
    };
  }, [user]);

  const ensureVerifier = () => {
    if (verifier) return verifier;
    verifier = new RecaptchaVerifier(getFirebaseAuth(), "ba-recaptcha", {
      size: "invisible",
    });
    return verifier;
  };

  const afterSignIn = useCallback(async (signed: User, phone?: string) => {
    const token = await signed.getIdToken();
    if (phone) {
      const link = await fetch("/api/auth/legacy-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      });
      const json = (await link.json()) as { customToken?: string };
      if (json.customToken) {
        const linked = await signInWithCustomToken(getFirebaseAuth(), json.customToken);
        await loadProfile(linked.user.uid);
        return;
      }
    }
    await fetch("/api/auth/ensure-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone }),
    });
    await loadProfile(signed.uid);
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      ready,
      needsOnboarding: Boolean(user && profile && needsAcademic(profile)),
      kicked,
      sendSms: async (phone) => {
        const normalized = normalizePhone(phone);
        confirmation = await signInWithPhoneNumber(
          getFirebaseAuth(),
          normalized,
          ensureVerifier(),
        );
        window.sessionStorage.setItem("ba_phone", normalized);
      },
      confirmSms: async (code) => {
        if (!confirmation) throw new Error("Request a code first");
        const cred = await confirmation.confirm(code);
        await afterSignIn(cred.user, window.sessionStorage.getItem("ba_phone") ?? undefined);
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
        await afterSignIn(cred.user, normalized);
      },
      signInGoogle: async () => {
        const cred = await signInWithPopup(getFirebaseAuth(), googleProvider);
        await afterSignIn(cred.user);
      },
      signInApple: async () => {
        const cred = await signInWithPopup(getFirebaseAuth(), appleProvider);
        await afterSignIn(cred.user);
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
    [user, profile, ready, kicked, afterSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
