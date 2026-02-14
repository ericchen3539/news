/**
 * HTML table template for digest email.
 */

export interface DigestRow {
  titleZh: string;
  summaryZh: string;
  link: string;
  sourceLabel: string;
}

export function buildDigestTable(rows: DigestRow[]): string {
  if (rows.length === 0) {
    return "<p>今日暂无符合筛选条件的新闻。</p>";
  }

  const trs = rows
    .map(
      (r) => `
    <tr>
      <td><a href="${escapeHtml(r.link)}">${escapeHtml(r.titleZh)}</a></td>
      <td>${escapeHtml(r.summaryZh)}</td>
      <td><a href="${escapeHtml(r.link)}">${escapeHtml(r.sourceLabel)}</a></td>
    </tr>
  `
    )
    .join("");

  return `
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <thead>
      <tr style="background: #f0f0f0;">
        <th>标题</th>
        <th>摘要</th>
        <th>来源</th>
      </tr>
    </thead>
    <tbody>
      ${trs}
    </tbody>
  </table>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
