/**
 * Filter engine: applies user filter rules (include/exclude by preset categories) to news items.
 * In include mode, items matching commercial keywords (ads, promotions) are excluded.
 */

import { expandCategories, COMMERCIAL_KEYWORDS } from "./presets.js";

export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  sourceLabel: string;
}

export function filterNews(
  items: NewsItem[],
  mode: "include" | "exclude",
  categoryIds: string[]
): NewsItem[] {
  const keywords = expandCategories(categoryIds);
  if (keywords.length === 0) return items;

  const text = (item: NewsItem) =>
    `${(item.title ?? "").toLowerCase()} ${(item.summary ?? "").toLowerCase()}`;

  const hasCommercialMatch = (item: NewsItem) =>
    COMMERCIAL_KEYWORDS.some((kw) => text(item).includes(kw.toLowerCase()));

  return items.filter((item) => {
    const hasMatch = keywords.some((kw) => text(item).includes(kw.toLowerCase()));
    if (mode === "include") {
      return hasMatch && !hasCommercialMatch(item);
    }
    return !hasMatch;
  });
}
