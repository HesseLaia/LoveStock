import 'dotenv/config';

import cors from 'cors';
import express from 'express';

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

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`LoveStock API listening on :${port}`);
});

