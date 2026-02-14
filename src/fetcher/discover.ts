/**
 * RSS feed discovery from webpage URL.
 * Parses HTML for link rel="alternate" type="application/rss+xml" (or atom/feed+json),
 * falls back to common paths (/feed, /rss, etc.) if not found.
 */

import Parser from "rss-parser";

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = "NewsDigest/1.0";

const COMMON_FEED_PATHS = [
  "/feed",
  "/rss",
  "/atom.xml",
  "/feed.xml",
  "/index.xml",
  "/rss.xml",
  "/feeds/posts/default",
  "/?feed=rss2",
  "/?feed=atom",
];

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: { "User-Agent": USER_AGENT },
});

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function isLikelyRssUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("/feed") ||
    lower.includes("/rss") ||
    lower.endsWith(".rss") ||
    lower.endsWith(".xml") ||
    lower.includes("atom") ||
    lower.includes("feed+json")
  );
}

/**
 * Extract feed URLs from HTML link tags (rel="alternate" type="application/rss+xml" etc.).
 */
function extractFeedLinksFromHtml(html: string, baseUrl: string): string[] {
  const feeds: string[] = [];
  const feedTypes = ["application/rss+xml", "application/atom+xml", "application/feed+json"];

  const linkRegex = /<link\s+([^>]+)>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const attrs = match[1];
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const type = attrs.match(/type\s*=\s*["']([^"']+)["']/i)?.[1];
    const rel = attrs.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1];

    if (!href || !type) continue;
    const relLower = (rel ?? "").toLowerCase();
    const typeLower = type.toLowerCase();
    if (!relLower.includes("alternate")) continue;
    if (!feedTypes.some((t) => typeLower.includes(t))) continue;

    feeds.push(resolveUrl(baseUrl, href));
  }
  return feeds;
}

/**
 * Try to parse a URL as RSS/Atom; returns true if valid feed.
 */
async function isValidFeed(url: string): Promise<boolean> {
  try {
    await parser.parseURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Discover RSS feed URL from a webpage URL.
 * 1. Fetches HTML, parses link rel="alternate" type="application/rss+xml"
 * 2. Falls back to common paths (/feed, /rss, etc.)
 * 3. Validates candidates with rss-parser
 *
 * @param inputUrl - User-provided URL (website or RSS)
 * @returns Resolved feed URL, or null if not found
 */
export async function discoverRssFeed(inputUrl: string): Promise<string | null> {
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  let baseUrl: string;
  try {
    const u = new URL(trimmed);
    if (!u.protocol.startsWith("http")) {
      baseUrl = `https://${trimmed}`;
    } else {
      baseUrl = trimmed;
    }
  } catch {
    baseUrl = `https://${trimmed}`;
  }

  const candidates: string[] = [];

  if (isLikelyRssUrl(baseUrl)) {
    candidates.push(baseUrl);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(baseUrl, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const discovered = extractFeedLinksFromHtml(html, res.url);
      candidates.push(...discovered);
    }
  } catch (err) {
    console.warn("[Discover] Failed to fetch page:", err instanceof Error ? err.message : err);
  }

  const origin = new URL(baseUrl).origin;
  for (const path of COMMON_FEED_PATHS) {
    candidates.push(resolveUrl(origin, path));
  }

  const seen = new Set<string>();
  for (const url of candidates) {
    const normalized = url.replace(/#.*$/, "").replace(/\?$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    if (await isValidFeed(normalized)) {
      return normalized;
    }
  }

  return null;
}
