# Bonus Academy — Student Sign-in & Sign-up Guide

_For the academy team. Describes how students get into `app.bonuskw.com`, what is required, what is optional, and what to do when a student is stuck. Last updated 11 Sep 2026._

---

## 1. The one rule to remember

**A student's account is identified by a verified phone number OR a verified email — either one is enough.**
The app never asks for a phone number after sign-in. Nothing in the app (courses, payments, EMI) needs a phone to work.

---

## 2. Sign-in methods on the login screen

| Button | Who it is for | What proves identity |
|---|---|---|
| **Mobile number → Continue** | Anyone (default) | One-time code sent by SMS (Firebase) |
| **Google** | Anyone with a Gmail / Google Workspace account | Google confirms the email |
| **Apple** | iPhone/Mac users | Apple confirms the email (may be a hidden relay address) |
| **Continue with email** | Old-app students who registered with **email + password** | Password. There is no email sign-up for new students; "Forgot password" sends a reset email |

Plus a link at the bottom: **"Sign out of this device"** — frees a slot when the device limit is hit (see §6).

---

## 3. What happens after a successful sign-in (automatic, no user action)

1. **Legacy account match.** The app looks for an existing student profile that owns the same identity:
   - phone sign-in → profile with the same mobile number (all old spellings: `+965…`, `965…`, `9…`, `0…`);
   - Google / Apple / verified email → profile with the same email address.
   If found, the student is switched into **that** account, with all their courses, orders and installments.
2. **Profile creation.** If nothing matches, a new student profile is created from what the provider gave us (name, email, photo).
3. **Onboarding (once).** If the profile has no academic details, the student picks **Country → University → Field** (or grade, for school students). This is the **only required step**.
4. Home.

---

## 4. Scenarios

### A. Brand-new student
- **Phone:** enter number → SMS code → academic details → home. Account created with the phone.
- **Google / Apple:** one tap → academic details → home. Account created with the email. **No phone is asked.**
- **Email + password:** not available for new students (there is no sign-up form). Use phone or Google/Apple.

### B. Existing student from the old (Flutter) app
Old accounts have a phone number, and almost all (99.9 %) also have an email.

| They use… | Result |
|---|---|
| Their **registered phone** | Lands in their old account |
| **Google/Apple** with their **registered email** | Lands in their old account (new since 11 Sep) |
| **Email + password** they set in the old app | Lands in their old account |
| A **different** phone or email | A **new, empty** account is created — see Plan C in §5 to fix |

### C. Student changed phone number
Sign in with Google/Apple using the registered email → they land in the old account. Or the academy sends a sign-in link (§5, Plan B).

### D. Student's email is different / they don't remember which
Academy checks the profile in the admin (People → Students → search by name or phone) and either tells them the email on file or sends a sign-in link.

---

## 5. When the SMS does not arrive (very common with Kuwaiti carriers)

Kuwaiti operators block a large share of verification SMS. The student sees "Something went wrong" or no code arrives. Work through the plans in order.

### Plan A — Sign in with Google / Apple instead (student does it alone)
Tell the student: *"Tap **Google** and choose the email you registered with the academy."*
If that email is on their profile they land in their existing account. Works for ~99 % of old students. Nothing is created twice.

### Plan B — Academy sends a sign-in link (30 seconds, no SMS)
1. Admin panel → **People → Students** → open the student.
2. Top-right **⋯ menu → Sign-in link → Create link → Copy**.
3. Send the link to the student on WhatsApp / any channel.
4. Student taps it → signed in immediately, no code.

Rules: one link works **once**, expires in **48 hours**, only works for student accounts, and only staff with *Edit students* permission can create it. Never post it publicly; it signs in whoever opens it.

### Plan C — Student already created a duplicate empty account
Happens when they used a different email/phone than the one on file.
1. Ask them to sign out (**Not you? Sign out** on onboarding, or Profile → Sign out).
2. Send a **sign-in link** for the **correct** (old) account (Plan B).
3. Optionally, in the admin, update the old profile's email to the one they now use so Google works next time. (Ask the tech team to delete the empty duplicate.)

### Plan D — Fixed test code (emergency, tech team only)
Firebase Console → Authentication → Sign-in method → Phone → *Phone numbers for testing*: add the number with a fixed 6-digit code, tell it to the student, remove after use. Max 10 numbers at a time.

### "Contact support on WhatsApp" button
When the SMS fails on the login screen, or on the "Enter code" screen, the app shows **Resend code** and **Contact support on WhatsApp**. The support button opens WhatsApp to **+965 9991 4714** with a prefilled message that includes the number they tried, so the team can go straight to Plan A or B.

---

## 6. Other things students hit

| Message / symptom | Meaning | Fix |
|---|---|---|
| **"Something went wrong (auth/…)"** on the phone screen | Firebase refused to send the SMS to this number. The code in brackets tells the tech team why | Plan A or B |
| **"Too many attempts"** | Firebase rate-limited this number/device | Wait a few hours, or Plan A / B |
| **"reCAPTCHA has already been rendered"** | Old bug, fixed 11 Sep | Reload the page once |
| **"Already signed in on another device"** dialog | Only one device can be signed in at a time | Choose **Continue on this device** (signs the other one out), or **Keep the other device, sign out here**. On the login screen, **Sign out of this device** clears a stuck session |
| **"This account is deleted"** | Profile was archived in the admin | Admin → Student → **Restore account** |
| **Still sees "Add your mobile number"** | Very old page cached in the browser | Close the tab and open the app again |
| **Sees old / finished courses** | Enrolments from ended batches are cleaned nightly; visible courses depend on university | Nothing to do; buying requires a running batch |

---

## 7. Required vs optional — summary

| Item | Required? | Notes |
|---|---|---|
| Phone **or** verified email | **Yes (one of them)** | Provided by the sign-in method itself |
| Country / University / Field | **Yes** | One-time onboarding |
| Phone number on profile | No | Useful for EMI reminders; old accounts already have it |
| Email on profile | No | Enables Google sign-in later |
| Name / photo | No | Pulled from Google/Apple when available; editable in Profile |
| Password | No | Only for old email+password accounts |

---

## 8. Quick script for support staff

> "Are you an existing student? → Try **Google** with your registered email.
> Not working or new? → Try your **mobile number**.
> No SMS? → Give me your name/number, I'll send you a **sign-in link** — tap it and you're in."
