/**
 * Preset filter categories. User selects by id, system expands to keywords.
 */

export const FILTER_PRESETS: Record<string, { label: string; keywords: string[] }> = {
  politics: {
    label: "政治",
    keywords: [
      "politics",
      "politician",
      "election",
      "government",
      "congress",
      "senate",
      "president",
      "vote",
      "voting",
      "legislation",
      "policy",
      "diplomacy",
      "war",
      "military",
      "trump",
      "biden",
      "democrat",
      "republican",
      "white house",
      "capital",
      "parliament",
      "minister",
      "political",
      "政治",
      "选举",
      "政府",
      "国会",
      "总统",
      "议会",
      "外交",
      "军事",
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

/**
 * Phrases/domains that cause false keyword matches when they appear in text.
 * Stripped before category matching (e.g., "Military.com" contains "military", "总统日" contains "总统").
 */
const TEXT_FALSE_POSITIVES = [
  "military.com",
  "military.org",
  "military.net",
  "presidents' day",
  "presidents day",
  "总统日",
];

export function stripSourceFalsePositives(text: string): string {
  let result = text.toLowerCase();
  for (const fp of TEXT_FALSE_POSITIVES) {
    result = result.replace(new RegExp(fp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  return result;
}

/** Keywords indicating commercial/promotional, product liability, or entertainment news. Items matching these are excluded even if they match category keywords. */
export const COMMERCIAL_KEYWORDS = [
  "促销",
  "优惠",
  "折扣",
  "deal",
  "deals",
  "sale",
  "sales",
  "广告",
  "promotion",
  "promo",
  "discount",
  "save",
  "savings",
  "bargain",
  "coupon",
  "特惠",
  "降价",
  "打折",
  "talc",
  "滑石粉",
  "baby powder",
  "爽身粉",
  "product liability",
  "强生",
  "box office",
  "票房",
  "movie",
  "电影",
];

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
