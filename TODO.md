# TODO

## Favorites screen
- [ ] Switch the grid from 3 columns to 2 columns.
- [ ] Match the title styling used on the Category screen (same title text/placement style, and possibly inherit the same badges).
- [ ] Add filter options to the Favorites screen.

## Ads
- [ ] Startup ad popup: Arabic text is missing the number of hours — needs to be filled in / interpolated correctly.
- [ ] Startup ad popup should load after category fetching and/or the home screen has finished loading, not before.
- [ ] Reward-ad ad-free cooldown: change from 3h to 2h.

## Settings screen
- [ ] Ko-fi button UI needs a redesign — should look like the button style used in the README, not the current gradient pill.

## Auth
- [ ] After signing out of Google, the app should allow signing in with a different Google account without requiring a full app restart. Currently the sign-in state only resets after closing and reopening the app.
- [ ] Sign in with phone does not work and throws a "something went wrong" error.

## Genres / filters
- [x] Pressing any genre currently crashes the app. — **Fixed**: `CategoryScreen.tsx` was calling a nonexistent `setSelectedGenre(...)` (leftover from before multi-genre support); state is actually the plural `selectedGenres` array. Changed to `setSelectedGenres(incomingGenre ? [incomingGenre] : [])`.
- [ ] Rework the genres and filter system — consider moving genre/filter parsing and fetching to the backend instead of doing it on the frontend.

## Content Sync / Push Notifications
- [x] Every new push to the backend with new content should trigger a content update fetch in the frontend, so that general notifications and content on the app stay in sync, while keeping everything else intact (e.g., the 24h cache). — **Implemented**:
  - Added `syncContentFromPush(data)` in `fcmService.ts`. On `type: "content_update"` it force-refreshes just that one category via `loadCategory(cat, true)`; on `type: "general_update"` (new titles / counts, no category info in the payload) it force-refreshes all `SYNC_CATEGORIES`. Either way this reuses the existing forced-refresh path, so the on-disk cache + timestamp update exactly like a pull-to-refresh — the 24h TTL logic itself is untouched, just reset early.
  - Wired into all three FCM entry points: the foreground handler, the notification-tap handler (background/quit), and the background message handler in `index.js`.
  - Found and fixed a related bug while in there: `setupForegroundHandler` was imported in `App.tsx` but never actually called, so foreground pushes were previously doing nothing at all. Now wired up (with proper unsubscribe on unmount).
  - Known limitation: this refreshes the cache, but a screen that's already open won't auto-re-render with the new data until it's revisited — no global state/event bus exists yet to push updates into a mounted HomeScreen/CategoryScreen. Worth a follow-up if you want live in-place updates too.

## In-App Updates (Full APK/AAB)
- [ ] Implement full APK in-app update mechanism for Android, same current github source and checker mechanism (react-native-simple-updater or rn-apk-update or react-native-update-in-app)(what is the best?).
- [ ] Add download progress UI (show percentage and download speed).
- [ ] Handle Android 10+ (Scoped Storage) and Android 12+ (PendingIntent mutability) requirements for APK installation.
- [ ] Add fallback logic: if in-app download fails, use the current implementation as a backup.
- [ ] iOS stays the same (current implementation).
