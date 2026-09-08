# Make It Count

A private, mobile-first daily accountability app built with React Native and Expo for iOS and Android.

## Included in this first version

- Onboarding for planning, evening review, and optional diary reminder times
- Daily and next-day planning
- Personal motivation statement
- Separate Do and Don't goals
- Achieved, not achieved, and pending goal states
- Optional explanation when a goal is not achieved
- A different encouragement after every completed goal
- Seven-day achieved-versus-missed chart
- Private daily diary with an optional notification
- Local-only storage with no account
- Native local notifications on iOS and Android

## Run it on an iPhone

1. Install Expo Go from the iOS App Store.
2. Install project packages with `npm install`.
3. Start the development server with `npx expo start`.
4. Scan the displayed QR code using the iPhone Camera app.

The phone and computer should be on the same network. Local notifications should be tested on a physical device.

## Checks

- `node tests/diary.cjs` — legacy diary compatibility and entry persistence
- `npx tsc --noEmit`
- `npx expo export --platform ios --platform android --output-dir dist`

Both iOS and Android bundles were successfully generated for this version.

## Updated daily flows

- Reminder times start with sensible defaults. Tap a time and select hours/minutes without typing, then tap Done.
- Diary drafts save automatically. Done adds a timestamped entry and closes the editor; tap a saved entry to expand it, then Done to collapse it. Older diary text remains available with its date (its original time was not recorded).
- Not today opens an optional reflection. Done closes the field and keyboard and shows supportive encouragement. Tap the reflection to revisit it.
- A brighter violet, peach, and gold palette and a daily completion bar highlight progress.

### Device smoke checks

1. Complete onboarding with Today and Tomorrow separately and confirm the selected planning day.
2. Keep default reminder times, then change hours/minutes in Settings. Verify notifications on a physical iOS/Android device, including denied permission and diary reminders disabled.
3. Save two diary entries, expand/collapse each, switch tabs, and restart. Confirm entries and timestamps persist and an unfinished draft remains available.
4. Mark a goal Not today, enter a reason, and tap Done. Repeat with an empty reason, then mark it Achieved. Confirm the appropriate popup and weekly totals each time.
5. Check the time selector and diary editor with the keyboard open, large text, and a small phone screen.
