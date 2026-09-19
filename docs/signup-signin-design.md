# Bonus Academy — how signup and sign-in are designed

Student app: `app.bonuskw.com` (repo `bonuskw-2026`). Admin panel: `admin.bonuskw.com` (repo `bonus-admin`).
Everything below is the behaviour of the code as it stands today.

## 1. There is no signup step, and therefore no password

There is no `/register` route. An account is created the first time someone proves they own a
phone number or an email address:

- phone (default) → OTP code → a server-minted Firebase **custom token** signs them in
- email → email + password on an existing account, or Google / Apple

So a brand-new student never sets a password. That is deliberate, not a missing screen: the phone
number is the credential, and it is what they can recover without an email inbox. A password
exists only for accounts that deliberately use email sign-in, and it is created through Firebase's
own reset/invite flows rather than a signup form.

## 2. One entry point

`/login` has two modes, phone and email. The screen decides what happens next from the identity,
not from a "sign up / sign in" choice:

1. **Phone** — the number is sent to the OTP gateway.
2. **Email** — existing account → password; new or forgotten → the reset link; Google/Apple → popup.
3. After any successful sign-in the app asks the server to complete the profile, then checks whether
   a verified phone is attached. No phone yet → `/verify`.

## 3. Phone OTP flow

| Step | Endpoint | Notes |
|---|---|---|
| Send | `POST /api/auth/otp/send` | channel `whatsapp` or `sms` (WhatsApp first, SMS as fallback) |
| Verify | `POST /api/auth/otp/verify` | gateway verifies, then the server returns a **custom token** |
| Sign in | client `signInWithCustomToken` | Firebase session begins here |
| Profile | `POST /api/auth/ensure-profile` | creates/completes `users/{uid}` |

Guardrails on the code itself: 5 minute TTL, 30 second cooldown per number, 5 sends per hour per IP,
maximum 5 attempts per code, codes stored hashed, and comparison done in constant time.

## 4. Email and social sign-in

Email/password and Google/Apple sign in through the Firebase client SDK, then the same
`ensure-profile` call. `ensure-profile` records a phone number **only** when Firebase's own ID token
vouches for it, and only when no other student already owns that number — the request body is a hint
that must match the token, never a source of truth. Google/Apple accounts without a phone land on
`/verify` to attach one.

## 5. Verify step (`/verify`)

A signed-in account with no verified phone. The number is verified by the same OTP gateway, then the
profile is updated. This is the screen that appears "randomly" when a session is disturbed and the
profile is reloaded without a phone attached — the flow itself is not random, it is driven by
`needsPhone`.

## 6. Legacy accounts: two ways an old profile is adopted

Old Flutter app accounts already exist in `users` with their orders, subscriptions and progress.
Nothing is migrated in bulk; the profile is linked when the owner proves the identity:

- **Legacy link** — `POST /api/auth/legacy-link`. The signed-in user's *verified* phone (or verified
  email) is matched to the legacy row, and a custom token is minted for it, so the old history is
  adopted. Identity comes from the ID token only: trusting a typed number would let anyone claim
  any account.
- **Sign-in link** — staff mint a single-use link from People in the admin panel (`signInLinks`,
  stored hashed, 48h TTL) for students whose carrier blocks SMS. `POST /api/auth/link/exchange`
  redeems it. This never works for staff accounts.

## 7. The session model (one live session, never expiring)

Firebase's own session never expires by design — there is no TTL here.

On every app start the client calls `POST /api/session/start` with a device id:

1. If another device holds a **live** session (heartbeat inside 15 minutes), the server answers 409
   with that session, and the app shows the take-over prompt: keep the other device, or continue here.
2. Choosing "continue here" passes `force`, the other session closes as a **take-over**, and the old
   device shows `/session-ended`.
3. A session with no heartbeat for 15 minutes no longer blocks anyone and closes as **stale**.
4. Reloading, a new tab or a PWA relaunch on the *same* device reuses its session instead of
   replacing it. Same device means the stored device id, or the same model + browser + IP — the
   second check exists because a cleared browser (iOS ITP, private mode) hands out a new id.
5. Heartbeat every 5 minutes; sign-out goes through `POST /api/session/kick`.

`devicePolicy` (devices in 30 days, cities in 24 hours) **no longer exists**: it never forced
anything, because nothing read the flags it wrote. The only rule is one live session.

Every session end records `endedBy` (`self`, `self-other`, `takeover`, `stale`, `duplicate`),
`endedFrom` and a plain-language `endedReason`, on the `sessions` row and mirrored into
`activityLog` — the collection the user profile's Activity tab actually reads.

## 8. Admin panel sign-in (staff)

Separate from students: staff sign in with email/password, or by phone at `/phone-login` with
verification at `/phone-verification`, and `phone-session.ts` keeps the staff phone session. Access
after sign-in is RBAC — `roles`, `permissions`, and middleware guarding `/admin/*` and
`/instructor/*`. Staff accounts are never self-service; they are created in the panel, and
`signInLinks` are refused for them.

## 9. Open decisions

1. **No password for new accounts** — intended (section 1). If students should also have a password
   for email sign-in, that is a new feature: a password step plus linking onto the OTP-created account.
2. **`/verify` appearing at odd times** — it is triggered by a missing verified phone on the profile,
   so reproduce it together with the profile read that reports `needsPhone`.
3. **Session history on the profile** — the profile now reads `sessions.userref` and
   `userdeviceinfo.device_user_ref`; rows written earlier with `userRef` will not appear.
