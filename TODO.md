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

## Genres / filters
- [ ] Pressing any genre currently crashes the app.
- [ ] Rework the genres and filter system — consider moving genre/filter parsing and fetching to the backend instead of doing it on the frontend.
