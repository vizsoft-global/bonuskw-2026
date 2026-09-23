# Cutover notes

Do not switch `bonuskw.com` or tighten Firestore rules until the Flutter student app is retired. Current rules are open so the live app keeps working.

**Status 2026-09-23:** the Flutter app is retired, and the rules are hardened — writes now need ownership or a panel role, released to `bonus-academy` from `bonuskw-admin/firestore.rules` (the rules the project actually deploys from; `firestore.rules.cutover` in this repo was a partial draft and is not to be deployed).

Still to do:

1. Point `bonuskw.com` at the `bonuskw-2026` Vercel project.
2. Remove `settings.masterPassword` and rotate Tap keys that are embedded in the Flutter app.
3. Archive the Flutter web hosting target.
