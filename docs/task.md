# LoveStock 开发任务清单

**版本：** v0.1  
**最后更新：** 2026-03-18  
**状态：** 进行中

---

## 📋 任务总览

共 25 个任务，按开发顺序排列，每个任务只做一件事。

---

## 🏗️ 阶段一：后端基础搭建（Task 1-7）

### Task 1: 初始化项目结构 ✅

**目标：** 创建项目文件夹结构和 git 仓库

**状态：** 已完成

**操作步骤：**
1. 初始化 git 仓库：`git init`
2. 创建 `.gitignore` 文件，添加 `.env`
3. 创建项目目录结构：
   ```
   backend/
   backend/src/
   backend/src/db/
   backend/src/services/
   backend/src/models/
   backend/src/utils/
   ```

**验收标准：**
- [x] git 仓库已初始化
- [x] `.gitignore` 文件存在且包含 `.env`
- [x] 运行 `git ls-files | Select-String ".env"` 无输出
- [x] 所有目录结构已创建

**依赖：** 无

---

### Task 2: 配置后端环境变量和依赖

**目标：** 配置后端开发环境和安装必要依赖

**操作步骤：**
1. 在 `backend/` 创建 `package.json`
2. 安装依赖：
   ```bash
   npm install express mysql2 dotenv cors
   npm install --save-dev nodemon
   ```
3. 创建 `backend/.env` 文件（本地开发用）
4. 配置 `package.json` scripts：
   ```json
   {
     "start": "node server.js",
     "dev": "nodemon server.js"
   }
   ```

**验收标准：**
- [ ] `backend/package.json` 存在且包含所有依赖
- [ ] `backend/.env` 文件存在（包含占位符）
- [ ] `backend/.env` 未被 git 追踪
- [ ] 运行 `npm run dev` 不报错（即使 server.js 为空）

**依赖：** Task 1

---

### Task 3: 创建 MySQL 连接池

**目标：** 实现数据库连接池，支持内网/公网地址切换

**操作步骤：**
1. 在 Railway 创建 MySQL 服务
2. 记录公网地址和内网地址
3. 实现 `backend/src/db/pool.js`
4. 创建环境变量验证逻辑

**验收标准：**
- [ ] Railway MySQL 服务已创建
- [ ] `backend/src/db/pool.js` 实现连接池
- [ ] 使用本地 `.env` 公网地址可成功连接
- [ ] 代码中无硬编码的数据库地址
- [ ] 运行测试查询成功（如 `SELECT 1`）

**依赖：** Task 2

---

### Task 4: 创建数据库表结构

**目标：** 执行初始化 SQL，创建 users 和 answers 表

**操作步骤：**
1. 创建 `backend/init.sql` 文件（见 tech-design.md 第 3.4 节）
2. 通过 Railway 控制台或本地 MySQL 客户端执行 SQL
3. 验证表结构：
   ```sql
   SHOW TABLES;
   DESCRIBE users;
   DESCRIBE answers;
   ```

**验收标准：**
- [ ] `backend/init.sql` 文件存在
- [ ] `users` 表已创建，包含所有字段
- [ ] `answers` 表已创建，包含外键和唯一索引
- [ ] `chart_data` 和 `answers_data` 字段类型为 LONGTEXT
- [ ] 运行 `SHOW TABLES` 显示两张表

**依赖：** Task 3

---

### Task 5: 实现 Express 服务器骨架

**目标：** 创建 Express 服务器，配置 CORS 和基础中间件

**操作步骤：**
1. 创建 `backend/server.js`
2. 配置 CORS 中间件（允许 localhost 和 Vercel 域名）
3. 添加 JSON body parser
4. 添加环境变量验证
5. 添加健康检查端点 `/health`

**验收标准：**
- [ ] 运行 `npm run dev` 服务器启动成功
- [ ] 访问 `http://localhost:3000/health` 返回 `{"status": "ok"}`
- [ ] 控制台显示 "Environment variables loaded successfully"
- [ ] 缺少必需环境变量时服务器拒绝启动

**依赖：** Task 4

---

### Task 6: 实现 Telegram initData 验证

**目标：** 实现 initData 验证逻辑和身份验证中间件

**操作步骤：**
1. 实现 `backend/src/services/validator.js`（见 tech-design.md 第 4.8 节）
2. 实现 HMAC-SHA256 签名验证
3. 实现 24 小时过期检查
4. 创建 `authMiddleware` 中间件
5. 添加开发环境跳过验证的逻辑

**验收标准：**
- [ ] `validator.js` 导出 `validateTelegramInitData` 函数
- [ ] 无效的 initData 返回 null
- [ ] 过期的 initData（>24小时）返回 null
- [ ] 有效的 initData 返回解析后的 user 对象
- [ ] `authMiddleware` 验证失败返回 401

**依赖：** Task 5

---

### Task 7: 实现用户数据 CRUD 操作

**目标：** 实现用户结果的读取和保存函数

**操作步骤：**
1. 实现 `backend/src/models/user.js`
2. 实现 `getUserResult(userId)` 函数
3. 实现 `saveUserResult(userId, telegramUser, valuation, answers)` 函数
4. 使用事务确保数据一致性
5. 正确使用 `JSON.stringify` 和 `JSON.parse`

**验收标准：**
- [ ] `getUserResult` 能正确读取用户结果，不存在返回 null
- [ ] `saveUserResult` 能插入新记录
- [ ] `saveUserResult` 能覆盖旧记录（使用 ON DUPLICATE KEY UPDATE）
- [ ] 所有 JSON 数据正确序列化和反序列化
- [ ] 数据库连接在 finally 块中正确释放
- [ ] 手动插入测试数据后能正确读取

**依赖：** Task 6

---

## 🧮 阶段二：核心估值算法（Task 8-13）

> **⚡ 注意：** Task 8-13 的所有函数逻辑独立，可以在同一个对话中并行实现，无需严格串行依赖。建议一次性完成整个估值算法模块。

### Task 8-13: 实现完整估值算法模块（可并行）

**目标：** 实现从答案到完整估值结果的所有计算逻辑

**操作步骤：**

#### 子任务 8.1: 基础分值计算
1. 创建 `backend/src/services/valuation.js`
2. 定义 `SCORE_MAP`（见 tech-design.md 第 5.2 节）
3. 实现 `calculateBaseScore(answers)` 函数
4. 处理 Q5-D 的随机分值

#### 子任务 8.2: 股票类型判断
1. 定义 `STOCK_TYPE_MAP`（见 tech-design.md 第 5.3 节）
2. 实现 `determineStockType(answers)` 函数
3. 处理默认情况（Growth Stock）

#### 子任务 8.3: 最终价格计算
1. 实现 `calculateFinalPrice(baseScore, stockType)` 函数
2. 实现归一化逻辑（-50 到 +75 映射到 $1 - $9999）
3. 实现股票类型调整系数
4. 添加 ±15% 随机扰动
5. 保留两位小数

#### 子任务 8.4: 涨跌幅和等级计算
1. 实现 `calculateChangePercent(answers, baseScore)` 函数（见 tech-design.md 第 5.5 节）
2. 基于前 5 题的激进程度计算涨跌幅
3. 实现 `determineGrade(finalPrice)` 函数（见 tech-design.md 第 5.6 节）
4. 根据价格区间返回 A+ 到 C-

#### 子任务 8.5: 特殊标签生成
1. 实现 `generateSpecialTag(answers)` 函数（见 tech-design.md 第 5.7 节）
2. 定义 6 种特殊标签规则
3. 只返回第一个匹配的标签

#### 子任务 8.6: K 线图数据生成
1. 创建 `backend/src/services/chart.js`
2. 实现 `generateChartData(stockType)` 函数（见 tech-design.md 第 5.8 节）
3. 根据股票类型设置趋势和波动性
4. 数据点范围限制在 0-52（SVG 坐标范围）

#### 子任务 8.7: 整合完整估值函数
1. 实现 `calculateValuation(answers, username)` 主函数
2. 实现 `generateTicker(username)` 函数
3. 按正确顺序调用所有子函数
4. 返回完整估值结果对象

**验收标准：**

**基础分值计算（8.1）：**
- [ ] 输入 8 个 A 返回正确的总分值
- [ ] 输入 8 个 D 返回正确的总分值（Q5-D 需随机）
- [ ] Q5-D 多次计算返回不同结果（验证随机性）
- [ ] 分值范围在 -50 到 +75 之间

**股票类型判断（8.2）：**
- [ ] 输入 `['A','A','A','A','A','B','B','B']` 返回 "Blue Chip"
- [ ] 输入 `['A','A','A','A','A','A','A','A']` 返回 "Concept Stock"
- [ ] 输入 `['A','A','A','A','A','C','C','C']` 返回 "Defensive Stock"
- [ ] 未匹配的组合返回 "Growth Stock"

**最终价格计算（8.3）：**
- [ ] baseScore = -50 时价格接近 $1
- [ ] baseScore = +75 时价格接近 $9999
- [ ] Blue Chip 价格比 Growth Stock 高约 20%
- [ ] 价格范围严格在 $1.00 - $9999.99
- [ ] 多次调用同一输入返回不同结果（验证随机性）

**涨跌幅和等级（8.4）：**
- [ ] 激进答案（高分）返回接近 +99.9% 的涨跌幅
- [ ] 保守答案（低分）返回接近 -20.0% 的涨跌幅
- [ ] 涨跌幅保留一位小数
- [ ] 价格 $8000+ 返回 A+
- [ ] 价格 $500- 返回 C-
- [ ] 边界价格（如 $4500）返回正确等级

**特殊标签（8.5）：**
- [ ] Q1-D 返回 "RARE FIND"
- [ ] Q2-A 返回 "HIGH LIQUIDITY"
- [ ] Q2-D 返回 "LONG-TERM VALUE"
- [ ] Q5-D 返回 "PRE-IPO ASSET"
- [ ] 无匹配时返回 null
- [ ] 多个匹配时只返回第一个

**K 线图数据（8.6）：**
- [ ] Blue Chip 生成平稳上升曲线（波动小）
- [ ] Concept Stock 生成大起大落曲线（波动大）
- [ ] Defensive Stock 生成接近水平曲线（波动极小）
- [ ] 所有数据点在 0-52 范围内
- [ ] 返回数组长度为 30
- [ ] 多次调用返回不同结果

**完整估值函数（8.7）：**
- [ ] `calculateValuation(['A','A','A','A','A','A','A','A'], 'alex')` 返回完整对象
- [ ] 返回对象包含所有必需字段：ticker, final_price, change_percent, stock_type, grade, special_tag, chart_data
- [ ] ticker 正确生成（如 "$ALEX"）
- [ ] 无 username 时 ticker 为 "$USER"
- [ ] 编写单元测试覆盖核心逻辑

**依赖：** Task 7

---

## 🤖 阶段三：OpenRouter 集成（Task 14-15）

### Task 14: 实现 OpenRouter API 调用

**目标：** 实现 AI 点评生成，带超时和降级

**操作步骤：**
1. 创建 `backend/src/services/openrouter.js`
2. 配置 OpenRouter 参数（模型 ID、超时时间等）
3. 实现 `buildPrompt` 函数（见 tech-design.md 第 6.2 节）
4. 实现 `generateComment` 函数，带 8 秒超时
5. 实现降级逻辑（使用兜底文案）

**验收标准：**
- [ ] 正常调用返回 AI 生成的点评（25 词以内）
- [ ] 超时时返回兜底文案
- [ ] API 错误时返回兜底文案
- [ ] 不重试，直接降级
- [ ] 日志记录错误信息
- [ ] 模型 ID 使用 `google/gemini-2.0-flash-001` 或 `google/gemini-2.5-flash`

**依赖：** Task 13

---

### Task 15: 验证 OpenRouter 模型 ID

**目标：** 确认 OpenRouter 模型 ID 有效

**操作步骤：**
1. 访问 https://openrouter.ai/models
2. 搜索 `gemini-2.0-flash-001` 或 `gemini-2.5-flash`
3. 确认模型状态为 Active
4. 更新 `OPENROUTER_CONFIG.model`
5. 测试调用

**验收标准：**
- [ ] 模型 ID 在 OpenRouter 网站上存在且 Active
- [ ] 测试调用成功返回内容
- [ ] 响应时间在 5 秒以内
- [ ] 兜底逻辑正常工作

**依赖：** Task 14

---

## 🔌 阶段四：API 端点实现（Task 16-17）

### Task 16: 实现 /api/init 端点

**目标：** 实现初始化检查端点

**操作步骤：**
1. 在 `backend/server.js` 添加 GET `/api/init` 路由
2. 使用 `authMiddleware` 验证 initData
3. 查询数据库检查用户是否有历史结果
4. 返回标准 JSON 响应（见 tech-design.md 第 4.5 节）

**验收标准：**
- [ ] 无 initData 返回 401
- [ ] 无效 initData 返回 401
- [ ] 首次用户返回 `has_result: false`
- [ ] 有历史结果用户返回完整结果对象
- [ ] 响应格式符合 API 规范
- [ ] 使用 Postman 测试成功

**依赖：** Task 15

---

### Task 17: 实现 /api/valuation 端点

**目标：** 实现答题提交和估值计算端点

**操作步骤：**
1. 在 `backend/server.js` 添加 POST `/api/valuation` 路由
2. 验证答案格式（8 个选项，每个是 A/B/C/D）
3. 调用估值算法计算结果
4. 调用 OpenRouter 生成 AI 点评
5. 保存结果到数据库
6. 返回完整结果

**验收标准：**
- [ ] 答案格式错误返回 400 + `INVALID_ANSWERS`
- [ ] 答案少于 8 个返回 400
- [ ] 答案包含非法选项（如 "E"）返回 400
- [ ] 正确答案返回完整结果对象
- [ ] 结果正确保存到数据库（覆盖旧记录）
- [ ] AI 点评生成失败时使用兜底文案
- [ ] 响应时间在 10 秒以内

**依赖：** Task 16

---

## 🎨 阶段五：前端开发（Task 18-21）

### Task 18: 前端文件结构分离

**目标：** 从 demo HTML 分离出独立的 CSS 和 JS 文件

**操作步骤：**
1. 将 `frontend_demo.html` 的 CSS 提取到 `frontend/styles.css`
2. 将 JavaScript 提取到 `frontend/app.js`
3. 创建 `frontend/config.js`
4. 更新 `frontend/index.html` 引用外部文件

**验收标准：**
- [ ] `frontend/index.html` 不包含 `<style>` 和 `<script>` 标签
- [ ] `frontend/styles.css` 包含所有样式
- [ ] `frontend/app.js` 包含所有逻辑
- [ ] `frontend/config.js` 包含 API_BASE_URL
- [ ] 本地打开 `index.html` 样式和功能正常

**依赖：** Task 17

---

### Task 19: 实现 LoveStock 命名空间

**目标：** 封装前端逻辑到全局命名空间

**操作步骤：**
1. 创建 `LoveStock` 对象（见 tech-design.md 第 10.1 节）
2. 实现状态管理（state 对象）
3. 实现题库和加载消息配置
4. 实现核心方法：init、navigateTo、handleAnswer 等

**验收标准：**
- [ ] 所有逻辑封装在 `LoveStock` 对象内
- [ ] 无全局变量污染（除了 LoveStock）
- [ ] 状态集中管理在 `state` 对象
- [ ] 页面切换通过 `navigateTo` 方法
- [ ] 代码结构清晰，易于维护

**依赖：** Task 18

---

### Task 20: 实现 API 调用和错误处理

**目标：** 对接后端 API，实现完整的前后端交互

**操作步骤：**
1. 实现 `checkInit()` 调用 `/api/init`
2. 实现 `callValuationAPI()` 调用 `/api/valuation`
3. 实现 `apiCall` 统一封装函数
4. 添加错误处理和重试逻辑
5. 实现加载状态和错误页面

**验收标准：**
- [ ] 首次打开能正确初始化
- [ ] 有历史结果时直接显示结果页
- [ ] 答题完成后正确提交到后端
- [ ] 网络错误显示友好提示
- [ ] 401 错误显示认证失败页
- [ ] 所有 fetch 请求带 `X-Telegram-Init-Data` header

**依赖：** Task 19

---

### Task 21: 实现结果页 K 线图渲染

**目标：** 根据后端返回的数据点渲染 SVG K 线图

**操作步骤：**
1. 实现 `renderChart(chartData)` 函数
2. 生成 SVG `<polyline>` 元素
3. 适配 400x52 画布尺寸
4. 添加渐变和发光效果

**验收标准：**
- [ ] 输入 30 个数据点正确渲染曲线
- [ ] 曲线颜色为 `#c8ff00`（霓虹绿）
- [ ] 曲线平滑连续，无断点
- [ ] 不同数据显示不同走势
- [ ] 移动端显示正常

**依赖：** Task 20

---

## 🚀 阶段六：部署和集成（Task 22-24）

### Task 22: 部署后端到 Railway

**目标：** 将后端 API 部署到 Railway

**操作步骤：**
1. 在 Railway 创建新服务，连接 GitHub repo
2. 设置 Root Directory 为 `backend/`
3. 配置环境变量（见 tech-design.md 第 7.1 节）
4. 设置启动命令：`npm start`
5. 部署并获取域名

**验收标准：**
- [ ] Railway 服务部署成功
- [ ] 访问 `https://<domain>/health` 返回 200
- [ ] `/api/init` 端点可访问
- [ ] `/api/valuation` 端点可访问
- [ ] 后端日志无错误
- [ ] 数据库连接成功（使用内网地址）

**依赖：** Task 21

---

### Task 23: 部署前端到 Vercel

**目标：** 将前端 Mini App 部署到 Vercel

**操作步骤：**
1. 在 Vercel 导入 GitHub repo
2. 设置 Root Directory 为 `frontend/`
3. 配置为静态部署（无构建命令）
4. 部署并获取域名
5. 更新 `frontend/config.js` 中的 API_BASE_URL

**验收标准：**
- [ ] Vercel 部署成功
- [ ] 访问 `https://<domain>` 显示欢迎页
- [ ] 页面样式正常
- [ ] 可以正常答题
- [ ] 能正常请求后端 API（无 CORS 错误）
- [ ] 移动端显示正常

**依赖：** Task 22

---

### Task 24: 创建 Telegram Bot（可选）

**目标：** 创建 Bot 发送 Mini App 入口

**操作步骤：**
1. 通过 @BotFather 创建新 Bot
2. 获取 BOT_TOKEN
3. 创建 `bot/bot.js`（见 tech-design.md 第 8.3 节）
4. 配置 `/start` 命令返回 Web App 按钮
5. 部署到 Railway（与 API 同 project）

**验收标准：**
- [ ] Bot 创建成功
- [ ] 发送 `/start` 返回欢迎消息
- [ ] 点击按钮打开 Vercel 部署的 Mini App
- [ ] Mini App 能正确获取 Telegram 用户信息
- [ ] Bot 部署到 Railway 且运行稳定

**依赖：** Task 23

---

## 🧪 阶段七：测试和优化（Task 25）

### Task 25: 端到端测试

**目标：** 完整测试从 Bot 入口到分享的全流程

**测试场景：**

#### 场景 1：首次用户完整流程
1. 从 Telegram Bot 点击「Open LoveStock」
2. 查看欢迎页（2 秒动画）
3. 点击「Get My Valuation」开始答题
4. 逐题回答 8 道题（测试每道题选项都正常）
5. 查看加载页（进度条和消息）
6. 查看结果页（检查所有字段显示正确）
7. 验证 K 线图渲染正确
8. 验证 AI 点评显示（或兜底文案）

**验收标准：**
- [ ] 整个流程无报错
- [ ] 所有页面跳转流畅
- [ ] 估值结果合理（$1 - $9999 范围）
- [ ] 涨跌幅合理（-20% 到 +99% 范围）
- [ ] 股票类型正确匹配答案
- [ ] 等级正确对应价格区间
- [ ] K 线图正确渲染
- [ ] 数据正确保存到数据库

#### 场景 2：重复用户流程
1. 使用相同 Telegram 账号再次打开 Mini App
2. 验证直接显示上次结果（跳过欢迎和答题页）
3. 检查结果是否与第一次一致

**验收标准：**
- [ ] 直接显示结果页
- [ ] 结果与上次一致
- [ ] 无需重新答题

#### 场景 3：覆盖旧结果
1. 从结果页点击「重新测试」按钮（如果有）
2. 重新答题（选择不同答案）
3. 提交后查看新结果
4. 验证数据库中只有一条记录（旧记录被覆盖）

**验收标准：**
- [ ] 新结果与旧结果不同
- [ ] 数据库中该用户只有一条记录
- [ ] `updated_at` 字段更新

#### 场景 4：边界情况测试
1. 测试所有 A 选项（最高分）
2. 测试所有 D 选项（特殊处理）
3. 测试特殊标签触发条件
4. 测试快速连点选项（防抖）

**验收标准：**
- [ ] 极端答案返回合理结果
- [ ] Q5-D 随机分值每次不同
- [ ] 特殊标签正确生成
- [ ] 快速连点不会选中多个选项

#### 场景 5：错误处理测试
1. 关闭后端服务，测试网络错误
2. 传入无效 initData，测试 401 错误
3. 传入非法答案格式，测试 400 错误

**验收标准：**
- [ ] 网络错误显示友好提示
- [ ] 401 显示认证失败页
- [ ] 400 显示答案格式错误提示
- [ ] 错误页可重试（reload）

#### 场景 6：性能测试
1. 测试答题响应速度（选项点击到下一题显示）
2. 测试加载页时长（API 调用 + 动画）
3. 测试结果页首屏渲染时间

**验收标准：**
- [ ] 答题响应时间 < 500ms
- [ ] 加载页总时长 < 10 秒
- [ ] 结果页首屏渲染 < 2 秒
- [ ] K 线图渲染无卡顿

#### 场景 7：兼容性测试
1. Telegram iOS 客户端测试
2. Telegram Android 客户端测试
3. Telegram Desktop 测试
4. 不同屏幕尺寸测试

**验收标准：**
- [ ] 所有平台功能正常
- [ ] 样式在所有平台显示正确
- [ ] 触摸交互流畅
- [ ] 无浏览器兼容性问题

**依赖：** Task 24

---

## 📊 进度跟踪

| 阶段 | 任务数 | 已完成 | 进行中 | 待开始 |
|------|--------|--------|--------|--------|
| 阶段一：后端基础 | 7 | 1 | 0 | 6 |
| 阶段二：估值算法 | 1 (合并 Task 8-13) | 0 | 0 | 1 |
| 阶段三：OpenRouter | 2 | 0 | 0 | 2 |
| 阶段四：API 端点 | 2 | 0 | 0 | 2 |
| 阶段五：前端开发 | 4 | 0 | 0 | 4 |
| 阶段六：部署集成 | 3 | 0 | 0 | 3 |
| 阶段七：测试优化 | 1 | 0 | 0 | 1 |
| **总计** | **20** | **1** | **0** | **19** |

> **📝 说明：** 原 Task 8-13 已合并为单一 Task 8-13（可并行实现），总任务数从 25 减少到 20。

---

## 🔄 任务依赖关系图

```
Task 1 ✅
  └─> Task 2
       └─> Task 3
            └─> Task 4
                 └─> Task 5
                      └─> Task 6
                           └─> Task 7
                                ├─> Task 8-13 (可并行实现，包含 7 个子任务)
                                │    └─> Task 14
                                │         └─> Task 15
                                │              ├─> Task 16
                                │              │    └─> Task 17
                                │              │         └─> Task 18
                                │              │              └─> Task 19
                                │              │                   └─> Task 20
                                │              │                        └─> Task 21
                                │              │                             └─> Task 22
                                │              │                                  └─> Task 23
                                │              │                                       └─> Task 24
                                │              │                                            └─> Task 25
```

**图例：**
- ✅ = 已完成
- `Task 8-13 (可并行实现)` = 整个模块的所有函数可以在同一对话中一次性实现

---

## 📝 注意事项

### 开发规范
1. **每完成一个 Task 立即 commit**，commit message 格式：`feat: Task N - 描述`
2. **遵循 CLAUDE.md 通用规则**，特别是数据库和 .env 安全规范
3. **遵循 .cursorrules 项目专用规则**，特别是前端 API 调用规范
4. **每个 Task 必须通过验收标准才能标记为完成**
5. **遇到问题先看 tech-design.md 第 9 章（风险预审）**

### 测试策略
- Task 8-13（估值算法）**可在一次对话中并行实现并测试**
- Task 16-17（API 端点）使用 Postman 测试
- Task 18-21（前端）本地浏览器测试
- Task 22-24（部署）生产环境测试
- Task 25（端到端）真实 Telegram 环境测试

### 常见问题参考
- 数据库 JSON 存储问题 → tech-design.md 第 3.2 节
- CORS 配置问题 → tech-design.md 第 4.7 节
- initData 验证问题 → tech-design.md 第 9.1 节
- OpenRouter 超时问题 → tech-design.md 第 6.3 节

---

**文档版本：** v0.1  
**创建日期：** 2026-03-18  
**维护者：** LoveStock Team

---

**相关文档：**
- [产品需求文档（PRD）](./LoveStock%20PRD%20v0.1.txt)
- [技术设计文档（Tech Design）](./tech-design.md)
- [通用开发规则（CLAUDE.md）](./CLAUDE.md)
- [项目专用规则（.cursorrules）](../.cursorrules)
