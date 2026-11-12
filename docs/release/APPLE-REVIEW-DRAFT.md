# Hydromate: resubmission package (4.3 / 4.2.6)

**Strategy:** Apple's message says "do not resubmit without substantial changes". We made one: the app is now built around *work schedules* (desk jobs, day/night/rotating shifts) instead of being a general water tracker. Medication and habit features were removed from the UI. Resubmit a NEW build, change the metadata below, and paste the reply into "Reply to App Review" on the same submission (and into App Review Information > Notes).

Replace the `[ ]` placeholders before sending. Do not add claims you can't back up.

---

## 1. App Store metadata (ASC > App Information / version page)

- **Name:** Hydromate: Shift Water Tracker
- **Subtitle (30 chars):** Water for night & day shifts
- **Keywords:** shift work,night shift,nurse,rotating shift,office,desk,hydration,water reminder,sleep schedule
- **Category:** Health & Fitness (secondary: Productivity)
- **Description (first lines matter most):**

> Most water apps assume you wake at 7 and sleep at 11. If you work nights, rotating shifts or long desk days, their day resets at midnight and their reminders ring while you sleep.
>
> Hydromate follows your work schedule instead:
> • Choose how you work: office/desk, day shift, night shift or rotating shifts
> • Your water day starts when you wake and ends when you sleep, even if that's 08:00 after a night shift
> • Weekly shift plan: mark each day as day shift, night shift or day off; reminders and goals follow it automatically
> • No reminders during your sleep window
> • Pace card: shows how much you should have had by now in *this* shift
> • History by shift: compare night shifts with day shifts and days off
> • Short desk breaks for office days
> • No account needed; your data stays on your device
>
> Hydromate is not a medical device and does not give medical advice.

- **Screenshots (redo all):** 1) the "How do you work?" onboarding step, 2) the weekly shift plan in Profile, 3) the home screen with "Night shift · 15:00–08:00", 4) history by shift, 5) the reminder schedule. The first screenshot must show the shift angle; Apple looks at it first.

---

## 2. Reply to App Review (English, paste as-is after filling the placeholders)

Hello App Review Team,

Thank you for the feedback. We agreed the previous build looked too much like a general water tracker, so we made substantial changes and are submitting a new build ([version/build]).

1. **What the app does.** Hydromate is a water tracker built for people whose day doesn't run midnight to midnight: shift workers and long-hours desk workers. At setup the user chooses office/desk, day shift, night shift or rotating shifts and sets their wake and sleep times. The "water day", the goal pace and the reminders follow that schedule. For example, a nurse working 20:00–08:00 has a water day that starts at 15:00 and ends at 08:00 the next morning, with no reminders while they sleep. Rotating-shift workers set a weekly plan (day/night/off per weekday), and the app switches the window automatically each day.

2. **Intended users.** Adults working night or rotating shifts (healthcare, security, manufacturing, logistics, call centers) and office workers who forget to drink during long desk sessions.

3. **The gap it fills.** Typical water apps reset the day at midnight and schedule reminders by clock hours. For a night-shift worker, that splits one working "day" into two, resets progress mid-shift, and sends reminders during daytime sleep. Hydromate ties the day boundary, the pace calculation and the reminder window to the user's shift, including back-to-back shifts and rotating weekly plans. History can also be compared by shift type.

4. **Beta testing.** [N] testers used the app on TestFlight. Their feedback led to: [specific item, e.g. "home screen simplified"], [specific item, e.g. "onboarding shortened"]. [Add shift-related feedback only if a tester actually gave it.]

5. **Standalone or suite.** Standalone. The only other app on my account is PATH Block Puzzle, a puzzle game, unrelated in purpose and code.

6. **Could it be an in-app feature of another app?** No. My other app is a puzzle game; a shift-based hydration utility does not belong in it.

7. **Shared code/assets with my other apps.** None. Hydromate does not share code, assets or frameworks with PATH Block Puzzle beyond standard third-party frameworks.

8. **Third-party codebase or content library.** No. I wrote the app myself using standard open-source frameworks (React Native/Expo, Firebase for notifications, RevenueCat for subscriptions, Google Mobile Ads). No template, app generator or content library was used.

9. **Client or third party.** No. It is my own idea, designed and published by me under my own developer account.

Thank you for your time.

Faruk Emre Öz

---

## 3. Before you submit, check these

- [ ] Build number is higher than the last one uploaded to ASC (app.json `buildNumber` is currently 3)
- [ ] Old screenshots and description are fully replaced (the old "general water tracker" text must not remain)
- [ ] Premium page only lists real perks: widgets + no ads (meds/habits removed)
- [ ] Onboarding → "Night shift" → home shows "Night · 15:00–08:00" (test on device)
- [ ] Profile > Shift plan → change a weekday → reminders update
- [ ] Privacy policy is live and mentions Firebase
