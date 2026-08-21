# Android TV / Fire OS Port — Audit of DeepSeek Recommendations

Reviewed against the submitted implementation guide (conditional GMS handling,
same-origin iframe assumption, WebView throttling fix, Vega OS caveat) and
current, verified information on Amazon's Fire TV platform direction.

---

## Part 1 — Conditional Google Play Services detection: **accurate**

`react-native-device-info`'s `isGooglePlayServicesAvailable()` is a real,
correct API, and gating `@react-native-firebase/messaging` and Google
Sign-In behind it is the right approach. Fire OS genuinely ships without
Play Services, and calling those APIs unconditionally will crash with
`GooglePlayServicesNotAvailableException`. The claim that email/password
auth doesn't need GMS is also correct.

**Verdict:** implementable as written, no changes needed.

---

## Caveat 1 — Same-origin iframe assumption: **accurate**

The VideoExtractor's fetch/XHR override and `contentDocument` click
simulation only work if the player iframe shares origin with the movie
page. Cross-origin iframes throw `SecurityError`. Since extraction already
works on mobile WebView under the same constraint, the "no code change
required" conclusion is reasonable — this isn't a TV-specific risk.

**Verdict:** accurate, no changes needed.

---

## Caveat 2 — WebView throttling fix: **technically sound, verify on hardware**

Moving from `opacity: 0` to genuinely off-screen positioning (`top: -9999`,
1×1 dimensions) is a real, documented workaround for WebView JS-timer
throttling on Android TV/Fire OS.

**One gap:** some OEM battery-management layers throttle *any* WebView not
in the visible view hierarchy, regardless of opacity vs. position. Test the
`setInterval` click simulation and m3u8 URL interception on real Fire Stick
hardware (not just an emulator) before shipping — the fix is correct in
principle but device-specific battery/background-process policies can still
interfere.

**Verdict:** correct fix, add hardware validation before considering it closed.

---

## Caveat 3 — Vega OS: **correct, but understates the current scope**

The original document frames Vega OS as limited to one device (the Fire TV
Stick 4K Select). That's now out of date. Amazon's own developer
documentation confirms all future Fire TV Sticks — not just the 4K Select —
will run Vega OS, and this year's Fire TV Stick HD already does. Vega is a
locked-down Linux platform that doesn't support sideloading, which is why
the Downloader app and third-party APKs don't work on Vega devices at all.

**Practical implication for this app:**
- It isn't "exclude the 4K Select" — it's "every *new* Fire TV Stick a
  customer buys from now on can't sideload this app at all."
- The addressable Fire OS audience is existing-device owners only, and it
  will shrink over time as people replace old sticks.
- The existing Android-based lineup (4K Plus, 4K Max, Cube) isn't
  disappearing soon — Amazon has committed to security updates for these
  through at least 2030 — so there's still a real window, just a narrowing
  one.

**Recommended change to the doc's language:** replace "Not compatible with
new Vega OS devices (e.g. Fire TV Stick 4K Select)" with something like
"Supports existing Android-based Fire OS devices; not compatible with
newer Fire TV Stick models running Vega OS," since the list of excluded
devices will keep growing and naming just one model will go stale fast.

**Verdict:** directionally correct, needs updated framing and messaging.

---

## Gap not covered by the document: D-pad / remote navigation

None of the four sections address focus-based navigation. Android TV and
Fire OS have no touchscreen — every interactive element (movie cards,
buttons, the settings screen) needs explicit remote-control focus handling
(`hasTVPreferredFocus`, `nextFocusUp/Down/Left/Right`, or a focus-engine
library), or the app is literally unusable with a remote.

This is typically the largest single workstream in a touch-to-TV port —
larger than the WebView fix and GMS gating combined — and it's absent from
both the implementation guide and the deployment checklist.

**Recommendation:** treat this as its own workstream, scoped separately
from the caveats above, before considering the port audit-approved.

---

## Bottom line

| Section | Status |
|---|---|
| Part 1 — GMS detection | Ready to implement as-is |
| Caveat 1 — Same-origin iframe | Accurate, no action needed |
| Caveat 2 — WebView throttling | Correct fix; validate on real hardware |
| Caveat 3 — Vega OS | Correct but scope understated; update messaging |
| **Missing** — Remote/D-pad navigation | Not covered; add as a required workstream |

Sources checked: Amazon Fire TV developer documentation (as reported by
AFTVnews, Ars Technica, PCWorld, Pocket-lint, Thurrott — all July 2026).
