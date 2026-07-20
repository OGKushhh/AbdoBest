// ─────────────────────────────────────────────────────────────────────────────
// Content exclusion list — developer-maintained, code-level.
//
// Add a content item's `id` here to hide it everywhere in the app (Home,
// Category, Search, Favorites) on the next build. This is NOT a user-facing
// setting — it's a static list shipped with the app, for permanently pulling
// a specific title (bad scrape, wrong metadata, takedown request, etc.)
// without waiting on the scraper pipeline or a backend change.
//
// IDs are whatever the item's `id` field is on ContentItem (see src/types) —
// the same value used for dedup in the Akwam scraper pipeline.
// ─────────────────────────────────────────────────────────────────────────────
export const EXCLUDED_CONTENT_IDS: string[] = [
  // 'example-id-123',
];
