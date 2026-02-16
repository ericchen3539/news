/**
 * RSS fetcher - fetches from multiple sources, merges and deduplicates.
 */

import Parser from "rss-parser";

export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  sourceLabel: string;
  /** RSS feed URL, for cache storage */
  sourceUrl?: string;
  /** Unix timestamp (ms), for cache storage and date filtering */
  pubDate?: number;
}

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "NewsDigest/1.0" },
});

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function similarity(a: string, b: string): number {
  const sa = a.toLowerCase().trim();
  const sb = b.toLowerCase().trim();
  if (sa === sb) return 1;
  if (sa.includes(sb) || sb.includes(sa)) return 0.9;
  const wordsA = new Set(sa.split(/\s+/));
  const wordsB = new Set(sb.split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  return (2 * intersection) / (wordsA.size + wordsB.size);
}

export interface FetchOptions {
  /** Only include items published within this many hours before now. 0 = no filter. */
  fetchWindowHours?: number;
}

/** Check if URL is Google News search RSS (supports after/before in q param). */
function isGoogleNewsSearchRss(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return (
      (u.hostname === "news.google.com" || u.hostname.endsWith(".news.google.com")) &&
      u.pathname.includes("/rss/search")
    );
  } catch {
    return false;
  }
}

/** Check if URL is Google News topics RSS (may support after/before query params). */
function isGoogleNewsTopicsRss(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return (
      (u.hostname === "news.google.com" || u.hostname.endsWith(".news.google.com")) &&
      u.pathname.includes("/rss/topics/")
    );
  } catch {
    return false;
  }
}

/** Generate day-sharded URLs for search RSS when fetch_window_hours >= 48. */
function getSearchRssShardedUrls(
  baseUrl: string,
  fetchWindowHours: number
): string[] {
  const urls: string[] = [];
  const u = new URL(baseUrl);
  const q = u.searchParams.get("q")?.trim() ?? "";
  const now = Date.now();
  const windowMs = fetchWindowHours * 3600 * 1000;
  const startMs = now - windowMs;

  const startDate = new Date(startMs);
  const endDate = new Date(now);

  const toYMD = (d: Date) => d.toISOString().slice(0, 10);

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (current <= end) {
    const after = toYMD(current);
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    const before = toYMD(next);

    const datePart = `after:${after} before:${before}`;
    const newQ = q ? `${q} ${datePart}` : datePart;
    u.searchParams.set("q", newQ);
    urls.push(u.toString());
    current = next;
  }

  return urls;
}

/** Generate day-sharded URLs for topics RSS (experimental; Topics may ignore params). */
function getTopicsShardedUrls(
  baseUrl: string,
  fetchWindowHours: number
): string[] {
  const urls: string[] = [];
  const u = new URL(baseUrl);
  const now = Date.now();
  const windowMs = fetchWindowHours * 3600 * 1000;
  const startMs = now - windowMs;

  const startDate = new Date(startMs);
  const endDate = new Date(now);
  const toYMD = (d: Date) => d.toISOString().slice(0, 10);

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (current <= end) {
    const after = toYMD(current);
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    const before = toYMD(next);

    u.searchParams.set("after", after);
    u.searchParams.set("before", before);
    urls.push(u.toString());
    current = next;
  }

  return urls;
}

function parseFeedItemsToNews(
  items: { title?: string; contentSnippet?: string; content?: string; summary?: string; link?: string; guid?: string }[],
  label: string,
  sourceUrl: string
): NewsItem[] {
  return (items ?? []).map((item) => {
    const iso = (item as { isoDate?: string }).isoDate;
    const pubMs = iso && !isNaN(new Date(iso).getTime()) ? new Date(iso).getTime() : Date.now();
    return {
      title: item.title ?? "",
      summary: item.contentSnippet ?? item.content ?? item.summary ?? "",
      link: item.link ?? item.guid ?? "",
      sourceLabel: label,
      sourceUrl,
      pubDate: pubMs,
    };
  });
}

export async function fetchFromSource(
  sourceUrl: string,
  label: string,
  options?: FetchOptions
): Promise<NewsItem[]> {
  const fetchWindowHours = options?.fetchWindowHours ?? 0;
  const cutoffMs =
    fetchWindowHours > 0 ? Date.now() - fetchWindowHours * 3600 * 1000 : 0;

  const shouldShardSearch =
    isGoogleNewsSearchRss(sourceUrl) && fetchWindowHours >= 48;
  const shouldShardTopics =
    isGoogleNewsTopicsRss(sourceUrl) && fetchWindowHours >= 48;
  const urlsToFetch = shouldShardSearch
    ? getSearchRssShardedUrls(sourceUrl, fetchWindowHours)
    : shouldShardTopics
      ? getTopicsShardedUrls(sourceUrl, fetchWindowHours)
      : [sourceUrl];

  const allItems: NewsItem[] = [];
  for (const url of urlsToFetch) {
    try {
      const feed = await parser.parseURL(url);
      const parsed = parseFeedItemsToNews(feed.items ?? [], label, sourceUrl);
      for (const item of parsed) {
        if (cutoffMs > 0 && item.pubDate !== undefined && item.pubDate < cutoffMs) continue;
        allItems.push(item);
      }
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err);
    }
  }
  return allItems;
}

export async function fetchAndMerge(
  sources: { source_url: string; label: string }[],
  options?: FetchOptions
): Promise<NewsItem[]> {
  const all: NewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const { source_url, label } of sources) {
    const items = await fetchFromSource(source_url, label, options);
    for (const item of items) {
      if (!item.link) continue;
      const norm = normalizeUrl(item.link);
      if (seenUrls.has(norm)) continue;
      const dup = all.find(
        (e) =>
          e.link &&
          (normalizeUrl(e.link) === norm || similarity(e.title, item.title) > 0.85)
      );
      if (dup) continue;
      seenUrls.add(norm);
      all.push(item);
    }
  }

  return all;
}
