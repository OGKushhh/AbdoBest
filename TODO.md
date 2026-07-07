# TODO

## Favorites screen
- [ ] Switch the grid from 3 columns to 2 columns.
- [ ] Match the title styling used on the Category screen (same title text/placement style, and possibly inherit the same badges).
- [ ] Add filter options to the Favorites screen.

## Ads
- [x] Startup ad popup: Arabic text is missing the number of hours. — **Fixed**: `RewardAdPopup.tsx` called `t('reward_body', { hours: '' })`, which made i18next substitute `{{hours}}` with an empty string *before* the code tried to `.split('{{hours}}')` on the result — the placeholder was already gone, so the highlighted hours text never got inserted (this was silently broken in English too, just not visible since the fallback happened to still show the sentence minus the number in a less obvious way). Fixed by calling `t('reward_body')` with no options, so i18next leaves `{{hours}}` untouched for the manual split to find. Also fixed a separate bug where the English template had a duplicate "hours hours" (the `reward_hours` string already contains the word "hours").
- [x] Startup ad popup should load after category fetching and/or the home screen has finished loading. — **Fixed**: `App.tsx` was firing the popup on a blind `setTimeout(1500)` running in parallel with the category sync, with no relation to whether it had actually finished. Changed to chain the popup onto `startSync(false).then(...)`, so it only appears once the initial category fetch genuinely completes.
- [x] Reward-ad ad-free cooldown: change from 3h to 2h. — **Fixed**: `AD_FREE_DURATION_MS` in `adManager.ts` changed to 2h. Also updated the `reward_hours` i18n string (was hardcoded to "3 hours" / "3 ساعات", now "2 hours" / "ساعتين" — using the correct Arabic dual grammatical form). Left a comment noting this value isn't auto-derived from the constant, so it needs a manual update if the duration changes again.

## Settings screen
- [x] Ko-fi button UI needs a redesign — should look like the button style used in the README, not the current gradient pill. — **Fixed**: replaced the full-width gradient card (`LinearGradient`, heart icon, big padding) with a small, flat, dark badge — matching the compact "Support me on Ko-fi" button style (`https://ko-fi.com/img/githubbutton_sm.svg`) used in the README, rather than the app's usual big CTA-button look.

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
- [x] Implement full APK in-app update mechanism for Android. — **Implemented, but not with any of the three named libraries.** `react-native-blob-util` was already a dependency in this project (used elsewhere for downloads), and it already provides everything needed: real byte-level download progress (`.progress()`) and an APK-install trigger (`.android.actionViewIntent()`) that handles the FileProvider/content-URI dance. That means **zero new native dependencies** — a meaningfully lower-risk choice than adding `rn-apk-update` (best of the three you listed — purpose-built for non-Play-Store APK updates, actively maintained — but still a new native module I can't build/test here) or the other two (`react-native-simple-updater` has ~0 weekly downloads/adoption; `sp-react-native-in-app-updates`-style Play Store wrappers don't apply since this app isn't Play Store–distributed anyway).
  - New `downloadAndInstallApk()` in `updateService.ts`: downloads the APK to the app's private cache dir (no storage permission needed) and hands it to the system installer.
  - `App.tsx` / `UpdateModal.tsx` wired to call it on Android; iOS is untouched (still opens the browser link, per the requirement below).
- [x] Add download progress UI (percentage and speed). — `UpdateModal.tsx` now shows a progress bar with live percentage and a rolling bytes/sec → KB/s or MB/s speed readout while downloading, replacing the download button during the download.
- [x] Handle Android 10+ (Scoped Storage) and Android 12+ (PendingIntent mutability) requirements. — Scoped Storage is sidestepped entirely by downloading to the app's own private cache dir instead of shared/external storage (no `WRITE_EXTERNAL_STORAGE` needed for this feature). Added `REQUEST_INSTALL_PACKAGES` permission, a `<queries>` entry for `application/vnd.android.package-archive` (without it, `actionViewIntent`'s internal activity-resolution check silently fails on Android 11+ — this is a documented library issue, not something obvious from the API), and an explicit `FileProvider` declaration + `provider_paths.xml` (react-native-blob-util normally supplies its own via manifest merging, but that has a documented history of silently not being picked up).
- [x] Add fallback logic: if in-app download fails, use the current implementation as a backup. — `App.tsx`'s `handleUpdateDownload` catches any failure from the in-app flow and falls back to `openUpdateUrl()` (the original browser-based download), same as before this feature existed.
- [x] iOS stays the same. — Untouched; `handleUpdateDownload` only attempts the in-app flow when `Platform.OS === 'android'`.
