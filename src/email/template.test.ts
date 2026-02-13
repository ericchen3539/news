/**
 * Unit tests for digest email template - HTML output, XSS escaping.
 */

import { describe, it, expect } from "vitest";
import { buildDigestTable } from "./template.js";

describe("buildDigestTable", () => {
  it("returns empty message when no rows", () => {
    const html = buildDigestTable([]);
    expect(html).toContain("No matching news articles today");
    expect(html).not.toContain("<table");
  });

  it("renders table with headers and rows", () => {
    const rows = [
      { titleZh: "标题1", summaryZh: "摘要1", link: "https://a.com/1", sourceLabel: "Source A" },
      { titleZh: "标题2", summaryZh: "摘要2", link: "https://b.com/2", sourceLabel: "Source B" },
    ];
    const html = buildDigestTable(rows);
    expect(html).toContain("<table");
    expect(html).toContain("标题</th>");
    expect(html).toContain("摘要</th>");
    expect(html).toContain("来源</th>");
    expect(html).toContain("标题1");
    expect(html).toContain("标题2");
    expect(html).toContain("https://a.com/1");
    expect(html).toContain("https://b.com/2");
  });

  it("escapes HTML in title to prevent XSS", () => {
    const rows = [
      {
        titleZh: "<script>alert(1)</script>",
        summaryZh: "safe",
        link: "https://x.com",
        sourceLabel: "X",
      },
    ];
    const html = buildDigestTable(rows);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;/script&gt;");
  });

  it("escapes HTML in summary", () => {
    const rows = [
      {
        titleZh: "Safe",
        summaryZh: "<img src=x onerror=alert(1)>",
        link: "https://x.com",
        sourceLabel: "X",
      },
    ];
    const html = buildDigestTable(rows);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes ampersands and quotes in link", () => {
    const rows = [
      {
        titleZh: "Link",
        summaryZh: "Desc",
        link: "https://x.com?a=1&b=2\"",
        sourceLabel: "X",
      },
    ];
    const html = buildDigestTable(rows);
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });
});
