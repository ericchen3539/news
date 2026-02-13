# 邮件流程测试指南

## 开发环境

### 验证邮件流程

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | `SMTP_HOST=skip` 或留空 | 注册时验证 URL 输出到控制台，不实际发邮件 |
| 2 | `DEV_VERIFY_EMAIL=1` | 注册后自动验证，无需点击链接 |
| 3 | `POST /api/auth/verify-email` `{"email":"xxx"}` | 按邮箱直接验证（开发用） |
| 4 | MailHog: `docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog` | 本地 SMTP，http://localhost:8025 查看邮件 |

### 摘要邮件流程

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | `SMTP_HOST=skip` | 摘要不实际发送，仅 console.log |
| 2 | `POST /api/dev/send-digest-now` `{"userId":1}` | 立即触发摘要，无需等待 cron 时间 |
| 3 | 条件：`NODE_ENV!==production` 或 `DEV_SEND_DIGEST=1` | 生产环境默认拒绝 |

### 单元测试

```bash
npm run test        # 单次运行
npm run test:watch  # 监听模式
```

覆盖：`filter/engine.ts`（include/exclude、关键词匹配）、`email/template.ts`（HTML 输出、XSS 转义）。

---

## 生产环境

### Vercel Cron

- 路径：`GET /api/cron/digest`
- 调度：每分钟 `* * * * *`
- 鉴权：`Authorization: Bearer ${CRON_SECRET}`，需在 Vercel 环境变量中设置 `CRON_SECRET`

### 验证邮件测试

1. 使用真实邮箱注册
2. 检查收件箱/垃圾箱
3. 点击验证链接，确认 `verified_at` 已更新
4. 可选：使用 Mailinator 等临时邮箱

### 摘要邮件测试

1. 配置 sources、filters、schedule
2. 将 `send_time` 设为下一分钟（如当前 14:32，设为 14:33）
3. 等待 1 分钟
4. 检查收件
5. 在 Vercel Dashboard 查看运行时日志

### 时区注意

`getUsersToNotify` 使用用户配置的 `timezone` 计算本地时间，Vercel 服务器一般为 UTC，需确保 `user_schedules.timezone` 与预期一致。
