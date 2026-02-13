/**
 * Unit tests for filter engine - include/exclude mode, keyword matching.
 */

import { describe, it, expect } from "vitest";
import { filterNews } from "./engine.js";

const makeItem = (title: string, summary = ""): { title: string; summary: string; link: string; sourceLabel: string } => ({
  title,
  summary,
  link: "https://example.com/1",
  sourceLabel: "Test",
});

describe("filterNews", () => {
  it("returns all items when categories is empty", () => {
    const items = [makeItem("Tech news"), makeItem("Sports news")];
    expect(filterNews(items, "include", [])).toEqual(items);
    expect(filterNews(items, "exclude", [])).toEqual(items);
  });

  it("include mode: keeps only items matching category keywords", () => {
    const items = [
      makeItem("New AI technology breakthrough"),
      makeItem("Football match results"),
      makeItem("Software startup funding"),
    ];
    const result = filterNews(items, "include", ["tech"]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.title)).toContain("New AI technology breakthrough");
    expect(result.map((r) => r.title)).toContain("Software startup funding");
    expect(result.map((r) => r.title)).not.toContain("Football match results");
  });

  it("include mode: matches keywords in summary", () => {
    const items = [makeItem("Random title", "This article discusses economy and market trends")];
    const result = filterNews(items, "include", ["business"]);
    expect(result).toHaveLength(1);
  });

  it("exclude mode: removes items matching category keywords", () => {
    const items = [
      makeItem("New AI technology breakthrough"),
      makeItem("Football match results"),
    ];
    const result = filterNews(items, "exclude", ["tech"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Football match results");
  });

  it("exclude mode: keeps items not matching any keyword", () => {
    const items = [makeItem("Weather forecast today")];
    const result = filterNews(items, "exclude", ["tech", "sports", "politics"]);
    expect(result).toHaveLength(1);
  });

  it("include mode: multiple categories expand to union of keywords", () => {
    const items = [
      makeItem("Tech company news"),
      makeItem("Basketball game"),
    ];
    const result = filterNews(items, "include", ["tech", "sports"]);
    expect(result).toHaveLength(2);
  });

  it("handles unknown category ids gracefully", () => {
    const items = [makeItem("Some news")];
    // Unknown id yields no keywords -> expandCategories returns [] -> all items pass
    expect(filterNews(items, "include", ["unknown-id"])).toEqual(items);
    expect(filterNews(items, "exclude", ["unknown-id"])).toEqual(items);
  });
});
