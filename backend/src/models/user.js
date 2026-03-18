import pool from '../db/pool.js';

export async function getUserResult(userId) {
  const [rows] = await pool.execute(
    `SELECT
      user_id,
      username,
      first_name,
      last_name,
      ticker,
      final_price,
      change_percent,
      stock_type,
      grade,
      special_tag,
      ai_comment,
      chart_data
    FROM users
    WHERE user_id = ?`,
    [userId]
  );

  if (!rows || rows.length === 0) return null;

  const row = rows[0];
  return {
    ticker: row.ticker,
    final_price: Number(row.final_price),
    change_percent: Number(row.change_percent),
    stock_type: row.stock_type,
    grade: row.grade,
    special_tag: row.special_tag ?? null,
    ai_comment: row.ai_comment ?? null,
    chart_data: row.chart_data ? JSON.parse(row.chart_data) : []
  };
}

export async function saveUserResult(userId, telegramUser, valuation, answers) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO users (
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
        updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        telegramUser?.username ?? null,
        telegramUser?.first_name ?? null,
        telegramUser?.last_name ?? null,
        valuation.ticker,
        valuation.final_price,
        valuation.change_percent,
        valuation.stock_type,
        valuation.grade,
        valuation.special_tag ?? null,
        valuation.ai_comment ?? null,
        JSON.stringify(valuation.chart_data ?? [])
      ]
    );

    await conn.execute(
      `INSERT INTO answers (user_id, answers_data)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
        answers_data = VALUES(answers_data),
        updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(answers)]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

