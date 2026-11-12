# Release verification plan — pending

Run on a clean installation and an upgrade from the last App Store Connect build; record device, OS version, build number, date and result. Do not submit until failures are resolved.

1. **Startup and onboarding:** both languages, notification permission accepted/denied, skip reminders, force close/reopen; verify target and profile persist. Test inaccessible local storage/retry where feasible.
2. **Water and history:** add, undo and remove entries on current and past days; confirm totals, date, goal history, streak, trend and challenge progress; cross waking time and midnight with optional schedule on/off.
3. **Small breaks and challenges:** check and uncheck, start each challenge, verify four distinct days within seven, restart after end and persist after relaunch. No points for excess water.
4. **Notifications:** confirm requested schedule matches delivered water reminders, including weekly and overnight windows; change interval/language, deny and restore OS permission; verify medicine and habit notices, actions and capacity error without loss of the old plan. Exercise interruption during replacement and legacy migration.
5. **Push:** signed physical device with APNs and Firebase configured. Confirm announcements default off, opt in, delivery foreground/background, topic subscription, opt out and token cleanup, offline retry. Local reminders remain independent.
6. **Premium and ads:** App Store sandbox monthly/annual products, price and introductory offer eligibility, purchase, cancel, restore, expiry, offline launch and offering errors. Verify entitlement and absence of ads for subscribers; test ad consent/error/withdrawal by region and privacy options.
7. **Widget/live activity:** add while app closed, around wake and midnight, repeated taps concurrent with app sync; verify no loss or duplication, correct history and entitlement, goal updates, restore/expiry.
8. **Accessibility and presentation:** Turkish/English, light/dark, largest supported text sizes, VoiceOver labels and touch targets, reduced motion, small screens, no clipping or unreachable controls.
9. **Release:** reconcile ASC version/build numbers and signed archive; verify bundle ID, app groups, push entitlement, widget, Firebase auto-init, legal URLs, screenshots and metadata. Test installable release archive. Publish corrected policy and complete truthful Apple response before any review submission.
