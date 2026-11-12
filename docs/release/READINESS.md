# Hydromate review remediation — active, not release-ready

Authoritative source: /Users/farukemreoz/Projects/sumolasi2-review, branch release/review-remediation, based on main 4ba304b. The scratch repo was based on older 65c5053. Do not ship scratch or overwrite canonical native/config/mascot updates.

Product direction confirmed by owner: a daily helper for remembering water and small breaks on busy days; general audience. Shift schedule remains optional. Owner's personal difficulty remembering water inspired the app; began building before App Store research. Three TestFlight testers led to UI/UX changes. The owner confirmed that tester feedback led to changes to the home UI and onboarding flow and requested that the policy name only Faruk Emre Öz. Owner confirmed no purchased app template, app generation service or other app source was used and the app was not developed for a client or partner; non-standard third-party content libraries still need review. Never invent beta evidence.

Completed this pass:
- Imported new feature sources onto latest canonical release worktree using three-way integration.
- Kept canonical Firebase services, native configuration 1.0.1(3), release assets and top-level Profile Row fix.
- Resolved locale merge conflicts without reintroducing duplicate reminder keys.
- Fixed HabitEditSheet undefined addHabit action; added visible save error.
- Integrated habits entitlement effects into canonical App.js.
- Source syntax parsed; no device/build claim.

Remaining release gates:
1. Shared notification planner: serialized mutations; dedupe weekly slots into daily when applicable; respect total iOS budget including water/meds/habits; no silent interval sampling; recover partial failures. Existing water 60 + habits 5 + meds exceeds device capacity.
2. Hydration/widget water-day reconciliation: widget calendar date can cause before-wake entries to be discarded. Preserve IDs, original timestamps and historical totals. Day transitions, schedule edits, migration and history trends need real regression coverage.
3. Language change must preserve weekly plan and update habit notification text. Notification taps must route to correct screen; stale medication responses must not mark today's dose.
4. Premium: intro eligibility, entitlement independent of offerings fetch; cached entitlement/retry/listener cleanup. Verify actual offerings, products, restore/purchase/expiry with StoreKit/RevenueCat.
5. Push: inspect canonical services (scratch audit is not authoritative); separate broadcast opt-in from local reminders, migration/unsubscribe and policy updates.
6. Ads: consent errors must not authorize ads; expose privacy options when required.
7. Profile: always accessible policy, terms, support, restore/manage subscriptions. Inspect canonical theme before changing: it already uses Appearance.setColorScheme (scratch-only theme finding may be false).
8. Remove 150%-goal and arbitrary ten-log incentives; make goal an adjustable starting target. Refine challenges into intentional sustainable experiences, not superficial counters.
9. Product coherence: water + small breaks, concise home, actual useful progress/entry correction. Check touch targets, large text, contrast, reduced motion, both locales and empty/error/loading states.
10. Update privacy policy (currently says local-only notifications, omits Firebase), terms and App Store metadata/screenshots/review answers. External publishing requires concrete reviewed content; owner has not authorized sending review reply yet.
11. Build/version reconciliation: EAS remote autoIncrement; canonical native plist/app.json 1.0.1(3), pbxproj stale settings. Obtain actual ASC latest build before choosing next number.
12. End-stage clean install and upgrade tests, real-device local/push notifications, widget, offline data, purchases; release archive/export validation. Then submit only when authorized, never claim Apple approval certainty.

Available tooling from audit: Xcode 27.2; iPhone simulators installed; paired Faruk iPhone 13. No new release archive produced. Existing Oct20 archive is old dev-signed 1.0.0(1).


Current work in progress (not yet validated):
- Added opt-in app announcements, shared notification capacity management, subscription eligibility handling, and privacy/support controls.
- Added daily break checklists and opt-in seven-day challenges; changed unsafe goal-exceeding incentives.
- Draft policy updated locally with Firebase disclosure and owner name. The live policy has not been updated.
- Startup and local data failure paths need end-to-end verification. Widget cross-process write races, notification recovery, purchase configuration and App Store metadata remain release gates.
- No new build, device test, or review submission has been completed.

- The iOS native directory is gitignored. A copy from canonical main is now present locally; confirm Firebase native auto-init in the resulting build and retain the custom native configuration in the chosen build workflow.

- Managed notification replacements now journal the previous plan and retry recovery on launch. Legacy notifications have no stored trigger inputs, so migration failure recovery still requires device verification and must not be described as guaranteed.

- Copied canonical ignored iOS project into this worktree without Pods, build outputs or machine-local Xcode settings. The native project contains a Firebase configuration build phase; actual generated Info.plist and signing still need build validation. Because ios is ignored, cloud builds may regenerate it; the native project and its custom widget/Firebase build phases must be reconciled with the chosen build workflow before release.

- Apple response draft created locally; it explicitly separates unsubmitted functionality and leaves unconfirmed provenance and beta specifics open. Nothing has been sent.

- Routine and custom-habit completion now request a water-day rollover before selecting the completion date. This must still be verified across wake-time and schedule changes on device.

- Startup retry now explicitly retries font loading as well as data hydration. Verify failure and recovery on device.

- Push registration waits briefly for APNs token availability; foreground retries remain in place. Verify opt-in, opt-out, token cleanup and delivery on a signed device.

- iOS Metro production export succeeded (2,602 modules); this validates bundling only, not native build or runtime behavior.

- Created a release verification plan covering upgrade and clean install, notification recovery, purchases and widget concurrency; no device tests are claimed yet.
- A focused history analytics check passed for completed-day average, target/empty counts and total. This is not a runtime, UI or device test. The current source also completed iOS Metro export after the subsequent goal changes, but further source edits require another export before release.
