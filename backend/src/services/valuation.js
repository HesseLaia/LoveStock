import { generateChartData } from './chart.js';

export const SCORE_MAP = {
  // 前5题总分范围要求：最低 -50，最高 +75
  q1: [15, 10, -5, -15],
  q2: [15, 5, -5, -10],
  q3: [10, 15, 0, -5],
  q4: [-10, 10, 5, -5],
  q5: [-10, 5, 20, () => Math.random() * 30 - 15],
  q6: [0, 0, 0, 0],
  q7: [0, 0, 0, 0],
  q8: [0, 0, 0, 0]
};

export function calculateBaseScore(answers) {
  let baseScore = 0;

  answers.forEach((answer, qIndex) => {
    const optionIndex = answer.charCodeAt(0) - 65;
    const scoreValue = SCORE_MAP[`q${qIndex + 1}`]?.[optionIndex];

    if (typeof scoreValue === 'function') baseScore += scoreValue();
    else baseScore += scoreValue ?? 0;
  });

  return baseScore;
}

const STOCK_TYPE_MAP = {
  BBB: 'Blue Chip',
  BBA: 'Blue Chip',
  BBD: 'Blue Chip',
  BAB: 'Blue Chip',

  AAA: 'Concept Stock',
  AAB: 'Concept Stock',
  AAC: 'Concept Stock',
  AAD: 'Concept Stock',
  ABA: 'Concept Stock',

  CCC: 'Defensive Stock',
  CCB: 'Defensive Stock',
  CCA: 'Defensive Stock',
  CBC: 'Defensive Stock',
  CAC: 'Defensive Stock',

  default: 'Growth Stock'
};

export function determineStockType(answers) {
  const personalityKey = `${answers[5]}${answers[6]}${answers[7]}`;
  return STOCK_TYPE_MAP[personalityKey] || STOCK_TYPE_MAP.default;
}

export function calculateFinalPrice(baseScore, stockType) {
  const MIN_PRICE = 1;
  const MAX_PRICE = 9999;

  const normalizedScore = (baseScore + 50) / 125;
  let finalPrice = MIN_PRICE + normalizedScore * (MAX_PRICE - MIN_PRICE);

  const typeMultiplier = {
    'Blue Chip': 1.2,
    'Growth Stock': 1.0,
    'Concept Stock': 0.8,
    'Defensive Stock': 1.1
  };
  finalPrice *= typeMultiplier[stockType] ?? typeMultiplier['Growth Stock'];

  const jitter = 0.85 + Math.random() * 0.3;
  finalPrice *= jitter;

  finalPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE, finalPrice));
  return Number(finalPrice.toFixed(2));
}

export function calculateChangePercent(answers) {
  let aggressiveScore = 0;

  for (let i = 0; i < 5; i++) {
    const optionIndex = answers[i].charCodeAt(0) - 65;
    const scoreValue = SCORE_MAP[`q${i + 1}`]?.[optionIndex];
    if (typeof scoreValue === 'function') aggressiveScore += scoreValue();
    else aggressiveScore += scoreValue ?? 0;
  }

  const minChange = -20.0;
  const maxChange = 99.9;
  const normalized = (aggressiveScore + 50) / 125;
  let changePercent = minChange + normalized * (maxChange - minChange);
  changePercent = Math.max(-20.0, Math.min(99.9, changePercent));

  return Number(changePercent.toFixed(1));
}

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

export function determineGrade(finalPrice) {
  return GRADE_MAP.find((g) => finalPrice >= g.min)?.grade ?? 'C-';
}

export function generateSpecialTag(answers) {
  const tags = [];

  if (answers[0] === 'D') tags.push('RARE FIND');
  if (answers[1] === 'A') tags.push('HIGH LIQUIDITY');
  if (answers[1] === 'D') tags.push('LONG-TERM VALUE');
  if (answers[2] === 'C') tags.push('ASYMMETRIC INFO');
  if (answers[3] === 'D') tags.push('MYSTERY PREMIUM');
  if (answers[4] === 'D') tags.push('PRE-IPO ASSET');

  return tags.length > 0 ? tags[0] : null;
}

export function generateTicker(username) {
  if (!username) return '$USER';

  const cleaned = username.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const ticker = cleaned.slice(0, 4) || 'USER';
  return `$${ticker}`;
}

export function calculateValuation(answers, username) {
  const baseScore = calculateBaseScore(answers);
  const stockType = determineStockType(answers);
  const finalPrice = calculateFinalPrice(baseScore, stockType);
  const changePercent = calculateChangePercent(answers);
  const grade = determineGrade(finalPrice);
  const specialTag = generateSpecialTag(answers);
  const chartData = generateChartData(stockType);
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

