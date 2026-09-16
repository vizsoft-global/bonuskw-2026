# Account activation after registration — design

Date: 2026-09-16
App: `bonuskw-2026` (student web app). One backfill script lives in `bonuskw-admin`.

## Goal

Every **student** account must end up with one verified email **and** one verified
phone. Whichever of the two it is missing when the account is created is collected
during a short activation flow, and the student cannot use the app until it is
done. Staff, dev testers and every account that exists today are exempt.

## Decisions (agreed with the product owner)

| Question | Decision |
|---|---|
| Email verification | Firebase's own verification email (a link, not a code). No mail provider, no DNS work. |
| Phone verification | Firebase Phone Auth only. The existing gateway/WhatsApp OTP is not used here. |
| Profile photo | Deferred. Not part of the activation flow for now. |
| Existing accounts | Grandfathered with a backfill; only accounts created after the cutover activate. |
| Identifier already on another account | Never auto-merged. Offer to sign in to the owning account instead. |

## Where we start from

- `/login` has two modes: **phone** (primary; signs in or creates) and
  **email + password** ("accounts made in the previous app"), plus Google and
  Apple buttons. Paths that end in a new account today: phone, Google, Apple.
- Onboarding is one step — country / university / field — gated by
  `needsOnboarding` (`computeNeedsOnboarding` → `needsAcademic`) and enforced by
  `components/layout/require-auth.tsx`, which redirects to `/onboarding`.
- Phone OTP infrastructure exists (`lib/server/otp.ts`, `otpRequests`, `/verify`)
  and `linkWithPhoneNumber` is already wired in `auth-provider` (line ~411).
- **Nothing** email-verification related exists: no `sendEmailVerification`, no
  `updateEmail`, no `applyActionCode`, no `oobCode` handling.
- `users` carries `firstName`, `lastName`, `photo_url`, `email`, `phoneNumber`
  and a legacy `emailVerifed` (sic) flag.

## Data model

On `users/{uid}`, one nested object and two mirrors:

```ts
verification?: {
  emailVerifiedAt?: Timestamp;   // set when Firebase reports the email verified
  phoneVerifiedAt?: Timestamp;   // set when the phone credential is confirmed
  activatedAt?: Timestamp;       // set once both are done — this is the gate
  grandfathered?: boolean;       // set by the backfill for pre-cutover accounts
};
```

`email` and `phoneNumber` stay mirrored on the profile because search, admin
lists and notifications already read them. The legacy `emailVerifed` field is left
alone and not read.

**Gate condition** (`isActivated(profile)`): `verification.activatedAt` is set, or
`verification.grandfathered === true`, or the role is not `Student`, or the account
is a dev tester in dev mode.

## The activation flow

One route, `/activate`, stepping through whatever is missing. Order matters: the
cheap local step first, then the network one.

1. **Names + birth date** (new field `birthDate`; `firstName`/`lastName` already
   exist). Saved on continue. No photo.
2. **The missing identifier.** The step is chosen by what the account actually
   lacks, not by how it was created — an email+password account, for example, has
   an email Firebase has *not* verified, so it needs both steps:
   - `user.emailVerified === false` (phone sign-ups, email+password accounts) →
     the **email step**: ask for the email → `updateEmail(user, email)` →
     `sendEmailVerification(user)` → a "check your inbox" screen with **Resend**
     and **I've verified** (which calls `user.reload()` and re-checks). On success
     write `email` and `verification.emailVerifiedAt`.
   - No verified phone on the account (`user.phoneNumber` empty — Google, Apple and
     email accounts) → the **phone step**: ask for the number →
     `linkWithPhoneNumber(user, phone, verifier)` → the existing 6-digit code
     screen → `confirmation.confirm(code)`. On success write `phoneNumber` and
     `verification.phoneVerifiedAt`.
     `linkWithPhoneNumber` (not `signInWithPhoneNumber`) is essential here: the
     latter would replace the session with the phone's account.
   - Both missing → email first, then phone.
3. When both are present, stamp `verification.activatedAt` and continue to `/`.

The existing `/verify` screen and its `OtpInput` are reused for the code entry in
step 2. `require-auth` keeps the student on `/activate` until `isActivated`.

## The email link, precisely

Firebase's default action handler verifies the `oobCode` server-side, so the
account becomes verified whether or not the student is signed in on the device
they opened the link on. The app only has to observe it: `user.reload()`, then
re-read `emailVerified`. The "I've verified" button does exactly that, and the
screen polls every few seconds while it is open, so a link opened on another
device is still picked up.

Optional later polish (not in this change): set a custom Action URL in the Firebase
console pointing at our own page so the student lands back in the app instead of
Firebase's generic confirmation page. The flow works without it.

`updateEmail` requires a recent sign-in. Activation happens immediately after
sign-in, so that is satisfied; if the SDK still refuses with
`auth/requires-recent-login`, we send the student through the phone step again and
resume.

## When the email or phone is already on another account

Ownership is proven by the verification itself, so the rule is: verify, then offer
to switch — never merge, never move an identifier.

- **Email**: before sending anything, the client calls a small server route
  (`/api/activate/check-identifier`, admin SDK) which answers "free", "mine" or
  "someone else's" for an email or phone. If it belongs to another account, the
  screen says so and offers **Sign in with that account**; the student cannot claim
  it. The check runs again server-side when the value is written, and
  `updateEmail`'s `auth/email-already-in-use` is handled as a race that lands on
  the same screen.
- **Phone**: the same pre-check, plus `linkWithPhoneNumber` failing with
  `auth/credential-already-in-use` mapped to the same screen.
- Switching accounts reuses the existing pattern from the phone login path
  (`{ switched: true }` in `auth-provider`), so the student ends up signed in to the
  account that owns the identifier instead of hitting a dead end.
- A super-admin merge tool for genuinely duplicated people is **out of scope**; it
  would need its own change.

## Grandfathering the existing accounts

A one-off script in `bonuskw-admin` (`scripts/backfill-account-verification.mjs`,
same shape as `backfill-course-stats.mjs`: dry run by default, `--apply` to write)
stamps `verification.activatedAt` **and** `verification.grandfathered = true`, plus
`verification.emailVerifiedAt` where Firebase already reports the email verified, on
every user that exists at cutover. Nobody is locked out on deploy day, nothing
changes for the ~4,000 current accounts, and the gate stays data-driven, so a
specific account can be forced to activate later by clearing the field.

## Out of scope for this change

- Profile photo / study-themed avatars (deferred by the product owner).
- The gateway OTP (WhatsApp/SMS) for activation — Firebase Phone Auth only.
- Auto-merging two accounts that belong to one person.
- Admin screens for verification status (a later phase: see who is verified, and
  re-send on a student's behalf).

## Rollout order

1. Data model + `isActivated` + the backfill script + the gate in `require-auth`,
   with the flow routes stubbed so nothing can dead-end before the steps exist.
2. Names + birth date step.
3. Phone step for Google / Apple / email accounts (`linkWithPhoneNumber`).
4. Email step for phone accounts (`updateEmail` + `sendEmailVerification`).
5. Identifier pre-check route + the "sign in instead" screens.
6. Admin visibility — the last item in "Out of scope" above, on its own later
   phase.

Steps 1–2 are safe to ship alone: existing users are grandfathered, and a new
account is only held at the names step until 3 and 4 land.

## Verification plan

- Unit-ish: the `isActivated` truth table (student vs staff vs grandfathered vs dev
  tester), and the identifier pre-check answers for free / mine / someone else's.
- Manual, on staging with throwaway accounts: each of the three creation paths
  (phone, Google, email) end to end, including a resend, a link opened on a second
  device, and both collisions.
- Post-deploy: confirm a grandfathered student is not asked to activate, and that a
  brand-new phone sign-up lands on `/activate`.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, then the live `/api/version`
  check after deploy, as with the previous changes.

## Risks

- **Firebase email quota**: verification emails are rate-limited per project per
  day. Only new accounts are asked, so volume tracks registrations, not the
  existing user base.
- **SMS reliability in Kuwait** was why the phone step was removed from onboarding
  before. Only *new* accounts see it now, and it is the only way to verify a phone
  with Firebase, so we accept it — but if delivery proves bad again, the fallback is
  the gateway's WhatsApp channel, which would be its own change.
- **Link-based verification is asynchronous**: a student may not open the email
  straight away. The screen has to be patient (resend, poll, and allow coming back
  later) and the gate must not imply the account is broken.

