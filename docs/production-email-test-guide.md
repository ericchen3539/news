# 生产环境验证邮件测试指南

> 依据 `email_flow_testing_plan` 2.2 节，逐步排查「注册后收不到验证邮件」问题。

---

## 前置：根因排查清单

验证邮件未送达的常见原因：

| # | 可能原因 | 检查方式 |
|---|----------|----------|
| 1 | **Vercel 函数提前终止** | 当前 `sendVerificationEmail` 为 fire-and-forget，响应返回后函数被 kill，邮件可能未发出 |
| 2 | `SMTP_HOST` 未设置或为 `skip` | 空值或 `skip` 会直接跳过发信 |
| 3 | SMTP 凭据错误 | `SMTP_USER` / `SMTP_PASS` 配置错误 |
| 4 | `APP_URL` 错误 | 验证链接指向错误域名 |
| 5 | 邮件进垃圾箱 | 检查垃圾邮件文件夹 |
| 6 | SMTP 提供商限制 | 如 Gmail 需开启「应用专用密码」 |

---

## 步骤 1：确认 Vercel 环境变量

1. 打开 [Vercel Dashboard](https://vercel.com) → 选择项目 → **Settings** → **Environment Variables**
2. 确认以下变量在 **Production** 环境已设置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `SMTP_HOST` | ✅ | 真实 SMTP 主机，如 `smtp.gmail.com`。**不能**为空或 `skip` |
| `SMTP_PORT` | ✅ | 通常 `587`（TLS）或 `465`（SSL） |
| `SMTP_USER` | ✅ | SMTP 登录用户名 |
| `SMTP_PASS` | ✅ | SMTP 密码（Gmail 用应用专用密码） |
| `SMTP_FROM` | 建议 | 发件人，如 `News Digest <noreply@yourdomain.com>`，否则默认 `noreply@example.com` 可能被拒 |
| `APP_URL` | ✅ | 生产域名，如 `https://your-app.vercel.app` |
| `DATABASE_URL` | ✅ | `postgresql://...`（Neon） |
| `JWT_SECRET` | ✅ | 生产用强随机字符串 |

3. 修改后需 **Redeploy** 才能生效。

---

## 步骤 2：检查运行时日志

1. Vercel Dashboard → 项目 → **Logs**（或 **Deployments** → 某次部署 → **Functions**）
2. 使用真实邮箱执行一次注册
3. 在 Logs 中搜索：
   - `[Dev] Skip SMTP` → 若出现，说明 `SMTP_HOST` 未正确配置，邮件被跳过
   - `[Auth] Failed to send verification email` → SMTP 发送失败，查看后续错误堆栈
   - 无相关日志 → 可能是函数在发信完成前被终止（见步骤 4）

---

## 步骤 3：验证 DB 与 Token

确认注册流程至少写入了 DB：

1. 连接 Neon 数据库，执行：
   ```sql
   SELECT u.id, u.email, u.verified_at, v.token, v.expires_at
   FROM users u
   LEFT JOIN verification_tokens v ON v.user_id = u.id
   ORDER BY u.id DESC LIMIT 5;
   ```
2. 若 `verification_tokens` 有对应记录且 `expires_at` 未过期，说明注册与 token 生成正常，问题在发信环节。

---

## 步骤 4：修复 Fire-and-Forget（关键）

**问题**：`src/auth/index.ts` 中 `sendVerificationEmail` 使用 fire-and-forget：

```ts
sendVerificationEmail(email, verifyUrl).catch((err) =>
  console.error("[Auth] Failed to send verification email:", err)
);
```

在 Vercel Serverless 中，响应返回后函数会立即终止，**未 await 的 Promise 可能被中断**，邮件发送无法完成。

**修复**：改为 `await`，在返回前完成发信。若 SMTP 失败，可返回明确错误给用户。

---

## 步骤 5：使用临时邮箱测试

避免污染主邮箱：

1. 使用 [Mailinator](https://www.mailinator.com/) 或 [Guerrilla Mail](https://www.guerrillamail.com/)
2. 用临时邮箱地址注册
3. 检查收件箱与垃圾箱
4. 点击验证链接，确认跳转成功

---

## 步骤 6：完整验证流程检查表

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 使用真实/临时邮箱注册 | 返回 `{"message":"Registration successful. Check your email to verify."}` |
| 2 | 检查收件箱/垃圾箱 | 收到主题为 "Verify your email - News Digest" 的邮件 |
| 3 | 点击邮件中的验证链接 | 跳转到 `{APP_URL}/verify?token=xxx`，显示 "Email verified successfully." |
| 4 | 使用过期 token 访问 | 返回 "Token expired" |
| 5 | 使用错误 token 访问 | 返回 "Invalid or expired token" |

---

## 下一步

1. 完成步骤 1–3 的排查
2. 应用步骤 4 的代码修复并重新部署
3. 按步骤 5–6 再次测试

若仍有问题，提供 Vercel Logs 中的相关错误信息以便进一步排查。
