# Cutover notes

Do not switch `bonuskw.com` or tighten Firestore rules until the Flutter student app is retired. Current rules are open so the live app keeps working.

When the React student app is the only client:

1. Point `bonuskw.com` at the `bonuskw-2026` Vercel project.
2. Deploy the hardened rules draft in `firestore.rules.cutover` from the student repo.
3. Remove `settings.masterPassword` and rotate Tap keys that are embedded in the Flutter app.
4. Archive the Flutter web hosting target.
