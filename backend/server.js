import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './src/services/validator.js';
import { generateComment } from './src/services/openrouter.js';
import { calculateValuation } from './src/services/valuation.js';
import { getUserResult, saveUserResult } from './src/models/user.js';

const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'OPENROUTER_API_KEY',
  'BOT_TOKEN'
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

console.log('Environment variables loaded successfully');

const app = express();

const allowedOrigins = [
  'https://lovestock.vercel.app',
  'https://prismatic-puppy-8167f6.netlify.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data'],
    methods: ['GET', 'POST', 'OPTIONS']
  })
);

app.use(express.json({ limit: '100kb' }));

const valuationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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
      error: 'DB_ERROR',
      message: 'Failed to initialize'
    });
  }
});

app.post('/api/valuation', valuationRateLimiter, authMiddleware, async (req, res) => {
  try {
    const { answers } = req.body ?? {};

    if (!Array.isArray(answers) || answers.length !== 8) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ANSWERS',
        message: 'Answers must be an array of 8 valid options (A/B/C/D)'
      });
    }

    const validOptions = new Set(['A', 'B', 'C', 'D']);
    if (!answers.every((a) => validOptions.has(a))) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ANSWERS',
        message: 'Answers must be an array of 8 valid options (A/B/C/D)'
      });
    }

    const userId = req.telegramUser.id;
    const usernameForTicker =
      req.telegramUser.username || req.telegramUser.first_name || 'USER';

    const valuation = calculateValuation(answers, usernameForTicker);
    const aiComment = await generateComment(
      valuation.stock_type,
      valuation.final_price,
      valuation.grade,
      valuation.special_tag
    );
    valuation.ai_comment = aiComment;

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

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`LoveStock API listening on :${port}`);
});

