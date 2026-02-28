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
      "dhs",
      "homeland security", // full name when "DHS" not in text
      "ice",
      "cbp",
      "fbi",
      "doj",
      "scandal",
      "investigation",
      "indictment",
      "protest",
      "demonstration",
      "政治",
      "选举",
      "政府",
      "国会",
      "总统",
      "议会",
      "外交",
      "军事",
      "丑闻",
      "调查",
      "起诉",
      "抗议",
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
  "god of war",
  "战神",
  "hardware", // "Hardware" contains "war"
  "software", // "software" contains "war"
  "stable", // "stable" contains "state"
  "military-grade", // tech context for encryption etc
  "android police", // tech site name, prevents "ice" matching inside
  // 地理/行政语境
  "state capital",
  "capital region",
  // 商业语境
  "venture capital",
  "capital investment",
  // 科技/合规语境
  "privacy policy",
  "cookie policy",
  "content policy",
  "security policy",
  "corporate policy",
  "company policy",
  "platform policy",
  "ad policy",
  "user policy",
  // 政府/安全语境（科技漏洞、浏览器警告）
  "政府向 chrome 用户发出",
  "政府向用户发出",
  "政府向用户发出警报",
  "印度政府警告",
  "政府敦促用户更新",
  "政府敦促更新",
  // political 误匹配
  "apolitical",
  // 白宫/政治人物出现在娱乐、健身、八卦语境（整句 strip 掉后不再匹配政治）
  "white house had a very manly week",
  "white house had a very manly",
  // ICE 在体育/娱乐语境（如 UFC "ICE joke"）非移民执法
  "ice joke",
  "ice jokes",
  // 天气/灾害时地方政府宣布（含“政府”，strip 后该语境不触发政治）
  "市政府宣布",
  // 犯罪/社会新闻中“警方调查”含“调查”，strip 后该语境不再触发政治
  "警方调查",
  // 电视剧/娱乐：剧名含 CIA/FBI，非政府机构
  "cia premiere",
  "fbi wedding",
  "fbi universe",
  "联邦调查局婚礼",
  "中央情报局首映",
  // “voice” 含 “vote” 会误触政治；综艺名 strip
  "the voice return",
  // FBI 在科技/消费语境（如路由器安全警告）strip 后不单独触发政治
  "fbi says these wi-fi routers",
  "fbi says these wi-fi",
  // 商业/并购稿中顺带提“政治成为焦点”，strip 后不以政治为主的不误入
  "政治成为焦点",
  // 文学/文化报道中“political vulture”多为媒体名或比喻，非政治议题
  "political vulture",
  "政治秃鹫",
  // 体育：投票/评选语境，非选举
  "fan vote",
  "mvp vote",
  // 商业/科技：市场调查含“调查”，strip 后不单独触发政治
  "市场调查",
  // 产品/游戏/技术演示含“demonstration”，非抗议/示威
  "product demonstration",
  "game demonstration",
  "技术演示",
  "产品演示",
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
  "hair extensions",
  "接发",
  "辫子",
  "chemicals",
  "化学物质",
  "游戏",
  "playstation",
  "ps5",
  "aurora",
  "northern lights",
  "极光",
  "北极光",
  // 政府管理资产运营（非政治）
  "national park",
  "reservation system",
  "国家公园",
  "预订系统",
];

/**
 * Explicit weak keywords: appear in many non-category contexts (e.g. "capital" in venture capital).
 * In include mode, if only weak keywords match, require matchCount >= 2 to reduce false positives.
 */
/** Single-mention in non-political context (company president, product demo, annual congress). Require 2+ politics matches when only weak. */
const EXPLICIT_WEAK_KEYWORDS = new Set([
  "capital",
  "government",
  "政府",
  "policy",
  "war",
  "market",
  "state",
  "minister",
  "经济",
  "investigation",
  "military",
  "white house",
  "president",
  "protest",
  "demonstration",
  "congress",
  "senate",
]);

/**
 * Keywords that appear in multiple presets (cross-category) can cause false politics matches.
 * E.g. a tech article with "government" gets included in politics. Auto-add these to weak list.
 */
function getCrossCategoryKeywords(): Set<string> {
  const keywordToPresets = new Map<string, Set<string>>();
  for (const [presetId, preset] of Object.entries(FILTER_PRESETS)) {
    for (const kw of preset.keywords) {
      const presets = keywordToPresets.get(kw) ?? new Set();
      presets.add(presetId);
      keywordToPresets.set(kw, presets);
    }
  }
  const crossCategory = new Set<string>();
  for (const [kw, presets] of keywordToPresets) {
    if (presets.size >= 2) crossCategory.add(kw);
  }
  return crossCategory;
}

/** Weak keywords = explicit + cross-category. Cross-category keywords auto-join when added to multiple presets. */
export const WEAK_KEYWORDS = new Set([
  ...EXPLICIT_WEAK_KEYWORDS,
  ...getCrossCategoryKeywords(),
]);

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
