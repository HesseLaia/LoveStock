# LoveStock

LoveStock 是一个 Telegram Mini App：通过回答 8 个问题生成你的“市场估值”，并附带 AI 点评。

## 技术栈

- 前端：原生 HTML/CSS/JavaScript（静态部署）
- 后端：Node.js 18+ + Express（API：`/api/init`、`/api/valuation`）
- 数据库：MySQL（Railway 托管）
- AI：OpenRouter（Gemini Flash）
- 测试：Node Test（`node --test`）

## 项目结构

```text
LoveStock/
  backend/
    server.js
    src/
      db/pool.js
      models/user.js
      services/
        validator.js
        valuation.js
        chart.js
        openrouter.js
  frontend/
    index.html
    app.js
    styles.css
    config.js
  docs/
    tech-design.md
    task.md
    scaling-notes.md
  bot/               # 可选：Telegram 入口
```

## 本地开发步骤

1. 准备环境
- 安装 Node.js（建议 >= 18）
- 配置 `backend/.env`（见下方环境变量清单）

2. 启动后端
- 进入后端目录：`cd backend`
- 安装依赖：`npm install`
- 启动开发：`npm run dev`
- 验证健康检查：访问 `http://localhost:3000/health`

3. 打开前端
- 由于前端是静态站点，直接打开 `frontend/index.html`
- 确保 `frontend/config.js` 中 `API_BASE_URL` 指向你的后端地址

## 部署说明（Railway + Netlify）

### Railway（后端 + MySQL）

1. 在 Railway 创建项目，并在同一 Project 内添加 MySQL 与 Node 服务
2. Railway 设置：
- Root directory：`backend/`
- 启动命令：`npm start`
- 配置环境变量（见下方环境变量清单）
3. 部署后验证：
- `GET /health`
- `GET /api/init`、`POST /api/valuation`

### Netlify（前端）

1. 将 `frontend/` 作为站点根目录发布（静态部署）
2. 在 `frontend/config.js` 中把 `API_BASE_URL` 改为你的 Railway 后端域名
3. 确保 `APP_URL`（后端环境变量）与前端线上域名一致，用于 OpenRouter 请求头

## 环境变量清单（后端）

在 `backend/.env` 或 Railway 的环境变量中配置以下项：

- 数据库
  - `DB_HOST`：MySQL 主机（本地用公网地址；Railway 用内网地址）
  - `DB_PORT`：端口
  - `DB_NAME`：数据库名（如 `lovestock`）
  - `DB_USER`：数据库用户
  - `DB_PASSWORD`：数据库密码
- AI
  - `OPENROUTER_API_KEY`：OpenRouter API Key
- Telegram 鉴权
  - `BOT_TOKEN`：用于验证 Telegram WebApp 的 `initData`
- 应用配置
  - `APP_URL`：前端域名/回传 referer（给 OpenRouter 用；本地可填 `http://localhost:xxxx`）
  - `NODE_ENV`：运行环境（本地可填 `development`）
  - `PORT`：端口（默认 `3000`）

