# News Digest - 新闻摘要邮件系统

每日从用户配置的新闻源抓取新闻，按预设类别过滤，翻译为中文后以表格形式邮件发送。

## 功能

- 用户邮箱注册与验证
- 多新闻源配置（RSS URL）
- 预设类别过滤（政治、科技、体育、财经、娱乐），支持多选
- 发送频率：每天 / 每周 / 每两周 / 每月
- 发送时间与星期几 / 每月几号可自定义，默认 7:00
- 单一表格输出：标题（中文）、摘要（中文）、源链接、来源

## 快速开始

### 环境变量

复制 `.env.example` 为 `.env` 并配置：

```
DATABASE_URL=file:./data/news.db
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
JWT_SECRET=your-secret-key
APP_URL=http://localhost:3000
```

### 安装与运行

```bash
npm install
npm run db:migrate
npm run dev
```

访问 http://localhost:3000 进行注册与配置。

### 定时任务

另开终端运行 cron（每分钟检查并发送）：

```bash
npm run cron
```

## API

- `POST /api/auth/register` - 注册
- `GET /api/auth/verify?token=` - 验证邮箱
- `POST /api/auth/verify-email` - 开发用：按邮箱直接验证（生产环境应移除）
- `POST /api/auth/login` - 登录
- `GET /api/filter-presets` - 预设类别列表
- `GET/POST/DELETE /api/sources` - 新闻源 CRUD（需认证）
- `GET/PUT /api/filters` - 过滤条件（需认证）
- `GET/PUT /api/schedule` - 发送频率与时间（需认证）

## 项目结构

```
src/
├── api/          # 路由
├── auth/          # 注册、登录、验证
├── db/            # 数据库
├── email/         # 邮件模板与发送
├── fetcher/       # RSS 抓取
├── filter/        # 过滤引擎与预设
├── translate/     # 翻译
├── cron/          # 定时任务
└── index.ts
```
