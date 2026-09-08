# Momentum Daily

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

- `npx tsc --noEmit`
- `npx expo export --platform ios --platform android --output-dir dist`

Both iOS and Android bundles were successfully generated for this version.
