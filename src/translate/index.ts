/**
 * Translation service - translates title and summary to Chinese.
 */

import { translate } from "@vitalets/google-translate-api";

const DELAY_MS = 200;
const MAX_RETRIES = 2;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateWithRetry(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return "";
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const result = await translate(text, { from: "auto", to: "zh-CN" });
      return result.text ?? text;
    } catch (err) {
      if (i === MAX_RETRIES) {
        console.warn("Translation failed for:", text.slice(0, 50), err);
        return text;
      }
      await sleep(500 * (i + 1));
    }
  }
  return text;
}

export async function translateToChinese(text: string): Promise<string> {
  const result = await translateWithRetry(text);
  await sleep(DELAY_MS);
  return result;
}

export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  sourceLabel: string;
}

export interface TranslatedItem {
  title: string;
  titleZh: string;
  summaryZh: string;
  link: string;
  sourceLabel: string;
}

export async function translateBatch(items: NewsItem[]): Promise<TranslatedItem[]> {
  const results: TranslatedItem[] = [];
  for (const item of items) {
    const [titleZh, summaryZh] = await Promise.all([
      translateWithRetry(item.title),
      translateWithRetry(item.summary || item.title),
    ]);
    await sleep(DELAY_MS);
    results.push({
      title: item.title,
      titleZh,
      summaryZh,
      link: item.link,
      sourceLabel: item.sourceLabel,
    });
  }
  return results;
}
