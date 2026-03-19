## LoveStock 扩展性与容量评估笔记（MVP 版）

**版本：** v0.1  
**最后更新：** 2026-03-19  
**适用阶段：** MVP 已上线、小流量试运营阶段  

---

## 1. 当前架构简述

- **前端：** 纯静态 HTML/CSS/JS（Vercel），Telegram Mini App 外壳
- **后端：** Node.js 18 + Express（Railway 单实例）
- **数据库：** MySQL（Railway，同一 Project，连接池）
- **AI：** OpenRouter + Gemini Flash（`google/gemini-2.0-flash-001`）
- **主要请求路径：**
  - `GET /api/init`：initData 校验 + 读 `users` 表
  - `POST /api/valuation`：initData 校验 → 算估值 → 调 OpenRouter → 事务写 `users` + `answers`

---

## 2. 关键实现与现状

- **数据库连接池**（`backend/src/db/pool.js`）
  - `connectionLimit: 10`
  - `waitForConnections: true`
  - `queueLimit: 0`（不限队列长度）

- **AI 调用**（`backend/src/services/openrouter.js`）
  - 单次调用超时：8 秒（AbortController）
  - 不重试，失败/超时直接降级为 fallback 文案

- **/api/valuation 路径**（`backend/server.js`）
  1. 验证 `answers`（长度=8，元素∈A/B/C/D）
  2. 使用 `calculateValuation`（纯计算，毫秒级）
  3. `await generateComment(...)`（OpenRouter，2–8 秒）
  4. `await saveUserResult(...)`（MySQL 事务 + upsert）
  5. 返回完整结果 JSON

- **基础防护**
  - Express JSON body 限制：`limit: '100kb'`
  - 必填环境变量缺失时直接 `process.exit(1)`
  - OpenRouter 调用错误/超时均有日志 & 降级处理

---

## 3. 瓶颈分析

### 3.1 技术瓶颈

1. **OpenRouter AI 调用是主瓶颈**
   - 单次请求耗时的主要部分在 AI：
     - initData 验证：≈ 5–10ms
     - DB 读写：≈ 50–150ms
     - OpenRouter：**2,000–8,000ms**
   - `/api/valuation` 当前是**同步等待 AI 结果**后才返回。

2. **数据库连接池上限 10**
   - 理论上只允许最多 ~10 个并发请求在执行 DB 操作。
   - 若请求耗时 8 秒，则池内连接会长时间占用。

3. **连接队列无限长**
   - `queueLimit: 0` 表示**不限制排队长度**，高峰期可能导致大量请求堆积，引起排队延迟和内存压力。

4. **单实例部署（Railway）**
   - 只有 1 个 Node 实例，无多副本 / 无水平扩展。
   - 某次崩溃或偶发 GC 高停顿，会影响所有请求。

### 3.2 粗略容量估算（当前实现）

简单用“连接池 + AI 调用时长”估算 /api/valuation 的吞吐：

- 连接池：10 个连接
- 单个请求平均耗时（保守）：~4 秒

\[
\text{理论最大并发处理数} = \frac{10 \text{ 连接}}{4 \text{ 秒}} \approx 2.5 \text{ req/s}
\]

考虑到：
- Node 事件循环、偶发长尾请求、MySQL 波动、OpenRouter 偶发 timeout

**更保守估计：**
- 稳定 **QPS ≈ 1–2** 比较安全。
- 同一时刻 **5–10 个用户** 同时提交答卷基本没问题。

结合 Telegram Mini App 典型使用模式（多数用户分散在一天内使用，答题只发生 1 次）：

- 若每个用户平均每天只提交 1 次 `/api/valuation`：
  - 峰谷比 ≈ 10:1（高峰时间集中过来）
  - 在高峰 10 分钟内可以安全处理：  
    \( \text{2 req/s} × 600 s = 1200 \text{ 次请求} \)
  - **对应 DAU 量级：≈ 300–500**（考虑到不是所有人都挤在高峰）。

**结论（MVP 阶段）：**
- 目前架构适合：**几百 DAU / 十几并发用户** 的试运营。
- 若要上千 DAU 或有突发流量，需要架构升级（见后文）。

---

## 4. 主要扩展性风险清单（记录用）

> 这些问题在 MVP 阶段可以暂缓，但在 DAU 增长前需要重点处理。

1. **同步阻塞的 AI 调用**
   - 所有用户提交都要等待 OpenRouter 返回。
   - 大量并发会导致响应时间劣化、队列堆积。

2. **连接池与队列策略**
   - `connectionLimit: 10` + `queueLimit: 0`：
     - 好处：不会立刻拒绝请求。
     - 风险：极端情况下队列可能撑爆内存 / 增加尾延迟。

3. **缺少限流与突发保护**
   - `/api/valuation` 没有限流（rate limit）。
   - 一旦被恶意刷或产品上榜，OpenRouter 与 DB 都可能被打爆。

4. **单实例无冗余**
   - Railway 目前应只跑 1 个后端实例。
   - 任何单点问题（崩溃 / 部署中断）都会让服务整体不可用。

5. **监控与预警不足**
   - 没有系统级监控（响应时间、错误率、QPS）和告警。
   - 容量逼近上限时不易提前发现。

---

## 5. 分阶段扩展方案（做计划用）

### 5.1 阶段 A：MVP 小流量（< 500 DAU）

**目标：** 保持实现简单，在已有架构上加最小防护，确保不会“轻易挂掉”。

建议（可以视情况逐步加）：

- 在 `/api/valuation` 上加**简单限流**（按 IP 或 Telegram user_id）：
  - 每分钟最多 N 次（例如 5 次）。
  - 防止恶意刷或用户疯狂重复点击。
- 保持连接池 10 不变，主要依赖 OpenRouter 降级机制。
- 在 Railway 上配置基础监控（错误日志 + 简单响应时间观察）。

### 5.2 阶段 B：公开发布（1K–10K DAU）

**触发条件：** 产品验证有效，有明显增长趋势，预期 DAU 达到 1K+。

核心改动思路：

1. **把 AI 调用从同步改为异步队列（关键）**
   - /api/valuation 步骤变为：
     1. 同步计算估值（不调用 OpenRouter）
     2. 立即返回带 fallback 文案的结果
     3. 后台 Worker 通过队列异步补充/更新 AI 点评
   - 好处：
     - 响应时间 8 秒 → < 200ms
     - 并发能力从 **1–2 req/s → 20–50 req/s**（主要受 DB 限制）

2. **连接池扩容**
   - 把 `connectionLimit` 从 10 提升到 30–50（根据 Railway 实际配置）。

3. **加缓存层（可选，但收益大）**
   - 典型场景：重复打开 Mini App 时，直接从 Redis 读历史结果，减轻 DB 压力。

### 5.3 阶段 C：规模化运营（> 10K DAU）

**仅作为远期规划记录，当前无需实现。**

方向性措施：

- 后端拆分为：
  - API 服务（无 AI 调用，专做鉴权 + DB）
  - AI Worker 服务（消费队列，调 OpenRouter）
- 多实例部署 + 负载均衡：
  - Railway 多副本或迁移到支持自动扩缩容的平台。
- 数据库层：
  - 更大的 MySQL 实例（或读写分离 / 连接池代理）。
  - 更激进的缓存策略（用户结果缓存 + 热点数据缓存）。

---

## 6. 结论（给未来自己的 TL;DR）

- 现在这套实现（同步 AI 调用 + 10 连接池 + 单实例）**足以支撑一个“几百 DAU 的 MVP”**。
- 真正的瓶颈来自 **OpenRouter 的同步调用** 和 **连接池规模**，而不是估值算法或前端。
- 在 DAU 明显接近 1K+ 之前，不需要立刻大改架构；但**一旦看到明显增长曲线，就要优先做：**
  1. 把 AI 调用异步化（队列 + Worker）
  2. 提升连接池上限 & 加限流
  3. 接入基础监控与告警

这份 `scaling-notes.md` 只做“扩展性决策备忘录”，不改变当前 v1.0.0 的实现，为后续 v1.1+ 规划预留空间。

