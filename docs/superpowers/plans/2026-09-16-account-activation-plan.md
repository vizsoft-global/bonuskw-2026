# Account activation — implementation plan

Spec: `docs/superpowers/specs/2026-09-16-account-activation-design.md`
App: `bonuskw-2026`; the backfill script lands in `bonuskw-admin`.

Phases ship in order, each independently deployable. Phase 1 is inert on its own
because every existing account is grandfathered.

## Phase 1 — model, gate, grandfathering

**Data**
- `src/lib/types/firestore.ts`: add to `UserDoc`:
  ```ts
  verification?: {
    emailVerifiedAt?: Timestamp | Date;
    phoneVerifiedAt?: Timestamp | Date;
    activatedAt?: Timestamp | Date;
    grandfathered?: boolean;
  };
  birthDate?: Timestamp | Date;
  ```
  (`firstName` / `lastName` already exist.)

**Logic — new `src/lib/auth/activation.ts`**
- `isStaff(profile)` — role not `Student`.
- `isDevTester(profile, config)` — `devTester` profile flag + dev mode on.
- `isActivated(user, profile, opts)` — true when any of: `verification.activatedAt`
  set, `verification.grandfathered`, staff, dev tester.
- `missingSteps(user, profile)` — returns `("names" | "email" | "phone")[]` from
  `firstName`/`lastName`/`birthDate`, `user.emailVerified`, `user.phoneNumber`.

**Provider**
- `auth-provider.tsx`: expose `needsActivation` next to `needsOnboarding`, computed
  the same way (from the profile snapshot + the Firebase user), and refresh it after
  each activation step. Keep `needsOnboarding` untouched.

**Routing**
- `components/layout/require-auth.tsx`: redirect to `/activate` when
  `needsActivation && !allowActivation`, ordered after the onboarding check so the
  academic step still comes first.
- `src/app/activate/page.tsx`: shell that renders the missing steps in order
  (names/DOB → email → phone). Phase 1 ships it with the names step only; the other
  two render as "coming next" placeholders so no account can dead-end.

**Backfill — `bonuskw-admin/scripts/backfill-account-verification.mjs`**
- Same shape as `backfill-course-stats.mjs`: dry run by default, `--apply` to write.
- For every user: set `verification.activatedAt = now`,
  `verification.grandfathered = true`, and `verification.emailVerifiedAt` where
  Firebase Auth already reports `emailVerified`; `phoneVerifiedAt` where the Auth
  record has a `phoneNumber`.
- Batched writes (400/batch), skips docs already stamped, prints a summary.

**Acceptance**
- `tsc --noEmit`, `eslint`, `next build` clean.
- Backfill dry run lists ~4,000 accounts; apply stamps them; re-run reports 0 to
  change.
- An existing student signs in and is not asked to activate.
- A brand-new phone sign-up lands on `/activate`.


## Phase 2 — names + birth date

- Step 1 of `/activate`: first name, last name, birth date (required; date picker,
  sensible age bounds — no future dates, no age under ~10).
- Save to `users/{uid}` (`firstName`, `lastName`, `birthDate`) with
  `serverTimestamp`-free plain values, then re-check `missingSteps` and advance.
- Prefill from the Google/Apple display name where available (`display_name`), so
  most students only confirm.
- Acceptance: a fresh account cannot reach any authed route before this is saved;
  an existing account never sees the step.

## Phase 3 — phone step (Google / Apple / email accounts)

- Step for accounts with no verified phone: country-code + number input reusing the
  login screen's validation.
- `linkWithPhoneNumber(user, phone, verifier)` → reuse `/verify`'s `OtpInput` screen
  for the 6-digit code → `confirm(code)`.
- On success: write `phoneNumber` and `verification.phoneVerifiedAt`.
- Handle: `auth/credential-already-in-use` (phase 5's sign-in-instead screen),
  `auth/provider-already-linked` (already done), expired code, resend cooldown.
- Acceptance: a Google sign-up reaches `/activate`, links a phone, and lands on `/`
  with `phoneVerifiedAt` set on the profile.

## Phase 4 — email step (phone accounts)

- Step for accounts with `emailVerified === false`: email input →
  `updateEmail(user, email)` → `sendEmailVerification(user)`.
- "Check your inbox" screen: **Resend** (with a cooldown) and **I've verified**
  which calls `user.reload()` and re-reads `emailVerified`; the screen also polls
  every ~5s while open.
- On success: write `email` and `verification.emailVerifiedAt`.
- Handle: `auth/email-already-in-use` (phase 5), `auth/invalid-email`,
  `auth/requires-recent-login` (re-run the phone step then resume), and the case
  where the student never opens the email (they can return later; the gate holds).
- Acceptance: a phone sign-up adds and verifies an email, and both flags end up set
  with `activatedAt` stamped.

## Phase 5 — identifier already in use

- New server route `src/app/api/activate/check-identifier/route.ts` (admin SDK):
  body `{ kind: "email" | "phone", value }` → `{ state: "free" | "mine" | "taken" }`
  using `getUserByEmail` / `getUserByPhoneNumber`, treating the caller's own uid as
  `mine`.
- Called before sending anything; `taken` shows "This email/phone is already on
  another account" with **Sign in with that account**, reusing the `switched: true`
  pattern from the phone login path.
- Map the SDK race errors (`auth/email-already-in-use`,
  `auth/credential-already-in-use`) to the same screen.
- Acceptance: using an email that belongs to a second test account offers sign-in,
  never claims it, and the second account still works afterwards.

## Phase 6 — admin visibility (later)

- People list: a "Verified" column from `verification.activatedAt`, filter for
  unverified, and a "Re-send verification" action (calls an admin route that mints
  a verification link / requests a new SMS on the student's behalf).
- Not required for the student flow to work; ships separately.

## Rollback

- Phase 1's gate is data-driven: clearing `verification.activatedAt` and
  `grandfathered` re-gates an account, and the backfill can be reversed by
  deleting the `verification` object. No schema change, no rules change.
- Phases 3 and 4 can be disabled by leaving their steps out of
  `missingSteps()`, which drops every account back to the names step only.
