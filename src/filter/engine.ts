/**
 * Filter engine: applies user filter rules (include/exclude by preset categories) to news items.
 * In include mode, items matching commercial keywords (ads, promotions) are excluded.
 * Source domain false positives (e.g., Military.com) are stripped before category matching.
 */

import { expandCategories, COMMERCIAL_KEYWORDS, WEAK_KEYWORDS, stripSourceFalsePositives } from "./presets.js";

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

  const rawText = (item: NewsItem) =>
    `${(item.title ?? "").toLowerCase()} ${(item.summary ?? "").toLowerCase()}`;

  const textForCategoryMatch = (item: NewsItem) =>
    stripSourceFalsePositives(rawText(item));

  const hasCommercialMatch = (item: NewsItem) =>
    COMMERCIAL_KEYWORDS.some((kw) => rawText(item).includes(kw.toLowerCase()));

  return items.filter((item) => {
    const text = textForCategoryMatch(item);
    const matchedKeywords = keywords.filter((kw) => text.includes(kw.toLowerCase()));
    const matchCount = matchedKeywords.length;
    const hasWeakOnly = matchedKeywords.length > 0 && matchedKeywords.every((kw) => WEAK_KEYWORDS.has(kw));
    const hasMatch =
      mode === "include"
        ? matchCount >= 1 && (!hasWeakOnly || matchCount >= 2)
        : matchCount > 0;
    if (mode === "include") {
      return hasMatch && !hasCommercialMatch(item);
    }
    return !hasMatch;
  });
}
