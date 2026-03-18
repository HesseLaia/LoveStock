-- backend/init.sql
-- LoveStock MySQL 初始化脚本（Railway / 本地均可执行）

CREATE DATABASE IF NOT EXISTS lovestock
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lovestock;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT PRIMARY KEY COMMENT 'Telegram user ID',
  username VARCHAR(255) NULL COMMENT 'Telegram username（可能为空）',
  first_name VARCHAR(255) NULL COMMENT 'Telegram first name',
  last_name VARCHAR(255) NULL COMMENT 'Telegram last name',

  ticker VARCHAR(10) NOT NULL COMMENT '股票代号（如 $ALEX）',
  final_price DECIMAL(10,2) NOT NULL COMMENT '最终估值',
  change_percent DECIMAL(5,1) NOT NULL COMMENT '涨跌幅',
  stock_type VARCHAR(50) NOT NULL COMMENT 'Blue Chip / Growth Stock / Concept Stock / Defensive Stock',
  grade VARCHAR(5) NOT NULL COMMENT '等级：A+ 到 C-',
  special_tag VARCHAR(100) NULL COMMENT '附加标签（如 RARE FIND）',
  ai_comment TEXT NULL COMMENT 'OpenRouter 生成的一句话点评',

  chart_data LONGTEXT NOT NULL COMMENT 'JSON 数组：30个数据点',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '首次创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',

  INDEX idx_created (created_at),
  INDEX idx_ticker (ticker)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户估值结果表（覆盖更新，不保留历史）';

CREATE TABLE IF NOT EXISTS answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT 'Telegram user ID',
  answers_data LONGTEXT NOT NULL COMMENT 'JSON.stringify(["A","B",...])，8个选项',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '答题提交时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user (user_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户答题记录表（每次覆盖更新）';

