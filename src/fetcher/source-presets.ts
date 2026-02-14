/**
 * Predefined RSS feed URLs for popular sources (e.g. Google News by category).
 * When user adds "news.google.com" + label "U.S.", we use the preset URL directly.
 */

const US_PARAMS = "hl=en-US&gl=US&ceid=US:en";

export const GOOGLE_NEWS_PRESETS: Record<string, string> = {
  Home: `https://news.google.com/rss?${US_PARAMS}`,
  "For you": `https://news.google.com/rss?${US_PARAMS}`,
  "U.S.": `https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNRGxqTjNjd0VnSmxiaWdBUAE?${US_PARAMS}`,
  World: `https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?${US_PARAMS}`,
  Local: `https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNRGxqTjNjd0VnSmxiaWdBUAE?${US_PARAMS}`,
  Business: `https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?${US_PARAMS}`,
  Technology: `https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pIUWlnQVAB?${US_PARAMS}`,
  Entertainment: `https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB?${US_PARAMS}`,
  Sports: `https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB?${US_PARAMS}`,
  Science: `https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB?${US_PARAMS}`,
  Health: `https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ?${US_PARAMS}`,
};

const LABEL_ALIASES: Record<string, string> = {
  us: "U.S.",
  "u.s.": "U.S.",
  "u.s": "U.S.",
  world: "World",
  home: "Home",
  business: "Business",
  tech: "Technology",
  technology: "Technology",
  entertainment: "Entertainment",
  sports: "Sports",
  science: "Science",
  health: "Health",
  local: "Local",
  "for you": "For you",
};

function normalizeLabel(label: string): string {
  const trimmed = label.trim();
  return LABEL_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

function isGoogleNewsDomain(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname === "news.google.com" || u.hostname.endsWith(".news.google.com");
  } catch {
    return url.toLowerCase().includes("news.google.com");
  }
}

/**
 * If user adds news.google.com with a known category label, return the preset RSS URL.
 */
export function getGoogleNewsPresetUrl(userUrl: string, userLabel: string): string | null {
  if (!isGoogleNewsDomain(userUrl)) return null;
  const label = normalizeLabel(userLabel || "Home");
  return GOOGLE_NEWS_PRESETS[label] ?? null;
}

export function getGoogleNewsPresetsList(): { id: string; label: string }[] {
  return Object.keys(GOOGLE_NEWS_PRESETS).map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
  }));
}
