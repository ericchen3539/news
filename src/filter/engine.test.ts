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

  it("include mode: excludes items matching commercial keywords even when category matches", () => {
    const items = [
      makeItem("Apple 总统日促销: Apple Watch 仅需 299 美元"),
      makeItem("President Biden signs new legislation"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("President Biden signs new legislation");
  });

  it("include mode: excludes category match when keyword comes only from source domain", () => {
    const items = [
      makeItem("Rayman 30th Anniversary Edition Releases Tomorrow", "Game news from Military.com"),
      makeItem("Military operations in the region continue"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Military operations in the region continue");
  });

  it("include mode: excludes product liability news even when matching politics keywords", () => {
    const items = [
      makeItem("Pennsylvania jury finds Johnson & Johnson liable for cancer in talc trial", "Legislation and policy discussed. 强生滑石粉诉讼."),
      makeItem("Congress passes new legislation on immigration"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Congress passes new legislation on immigration");
  });

  it("include mode: excludes entertainment news matching Presidents Day / 总统日", () => {
    const items = [
      makeItem("Wuthering Heights Still Looking To Swoon $40M Over 4-Day Presidents' Day Frame", "Box office update. 总统日和情人节4天."),
      makeItem("President Biden meets with European leaders"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("President Biden meets with European leaders");
  });

  it("include mode: excludes health/consumer news about hair extensions and chemicals", () => {
    const items = [
      makeItem("Harmful chemicals in extensions marketed to Black women", "Government regulation. 接发中发现有害化学物质."),
      makeItem("Congress passes new legislation on immigration"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Congress passes new legislation on immigration");
  });

  it("include mode: excludes game news matching God of War / 战神", () => {
    const items = [
      makeItem("God of War Sons of Sparta Co-Op Confusion on PlayStation Store", "战神斯巴达之子. Game news."),
      makeItem("War in the region continues as tensions rise"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("War in the region continues as tensions rise");
  });

  it("include mode: excludes aurora/weather news even when matching politics keywords", () => {
    const items = [
      makeItem("Valentine's Day Aurora Alert: 12 States On Watch For Northern Lights", "State capital cities. 情人节极光警报北极光."),
      makeItem("Capital city prepares for summit meeting"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Capital city prepares for summit meeting");
  });

  it("include mode: excludes weather news matching state capital", () => {
    const items = [
      makeItem("Valentine's Day heat breaks record in Twin Cities", "State capital region sees record temps. Minnesota weather."),
      makeItem("Congress passes new legislation"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Congress passes new legislation");
  });

  it("include mode: excludes tech news matching privacy policy", () => {
    const items = [
      makeItem("iOS 26.3 Released, New Siri Snags", "Privacy policy updates. Apple adds new privacy features."),
      makeItem("President Biden signs executive order"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("President Biden signs executive order");
  });

  it("include mode: excludes gaming news matching venture capital", () => {
    const items = [
      makeItem("Father Of Sega Hardware Has Passed Away", "Venture capital in gaming industry. Sega Genesis creator."),
      makeItem("Senate votes on new bill"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Senate votes on new bill");
  });

  it("include mode: keeps political news with capital city", () => {
    const items = [makeItem("Capital city prepares for summit meeting")];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
  });

  it("include mode: keeps political news with military hardware", () => {
    const items = [makeItem("Military hardware deployed to region", "Defense ministry confirms.")];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
  });

  it("include mode: excludes tech news matching content policy", () => {
    const items = [
      makeItem("YouTube adds new hurdles for ad blockers", "Content policy updates. Ad blocker battle continues."),
      makeItem("Congress passes new legislation"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Congress passes new legislation");
  });

  it("include mode: excludes security news matching 政府警告", () => {
    const items = [
      makeItem("Chrome Zero-Day Under Active Attack", "政府向 Chrome 用户发出高严重性警报. 印度政府警告存在高风险缺陷."),
      makeItem("Senate votes on new bill"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Senate votes on new bill");
  });

  it("include mode: keeps DHS/ICE news", () => {
    const items = [makeItem("DHS shuts down after funding lapse", "Department of Homeland Security.")];
    expect(filterNews(items, "include", ["politics"])).toHaveLength(1);
  });

  it("include mode: excludes national park reservation news (government-managed asset, not political)", () => {
    const items = [
      makeItem(
        "Yosemite National Park ends its reservation system for 2026",
        "National Park Service expands access. Reservation policy changes. 国家公园取消预订系统."
      ),
      makeItem("Congress passes new legislation on immigration"),
    ];
    const result = filterNews(items, "include", ["politics"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Congress passes new legislation on immigration");
  });
});
