/**
 * posterUrl.ts
 *
 * The two scraper pipelines' poster URLs come pre-baked at a small thumbnail
 * size. Only one of the two underlying CDNs actually has more real detail
 * sitting behind that thumbnail — confirmed by hand for both:
 *
 *   - static.faselhdcdn.com — the "-WxH" in each image's own filename IS
 *     that image's true source resolution — it varies per title, not a
 *     fixed platform-wide size. Requesting a bigger size via the query
 *     string (?resize=W%2CH) doesn't return more detail — it's the same
 *     pixels from that image's own native size scaled up server-side,
 *     which means a bigger download for a *softer* result than just using
 *     the URL as-is. So: leave FaselHD URLs completely untouched, whatever
 *     size happens to be in that particular filename.
 *
 *   - img.downet.net (Akwam) — genuinely has more resolution behind the
 *     small thumbnail. Confirmed via local comparison: 1500×2250 shows real
 *     extra detail over both 780×1170 and the original 178×260 thumbnail.
 *     Size lives in the path: /thumb/178x260/uploads/xyz.jpg
 *                          →  /thumb/1500x2250/uploads/xyz.jpg
 *
 * Anything that doesn't match a known pattern is returned completely
 * unchanged — this must never guess at a transform for an unrecognized
 * source, since a wrong guess can silently break the image entirely.
 */

const DOWNET_THUMB_PATH = /\/thumb\/\d+x\d+\//;

/** Akwam's confirmed real ceiling — genuinely sharper than 780×1170, not just a bigger declared size. */
const DOWNET_LARGE_WIDTH = 1500;
const DOWNET_LARGE_HEIGHT = 2250;

/**
 * Returns a larger version of a poster URL where the source CDN actually
 * has more real detail to give (currently: Akwam only). FaselHD URLs pass
 * through unchanged, since its thumbnail size already IS its true
 * resolution. Anything unrecognized also passes through unchanged.
 */
export const getLargePosterUrl = (url: string | undefined | null): string => {
  if (!url) return url ?? '';

  if (url.includes('downet.net')) {
    if (DOWNET_THUMB_PATH.test(url)) {
      return url.replace(DOWNET_THUMB_PATH, `/thumb/${DOWNET_LARGE_WIDTH}x${DOWNET_LARGE_HEIGHT}/`);
    }
    return url;
  }

  // faselhdcdn.com and anything else: no real gain available, or unknown
  // source — return unchanged rather than request a fake-bigger image.
  return url;
};
