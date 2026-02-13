/**
 * Filter engine: applies user filter rules (include/exclude by preset categories) to news items.
 */

import { expandCategories } from "./presets.js";

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

  return items.filter((item) => {
    const hasMatch = keywords.some((kw) => text(item).includes(kw.toLowerCase()));
    return mode === "include" ? hasMatch : !hasMatch;
  });
}
