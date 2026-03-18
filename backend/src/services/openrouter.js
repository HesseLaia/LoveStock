const OPENROUTER_CONFIG = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'google/gemini-2.0-flash-001',
  timeout: 8000,
  fallbackComment:
    'Market trajectory remains uncertain but long-term fundamentals show promise'
};

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

export async function generateComment(stockType, finalPrice, grade, specialTag) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_CONFIG.timeout);

  try {
    const prompt = buildPrompt(stockType, finalPrice, grade, specialTag);

    const response = await fetch(OPENROUTER_CONFIG.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://lovestock.vercel.app',
        'X-Title': 'LoveStock Exchange'
      },
      body: JSON.stringify({
        model: OPENROUTER_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
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
    const comment = data?.choices?.[0]?.message?.content?.trim();
    if (!comment) throw new Error('Empty response from OpenRouter');

    return comment;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error?.name === 'AbortError') {
      console.error('OpenRouter timeout after 8s');
    } else {
      console.error('OpenRouter error:', {
        timestamp: new Date().toISOString(),
        stockType,
        finalPrice,
        grade,
        specialTag,
        error: error?.message || String(error),
        fallback: 'using default comment'
      });
    }

    return OPENROUTER_CONFIG.fallbackComment;
  }
}

export { OPENROUTER_CONFIG, buildPrompt };

