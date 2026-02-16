# 新闻摘要订阅设计审查

## 核心需求

用户以一定频率（如 12 小时）订阅新闻摘要，期望：
- 每 N 小时收到一次摘要
- 避免重复（同一新闻不重复发送）
- 完整发送对应新闻源、用户选择的包含类别内的新闻

## 当前架构概览

```mermaid
flowchart TB
    subgraph Cron [定时任务]
        Tick[runTick 每分钟]
        Fetch[runFetchTask 每8小时]
    end
    
    subgraph Vercel [Vercel 部署]
        API[/api/cron/digest 每分钟]
    end
    
    subgraph Flow [发送流程]
        GetUsers[getUsersToNotify]
        GetCache[getCachedNews]
        FetchOnDemand[fetchAndMerge 若缓存空]
        Filter[filterNews]
        Translate[translateBatch]
        Send[sendDigestEmail]
    end
    
    API --> Tick
    Tick --> GetUsers
    GetUsers --> Flow
    GetCache --> FetchOnDemand
    FetchOnDemand --> Filter
    Filter --> Translate
    Translate --> Send
```

## 发现的问题与解决方案

### 1. Vercel 上缓存预取任务未运行（严重）

**问题**：`runFetchTask`（每 8 小时刷新 news_cache）仅在本地 `npm run cron` 中执行。Vercel 只配置了 `/api/cron/digest`，仅调用 `runTick`，**runFetchTask 从未在 Vercel 上执行**。

**影响**：
- 首次发送时缓存为空，会按需抓取，正常
- 后续发送依赖缓存，但缓存只在发送时写入，不会定期更新
- 两次发送之间新发布的新闻可能未被抓取，导致**漏发**

**解决方案**：
- 在 vercel.json 中新增 cron：`/api/cron/fetch`，每 4–8 小时执行一次
- 在 cron router 中增加 `GET /api/cron/fetch`，内部调用 `runFetchTask`，并校验 CRON_SECRET

---

### 2. 发送窗口边界可能重复（中等）

**问题**：`getCachedNews` 使用 `pub_date >= (now - fetchWindowHours)`。相邻两次发送（如 00:00 和 12:00）的窗口为 [00:00, 12:00] 和 [12:00, 24:00]。`pub_date === 12:00:00` 的新闻会同时满足两次条件，**可能被发送两次**。

**解决方案**：
- 使用 `lastSentAt` 作为下界：仅发送 `pub_date > lastSentAt` 的新闻
- 同时保留 `pub_date >= (now - fetchWindowHours)`，避免发送过旧新闻
- 即：`pub_date > lastSentAt AND pub_date >= (now - fetchWindowHours)`
- 需将 `lastSentAt` 传入 `processUser` 和 `getCachedNews`

---

### 3. 缓存过期时仍可能使用旧数据（中等）

**问题**：`processUser` 仅在 `items.length === 0` 时抓取。若缓存有数据但多为旧数据（例如上次抓取在 12 小时前），`getCachedNews` 会按 `pub_date` 过滤，但**不会主动刷新**，可能漏掉新发布的新闻。

**解决方案**：
- 在 `processUser` 中增加「缓存新鲜度」判断：若最近一次抓取时间早于 `fetchWindowHours` 的一半，则重新抓取
- 或：在 Vercel 上启用 runFetchTask 后，由定时任务保证缓存更新，可缓解此问题

---

### 4. 包含模式无类别选择时的行为（低）

**问题**：用户选择「包含」但未选任何类别时，`expandCategories([])` 为空，`filterNews` 直接返回全部新闻，相当于无过滤。

**解决方案**：
- 若产品上要求「包含模式必须选择至少一个类别」，可在保存 filters 时校验
- 或在前端/后端明确：未选类别时视为「全部包含」，并在 UI 上说明

---

### 5. 多关键词要求对「完整性」的影响（低）

**问题**：当前包含模式要求至少命中 2 个不同关键词。可能过滤掉仅命中 1 个关键词但确实属于该类的新闻，影响「完整」性。

**解决方案**：
- 保持 2 关键词要求以控制误匹配，同时扩展 `TEXT_FALSE_POSITIVES` 减少误匹配
- 若用户反馈漏发过多，可改为「至少 1 个关键词 + 不在误匹配列表中」

---

## 实施优先级建议

| 优先级 | 问题 | 工作量 |
|--------|------|--------|
| P0 | Vercel 上启用 runFetchTask | 小 |
| P1 | 发送窗口去重（使用 lastSentAt） | 中 |
| P2 | 缓存新鲜度判断 | 中 |
| P3 | 包含模式无类别的产品定义 | 小 |

---

## 数据流验证

**去重**：
- 同次摘要内：`fetchAndMerge` 按 URL 和标题相似度 >0.85 去重
- 跨次摘要：需依赖 P1 的 lastSentAt 窗口逻辑

**完整性**：
- 依赖 runFetchTask 或按需抓取保证数据源覆盖
- 依赖 filterNews 正确实现包含/排除逻辑
- 依赖 fetchWindowHours 与用户配置的发送间隔一致（当前已一致）
