import crypto from 'crypto';

export function validateTelegramInitData(initData) {
  if (!initData) return null;

  try {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return null;

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    const authDateRaw = params.get('auth_date');
    if (!authDateRaw) return null;
    const authDate = Number.parseInt(authDateRaw, 10);
    if (!Number.isFinite(authDate)) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authDate > 86400) return null;

    const userJson = params.get('user');
    if (!userJson) return null;

    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    req.telegramUser = { id: 123456789, username: 'testuser' };
    return next();
  }

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
}

