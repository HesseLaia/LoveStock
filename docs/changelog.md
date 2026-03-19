# LoveStock 变更日志

所有重要的项目变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.0] - 2026-03-19

### 🎉 上线

**功能特性：**
- ✅ 完整答题流程（8题）
  - 前5题：恋爱市场行为问题
  - 后3题：性格特征问题
  - 每题4个选项，单选
- ✅ 后端估值算法
  - 基于答案的分值计算系统
  - 4种股票类型判断：Blue Chip / Growth Stock / Concept Stock / Defensive Stock
  - 价格归一化算法（$1.00 - $9999.99）
  - 涨跌幅计算（-20.0% 到 +99.9%）
  - 等级系统（A+ 到 C-）
  - 6种特殊标签
  - K线图数据生成（30个数据点）
- ✅ AI 生成点评（OpenRouter Gemini）
  - Bloomberg 分析师风格文案
  - 8秒超时保护
  - 兜底文案降级机制
  - 模型：`google/gemini-2.0-flash-001`
- ✅ 结果页交易所大屏风格
  - 霓虹绿主题色（#c8ff00）
  - 实时K线图渲染（SVG）
  - Ticker 代号生成
  - 股票类型徽章
  - 等级展示
  - AI 点评区
- ✅ 导流到 Blink bot
  - 结果页底部导流按钮
  - 跳转到 Telegram Bot

**技术架构：**
- **前端**：纯 HTML/CSS/JavaScript（无框架）
  - Telegram Web App SDK 集成
  - Share Tech Mono 等宽字体
  - 响应式设计
  - 部署平台：Vercel
- **后端**：Node.js 18+ + Express
  - MySQL 8.0（Railway 托管）
  - grammy Bot 框架
  - 部署平台：Railway
- **安全性**：
  - Telegram initData HMAC-SHA256 验证
  - CORS 跨域配置
  - 环境变量隔离

---

### 🐛 修复

**安全漏洞：**
- 🔒 **XSS 安全漏洞修复**
  - 用户输入（username）经过严格转义
  - 防止脚本注入攻击
  - innerHTML 使用白名单过滤

**后端稳定性：**
- 🔧 **后端 JSON 解析容错**
  - 数据库 LONGTEXT 字段存储 JSON（避免 mysql2 自动解析问题）
  - 统一使用 `JSON.stringify` / `JSON.parse`
  - 解析失败时返回合理错误提示
- 🔧 **数据库连接池管理**
  - 所有连接在 finally 块中正确释放
  - 防止连接泄漏
  - 事务回滚机制

**OpenRouter 集成：**
- 🔧 **OpenRouter 输出长度限制**
  - 添加 `max_tokens: 100` 限制
  - 防止超长输出
  - 优化响应时间

**前端体验：**
- 🔧 **快速连点防抖**
  - 选项点击后 300ms 锁定
  - 防止重复选择
- 🔧 **加载状态优化**
  - 并行执行 API 调用和动画
  - 避免白屏
  - 最小加载时长保证动画完整播放

---

### 📊 数据统计

**上线数据（2026-03-19）：**
- 数据库表：2 张（users, answers）
- API 端点：3 个（/health, /api/init, /api/valuation）
- 代码行数：
  - 后端：~1200 行
  - 前端：~800 行
  - 配置文件：~300 行
- 依赖包数：
  - 后端：4 个（express, mysql2, dotenv, cors）
  - 前端：0 个（无构建依赖）

---

## [未发布] - 待迭代功能

### 计划中（v1.1）
- 答题页卡片抖动修复
- Share Tech Mono 字体渲染问题
- UI 整体视觉打磨
- 更多股票类型和题目
- 分享功能（生成图片卡片）
- 排行榜系统

详见 [task.md](./task.md) 底部的迭代计划。

---

## 版本说明

### 版本号规则
遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)：

- **主版本号（Major）**：不兼容的 API 修改
- **次版本号（Minor）**：向下兼容的功能性新增
- **修订号（Patch）**：向下兼容的问题修正

### 发布周期
- **Major Release**：重大功能更新或架构调整
- **Minor Release**：新功能上线
- **Patch Release**：Bug 修复和优化

---

**维护者：** LoveStock Team  
**项目仓库：** [GitHub](https://github.com/yourusername/lovestock)（待公开）  
**线上地址：** [https://lovestock.vercel.app](https://lovestock.vercel.app)
