# Telegram 项目通用开发规则
# 适用：TG Bot / TG Mini App 项目
# 每次新开对话，把此文件喂给 AI

---

## 🏗️ 技术栈

- **Bot 框架**：grammy
- **后端**：Node.js 18+ + Express
- **数据库**：mysql2/promise（连接池模式）
- **部署**：Railway（后端 + 数据库 + Bot）/ Netlify（前端静态）
- **AI**：OpenRouter API

---

## 🔴 绝对禁止

### 不得随意重构已有逻辑
修改某个函数前必须说明：① 为什么要改 ② 会影响哪些地方。不能静默重写已有功能。

### 不得改动 A 时影响 B
每次修改范围最小化。改完必须说明：「这个改动只影响了 xxx，不影响其他模块。」

### 不得硬编码任何密钥或敏感信息
BOT_TOKEN、API Key、数据库密码等必须全部从环境变量读取，不得出现在代码里。

---

## 🟡 数据库约定

### 用 LONGTEXT 存 JSON，不用 JSON 类型列
mysql2 对 JSON 类型列会自动解析，写入时对象可能变成 [object Object]。

```sql
-- ❌ 有坑
data JSON NOT NULL

-- ✅ 安全
data LONGTEXT NOT NULL
```

### 存取统一走 JSON.parse / JSON.stringify
```js
// 存
await db.execute('INSERT ... VALUES (?, ?)', [id, JSON.stringify(obj)]);
// 取
return JSON.parse(rows[0].data);
```

### JSON.parse 必须加 try/catch
数据库里可能存在脏数据，解析失败会导致整个请求崩溃：
```js
// ❌ 危险
const data = JSON.parse(rows[0].chart_data);

// ✅ 安全
let data;
try {
  data = JSON.parse(rows[0].chart_data);
} catch (e) {
  console.error('JSON parse error:', e);
  data = [];
}
```

### Railway 数据库地址区分内网/公网
```
# 本地开发（.env）：用公网地址
DB_HOST=xxx.proxy.rlwy.net
DB_PORT=xxxxx

# Railway 服务内部：用内网地址
DB_HOST=mysql.railway.internal
DB_PORT=3306
```
两个不能混用，本地用公网，Railway 服务用内网。

### Railway 数据库本地连接不稳定
本地开发时 Railway 公网地址可能连接失败（PROTOCOL_CONNECTION_LOST）。
不要花时间调试本地数据库连接，直接部署到 Railway 用内网地址测试。

### 所有服务必须在同一个 Railway project
跨 project 访问会 ETIMEDOUT。Bot、API 服务、MySQL 必须在同一个 project 里。

### 数据库连接必须在 finally 里释放
```js
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  // ... 操作 ...
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release(); // ← 必须有，否则连接池耗尽
}
```

---

## 🟡 Mini App 专项规则

### 架构约定
```
前端（HTML/JS）  → Netlify 部署
后端（Express）  → Railway 部署
数据库（MySQL）  → Railway 同一个 project
Bot（grammy）    → Railway 同一个 project
```

### Telegram initData 验签
- 验签必须在后端做，前端不做任何身份判断
- initData 存内存，不存 localStorage / cookie
- 开发环境可跳过验签（NODE_ENV=development），生产环境必须开启
- `window.Telegram?.WebApp` 必须做空值保护，本地浏览器没有这个对象

```js
// ✅ 正确：空值保护
const initData = window.Telegram?.WebApp?.initData || '';
const tg = window.Telegram?.WebApp;
if (tg) tg.ready();
```

### 前端 API 规范
- API 地址统一放 `frontend/config.js` 的 `CONFIG.API_BASE_URL`，禁止硬编码
- 所有 fetch 必须走统一的 `apiCall` 函数，不得裸 fetch
- apiCall 自动注入 `X-Telegram-Init-Data` header

### 前端 DOM 安全（XSS 防护）
后端返回数据填充到 DOM，一律用 `textContent`，禁止用 `innerHTML` 拼接：
```js
// ❌ 危险：XSS 风险
element.innerHTML = result.ai_comment;

// ✅ 安全
element.textContent = result.ai_comment;

// 必须用 innerHTML 时，先转义
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### Telegram 内部跳转
```js
// ✅ 在 Telegram 内跳转到其他 Bot 或链接
window.Telegram?.WebApp?.openTelegramLink('https://t.me/BotUsername');

// ❌ 不要用 window.open，在 TG 里行为不一致
```

### CORS 配置
后端必须在路由之前配置 CORS，且明确列出允许的前端域名：
```js
const allowedOrigins = [
  'https://your-app.netlify.app',
  'http://localhost:3000'
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
```

---

## 🟡 Bot 专项规则

### callbackQuery 里获取 chatId
grammy 的 callbackQuery 里 ctx.chat 有时是 undefined：
```js
// ❌ 错误
const chatId = ctx.chat.id;

// ✅ 正确
const chatId = ctx.callbackQuery.message?.chat?.id ?? ctx.chat?.id;
if (!chatId) return;
```

### 只能有一个 bot 实例运行
本地开发时不要运行 node bot.js，会和 Railway 实例冲突报 409 Conflict。

检查本地（Windows）：
```powershell
Get-Process node | ForEach-Object { (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine }
```

### 群里触发命令
群里命令必须带 bot 用户名，否则无响应：
```
/start@YourBotUsername
```
私聊直接 /start 即可。

---

## 🟡 存库前清理不可序列化的字段
setTimeout 返回的 timer 不能被 JSON.stringify，存库前删掉：
```js
async function saveRecord(record) {
  const plain = { ...record };
  delete plain.anyTimeout;
  await db.execute('...', [JSON.stringify(plain)]);
}
```

---

## 🟡 .env 文件安全

### 新项目初始化顺序（不能反）
```
1. git init
2. 建 .gitignore，写入 .env 和 node_modules/
3. 才能建 .env 填入真实 key
```

.env 一旦被 git add 过，gitignore 就失效了。
如果已经泄露：立刻轮换所有 key，删仓库重建。

### push 前必须确认（Windows）
```powershell
git ls-files | Select-String ".env"
```
有输出就不能 push，先执行：
```powershell
git rm --cached .env
git commit -m "fix: remove .env from git tracking"
```

---

## 🟡 第三方 API 模型 ID

OpenRouter 的模型 ID 会过期或改名，部署前先确认：
- `google/gemini-2.0-flash-exp` 已下线
- 当前可用：`google/gemini-2.0-flash-001` 或 `google/gemini-2.5-flash`

新项目开始前去 openrouter.ai/models 确认模型 ID 还有效。

---

## 🟡 Node 环境变量加载

Node 不会自动读取 .env，必须用 dotenv：
```js
// server.js / bot.js 第一行
import 'dotenv/config';
```

启动时验证必需的环境变量：
```js
const required = ['DB_HOST', 'DB_PASSWORD', 'BOT_TOKEN'];
required.forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing: ${key}`);
    process.exit(1);
  }
});
```

---

## 🟢 文件结构

### Mini App 项目
```
project/
├── .cursorrules
├── CLAUDE.md             ← 本文件（放根目录）
├── .gitignore            ← 包含 .env 和 node_modules/
├── frontend/             → Netlify 部署
│   ├── index.html
│   ├── config.js         ← API_BASE_URL 等配置
│   ├── app.js
│   └── styles.css
├── backend/              → Railway 部署（Root Directory: backend）
│   ├── server.js
│   ├── package.json
│   ├── .env              ← 本地用公网地址
│   └── src/
│       ├── db/pool.js
│       ├── services/
│       └── models/
├── bot/                  → Railway 部署（Root Directory: bot）
│   ├── bot.js
│   └── package.json
└── docs/
    ├── prd.md
    ├── tech-design.md
    ├── task.md
    └── changelog.md
```

### 纯 Bot 项目
```
project/
├── .cursorrules
├── CLAUDE.md
├── .gitignore
├── package.json
├── bot.js
├── src/
│   ├── handlers/
│   ├── core/
│   ├── db/
│   └── messages/
└── docs/
```

---

## 🟢 调试原则

1. 先加日志，再猜原因：在关键路径加 console.log，看实际值
2. 每次只改一处：同时改多处出了 bug 不知道是哪里导致的
3. commit 前问 AI：「这个改动有没有影响其他模块？」
4. 本地数据库连接失败不要死磕，直接部署到 Railway 测试

---

## 🟢 Git 规范

```
feat: 新功能
fix: bug 修复
refactor: 重构（不改功能）
debug: 临时调试（上线前必须删掉）
```

每个 task 完成测试通过后立即 commit。新功能用新分支，出问题直接回主分支。

---

## 📋 每次新对话的上下文模板

### Bot 项目
```
我在开发一个 Telegram Bot，技术栈：grammy + mysql2 + Railway。
通用规则：@CLAUDE.md
项目专用规则：@.cursorrules
当前 task：[描述]
相关代码：[粘贴]
```

### Mini App 项目
```
我在开发一个 Telegram Mini App。
后端域名：https://xxx.railway.app
前端域名：https://xxx.netlify.app
通用规则：@CLAUDE.md
项目专用规则：@.cursorrules
Tech Design：@docs/tech-design.md
当前 task：[描述]
```