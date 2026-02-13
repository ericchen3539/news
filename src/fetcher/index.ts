/**
 * RSS fetcher - fetches from multiple sources, merges and deduplicates.
 */

import Parser from "rss-parser";

export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  sourceLabel: string;
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

export async function fetchFromSource(
  sourceUrl: string,
  label: string
): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(sourceUrl);
    return (feed.items ?? []).map((item) => ({
      title: item.title ?? "",
      summary: item.contentSnippet ?? item.content ?? item.summary ?? "",
      link: item.link ?? item.guid ?? "",
      sourceLabel: label,
    }));
  } catch (err) {
    console.error(`Failed to fetch ${sourceUrl}:`, err);
    return [];
  }
}

export async function fetchAndMerge(sources: { source_url: string; label: string }[]): Promise<NewsItem[]> {
  const all: NewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const { source_url, label } of sources) {
    const items = await fetchFromSource(source_url, label);
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
