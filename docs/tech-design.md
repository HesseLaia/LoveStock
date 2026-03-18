# LoveStock Technical Design Document
**Version:** v0.1  
**Last Updated:** 2026-03-18  
**Status:** Draft

---

## 📋 目录

1. [技术栈选型](#1-技术栈选型)
2. [项目文件结构](#2-项目文件结构)
3. [数据模型](#3-数据模型)
4. [API 接口规范](#4-api-接口规范)
5. [估值算法](#5-估值算法)
6. [OpenRouter 调用规范](#6-openrouter-调用规范)
7. [环境变量清单](#7-环境变量清单)
8. [部署配置](#8-部署配置)
9. [风险预审](#9-风险预审)
10. [前端 APP 命名空间](#10-前端-app-命名空间)

---

## 1. 技术栈选型

### 1.1 前端（Telegram Mini App）

**技术方案：纯 HTML/CSS/JavaScript（无框架）**

**选型理由：**
- ✅ PRD 强调「体验完整不追求功能完整」，前端 demo 已实现完整 UI 和交互
- ✅ 无需构建工具，部署简单，Vercel 可直接托管静态文件
- ✅ Telegram Web App SDK 集成简单，只需引入一个 JS 文件
- ✅ 减少依赖和构建复杂度，便于快速迭代

**核心依赖：**
- Telegram Web App SDK：`https://telegram.org/js/telegram-web-app.js`
- 字体：Google Fonts - Share Tech Mono（等宽字体，交易所风格）

---

### 1.2 后端（API 服务）

**技术方案：Node.js 18+ + Express**

**选型理由：**
- ✅ 与 CLAUDE.md 规定的技术栈一致（grammy + Node.js）
- ✅ Express 轻量，适合只有 2-3 个 API 端点的场景
- ✅ 可与未来的 Bot 服务共享工具函数和数据库连接池
- ✅ 异步处理能力强，适合调用 OpenRouter API

**架构决策：**
- **后端与 Bot 分离**：Bot 负责发送入口消息，API 服务负责业务逻辑
- **原因**：关注点分离，便于独立部署和扩展，Bot 可选（用户也可直接通过链接打开 Mini App）

---

### 1.3 数据库

**技术方案：MySQL 8.0（Railway 托管）**

**选型理由：**
- ✅ 符合 CLAUDE.md 通用规则
- ✅ Railway 同 project 内网访问稳定（`mysql.railway.internal`）
- ✅ 结构化数据存储，用户信息和答题记录关系清晰

**关键约定（来自 CLAUDE.md）：**
- ⚠️ **用 LONGTEXT 存 JSON，不用 JSON 类型列**（避免 mysql2 自动解析导致的 `[object Object]` 问题）
- ⚠️ 存取统一走 `JSON.parse` / `JSON.stringify`
- ⚠️ Railway 内网地址（`mysql.railway.internal:3306`）和公网地址（`xxx.proxy.rlwy.net:xxxxx`）严格区分

---

### 1.4 部署

#### **前端部署：Vercel**
- ✅ 静态文件托管
- ✅ CDN 全球加速，适合 Telegram Mini App
- ✅ 自动 HTTPS
- ✅ 部署根目录：`frontend/`

#### **后端部署：Railway**
- ✅ 与 MySQL 在同一个 Railway project（避免跨 project 访问超时）
- ✅ 环境变量管理
- ✅ 内网访问 MySQL
- ✅ 部署根目录：`backend/`

#### **Bot 部署（可选）：Railway**
- 如果需要 Bot 发送入口消息，可部署到同一 Railway project
- Bot 逻辑极简：`/start` 命令返回 Web App 按钮

---

## 2. 项目文件结构

```
LoveStock/
├── .env                      # 本地环境变量（不提交 git）
├── .gitignore                # 必须包含 .env
├── package.json              # 根目录可选，或在 backend/ 下单独管理
├── CLAUDE.md                 # 通用 TG Bot 开发规则
├── .cursorrules              # 项目专用规则（待创建）
│
├── docs/                     # 文档目录
│   ├── prd.md                # 产品需求文档
│   ├── tech-design.md        # 技术设计文档（本文件）
│   ├── task.md               # 开发任务清单
│   └── changelog.md          # 变更日志
│
├── frontend/                 # 前端（Vercel 部署根目录）
│   ├── index.html            # 主页面（基于 frontend_demo.html）
│   ├── config.js             # 配置文件（API_BASE_URL 等）
│   ├── app.js                # 前端逻辑（从 HTML 分离）
│   ├── styles.css            # 样式表（从 HTML 分离）
│   └── vercel.json           # Vercel 配置（可选）
│
├── backend/                  # 后端（Railway 部署根目录）
│   ├── server.js             # Express 入口
│   ├── package.json          # 后端依赖
│   ├── .env                  # 后端本地环境变量（不提交）
│   ├── src/
│   │   ├── db/
│   │   │   └── pool.js       # MySQL 连接池
│   │   ├── services/
│   │   │   ├── validator.js  # Telegram initData 验证
│   │   │   ├── valuation.js  # 估值算法核心逻辑
│   │   │   ├── openrouter.js # OpenRouter API 调用
│   │   │   └── chart.js      # K线图数据生成
│   │   ├── models/
│   │   │   └── user.js       # 用户数据 CRUD 操作
│   │   └── utils/
│   │       └── logger.js     # 日志工具（可选）
│   └── railway.json          # Railway 配置（可选）
│
└── bot/                      # 可选：Bot 服务
    ├── bot.js                # Grammy bot 入口
    ├── package.json
    ├── .env
    └── src/
        └── handlers/
            └── start.js      # /start 命令处理
```

---

## 3. 数据模型

### 3.1 表结构设计

#### **表 1: `users`**
存储用户基本信息和最终估值结果

```sql
CREATE TABLE users (
  user_id BIGINT PRIMARY KEY COMMENT 'Telegram user ID',
  username VARCHAR(255) NULL COMMENT 'Telegram username（可能为空）',
  first_name VARCHAR(255) NULL COMMENT 'Telegram first name',
  last_name VARCHAR(255) NULL COMMENT 'Telegram last name',
  
  -- 估值结果
  ticker VARCHAR(10) NOT NULL COMMENT '股票代号（如 $ALEX）',
  final_price DECIMAL(10,2) NOT NULL COMMENT '最终估值（如 4721.38）',
  change_percent DECIMAL(5,1) NOT NULL COMMENT '涨跌幅（如 +12.4 或 -3.5）',
  stock_type VARCHAR(50) NOT NULL COMMENT 'Blue Chip / Growth Stock / Concept Stock / Defensive Stock',
  grade VARCHAR(5) NOT NULL COMMENT '等级：A+ 到 C-',
  special_tag VARCHAR(100) NULL COMMENT '附加标签（如 RARE FIND）',
  ai_comment TEXT NULL COMMENT 'OpenRouter 生成的一句话点评',
  
  -- K线图数据（后端生成）
  chart_data LONGTEXT NOT NULL COMMENT 'JSON 数组：30个数据点',
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '首次创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  
  -- 索引
  INDEX idx_created (created_at),
  INDEX idx_ticker (ticker)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户估值结果表（覆盖更新，不保留历史）';
```

---

#### **表 2: `answers`**
存储用户答题记录（用于后续数据分析）

```sql
CREATE TABLE answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT 'Telegram user ID',
  
  -- 答题数据（LONGTEXT 存储，不用 JSON 类型）
  answers_data LONGTEXT NOT NULL COMMENT 'JSON.stringify(["A", "B", "C", ...])，8个选项',
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '答题提交时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  
  -- 外键
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- 唯一索引（用于覆盖更新）
  UNIQUE KEY unique_user (user_id),
  
  -- 普通索引
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户答题记录表（每次覆盖更新）';
```

---

### 3.2 数据存取规范（来自 CLAUDE.md）

#### **写入示例（正确方式）**
```javascript
// ✅ 正确：使用 LONGTEXT + JSON.stringify
const chartData = [42, 38, 46, 32, 35, ...];
await db.execute(
  'INSERT INTO users (user_id, ticker, chart_data) VALUES (?, ?, ?)',
  [userId, ticker, JSON.stringify(chartData)]
);

const answers = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'];
await db.execute(
  'INSERT INTO answers (user_id, answers_data) VALUES (?, ?)',
  [userId, JSON.stringify(answers)]
);
```

#### **读取示例（正确方式）**
```javascript
// ✅ 正确：读取后使用 JSON.parse
const [rows] = await db.execute(
  'SELECT chart_data FROM users WHERE user_id = ?',
  [userId]
);

const chartData = JSON.parse(rows[0].chart_data);
// chartData 现在是数组 [42, 38, 46, ...]
```

#### **⚠️ 错误示例（禁止）**
```javascript
// ❌ 错误：使用 JSON 类型列
CREATE TABLE users (
  chart_data JSON NOT NULL  -- 会导致 mysql2 自动解析问题
);

// ❌ 错误：直接存入对象
await db.execute(
  'INSERT INTO users (chart_data) VALUES (?)',
  [chartData]  // 会变成 [object Object]
);
```

---

### 3.3 数据更新策略

**MVP 决策：覆盖旧结果，不保留历史**

#### **用户重新测试时的逻辑：**
```javascript
// backend/src/models/user.js
async function saveUserResult(userId, telegramUser, valuation, answers) {
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // 1. 插入或更新 users 表（覆盖旧结果）
    await conn.execute(`
      INSERT INTO users (
        user_id, username, first_name, last_name,
        ticker, final_price, change_percent, stock_type, grade,
        special_tag, ai_comment, chart_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        ticker = VALUES(ticker),
        final_price = VALUES(final_price),
        change_percent = VALUES(change_percent),
        stock_type = VALUES(stock_type),
        grade = VALUES(grade),
        special_tag = VALUES(special_tag),
        ai_comment = VALUES(ai_comment),
        chart_data = VALUES(chart_data),
        updated_at = CURRENT_TIMESTAMP
    `, [
      userId,
      telegramUser.username,
      telegramUser.first_name,
      telegramUser.last_name,
      valuation.ticker,
      valuation.final_price,
      valuation.change_percent,
      valuation.stock_type,
      valuation.grade,
      valuation.special_tag,
      valuation.ai_comment,
      JSON.stringify(valuation.chart_data)
    ]);
    
    // 2. 插入或更新答题记录（使用 UNIQUE KEY 实现覆盖）
    await conn.execute(`
      INSERT INTO answers (user_id, answers_data)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
        answers_data = VALUES(answers_data),
        updated_at = CURRENT_TIMESTAMP
    `, [userId, JSON.stringify(answers)]);
    
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
```

---

### 3.4 初始化 SQL 脚本

```sql
-- backend/init.sql（Railway MySQL 初始化脚本）

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS lovestock 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE lovestock;

-- 创建 users 表
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT PRIMARY KEY,
  username VARCHAR(255) NULL,
  first_name VARCHAR(255) NULL,
  last_name VARCHAR(255) NULL,
  ticker VARCHAR(10) NOT NULL,
  final_price DECIMAL(10,2) NOT NULL,
  change_percent DECIMAL(5,1) NOT NULL,
  stock_type VARCHAR(50) NOT NULL,
  grade VARCHAR(5) NOT NULL,
  special_tag VARCHAR(100) NULL,
  ai_comment TEXT NULL,
  chart_data LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_ticker (ticker)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 answers 表
CREATE TABLE IF NOT EXISTS answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  answers_data LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user (user_id),  -- 唯一索引，用于 ON DUPLICATE KEY UPDATE
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. API 接口规范

### 4.1 Base URL

**环境区分：**
- **本地开发**：`http://localhost:3000`
- **生产环境**：`https://lovestock-api.railway.app`（实际部署后替换）

---

### 4.2 通用请求头

所有接口都需要携带 Telegram initData 进行身份验证：

```
Content-Type: application/json
X-Telegram-Init-Data: <Telegram.WebApp.initData>
```

---

### 4.3 通用响应格式

#### **成功响应：**
```json
{
  "success": true,
  "data": { /* 具体数据 */ }
}
```

#### **失败响应：**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

---

### 4.4 错误码规范

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `INVALID_INIT_DATA` | 401 | Telegram initData 验证失败 |
| `INVALID_ANSWERS` | 400 | 答案格式错误（不是 8 个选项或选项不合法） |
| `OPENROUTER_TIMEOUT` | 500 | OpenRouter 超时（已使用兜底文案） |
| `OPENROUTER_ERROR` | 500 | OpenRouter 调用失败（已使用兜底文案） |
| `DB_ERROR` | 500 | 数据库操作错误 |
| `INTERNAL_ERROR` | 500 | 未知内部错误 |

---

### 4.5 端点 1: 初始化检查

**目的：** 验证 initData，检查用户是否有历史结果

```
GET /api/init
```

#### **请求头：**
```
X-Telegram-Init-Data: <Telegram.WebApp.initData>
```

#### **响应（首次用户）：**
```json
{
  "success": true,
  "data": {
    "user_id": 123456789,
    "username": "investor_puro",
    "first_name": "Alex",
    "has_result": false
  }
}
```

#### **响应（有历史结果）：**
```json
{
  "success": true,
  "data": {
    "user_id": 123456789,
    "username": "investor_puro",
    "first_name": "Alex",
    "has_result": true,
    "result": {
      "ticker": "$ALEX",
      "final_price": 4721.38,
      "change_percent": 12.4,
      "stock_type": "Growth Stock",
      "grade": "A-",
      "special_tag": "RARE FIND",
      "ai_comment": "Emotionally stable to the point where the market questions if this asset is too good to be true",
      "chart_data": [42, 38, 46, 32, 35, 18, 26, 13, 20, 28, 16, 10, 18, 6, 12, 20, 8, 15, 9, 17, 11, 5, 9, 3, 7, 2, 5, 4, 8, 5]
    }
  }
}
```

#### **实现示例：**
```javascript
// backend/server.js
app.get('/api/init', authMiddleware, async (req, res) => {
  try {
    const userId = req.telegramUser.id;
    const existingResult = await getUserResult(userId);
    
    res.json({
      success: true,
      data: {
        user_id: userId,
        username: req.telegramUser.username || null,
        first_name: req.telegramUser.first_name || null,
        has_result: !!existingResult,
        result: existingResult || undefined
      }
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'INTERNAL_ERROR',
      message: 'Failed to initialize'
    });
  }
});
```

---

### 4.6 端点 2: 提交答题并获取结果

**目的：** 计算估值，生成结果，存入数据库（覆盖旧结果）

```
POST /api/valuation
```

#### **请求头：**
```
Content-Type: application/json
X-Telegram-Init-Data: <Telegram.WebApp.initData>
```

#### **请求体：**
```json
{
  "answers": ["A", "B", "C", "D", "A", "B", "C", "D"]
}
```

- `answers`：数组，必须包含 8 个元素
- 每个元素必须是 `"A"`, `"B"`, `"C"`, `"D"` 之一

#### **响应（成功）：**
```json
{
  "success": true,
  "data": {
    "user_id": 123456789,
    "username": "investor_puro",
    "ticker": "$ALEX",
    "final_price": 4721.38,
    "change_percent": 12.4,
    "stock_type": "Growth Stock",
    "grade": "A-",
    "special_tag": "RARE FIND",
    "ai_comment": "Emotionally stable to the point where the market questions if this asset is too good to be true",
    "chart_data": [42, 38, 46, 32, 35, 18, 26, 13, 20, 28, 16, 10, 18, 6, 12, 20, 8, 15, 9, 17, 11, 5, 9, 3, 7, 2, 5, 4, 8, 5]
  }
}
```

#### **响应（失败 - 答案格式错误）：**
```json
{
  "success": false,
  "error": "INVALID_ANSWERS",
  "message": "Answers must be an array of 8 valid options (A/B/C/D)"
}
```

#### **实现示例：**
```javascript
// backend/server.js
app.post('/api/valuation', authMiddleware, async (req, res) => {
  try {
    const { answers } = req.body;
    
    // 验证答案格式
    if (!Array.isArray(answers) || answers.length !== 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'INVALID_ANSWERS',
        message: 'Answers must be an array of 8 elements'
      });
    }
    
    const validOptions = ['A', 'B', 'C', 'D'];
    if (!answers.every(a => validOptions.includes(a))) {
      return res.status(400).json({ 
        success: false, 
        error: 'INVALID_ANSWERS',
        message: 'Each answer must be A, B, C, or D'
      });
    }
    
    const userId = req.telegramUser.id;
    const username = req.telegramUser.username || req.telegramUser.first_name || 'USER';
    
    // 计算估值（详见第5章）
    const valuation = calculateValuation(answers, username);
    
    // 生成 AI 点评（详见第6章）
    const aiComment = await generateComment(
      valuation.stock_type,
      valuation.final_price,
      valuation.grade,
      valuation.special_tag
    );
    
    valuation.ai_comment = aiComment;
    
    // 保存到数据库（覆盖旧结果）
    await saveUserResult(userId, req.telegramUser, valuation, answers);
    
    res.json({
      success: true,
      data: {
        user_id: userId,
        username: req.telegramUser.username || null,
        ...valuation
      }
    });
    
  } catch (error) {
    console.error('Valuation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'INTERNAL_ERROR',
      message: 'Failed to calculate valuation'
    });
  }
});
```

---

### 4.7 CORS 配置

**问题：** 前端（Vercel）请求后端（Railway）会被浏览器拦截

**解决方案：**
```javascript
// backend/server.js
import express from 'express';

const app = express();

// CORS 中间件（必须在路由之前）
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://lovestock.vercel.app',  // 生产环境
    'http://localhost:5173',         // 本地开发（Vite）
    'http://127.0.0.1:5173'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());
```

---

### 4.8 身份验证中间件

```javascript
// backend/src/services/validator.js
import crypto from 'crypto';

/**
 * 验证 Telegram Web App initData
 * @param {string} initData - Telegram.WebApp.initData
 * @returns {object|null} - 解析后的 user 对象，验证失败返回 null
 */
export function validateTelegramInitData(initData) {
  if (!initData) return null;
  
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
      console.error('BOT_TOKEN not configured');
      return null;
    }
    
    // 解析 initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    
    // 按字母顺序排列参数
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // 计算签名
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    // 验证签名
    if (calculatedHash !== hash) {
      console.error('Invalid initData signature');
      return null;
    }
    
    // 验证时间戳（可选，防止重放攻击）
    const authDate = parseInt(params.get('auth_date'));
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authDate > 86400) {  // 24小时过期
      console.error('initData expired');
      return null;
    }
    
    // 解析 user 对象
    const userJson = params.get('user');
    if (!userJson) return null;
    
    return JSON.parse(userJson);
    
  } catch (error) {
    console.error('Error validating initData:', error);
    return null;
  }
}
```

```javascript
// backend/server.js
import { validateTelegramInitData } from './src/services/validator.js';

// 身份验证中间件
const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  const user = validateTelegramInitData(initData);
  
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'INVALID_INIT_DATA',
      message: 'Authentication failed'
    });
  }
  
  req.telegramUser = user;
  next();
};
```

---

## 5. 估值算法

### 5.1 算法流程

```
用户答题（8个选项：A/B/C/D）
         ↓
Step 1: 计算基础分值（baseScore）
         ↓
Step 2: 判断股票类型（stockType）- 基于 Q6/Q7/Q8
         ↓
Step 3: 生成最终价格（finalPrice）- 归一化 + 类型调整 + 随机扰动
         ↓
Step 4: 计算涨跌幅（changePercent）- 基于前5题激进程度
         ↓
Step 5: 判断等级（grade）- 基于价格区间
         ↓
Step 6: 生成特殊标签（specialTag）- 基于特定答案组合
         ↓
Step 7: 生成K线图数据（chartData）- 基于股票类型
         ↓
返回完整估值结果
```

---

### 5.2 Step 1: 计算基础分值

```javascript
// backend/src/services/valuation.js

/**
 * 每道题每个选项的分值（来自 PRD）
 */
const SCORE_MAP = {
  q1: [20, 10, -5, -15],   // Q1: 上次被表白
  q2: [15, 5, -5, -10],    // Q2: 失恋恢复时间
  q3: [10, 15, 0, -5],     // Q3: 关系中的角色
  q4: [-10, 10, 5, -5],    // Q4: 回复速度
  q5: [-10, 5, 20, () => Math.random() * 30 - 15],  // Q5: 前任评价（D选项随机±15）
  q6: [0, 0, 0, 0],        // Q6: 性格题，不计分
  q7: [0, 0, 0, 0],        // Q7: 性格题，不计分
  q8: [0, 0, 0, 0]         // Q8: 性格题，不计分
};

/**
 * 计算基础分值
 * @param {string[]} answers - 8个答案，如 ["A", "B", "C", "D", ...]
 * @returns {number} - baseScore，范围 -50 到 +75
 */
function calculateBaseScore(answers) {
  let baseScore = 0;
  
  answers.forEach((answer, qIndex) => {
    const optionIndex = answer.charCodeAt(0) - 65;  // 'A'->0, 'B'->1, 'C'->2, 'D'->3
    const scoreValue = SCORE_MAP[`q${qIndex + 1}`][optionIndex];
    
    // 处理 Q5 的 D 选项（随机分值）
    if (typeof scoreValue === 'function') {
      baseScore += scoreValue();
    } else {
      baseScore += scoreValue;
    }
  });
  
  return baseScore;
}
```

---

### 5.3 Step 2: 判断股票类型

```javascript
/**
 * 根据 Q6/Q7/Q8 组合判断股票类型
 */
const STOCK_TYPE_MAP = {
  // Blue Chip（蓝筹股）：稳健型
  'BBB': 'Blue Chip',
  'BBA': 'Blue Chip',
  'BBD': 'Blue Chip',
  'BAB': 'Blue Chip',
  
  // Concept Stock（概念股）：外向+情感型
  'AAA': 'Concept Stock',
  'AAB': 'Concept Stock',
  'AAC': 'Concept Stock',
  'AAD': 'Concept Stock',
  'ABA': 'Concept Stock',
  
  // Defensive Stock（防御股）：独立型
  'CCC': 'Defensive Stock',
  'CCB': 'Defensive Stock',
  'CCA': 'Defensive Stock',
  'CBC': 'Defensive Stock',
  'CAC': 'Defensive Stock',
  
  // Growth Stock（成长股）：其他所有组合
  'default': 'Growth Stock'
};

/**
 * 判断股票类型
 * @param {string[]} answers - 8个答案
 * @returns {string} - 股票类型
 */
function determineStockType(answers) {
  // 取 Q6/Q7/Q8 的答案（索引 5/6/7）
  const personalityKey = answers[5] + answers[6] + answers[7];
  return STOCK_TYPE_MAP[personalityKey] || STOCK_TYPE_MAP['default'];
}
```

---

### 5.4 Step 3: 生成最终价格

```javascript
/**
 * 生成最终价格
 * @param {number} baseScore - 基础分值（-50 到 +75）
 * @param {string} stockType - 股票类型
 * @returns {number} - 最终价格（$1.00 - $9999.99）
 */
function calculateFinalPrice(baseScore, stockType) {
  const MIN_PRICE = 1;
  const MAX_PRICE = 9999;
  
  // 归一化到 0-1 区间（修正：分母为 125，不是 130）
  const normalizedScore = (baseScore + 50) / 125;
  let finalPrice = MIN_PRICE + normalizedScore * (MAX_PRICE - MIN_PRICE);
  
  // 根据股票类型调整
  const typeMultiplier = {
    'Blue Chip': 1.2,       // 蓝筹股溢价
    'Growth Stock': 1.0,    // 成长股基准
    'Concept Stock': 0.8,   // 概念股折价（高风险）
    'Defensive Stock': 1.1  // 防御股小幅溢价
  };
  finalPrice *= typeMultiplier[stockType];
  
  // 加入 ±15% 随机扰动，让分布更有趣
  const jitter = 0.85 + Math.random() * 0.3;  // 0.85 - 1.15
  finalPrice *= jitter;
  
  // 限制在有效范围内，保留两位小数
  finalPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE, finalPrice));
  return parseFloat(finalPrice.toFixed(2));
}
```

---

### 5.5 Step 4: 计算涨跌幅

**决策逻辑：** 基于前5题的激进程度，不是纯随机

```javascript
/**
 * 计算涨跌幅（基于前5题的激进程度）
 * @param {string[]} answers - 8个答案
 * @param {number} baseScore - 基础分值
 * @returns {number} - 涨跌幅（-20.0 到 +99.9）
 */
function calculateChangePercent(answers, baseScore) {
  // 只看前5题的分值（性格题不影响涨跌幅）
  let aggressiveScore = 0;
  
  for (let i = 0; i < 5; i++) {
    const optionIndex = answers[i].charCodeAt(0) - 65;
    const scoreValue = SCORE_MAP[`q${i + 1}`][optionIndex];
    
    if (typeof scoreValue === 'function') {
      aggressiveScore += scoreValue();
    } else {
      aggressiveScore += scoreValue;
    }
  }
  
  // 前5题分值范围：-50 到 +75
  // 映射到涨跌幅：-20% 到 +99%
  const minChange = -20.0;
  const maxChange = 99.9;
  
  const normalized = (aggressiveScore + 50) / 125;
  let changePercent = minChange + normalized * (maxChange - minChange);
  
  // 保留一位小数
  return parseFloat(changePercent.toFixed(1));
}
```

---

### 5.6 Step 5: 判断等级

```javascript
/**
 * 判断等级（基于价格区间）
 */
const GRADE_MAP = [
  { min: 8000, grade: 'A+' },
  { min: 6000, grade: 'A' },
  { min: 4500, grade: 'A-' },
  { min: 3000, grade: 'B+' },
  { min: 2000, grade: 'B' },
  { min: 1000, grade: 'B-' },
  { min: 500, grade: 'C+' },
  { min: 0, grade: 'C-' }
];

/**
 * 判断等级
 * @param {number} finalPrice - 最终价格
 * @returns {string} - 等级（A+ 到 C-）
 */
function determineGrade(finalPrice) {
  return GRADE_MAP.find(g => finalPrice >= g.min).grade;
}
```

---

### 5.7 Step 6: 生成特殊标签

```javascript
/**
 * 生成特殊标签（基于特定答案组合）
 * @param {string[]} answers - 8个答案
 * @returns {string|null} - 特殊标签，无则返回 null
 */
function generateSpecialTag(answers) {
  const tags = [];
  
  // Q1-D: 从来没被表白 → 稀缺资产
  if (answers[0] === 'D') tags.push('RARE FIND');
  
  // Q2-A: 一周内恢复 → 高流动性
  if (answers[1] === 'A') tags.push('HIGH LIQUIDITY');
  
  // Q2-D: 还没恢复过 → 长期持有价值
  if (answers[1] === 'D') tags.push('LONG-TERM VALUE');
  
  // Q3-C: 互相暗示谁都不说 → 信息不对称
  if (answers[2] === 'C') tags.push('ASYMMETRIC INFO');
  
  // Q4-D: 经常忘回消息 → 神秘溢价
  if (answers[3] === 'D') tags.push('MYSTERY PREMIUM');
  
  // Q5-D: 没有前任 → 未上市原始股
  if (answers[4] === 'D') tags.push('PRE-IPO ASSET');
  
  // 只返回第一个标签（MVP简化）
  return tags.length > 0 ? tags[0] : null;
}
```

---

### 5.8 Step 7: 生成K线图数据

**决策：** 后端生成 30 个数据点，基于股票类型

```javascript
// backend/src/services/chart.js

/**
 * 生成K线图数据（30个数据点）
 * @param {string} stockType - 股票类型
 * @returns {number[]} - 30个数据点（0-52 范围，用于 SVG 绘制）
 */
export function generateChartData(stockType) {
  const points = [];
  let current = 30;  // 起始点（中间位置）
  
  // 根据股票类型设置波动参数
  const params = {
    'Blue Chip': { trend: 0.3, volatility: 2 },       // 平稳上升，小波动
    'Growth Stock': { trend: 0.5, volatility: 5 },    // 整体上升，中等震荡
    'Concept Stock': { trend: 0.2, volatility: 8 },   // 大起大落，高波动
    'Defensive Stock': { trend: 0.1, volatility: 1 }  // 几乎水平，极低波动
  };
  
  const { trend, volatility } = params[stockType] || params['Growth Stock'];
  
  for (let i = 0; i < 30; i++) {
    // 添加趋势（向下漂移，因为 SVG 坐标系 y 轴向下）
    current -= trend;
    
    // 添加随机波动
    const change = (Math.random() - 0.5) * volatility * 2;
    current += change;
    
    // 限制在 SVG 可视范围内（0-52）
    current = Math.max(2, Math.min(50, current));
    
    points.push(Math.round(current));
  }
  
  return points;
}
```

---

### 5.9 完整估值函数

```javascript
// backend/src/services/valuation.js
import { generateChartData } from './chart.js';

/**
 * 完整估值计算
 * @param {string[]} answers - 8个答案
 * @param {string} username - 用户名（用于生成 ticker）
 * @returns {object} - 完整估值结果
 */
export function calculateValuation(answers, username) {
  // Step 1: 计算基础分值
  const baseScore = calculateBaseScore(answers);
  
  // Step 2: 判断股票类型
  const stockType = determineStockType(answers);
  
  // Step 3: 生成最终价格
  const finalPrice = calculateFinalPrice(baseScore, stockType);
  
  // Step 4: 计算涨跌幅
  const changePercent = calculateChangePercent(answers, baseScore);
  
  // Step 5: 判断等级
  const grade = determineGrade(finalPrice);
  
  // Step 6: 生成特殊标签
  const specialTag = generateSpecialTag(answers);
  
  // Step 7: 生成K线图数据
  const chartData = generateChartData(stockType);
  
  // Step 8: 生成 Ticker（股票代号）
  const ticker = generateTicker(username);
  
  return {
    ticker,
    final_price: finalPrice,
    change_percent: changePercent,
    stock_type: stockType,
    grade,
    special_tag: specialTag,
    chart_data: chartData
  };
}

/**
 * 生成股票代号
 * @param {string} username - 用户名
 * @returns {string} - 如 "$ALEX" 或 "$USER"
 */
function generateTicker(username) {
  if (!username) return '$USER';
  
  // 取前3-4个字母，转大写
  const cleaned = username.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const ticker = cleaned.slice(0, 4) || 'USER';
  
  return `$${ticker}`;
}
```

---

## 6. OpenRouter 调用规范

### 6.1 配置参数

```javascript
// backend/src/services/openrouter.js

const OPENROUTER_CONFIG = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'google/gemini-2.0-flash-001',  // 确认模型ID有效（2026-03）
  timeout: 8000,  // 8秒超时
  fallbackComment: 'Market trajectory remains uncertain but long-term fundamentals show promise'
};
```

---

### 6.2 Prompt 模板（英文）

```javascript
/**
 * 构建 OpenRouter Prompt（Bloomberg 分析师风格）
 */
function buildPrompt(stockType, finalPrice, grade, specialTag) {
  return `You are a deadpan financial analyst covering the dating market. 
Based on the user's stock profile, write ONE sentence of analysis (max 25 words).

User profile:
- Stock type: ${stockType}
- Valuation: $${finalPrice}
- Grade: ${grade}
- Special tag: ${specialTag || 'none'}

Rules:
- Sound like a serious Bloomberg analyst describing something absurd
- Must include a finance/market term
- Max 25 words
- Output the sentence only, no punctuation at the end

Examples:
- "Emotionally stable to the point where the market questions if this asset is too good to be true"
- "High volatility with unpredictable returns but investors keep coming back for the adrenaline"
- "Defensive posture suggests resilience though limited upside potential in bull markets"
- "Pre-IPO asset with unproven track record yet commands premium valuation from early believers"`;
}
```

---

### 6.3 调用实现（带超时和降级）

```javascript
/**
 * 生成 AI 点评（带超时和降级兜底）
 * @param {string} stockType
 * @param {number} finalPrice
 * @param {string} grade
 * @param {string|null} specialTag
 * @returns {Promise<string>} - AI 生成的点评，超时则返回兜底文案
 */
export async function generateComment(stockType, finalPrice, grade, specialTag) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_CONFIG.timeout);
  
  try {
    const prompt = buildPrompt(stockType, finalPrice, grade, specialTag);
    
    const response = await fetch(OPENROUTER_CONFIG.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://lovestock.vercel.app',
        'X-Title': 'LoveStock Exchange'
      },
      body: JSON.stringify({
        model: OPENROUTER_CONFIG.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.9
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    
    const data = await response.json();
    const comment = data.choices?.[0]?.message?.content?.trim();
    
    if (!comment) {
      throw new Error('Empty response from OpenRouter');
    }
    
    return comment;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('OpenRouter timeout after 8s');
    } else {
      console.error('OpenRouter error:', error.message);
    }
    
    // 降级：返回兜底文案
    return OPENROUTER_CONFIG.fallbackComment;
  }
}
```

---

### 6.4 错误处理策略

**策略：不重试，直接降级**

**理由：**
- OpenRouter Gemini Flash 通常 2-3 秒响应，8 秒足够
- 用户体验优先：不让用户等待过长时间
- 兜底文案质量可接受，不影响核心功能

**日志记录：**
```javascript
// 在 catch 块中记录详细错误
console.error('OpenRouter error:', {
  timestamp: new Date().toISOString(),
  stockType,
  finalPrice,
  error: error.message,
  fallback: 'using default comment'
});
```

---

### 6.5 模型 ID 验证清单

**部署前检查：**
1. 访问 https://openrouter.ai/models
2. 搜索 `gemini-2.0-flash-001` 或 `gemini-2.5-flash`
3. 确认模型状态为 `Active`
4. 确认模型 ID 拼写正确（区分大小写）
5. 更新 `OPENROUTER_CONFIG.model`

**当前已知状态（2026-03）：**
- ❌ `google/gemini-2.0-flash-exp` - 已下线
- ✅ `google/gemini-2.0-flash-001` - 可用
- ✅ `google/gemini-2.5-flash` - 可用（更新版本）

---

---

## 7. 环境变量清单

### 7.1 后端环境变量（Railway）

```bash
# ========== 数据库配置 ==========
# Railway 内网地址（生产环境）
DB_HOST=mysql.railway.internal
DB_PORT=3306
DB_NAME=lovestock
DB_USER=root
DB_PASSWORD=<Railway自动生成>

# ========== OpenRouter API ==========
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# ========== 应用配置 ==========
APP_URL=https://lovestock.vercel.app
NODE_ENV=production
PORT=3000

# ========== Telegram（用于验证 initData）==========
BOT_TOKEN=<你的Bot Token>
```

---

### 7.2 本地开发环境变量（.env）

```bash
# ========== 数据库配置 ==========
# Railway 公网地址（本地开发）
DB_HOST=containers-us-west-xxx.railway.app
DB_PORT=7890
DB_NAME=lovestock
DB_USER=root
DB_PASSWORD=<同生产环境>

# ========== OpenRouter API ==========
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# ========== 应用配置 ==========
APP_URL=http://localhost:5173
NODE_ENV=development
PORT=3000

# ========== Telegram ==========
BOT_TOKEN=<你的Bot Token>
```

**⚠️ 关键区别：**
- **DB_HOST**：Railway 内网 vs 公网地址
- **DB_PORT**：3306 vs 公网端口
- **APP_URL**：生产域名 vs localhost

---

### 7.3 前端配置（config.js）

```javascript
// frontend/config.js
const CONFIG = {
  // ⚠️ 直接写死生产地址，本地开发时手动改这一行
  // 原因：Telegram Mini App 的 window.location.hostname 不可靠
  API_BASE_URL: 'https://lovestock-api.railway.app',  // 本地开发时改为 http://localhost:3000
  
  BLINK_BOT_URL: 't.me/BlinkBot?start=lovestock'
};
```

**为什么不用自动检测环境：**
- ❌ `window.location.hostname === 'localhost'` 在 Telegram 内嵌浏览器里不可靠
- ✅ 直接写死生产地址，本地开发时手动改一行即可

**不使用 Vercel 环境变量的原因：**
- 纯静态部署，无构建工具
- 配置简单，易于本地开发切换

---

### 7.4 环境变量加载（Node.js）

```javascript
// backend/server.js（第一行）
import 'dotenv/config';

// 验证必需的环境变量
const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'OPENROUTER_API_KEY',
  'BOT_TOKEN'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

console.log('Environment variables loaded successfully');
```

---

### 7.5 .env 安全检查清单

**初始化顺序（严格遵守）：**
1. `git init`
2. 创建 `.gitignore`，写入 `.env`
3. 才能创建 `.env` 文件

**push 前检查：**
```powershell
# Windows PowerShell
git ls-files | Select-String ".env"
```

**如果 .env 已被 git 追踪：**
```bash
git rm --cached .env
git commit -m "Remove .env from git"
```

**如果 .env 已泄露到 GitHub：**
1. 立即轮换所有密钥（BOT_TOKEN、OPENROUTER_API_KEY、DB_PASSWORD）
2. 删除仓库重建（或使用 git filter-repo 清理历史）

---

## 8. 部署配置

### 8.1 Railway 部署（后端 API）

#### **Step 1: 创建 Railway Project**
1. 登录 Railway，创建新 Project：`LoveStock`
2. 在同一 Project 内添加两个服务：
   - MySQL 数据库
   - Node.js 服务（后端 API）

#### **Step 2: 配置 MySQL 服务**
1. Railway 自动生成内网地址：
   ```
   mysql.railway.internal:3306
   ```
2. 记录公网地址（本地开发用）：
   ```
   containers-us-west-xxx.railway.app:7890
   ```
3. 执行初始化 SQL（通过 Railway 控制台或本地连接）：
   ```bash
   mysql -h <公网地址> -P <公网端口> -u root -p < backend/init.sql
   ```

#### **Step 3: 配置 Node.js 服务**
1. 连接 GitHub repo，设置根目录为 `backend/`
2. 配置环境变量（见 7.1 节）
3. 设置启动命令（Railway 自动检测 `package.json`）：
   ```json
   {
     "scripts": {
       "start": "node server.js"
     }
   }
   ```
4. 部署后获得域名：`https://lovestock-api.railway.app`

#### **Step 4: 验证部署**
```bash
# 测试健康检查（可选添加 /health 端点）
curl https://lovestock-api.railway.app/health

# 预期响应
{"status": "ok", "timestamp": "2026-03-18T..."}
```

---

### 8.2 Vercel 部署（前端 Mini App）

#### **Step 1: 导入 GitHub Repo**
1. 登录 Vercel，Import Project
2. 设置 Root Directory：`frontend/`

#### **Step 2: 构建配置**
```json
// frontend/vercel.json（可选）
{
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

**如果使用纯静态文件（无构建）：**
- Build Command：留空
- Output Directory：留空（默认为根目录）

#### **Step 3: 部署**
1. 点击 Deploy
2. 获得域名：`https://lovestock.vercel.app`
3. 在 `frontend/config.js` 中更新 `API_BASE_URL`

#### **Step 4: 更新后端 CORS 配置**
```javascript
// backend/server.js
const allowedOrigins = [
  'https://lovestock.vercel.app',  // ✅ 更新为实际域名
  'http://localhost:5173'
];
```

#### **Step 5: 测试 Mini App**
1. 创建 Telegram Bot（如果尚未创建）
2. 配置 Bot 发送按钮：
   ```javascript
   // bot/bot.js
   bot.command('start', async (ctx) => {
     await ctx.reply('💹 Welcome to LoveStock Exchange!', {
       reply_markup: {
         inline_keyboard: [[
           { 
             text: 'Open LoveStock', 
             web_app: { url: 'https://lovestock.vercel.app' } 
           }
         ]]
       }
     });
   });
   ```

---

### 8.3 Bot 部署（可选）

**如果需要 Bot 发送入口消息：**

#### **部署到 Railway（与 API 同 Project）**
1. 添加第三个服务：Node.js（bot）
2. 连接 GitHub repo，设置根目录为 `bot/`
3. 配置环境变量：
   ```bash
   BOT_TOKEN=<你的Bot Token>
   ```
4. 启动命令：
   ```json
   {
     "scripts": {
       "start": "node bot.js"
     }
   }
   ```

#### **bot/bot.js 示例代码**
```javascript
import { Bot } from 'grammy';
import 'dotenv/config';

const bot = new Bot(process.env.BOT_TOKEN);

bot.command('start', async (ctx) => {
  await ctx.reply(
    '💹 *Welcome to LoveStock Exchange*\n\n' +
    'Find out your real market value in the dating economy.\n' +
    '8 questions. Ruthlessly scientific. Slightly unhinged.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { 
            text: '📊 Get My Valuation', 
            web_app: { url: 'https://lovestock.vercel.app' } 
          }
        ]]
      }
    }
  );
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

bot.start();
console.log('LoveStock Bot is running...');
```

---

### 8.4 部署检查清单

**部署前：**
- [ ] 确认 OpenRouter 模型 ID 有效（访问 openrouter.ai/models）
- [ ] 本地测试通过（`npm run dev`）
- [ ] `.env` 文件未被 git 追踪
- [ ] 所有环境变量已配置

**部署后：**
- [ ] 后端 API 健康检查通过
- [ ] 前端可以正常访问（无 404）
- [ ] CORS 配置正确（浏览器控制台无错误）
- [ ] 从 Telegram Bot 打开 Mini App 正常
- [ ] 提交答题后能正常返回结果
- [ ] 数据库正确存储结果

---

## 9. 风险预审

### 9.1 Telegram initData 验证失败

**问题描述：**
`X-Telegram-Init-Data` 无法在后端正确验证，返回 401 错误

**原因：**
1. BOT_TOKEN 未配置或错误
2. 签名计算逻辑错误
3. initData 过期（超过 24 小时）
4. 本地开发时未使用真实的 Telegram 环境

**预防措施：**
- 使用官方验证方法（HMAC-SHA256）
- 测试时使用 Telegram Web App Debugger：
  ```
  https://core.telegram.org/bots/webapps#testing-web-apps
  ```
- 开发环境可临时跳过验证（**生产环境必须启用**）：
  ```javascript
  // backend/server.js（仅开发环境）
  const authMiddleware = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      req.telegramUser = { id: 123456789, username: 'testuser' };
      return next();
    }
    // 生产环境正常验证
    const user = validateTelegramInitData(req.headers['x-telegram-init-data']);
    if (!user) return res.status(401).json({ success: false, error: 'INVALID_INIT_DATA' });
    req.telegramUser = user;
    next();
  };
  ```

**如果验证失败：**
- 前端显示通用错误页，不暴露原因（安全考虑）
- 后端日志记录详细错误信息

---

### 9.2 CORS 跨域问题

**问题描述：**
前端（Vercel）请求后端（Railway）被浏览器拦截

**错误信息：**
```
Access to fetch at 'https://lovestock-api.railway.app/api/init' from origin 'https://lovestock.vercel.app' 
has been blocked by CORS policy
```

**预防措施：**
- 后端必须在路由之前配置 CORS 中间件（见 4.7 节）
- 确保 `allowedOrigins` 包含前端域名
- 处理 OPTIONS 预检请求

**调试方法：**
```bash
# 测试 CORS 配置
curl -H "Origin: https://lovestock.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Telegram-Init-Data" \
     -X OPTIONS \
     https://lovestock-api.railway.app/api/valuation

# 预期响应头包含
# Access-Control-Allow-Origin: https://lovestock.vercel.app
```

---

### 9.3 MySQL JSON 序列化坑

**问题描述：**
使用 JSON 类型列时，写入对象变成 `[object Object]`

**错误示例：**
```javascript
// ❌ 错误
CREATE TABLE users (chart_data JSON NOT NULL);
await db.execute('INSERT INTO users (chart_data) VALUES (?)', [chartData]);
// 结果：chart_data = "[object Object]"
```

**正确做法（来自 CLAUDE.md）：**
```javascript
// ✅ 正确
CREATE TABLE users (chart_data LONGTEXT NOT NULL);
await db.execute('INSERT INTO users (chart_data) VALUES (?)', [JSON.stringify(chartData)]);
```

**预防措施：**
- 所有 JSON 数据必须使用 LONGTEXT 存储
- 写入前 `JSON.stringify()`
- 读取后 `JSON.parse()`

---

### 9.4 OpenRouter 模型 ID 过期

**问题描述：**
`google/gemini-2.0-flash-exp` 已下线，导致 API 调用失败

**预防措施：**
- 部署前访问 openrouter.ai/models 确认模型 ID
- 当前可用（2026-03）：
  - ✅ `google/gemini-2.0-flash-001`
  - ✅ `google/gemini-2.5-flash`
- 后端使用兜底文案机制（见 6.3 节）

**更新流程：**
1. 确认新模型 ID
2. 更新 `OPENROUTER_CONFIG.model`
3. 测试调用是否成功
4. 重新部署

---

### 9.5 Railway 内网 vs 公网地址混用

**问题描述：**
- 本地开发用内网地址 → 连接超时
- Railway 服务用公网地址 → 浪费流量，可能不稳定

**预防措施：**
```javascript
// backend/src/db/pool.js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,  // 根据环境自动切换
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
```

**环境变量区分：**
- 本地 `.env`：公网地址 + 公网端口
- Railway 环境变量：`mysql.railway.internal` + `3306`

---

### 9.6 K线图 SVG 生成性能

**问题描述：**
前端实时生成复杂 SVG 可能卡顿

**解决方案：**
- ✅ 后端生成数据点（30 个），前端只负责渲染
- 数据点控制在 30-50 个
- 使用简单的 `<polyline>` 而非复杂路径

**前端渲染示例：**
```javascript
function renderChart(chartData) {
  // chartData: [42, 38, 46, 32, ...]
  const width = 400;
  const height = 52;
  const step = width / (chartData.length - 1);
  
  const points = chartData
    .map((y, i) => `${i * step},${y}`)
    .join(' ');
  
  return `<polyline points="${points}" fill="none" stroke="#c8ff00" stroke-width="1.5"/>`;
}
```

---

### 9.7 前端快速连点选项

**问题描述：**
用户快速点击导致答案重复提交

**预防措施（已在 demo 中实现）：**
```javascript
let isLocked = false;

function handleAnswer(answerIndex) {
  if (isLocked) return;  // 防止重复点击
  isLocked = true;
  
  // 选中后禁用按钮 300ms
  setTimeout(() => {
    // 切换到下一题
    isLocked = false;
  }, 300);
}
```

---

### 9.8 Telegram Mini App 首次加载白屏

**问题描述：**
`Telegram.WebApp` 未初始化完成就调用 API

**预防措施：**
```javascript
// frontend/app.js
const LoveStock = {
  init() {
    // 必须先初始化 Telegram SDK
    const tg = window.Telegram.WebApp;
    tg.ready();      // ← 关键：通知 Telegram 加载完成
    tg.expand();     // ← 展开为全屏
    
    // 然后再调用后端 API
    this.checkInit();
  }
};

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
  LoveStock.init();
});
```

---

### 9.9 数据库连接池耗尽

**问题描述：**
高并发时连接未正确释放，导致后续请求超时

**预防措施：**
```javascript
// backend/src/models/user.js
async function saveUserResult(userId, telegramUser, valuation, answers) {
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    // 执行数据库操作
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();  // ← 关键：必须释放连接
  }
}
```

---

### 9.10 Bot 和 Railway 服务冲突（409 Conflict）

**问题描述：**
本地运行 `node bot.js` 时，Railway 上的 Bot 实例也在运行，导致冲突

**预防措施：**
- 本地开发时不要运行 Bot 服务
- 检查本地 Node 进程：
  ```powershell
  Get-Process node | ForEach-Object { 
    (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine 
  }
  ```
- Cursor 自己的 tsserver 进程不用管

**如果需要本地测试 Bot：**
- 临时停止 Railway 上的 Bot 服务
- 或创建单独的测试 Bot Token

---

## 10. 前端 APP 命名空间

### 10.1 全局对象结构

```javascript
// frontend/app.js

/**
 * LoveStock 全局命名空间
 * 封装所有前端逻辑，避免全局污染
 */
const LoveStock = {
  // ========== 配置 ==========
  config: CONFIG,  // 来自 config.js
  
  // ========== 状态 ==========
  state: {
    currentQuestion: 0,          // 当前题目索引（0-7）
    answers: [],                 // 用户答案数组
    isLocked: false,             // 防止快速连点
    telegramUser: null,          // Telegram 用户信息
    hasHistoryResult: false,     // 是否有历史结果
    historyResult: null          // 历史结果数据
  },
  
  // ========== 题库 ==========
  questions: [
    {
      q: "How long ago were you last confessed to?",
      opts: [
        "Within the last month",
        "Sometime this year",
        "Can't really remember",
        "Never happened, I think"
      ]
    },
    {
      q: "After a breakup, how fast do you bounce back?",
      opts: [
        "Under a week — I'm a professional",
        "A month, give or take",
        "Several months of fog",
        "Still loading..."
      ]
    },
    {
      q: "In a relationship, you're usually...",
      opts: [
        "The one doing the chasing",
        "The one being chased",
        "Mutual pining until someone cracks",
        "Whatever the universe decides"
      ]
    },
    {
      q: "Your average reply time to a text?",
      opts: [
        "Instant — I have no self-control",
        "A few minutes, casually",
        "When I remember",
        "My read receipts are off for a reason"
      ]
    },
    {
      q: "Your ex would most likely describe you as...",
      opts: [
        "Too clingy, honestly",
        "A little cold, but fair",
        "Perfect — they just weren't ready",
        "I have no ex. I am the ex."
      ]
    },
    {
      q: "Your ideal weekend looks like?",
      opts: [
        "Loud, crowded, maximum people",
        "A small group, good vibes",
        "Home, solo, do not disturb",
        "Purely depends on my mood"
      ]
    },
    {
      q: "In a relationship, what matters most?",
      opts: [
        "Being truly understood",
        "Stability and safety",
        "Space to be yourself",
        "Growing together"
      ]
    },
    {
      q: "Your biggest relationship asset is...",
      opts: [
        "I'm the fun one, always",
        "Reliable as a Swiss clock",
        "Radically self-sufficient",
        "All-in when I'm in"
      ]
    }
  ],
  
  // ========== 加载消息 ==========
  loadingMessages: [
    "Auditing emotional volatility...",
    "Checking dividend history...",
    "Pricing attachment style...",
    "Consulting the love index...",
    "Calibrating mystery premium...",
    "Running IPO risk assessment...",
    "Finalizing your valuation..."
  ],
  
  // ========== 初始化 ==========
  init() {
    this.initTelegramSDK();
    this.checkInit();
  },
  
  // ========== Telegram SDK 初始化 ==========
  initTelegramSDK() {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();  // 防止误关闭
    
    this.state.telegramUser = tg.initDataUnsafe.user;
    
    // 设置主题色
    tg.setHeaderColor('#0a0813');
    tg.setBackgroundColor('#0e0b14');
  },
  
  // ========== 检查初始化状态 ==========
  async checkInit() {
    try {
      const tg = window.Telegram.WebApp;
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/init`, {
        headers: { 'X-Telegram-Init-Data': tg.initData }
      });
      
      const json = await response.json();
      
      if (!json.success) {
        this.showError('Authentication failed');
        return;
      }
      
      if (json.data.has_result) {
        // 有历史结果，直接跳结果页
        this.state.hasHistoryResult = true;
        this.state.historyResult = json.data.result;
        this.navigateTo('result');
      } else {
        // 首次用户，显示欢迎页
        this.navigateTo('welcome');
        this.bindEvents();
      }
      
    } catch (error) {
      console.error('Init error:', error);
      this.showError('Failed to connect to server');
    }
  },
  
  // ========== 页面导航 ==========
  navigateTo(page) {
    const container = document.getElementById('ls-page');
    container.innerHTML = '';
    
    switch (page) {
      case 'welcome':
        this.renderWelcomePage(container);
        break;
      case 'quiz':
        this.renderQuizPage(container);
        break;
      case 'loading':
        this.renderLoadingPage(container);
        break;
      case 'result':
        this.renderResultPage(container);
        break;
    }
  },
  
  // ========== 事件绑定 ==========
  bindEvents() {
    const startBtn = document.getElementById('ls-startbtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startQuiz());
    }
  },
  
  // ========== 开始答题 ==========
  startQuiz() {
    this.state.currentQuestion = 0;
    this.state.answers = [];
    this.state.isLocked = false;
    this.navigateTo('quiz');
  },
  
  // ========== 处理答案选择 ==========
  handleAnswer(answerIndex) {
    if (this.state.isLocked) return;
    
    this.state.isLocked = true;
    this.state.answers.push(['A', 'B', 'C', 'D'][answerIndex]);
    
    // 视觉反馈
    const buttons = document.querySelectorAll('.ls-opt');
    buttons[answerIndex].classList.add('ls-picked');
    buttons.forEach((btn, i) => {
      if (i !== answerIndex) btn.classList.add('ls-dimmed');
    });
    
    setTimeout(() => {
      if (this.state.currentQuestion < 7) {
        // 下一题
        this.state.currentQuestion++;
        this.state.isLocked = false;
        this.renderQuestion();
      } else {
        // 答题完成，提交
        this.submitAnswers();
      }
    }, 500);
  },
  
  // ========== 提交答案 ==========
  async submitAnswers() {
    this.navigateTo('loading');
    
    try {
      // 并行执行：API 调用 + 加载动画（提升用户体验）
      const [json] = await Promise.all([
        this.callValuationAPI(),
        this.simulateLoading()  // 至少播放完整动画
      ]);
      
      if (!json.success) {
        this.showError('Failed to calculate valuation');
        return;
      }
      
      this.state.historyResult = json.data;
      this.navigateTo('result');
      
    } catch (error) {
      console.error('Submit error:', error);
      this.showError('Network error');
    }
  },
  
  // ========== 调用估值 API ==========
  async callValuationAPI() {
    const tg = window.Telegram.WebApp;
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/valuation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      },
      body: JSON.stringify({ answers: this.state.answers })
    });
    
    return response.json();
  },
  
  // ========== 模拟加载动画 ==========
  async simulateLoading() {
    return new Promise(resolve => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 1.4;
        const bar = document.getElementById('ls-lbar');
        const msg = document.getElementById('ls-lmsg');
        
        if (bar) bar.style.width = Math.min(progress, 100) + '%';
        
        const msgIndex = Math.min(
          Math.floor((progress / 100) * this.loadingMessages.length),
          this.loadingMessages.length - 1
        );
        if (msg) msg.textContent = this.loadingMessages[msgIndex];
        
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(resolve, 400);
        }
      }, 35);
    });
  },
  
  // ========== 错误提示 ==========
  showError(message) {
    const container = document.getElementById('ls-page');
    container.innerHTML = `
      <div class="ls-error">
        <div class="ls-error-icon">⚠️</div>
        <div class="ls-error-title">Something went wrong</div>
        <div class="ls-error-msg">${message}</div>
        <button class="ls-btn" onclick="location.reload()">Try Again</button>
      </div>
    `;
  },
  
  // ========== 渲染函数（省略具体实现，与 demo 一致）==========
  renderWelcomePage(container) { /* ... */ },
  renderQuizPage(container) { /* ... */ },
  renderLoadingPage(container) { /* ... */ },
  renderResultPage(container) { /* ... */ },
  renderQuestion() { /* ... */ }
};

// ========== 页面加载后初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  LoveStock.init();
});
```

---

### 10.2 关键方法说明

| 方法 | 作用 | 调用时机 |
|------|------|----------|
| `init()` | 初始化应用 | 页面加载时 |
| `initTelegramSDK()` | 初始化 Telegram Web App SDK | `init()` 内部 |
| `checkInit()` | 调用 `/api/init` 检查历史结果 | `init()` 内部 |
| `navigateTo(page)` | 切换页面 | 用户交互时 |
| `startQuiz()` | 开始答题 | 点击「Get My Valuation」按钮 |
| `handleAnswer(index)` | 处理答案选择 | 点击选项按钮 |
| `submitAnswers()` | 提交答案到后端 | 答完第8题后 |
| `simulateLoading()` | 模拟加载动画 | 提交答案后 |
| `showError(message)` | 显示错误页 | API 调用失败时 |

---

### 10.3 状态管理规范

**不可变状态更新：**
```javascript
// ❌ 错误：直接修改状态
this.state.answers.push('A');

// ✅ 正确：记录后再更新
const answer = ['A', 'B', 'C', 'D'][answerIndex];
this.state.answers.push(answer);
```

**状态重置：**
```javascript
// 用户点击「重新计算」按钮时
resetState() {
  this.state.currentQuestion = 0;
  this.state.answers = [];
  this.state.isLocked = false;
  this.state.hasHistoryResult = false;
  this.state.historyResult = null;
}
```

---

### 10.4 HTML 结构约定

**关键元素 ID：**
```html
<!-- 主容器 -->
<div class="ls-scene" id="ls-scene">
  <div class="ls-tape">...</div>
  <div id="ls-page">...</div>  <!-- 页面内容动态渲染 -->
</div>
```

**动态渲染的子元素 ID：**
- `#ls-startbtn` - 开始按钮
- `#ls-pfill` - 进度条填充
- `#ls-ca` - 当前题目卡片
- `#ls-opts` - 选项容器
- `#ls-lbar` - 加载进度条
- `#ls-lmsg` - 加载消息

---

### 10.5 CSS 类名约定

**页面容器类：**
- `.ls-welcome` - 欢迎页
- `.ls-quiz` - 答题页
- `.ls-loading` - 加载页
- `.ls-result` - 结果页
- `.ls-error` - 错误页

**状态类：**
- `.ls-picked` - 已选中的选项
- `.ls-dimmed` - 未选中的选项（变暗）
- `.fly-left` - 卡片飞出动画

---

## 11. 总结与检查清单

### 11.1 开发流程

```
1. 初始化项目
   ├── git init
   ├── 创建 .gitignore（包含 .env）
   ├── 创建 .env 文件
   └── npm install

2. 数据库初始化
   ├── Railway 创建 MySQL 服务
   ├── 执行 init.sql
   └── 配置环境变量

3. 后端开发
   ├── 实现 API 端点
   ├── 实现估值算法
   ├── 实现 OpenRouter 调用
   └── 本地测试

4. 前端开发
   ├── 分离 HTML/CSS/JS
   ├── 实现 LoveStock 命名空间
   ├── 对接后端 API
   └── 本地测试

5. 部署
   ├── Railway 部署后端
   ├── Vercel 部署前端
   ├── 更新 CORS 配置
   └── 端到端测试

6. Bot 集成（可选）
   ├── 创建 Telegram Bot
   ├── 配置 Web App 按钮
   └── Railway 部署 Bot
```

---

### 11.2 上线前检查清单

**代码层面：**
- [ ] 所有敏感信息从环境变量读取
- [ ] `.env` 文件未被 git 追踪
- [ ] CORS 配置包含生产域名
- [ ] OpenRouter 模型 ID 有效
- [ ] 数据库表使用 LONGTEXT 存 JSON
- [ ] 所有数据库连接正确释放

**功能层面：**
- [ ] 用户首次打开能正常初始化
- [ ] 用户有历史结果时能正常显示
- [ ] 答题流程流畅无卡顿
- [ ] 提交答案后能正常返回结果
- [ ] K线图正确渲染
- [ ] AI 点评正常生成（或使用兜底文案）
- [ ] 重新测试能覆盖旧结果

**部署层面：**
- [ ] Railway 后端健康检查通过
- [ ] Vercel 前端可访问
- [ ] 从 Telegram Bot 打开正常
- [ ] CORS 无报错
- [ ] 数据库正确存储数据

---

### 11.3 下一步优化方向（V0.2+）

**功能增强：**
- 添加分享功能（生成图片卡片）
- 排行榜（查看其他用户估值）
- 多语言支持（中文/英文切换）
- 更多题目和股票类型

**技术优化：**
- 使用 Redis 缓存历史结果
- 添加监控和日志系统
- 优化 OpenRouter 调用（批量生成点评）
- 前端使用构建工具（Vite）

**数据分析：**
- 答题数据分析（热门选项）
- 用户行为追踪（完成率）
- A/B 测试框架

---

**🎉 Tech Design 文档完成！**

本文档覆盖了 LoveStock Telegram Mini App 从技术选型到部署上线的所有关键决策和实现细节。

**文档版本：** v0.1  
**最后更新：** 2026-03-18  
**维护者：** LoveStock Team

---

**附录：相关文档**
- [产品需求文档（PRD）](./LoveStock%20PRD%20v0.1.txt)
- [通用开发规则（CLAUDE.md）](../CLAUDE.md)
- [开发任务清单（task.md）](./task.md)（待创建）
- [变更日志（changelog.md）](./changelog.md)（待创建）
