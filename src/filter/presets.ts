/**
 * Preset filter categories. User selects by id, system expands to keywords.
 */

export const FILTER_PRESETS: Record<string, { label: string; keywords: string[] }> = {
  politics: {
    label: "政治",
    keywords: [
      "politics",
      "election",
      "government",
      "congress",
      "senate",
      "president",
      "vote",
      "legislation",
      "policy",
      "diplomacy",
      "war",
      "military",
      "政治",
      "选举",
      "政府",
      "国会",
    ],
  },
  tech: {
    label: "科技",
    keywords: [
      "technology",
      "tech",
      "AI",
      "software",
      "startup",
      "科技",
      "人工智能",
      "互联网",
    ],
  },
  sports: {
    label: "体育",
    keywords: [
      "sports",
      "football",
      "basketball",
      "olympics",
      "体育",
      "足球",
      "篮球",
    ],
  },
  business: {
    label: "财经",
    keywords: [
      "business",
      "economy",
      "market",
      "stock",
      "财经",
      "经济",
      "股市",
    ],
  },
  entertainment: {
    label: "娱乐",
    keywords: [
      "entertainment",
      "celebrity",
      "movie",
      "娱乐",
      "明星",
      "电影",
    ],
  },
};

export function getFilterPresetsList(): { id: string; label: string }[] {
  return Object.entries(FILTER_PRESETS).map(([id, { label }]) => ({ id, label }));
}

export function expandCategories(categoryIds: string[]): string[] {
  const keywords = new Set<string>();
  for (const id of categoryIds) {
    const preset = FILTER_PRESETS[id];
    if (preset) {
      for (const kw of preset.keywords) keywords.add(kw);
    }
  }
  return [...keywords];
}
